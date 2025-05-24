const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { NewMessage } = require('telegram/events');
const input = require('input');
const dotenv = require('dotenv');
const configManager = require('../utils/configManager');
const smsService = require('./smsService');

dotenv.config();

class TelegramClientService {
  constructor() {
    this.apiId = parseInt(configManager.get('TELEGRAM_API_ID'));
    this.apiHash = configManager.get('TELEGRAM_API_HASH');
    this.sessionString = configManager.get('TELEGRAM_SESSION_STRING') || '';
    this.client = null;
    this.isConnected = false;
    this.currentTemplate = configManager.get('DEFAULT_TEMPLATE') || 'template1';
    this.isRunning = false;
    this.targetChats = [];
    this._isListening = false;
    this.passwordSrpResult = null; // 2단계 인증을 위한 SRP 결과 저장
  }

  async initialize() {
    try {
      console.log('텔레그램 클라이언트 초기화 중...');
      console.log(`API ID: ${this.apiId}`);
      console.log(`API Hash: ${this.apiHash ? this.apiHash.substring(0, 10) + '...' : '없음'}`);
      console.log(`세션 문자열: ${this.sessionString ? '있음' : '없음'}`);

      // 세션 문자열이 있으면 사용, 없으면 빈 세션으로 시작
      const session = new StringSession(this.sessionString);
      
      this.client = new TelegramClient(session, this.apiId, this.apiHash, {
        connectionRetries: 5,
      });

      console.log('텔레그램 서버에 연결 중...');
      await this.client.connect();
      console.log('텔레그램 서버 연결 성공');

      // 로그인 상태 확인
      const isAuthorized = await this.client.checkAuthorization();
      console.log('로그인 상태:', isAuthorized ? '로그인됨' : '로그인 필요');

      if (!isAuthorized) {
        console.log('로그인이 필요합니다. 로그인을 시작합니다...');
        await this.login();
      } else {
        console.log('이미 로그인되어 있습니다.');
        this.isConnected = true;
      }

      return true;
    } catch (error) {
      console.error('텔레그램 클라이언트 초기화 실패:', error);
      throw error;
    }
  }

  async login() {
    try {
      console.log('\n=== 텔레그램 로그인 ===');
      
      // 1단계: 전화번호 입력
      const phoneNumber = await input.text('전화번호를 입력하세요 (예: +821012345678): ');
      console.log(`전화번호 ${phoneNumber}로 인증 코드 요청 중...`);
      
      // 텔레그램 클라이언트의 sendCode 메서드 사용
      await this.client.sendCode(
        {
          apiId: this.apiId,
          apiHash: this.apiHash
        },
        phoneNumber
      );
      
      console.log('인증 코드가 발송되었습니다.');
      
      // 2단계: 인증 코드 입력
      const code = await input.text('받은 인증 코드를 입력하세요: ');
      
      try {
        // 인증 코드로 로그인 시도
        await this.client.signInUser(
          {
            apiId: this.apiId,
            apiHash: this.apiHash
          },
          {
            phoneNumber: phoneNumber,
            phoneCode: () => Promise.resolve(code)
          }
        );
        
        console.log('로그인 성공!');
        
      } catch (error) {
        if (error.message.includes('SESSION_PASSWORD_NEEDED')) {
          console.log('2단계 인증이 필요합니다.');
          const password = await input.text('2단계 인증 비밀번호를 입력하세요: ');
          
          // 2단계 인증으로 로그인
          await this.client.signInUser(
            {
              apiId: this.apiId,
              apiHash: this.apiHash
            },
            {
              phoneNumber: phoneNumber,
              phoneCode: () => Promise.resolve(code),
              password: () => Promise.resolve(password)
            }
          );
          
          console.log('2단계 인증 성공!');
        } else {
          throw error;
        }
      }
      
      // 세션 문자열 저장
      const sessionString = this.client.session.save();
      console.log('\n세션 문자열이 생성되었습니다:');
      console.log(sessionString);
      
      // .env 파일에 세션 문자열 저장 (실제로는 파일 시스템에 저장해야 함)
      console.log('\n이 세션 문자열을 .env 파일의 TELEGRAM_SESSION_STRING에 저장하세요.');
      
      this.isConnected = true;
      return true;
      
    } catch (error) {
      console.error('로그인 실패:', error);
      throw error;
    }
  }

