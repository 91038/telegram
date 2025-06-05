const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { NewMessage } = require('telegram/events');
const { Api } = require('telegram');
const configManager = require('../utils/configManager');
const phoneExtractor = require('../utils/phoneExtractor');

class WebTelegramService {
    constructor() {
        this.apiId = parseInt(configManager.get('TELEGRAM_API_ID'));
        this.apiHash = configManager.get('TELEGRAM_API_HASH');
        this.client = null;
        this.isConnected = false;
        this.isInitializing = false;
        this.isMonitoring = false;
        this.passwordSrpResult = null; // 2단계 인증용
        this.loginState = {
            phoneNumber: null,
            phoneCodeHash: null,
            isWaitingForCode: false,
            isWaitingForPassword: false
        };
    }

    async initialize() {
        try {
            if (this.isInitializing) {
                console.log('이미 초기화 중입니다. 대기 중...');
                return { success: true, needsLogin: false, message: '초기화 중입니다.' };
            }

            if (this.isConnected && this.client) {
                console.log('이미 연결되어 있습니다.');
                try {
                    const isAuthorized = await this.client.checkAuthorization();
                    if (isAuthorized) {
                        return { success: true, needsLogin: false };
                    } else {
                        this.isConnected = false;
                        console.log('세션이 만료되었습니다. 재로그인이 필요합니다.');
                    }
                } catch (error) {
                    console.log('세션 확인 중 오류:', error.message);
                    this.isConnected = false;
                }
            }

            this.isInitializing = true;
            console.log('웹 텔레그램 서비스 초기화 중...');
            
            const sessionString = configManager.get('TELEGRAM_SESSION_STRING');
            const session = new StringSession(sessionString);
            
            if (this.client) {
                try {
                    await this.client.disconnect();
                } catch (error) {
                    console.log('기존 클라이언트 연결 해제 중 오류 (무시):', error.message);
                }
            }

            this.client = new TelegramClient(session, this.apiId, this.apiHash, {
                connectionRetries: 5,
            });

            await this.client.connect();
            console.log('텔레그램 서버 연결 성공');

            const isAuthorized = await this.client.checkAuthorization();
            if (isAuthorized) {
                this.isConnected = true;
                console.log('세션으로 자동 로그인 성공');
                return { success: true, needsLogin: false };
            } else {
                console.log('로그인이 필요합니다.');
                return { success: true, needsLogin: true };
            }
        } catch (error) {
            console.error('텔레그램 서비스 초기화 실패:', error);
            return { success: false, error: error.message };
        } finally {
            this.isInitializing = false;
        }
    }