  async startMonitoring(chatId, messageTemplates) {
    if (!this.isConnected) {
      throw new Error('텔레그램 클라이언트가 연결되지 않았습니다.');
    }

    console.log(`채팅방 ${chatId} 모니터링 시작...`);
    console.log(`메시지 템플릿 ${messageTemplates.length}개 준비됨`);

    // 새 메시지 이벤트 리스너
    this.client.addEventHandler(async (event) => {
      try {
        const message = event.message;
        if (!message || !message.message) return;

        // 지정된 채팅방의 메시지만 처리
        const messageChat = message.chatId || message.peerId?.chatId;
        if (messageChat?.toString() !== chatId.toString()) return;

        console.log(`새 메시지 수신: ${message.message}`);

        // 전화번호 패턴 검색 (한국 휴대폰 번호)
        const phonePattern = /010[-\s]?\d{4}[-\s]?\d{4}/g;
        const phoneNumbers = message.message.match(phonePattern);

        if (phoneNumbers && phoneNumbers.length > 0) {
          console.log(`전화번호 발견: ${phoneNumbers.join(', ')}`);

          // 각 전화번호에 대해 모든 메시지 템플릿 발송
          for (const phoneNumber of phoneNumbers) {
            const cleanNumber = phoneNumber.replace(/[-\s]/g, '');
            
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
                
                // 메시지 간 1초 대기
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }
            
            console.log(`${cleanNumber}로 모든 메시지 발송 완료`);
          }
        }
      } catch (error) {
        console.error('메시지 처리 중 오류:', error);
      }
    }, new NewMessage({}));