    async sendCode(phoneNumber) {
        try {
            if (!this.client) {
                throw new Error('텔레그램 클라이언트가 초기화되지 않았습니다.');
            }

            console.log(`전화번호 ${phoneNumber}로 인증 코드 요청 중...`);
            
            const result = await this.client.invoke(
                new Api.auth.SendCode({
                    phoneNumber: phoneNumber,
                    apiId: this.apiId,
                    apiHash: this.apiHash,
                    settings: new Api.CodeSettings({
                        allowFlashcall: false,
                        currentNumber: false,
                        allowAppHash: false,
                        allowMissedCall: false,
                        logoutTokens: []
                    })
                })
            );

            this.loginState = {
                phoneNumber: phoneNumber,
                phoneCodeHash: result.phoneCodeHash,
                isWaitingForCode: true,
                isWaitingForPassword: false
            };

            console.log('인증 코드 발송 성공');
            return {
                success: true,
                message: '인증 코드가 발송되었습니다.',
                phoneCodeHash: result.phoneCodeHash
            };
        } catch (error) {
            console.error('인증 코드 발송 실패:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async verifyCode(phoneNumber, code) {
        try {
            if (!this.loginState.isWaitingForCode || this.loginState.phoneNumber !== phoneNumber) {
                throw new Error('인증 코드 요청이 필요합니다.');
            }

            console.log('인증 코드 검증 중...');

            try {
                const result = await this.client.invoke(
                    new Api.auth.SignIn({
                        phoneNumber: phoneNumber,
                        phoneCodeHash: this.loginState.phoneCodeHash,
                        phoneCode: code
                    })
                );

                const sessionString = this.client.session.save();
                configManager.set('TELEGRAM_SESSION_STRING', sessionString);
                
                this.isConnected = true;
                this.loginState = {
                    phoneNumber: null,
                    phoneCodeHash: null,
                    isWaitingForCode: false,
                    isWaitingForPassword: false
                };

                console.log('텔레그램 로그인 성공');
                return {
                    success: true,
                    message: '로그인 성공',
                    sessionString: sessionString
                };

            } catch (error) {
                if (error.message.includes('SESSION_PASSWORD_NEEDED')) {
                    console.log('2단계 인증이 필요합니다.');
                    try {
                        this.passwordSrpResult = await this.client.invoke(new Api.account.GetPassword());
                        this.loginState.isWaitingForPassword = true;
                        this.loginState.isWaitingForCode = false;
                        
                        return {
                            success: false,
                            needsPassword: true,
                            message: '2단계 인증 비밀번호가 필요합니다.'
                        };
                    } catch (passwordError) {
                        throw new Error('2단계 인증 정보를 가져올 수 없습니다.');
                    }
                } else {
                    throw error;
                }
            }
        } catch (error) {
            console.error('인증 코드 검증 실패:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async verifyPassword(phoneNumber, code, password) {
        try {
            if (!this.loginState.isWaitingForPassword || this.loginState.phoneNumber !== phoneNumber) {
                throw new Error('2단계 인증 상태가 아닙니다.');
            }

            console.log('2단계 인증 비밀번호 검증 중...');

            let passwordCheck;
            
            try {
                passwordCheck = await this.client.computeCheck(this.passwordSrpResult, password);
            } catch (error1) {
                console.log('방법 1 실패, 방법 2 시도 중...');
                try {
                    const { computeCheck } = require('telegram/Password');
                    passwordCheck = await computeCheck(this.passwordSrpResult, password);
                } catch (error2) {
                    console.log('방법 2 실패, 방법 3 시도 중...');
                    passwordCheck = new Api.InputCheckPasswordSRP({
                        srpId: this.passwordSrpResult.srpId,
                        a: Buffer.from('test'),
                        m1: Buffer.from('test')
                    });
                }
            }
            
            const result = await this.client.invoke(
                new Api.auth.CheckPassword({
                    password: passwordCheck
                })
            );

            const sessionString = this.client.session.save();
            configManager.set('TELEGRAM_SESSION_STRING', sessionString);
            
            this.isConnected = true;
            this.loginState = {
                phoneNumber: null,
                phoneCodeHash: null,
                isWaitingForCode: false,
                isWaitingForPassword: false
            };

            console.log('2단계 인증 로그인 성공');
            return {
                success: true,
                message: '로그인 성공',
                sessionString: sessionString
            };

        } catch (error) {
            console.error('2단계 인증 실패:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async findChatByIdOrUsername(chatIdOrUsername) {
        try {
            if (!this.isConnected) {
                throw new Error('텔레그램에 로그인되지 않았습니다.');
            }

            // 세션 상태 먼저 확인
            try {
                const isAuthorized = await this.client.checkAuthorization();
                if (!isAuthorized) {
                    this.isConnected = false;
                    throw new Error('세션이 만료되었습니다. 다시 로그인해주세요.');
                }
            } catch (error) {
                if (error.message.includes('SESSION_REVOKED') || error.message.includes('401')) {
                    this.isConnected = false;
                    throw new Error('세션이 취소되었습니다. 다시 로그인해주세요.');
                }
                throw error;
            }

            if (/^-?\d+$/.test(chatIdOrUsername)) {
                console.log(`채팅방 ID로 검색: ${chatIdOrUsername}`);
                const chatId = chatIdOrUsername.toString();
                
                try {
                    // 먼저 모든 대화 목록 가져오기
                    const dialogs = await this.client.getDialogs({ limit: 100 });
                    
                    // 대화 목록에서 해당 ID 찾기
                    for (const dialog of dialogs) {
                        const entity = dialog.entity;
                        if (!entity) continue;
                        
                        let entityId;
                        if (entity.id) {
                            entityId = entity.id.toString();
                        } else if (entity.chatId) {
                            entityId = entity.chatId.toString();
                        } else if (entity.channelId) {
                            entityId = entity.channelId.toString();
                        }
                        
                        // 그룹의 경우 음수 ID 처리
                        if (entity.chatId && chatId.startsWith('-')) {
                            const groupId = '-' + entity.chatId.toString();
                            if (groupId === chatId) {
                                const title = entity.title || '알 수 없는 그룹';
                                console.log(`그룹 채팅방 찾음: ${title} (ID: ${chatId})`);
                                return {
                                    success: true,
                                    chatId: chatId,
                                    title: title,
                                    type: 'group'
                                };
                            }
                        }
                        
                        // 채널의 경우 슈퍼그룹 ID 처리
                        if (entity.id && entity.className === 'Channel') {
                            const channelId = '-100' + entity.id.toString();
                            if (channelId === chatId || entity.id.toString() === chatId) {
                                const title = entity.title || '알 수 없는 채널';
                                console.log(`채널/슈퍼그룹 찾음: ${title} (ID: ${chatId})`);
                                return {
                                    success: true,
                                    chatId: chatId,
                                    title: title,
                                    type: 'channel'
                                };
                            }
                        }
                        
                        // 일반 사용자의 경우
                        if (entityId === chatId || entityId === chatId.replace('-', '')) {
                            const title = entity.title || entity.firstName || entity.username || '알 수 없음';
                            console.log(`사용자 찾음: ${title} (ID: ${chatId})`);
                            return {
                                success: true,
                                chatId: chatId,
                                title: title,
                                type: 'user'
                            };
                        }
                    }
                    
                    console.log(`대화 목록에서 ID ${chatId}를 찾을 수 없습니다. ID를 그대로 사용합니다.`);
                    
                } catch (dialogError) {
                    console.log('대화 목록 검색 실패, 직접 엔티티 검색 시도:', dialogError.message);
                    
                    try {
                        // 마지막 시도: 직접 엔티티 가져오기
                        const entity = await this.client.getEntity(parseInt(chatIdOrUsername));
                        if (entity) {
                            const title = entity.title || entity.firstName || entity.username || `채팅방 ID: ${chatIdOrUsername}`;
                            console.log(`직접 검색으로 채팅방 찾음: ${title} (ID: ${chatId})`);
                            return {
                                success: true,
                                chatId: chatId,
                                title: title,
                                type: 'direct'
                            };
                        }
                    } catch (entityError) {
                        console.log('직접 엔티티 검색도 실패:', entityError.message);
                    }
                }
                
                // 모든 방법이 실패한 경우 ID를 그대로 사용
                console.log(`채팅방을 찾을 수 없어 ID를 그대로 사용합니다: ${chatId}`);
                return {
                    success: true,
                    chatId: chatId,
                    title: `채팅방 ID: ${chatId}`,
                    type: 'unknown'
                };
            }

            console.log(`사용자명으로 검색: ${chatIdOrUsername}`);
            const username = chatIdOrUsername.startsWith('@') ? chatIdOrUsername.slice(1) : chatIdOrUsername;
            
            const entity = await this.client.getEntity(username);
            
            if (entity) {
                const chatId = entity.id.toString();
                const title = entity.title || entity.firstName || entity.username || '알 수 없음';
                
                console.log(`사용자명으로 채팅방 찾음: ${title} (ID: ${chatId})`);
                return {
                    success: true,
                    chatId: chatId,
                    title: title,
                    type: 'username'
                };
            } else {
                throw new Error('채팅방을 찾을 수 없습니다.');
            }
        } catch (error) {
            console.error('채팅방 검색 실패:', error);
            
            // SESSION_REVOKED 오류인 경우 특별 처리
            if (error.message.includes('SESSION_REVOKED') || error.message.includes('401')) {
                this.isConnected = false;
                return {
                    success: false,
                    error: '세션이 만료되었습니다. 웹 페이지에서 다시 로그인해주세요.',
                    needsRelogin: true
                };
            }
            
            return {
                success: false,
                error: error.message
            };
        }
    }

    async startMonitoring(chatIdOrUsername, messageTemplates) {
        try {
            if (!this.isConnected) {
                throw new Error('텔레그램에 로그인되지 않았습니다.');
            }

            if (this.isMonitoring) {
                return {
                    success: false,
                    error: '이미 모니터링 중입니다.'
                };
            }

            const chatResult = await this.findChatByIdOrUsername(chatIdOrUsername);
            if (!chatResult.success) {
                // SESSION_REVOKED 오류인 경우 특별 처리
                if (chatResult.needsRelogin) {
                    this.isConnected = false;
                    return {
                        success: false,
                        error: '세션이 만료되었습니다. 웹 페이지를 새로고침하고 다시 로그인해주세요.',
                        needsRelogin: true
                    };
                }
                return chatResult;
            }

            const chatId = chatResult.chatId;
            console.log(`채팅방 ${chatResult.title} (${chatId}) 모니터링 시작...`);
            console.log(`채팅방 타입: ${chatResult.type || '알 수 없음'}`);
            console.log(`메시지 템플릿 ${messageTemplates.length}개 준비됨`);

            this.isMonitoring = true;

            this.client.addEventHandler(async (event) => {
                try {
                    const message = event.message;
                    if (!message || !message.message) return;

                    // 메시지의 채팅방 ID 확인 로직 개선
                    let messageChatId;
                    if (message.peerId) {
                        if (message.peerId.chatId) {
                            // 일반 그룹 채팅방
                            messageChatId = '-' + message.peerId.chatId.toString();
                        } else if (message.peerId.channelId) {
                            // 슈퍼그룹 또는 채널
                            messageChatId = '-100' + message.peerId.channelId.toString();
                        } else if (message.peerId.userId) {
                            // 개인 채팅
                            messageChatId = message.peerId.userId.toString();
                        }
                    } else if (message.chatId) {
                        messageChatId = message.chatId.toString();
                    }

                    // 채팅방 ID 매칭 확인 (다양한 형태 고려)
                    const targetChatId = chatId.toString();
                    let isTargetChat = false;
                    
                    if (messageChatId) {
                        isTargetChat = messageChatId === targetChatId || 
                                      messageChatId === targetChatId.replace('-', '') ||
                                      messageChatId.replace('-', '') === targetChatId.replace('-', '') ||
                                      messageChatId.replace('-100', '') === targetChatId.replace('-100', '') ||
                                      messageChatId.replace('-', '') === targetChatId.replace('-100', '');
                    }

                    if (!isTargetChat) {
                        // 디버깅용 로그
                        console.log(`메시지 채팅방 ID: ${messageChatId}, 대상 채팅방 ID: ${targetChatId} - 일치하지 않음`);
                        return;
                    }

                    console.log(`새 메시지 수신 (${messageChatId}): ${message.message}`);

                    // 새로운 전화번호 추출기 사용
                    const analysisResult = phoneExtractor.analyzeMessage(message.message);
                    const phoneNumbers = analysisResult.phoneNumbers;

                    console.log(`전화번호 분석 결과:`, {
                        발견된_번호_개수: analysisResult.count,
                        추출된_번호들: phoneNumbers,
                        포맷된_번호들: analysisResult.formattedNumbers
                    });

                    if (phoneNumbers && phoneNumbers.length > 0) {
                        console.log(`전화번호 발견: ${phoneNumbers.join(', ')}`);

                        const smsService = require('./smsService');

                        for (const phoneNumber of phoneNumbers) {
                            // 전화번호는 이미 정리된 상태
                            const cleanNumber = phoneNumber;
                            
                            console.log(`${cleanNumber}로 메시지 발송 시작...`);
                            
                            for (let i = 0; i < messageTemplates.length; i++) {
                                const template = messageTemplates[i];
                                if (template && template.trim()) {
                                    console.log(`메시지 ${i + 1} 발송 중: ${template.substring(0, 20)}...`);
                                    
                                    const result = await smsService.sendSMS(cleanNumber, template);
                                    
                                    if (result.success) {
                                        console.log(`✅ 메시지 ${i + 1} 발송 성공: ${result.messageId}`);
                                    } else {
                                        console.log(`❌ 메시지 ${i + 1} 발송 실패: ${result.error}`);
                                    }
                                    
                                    // SMS API 제한으로 인해 12초 대기 (10초 제한 + 여유시간)
                                    if (i < messageTemplates.length - 1) { // 마지막 메시지가 아닌 경우에만 대기
                                        console.log(`다음 메시지 발송을 위해 12초 대기 중...`);
                                        await new Promise(resolve => setTimeout(resolve, 12000));
                                    }
                                }
                            }
                            
                            console.log(`${cleanNumber}로 모든 메시지 발송 완료`);
                        }
                    }
                } catch (error) {
                    console.error('메시지 처리 중 오류:', error);
                }
            }, new NewMessage({}));

            console.log('메시지 모니터링이 시작되었습니다.');
            return {
                success: true,
                message: `${chatResult.title} 모니터링 시작됨 (타입: ${chatResult.type || '알 수 없음'})`,
                chatInfo: chatResult
            };
        } catch (error) {
            this.isMonitoring = false;
            console.error('모니터링 시작 실패:', error);
            
            // SESSION_REVOKED 오류인 경우 특별 처리
            if (error.message.includes('SESSION_REVOKED') || error.message.includes('401')) {
                this.isConnected = false;
                return {
                    success: false,
                    error: '세션이 만료되었습니다. 웹 페이지를 새로고침하고 다시 로그인해주세요.',
                    needsRelogin: true
                };
            }
            
            return {
                success: false,
                error: error.message
            };
        }
    }

    stopMonitoring() {
        if (this.isMonitoring) {
            this.isMonitoring = false;
            console.log('모니터링이 중지되었습니다.');
            return { success: true, message: '모니터링이 중지되었습니다.' };
        } else {
            return { success: false, error: '모니터링이 실행 중이 아닙니다.' };
        }
    }

    getLoginState() {
        return {
            isConnected: this.isConnected,
            isWaitingForCode: this.loginState.isWaitingForCode,
            isWaitingForPassword: this.loginState.isWaitingForPassword,
            phoneNumber: this.loginState.phoneNumber,
            isMonitoring: this.isMonitoring
        };
    }

    async disconnect() {
        if (this.client) {
            await this.client.disconnect();
            this.isConnected = false;
            console.log('텔레그램 클라이언트 연결 해제됨');
        }
    }
}

module.exports = new WebTelegramService(); 