    console.log('메시지 모니터링이 시작되었습니다. 전화번호가 포함된 메시지를 기다리는 중...');
  }

  async disconnect() {
    if (this.client) {
      await this.client.disconnect();
      this.isConnected = false;
      console.log('텔레그램 클라이언트 연결 해제됨');
    }
  }

  getStatus() {
    return {
      isConnected: this.isConnected,
      hasSession: !!this.sessionString,
      phoneNumber: this.phoneNumber
    };
  }

  async addTargetChat(chatIdentifier) {
    try {
      // 채팅방 ID 또는 사용자명으로 대화 검색
      const entity = await this.client.getEntity(chatIdentifier);
      this.targetChats.push(entity.id.toString());
      console.log(`대상 채팅방 추가됨: ${chatIdentifier} (ID: ${entity.id})`);
      return true;
    } catch (error) {
      console.error(`채팅방 추가 실패 (${chatIdentifier}):`, error.message);
      return false;
    }
  }

  async startListening() {
    if (!this.client) {
      console.error('텔레그램 클라이언트가 초기화되지 않았습니다.');
      return false;
    }

    if (!this.isRunning) {
      console.error('텔레그램에 로그인되어 있지 않습니다.');
      return false;
    }

    // 대상 채팅방 정보 확인
    console.log('모니터링 시작 - 대상 채팅방:', this.targetChats);
    if (this.targetChats.length === 0) {
      console.warn('모니터링할 채팅방이 설정되지 않았습니다. 모든 채팅방을 모니터링합니다.');
    }

    console.log('메시지 모니터링을 시작합니다...');
    
    try {
      // 이벤트 핸들러가 이미 등록되어 있는지 확인
      if (this._isListening) {
        console.log('이미 메시지 모니터링 중입니다.');
        return true;
      }
      
      // 현재 템플릿 확인
      console.log(`현재 사용 중인 템플릿: ${this.currentTemplate}`);
      console.log(`템플릿 내용: ${configManager.get(this.currentTemplate) || '없음'}`);
      
      // 새 메시지 이벤트 리스너 등록
      console.log('새 메시지 이벤트 리스너 등록 중...');
      this.client.addEventHandler(this.handleMessage.bind(this), new NewMessage({}));
      this._isListening = true;
      
      console.log('메시지 모니터링이 성공적으로 시작되었습니다.');
      
      // 기본 템플릿 설정 (설정되지 않은 경우)
      if (!this.currentTemplate || !configManager.get(this.currentTemplate)) {
        this.currentTemplate = 'default';
        console.log(`기본 템플릿으로 설정: ${this.currentTemplate}`);
      }
      
      return true;
    } catch (error) {
      console.error('메시지 모니터링 시작 중 오류 발생:', error);
      return false;
    }
  }

  async handleMessage(event) {
    try {
      const message = event.message;
      
      // 메시지 내용 확인
      const messageText = message.text || '';
      if (!messageText) {
        console.log('텍스트가 없는 메시지 무시 (미디어 또는 다른 타입)');
        return;
      }
      
      // 채팅방 ID가 대상 목록에 있는지 확인
      const chatId = message.chatId.toString();
      
      // 채팅방 ID 출력
      console.log(`\n새 메시지 수신 - 채팅방 ID: ${chatId}`);
      console.log(`메시지 내용: ${messageText}`);
      
      // 대상 채팅방 필터링 (목록이 비어있으면 모든 채팅방 허용)
      if (this.targetChats.length > 0 && !this.targetChats.includes(chatId)) {
        console.log(`채팅방 ${chatId}은(는) 모니터링 대상이 아닙니다. 무시합니다.`);
        console.log('모니터링 대상 채팅방 목록:', this.targetChats);
        return; // 대상 채팅방이 아니면 무시
      }
      
      console.log(`[${chatId}] 메시지 수신: ${messageText}`);
      
      // 전화번호 추출 (다양한 형식 처리)
      const phoneNumbersWithHyphen = messageText.match(/01[0-9]-[0-9]{3,4}-[0-9]{4}/g) || [];
      const phoneNumbersWithoutHyphen = messageText.match(/01[0-9][0-9]{7,8}/g) || [];
      
      // 중복 제거를 위해 Set 사용
      const phoneNumberSet = new Set([
        ...phoneNumbersWithHyphen,
        ...phoneNumbersWithoutHyphen
      ]);
      
      const phoneNumbers = [...phoneNumberSet];
      console.log(`[${chatId}] 발견된 전화번호:`, phoneNumbers);
      
      if (phoneNumbers.length === 0) {
        console.log(`[${chatId}] 메시지에서 전화번호를 찾을 수 없습니다.`);
        return;
      }
      
      // 외부 메시지 핸들러가 있으면 사용
      if (this.messageHandler) {
        console.log(`[${chatId}] 외부 메시지 핸들러 호출`);
        await this.messageHandler(event, message, chatId, message.chat?.title || chatId, phoneNumbers);
        return;
      }
      
      // 기본 처리 로직 (외부 메시지 핸들러가 없을 경우)
      console.log(`[${chatId}] ${phoneNumbers.length}개의 전화번호를 발견했습니다. SMS 발송을 시작합니다.`);
      
      // 다중 메시지 설정 불러오기
      const fs = require('fs');
      const path = require('path');
      let messageSettings = {
        useMultiMessage: true,
        messageDelay: 10,
        messageTemplate1: 'default',
        messageTemplate2: '',
        messageTemplate3: ''
      };
      
      try {
        const settingsPath = path.join(__dirname, '..', 'data', 'settings.json');
        if (fs.existsSync(settingsPath)) {
          const savedSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
          messageSettings = { ...messageSettings, ...savedSettings };
        }
      } catch (e) {
        console.warn('설정 파일 로드 실패, 기본 설정 사용:', e.message);
      }
      
      console.log('다중 메시지 설정:', messageSettings);
      
      // 각 전화번호에 SMS 발송
      for (const phoneNumber of phoneNumbers) {
        // 하이픈 제거
        const cleanNumber = phoneNumber.replace(/-/g, '');
        
        if (cleanNumber.length >= 10 && cleanNumber.length <= 11) {
          console.log(`[${chatId}] ${cleanNumber}로 SMS 발송 시도 중...`);
          
          // 다중 메시지 설송인지 확인
          if (messageSettings.useMultiMessage) {
            // 다중 메시지 발송
            const templates = [
              messageSettings.messageTemplate1,
              messageSettings.messageTemplate2,
              messageSettings.messageTemplate3
            ].filter(t => t && t.trim() !== ''); // 빈 템플릿 제거
            
            console.log(`다중 메시지 발송: ${templates.length}개 템플릿 사용`);
            
            for (let i = 0; i < templates.length; i++) {
              const templateName = templates[i];
              const template = configManager.get(templateName);
              
              if (!template) {
                console.warn(`템플릿 '${templateName}'을 찾을 수 없습니다. 건너뜁니다.`);
                continue;
              }
              
              console.log(`[${chatId}] ${cleanNumber}로 ${i + 1}번째 메시지 발송: ${templateName}`);
              console.log(`템플릿 내용: ${template}`);
              
              const result = await smsService.sendSMS(cleanNumber, template);
              
              if (result.success) {
                console.log(`[${chatId}] ${cleanNumber}로 ${i + 1}번째 SMS 발송 성공`);
              } else {
                console.error(`[${chatId}] ${cleanNumber}로 ${i + 1}번째 SMS 발송 실패:`, result.error);
              }
              
              // 메시지 간 지연
              if (i < templates.length - 1) {
                console.log(`${messageSettings.messageDelay}초 대기 중...`);
                await new Promise(resolve => setTimeout(resolve, messageSettings.messageDelay * 1000));
              }
            }
          } else {
            // 단일 메시지 발송 (기존 방식)
            const templateName = messageSettings.messageTemplate1 || 'default';
            const template = configManager.get(templateName);
            
            console.log(`단일 메시지 발송: 템플릿 ${templateName}`);
            console.log(`템플릿 내용: ${template}`);
            
            const result = await smsService.sendSMS(cleanNumber, template);
            
            if (result.success) {
              console.log(`[${chatId}] ${cleanNumber}로 SMS 발송 성공`);
            } else {
              console.error(`[${chatId}] ${cleanNumber}로 SMS 발송 실패:`, result.error);
            }
          }
        } else {
          // 유효하지 않은 전화번호 메시지를 로그에만 출력 (텔레그램 회신 제거)
          console.warn(`[${chatId}] 유효하지 않은 전화번호 형식: ${phoneNumber} (${cleanNumber})`);
        }
      }
    } catch (error) {
      console.error('메시지 처리 중 오류 발생:', error);
    }
  }

  setTemplate(templateName) {
    if (configManager.get(templateName)) {
      this.currentTemplate = templateName;
      console.log(`템플릿이 "${templateName}"으로 변경되었습니다.`);
      return true;
    }
    return false;
  }

  async stop() {
    if (this.client && this.isRunning) {
      await this.client.disconnect();
      this.isRunning = false;
      console.log('텔레그램 클라이언트 연결이 종료되었습니다.');
    }
  }

  // 메시지 핸들러 설정
  setMessageHandler(handler) {
    if (typeof handler === 'function') {
      this.messageHandler = handler;
      return true;
    }
    return false;
  }

  // 웹 API 호환 메서드들
  async requestLoginCode(phoneNumber) {
    return await this.sendCode(phoneNumber);
  }

  async verifyCode(phoneNumber, phoneCodeHash, phoneCode) {
    // 저장된 정보와 일치하는지 확인
    if (this.phoneNumber !== phoneNumber || this.phoneCodeHash !== phoneCodeHash) {
      return { success: false, error: '인증 정보가 일치하지 않습니다.' };
    }
    
    const result = await this.signIn(phoneCode);
    
    if (result.success) {
      return {
        success: true,
        requiresPassword: false,
        session: result.sessionString
      };
    } else if (result.needPassword) {
      return {
        success: true,
        requiresPassword: true
      };
    } else {
      return result;
    }
  }

  async checkPassword(password) {
    const result = await this.signInWithPassword(password);
    
    if (result.success) {
      return {
        success: true,
        session: result.sessionString
      };
    } else {
      return result;
    }
  }
}

module.exports = new TelegramClientService(); 