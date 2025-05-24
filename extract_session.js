const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { Api } = require('telegram/tl');
const input = require('input');
require('dotenv').config();

// 터미널에서 직접 세션 추출하는 스크립트
async function extractSession() {
    console.log('='.repeat(50));
    console.log('텔레그램 세션 추출 도구');
    console.log('='.repeat(50));
    
    const apiId = parseInt(process.env.TELEGRAM_API_ID);
    const apiHash = process.env.TELEGRAM_API_HASH;
    
    if (!apiId || !apiHash) {
        console.error('❌ .env 파일에서 TELEGRAM_API_ID와 TELEGRAM_API_HASH를 확인해주세요.');
        process.exit(1);
    }
    
    console.log('✅ API 정보 확인 완료');
    console.log(`API ID: ${apiId}`);
    console.log(`API Hash: ${apiHash.substring(0, 8)}...`);
    console.log('');
    
    const stringSession = new StringSession('');
    const client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
    });
    
    try {
        console.log('📡 텔레그램 서버에 연결 중...');
        await client.connect();
        console.log('✅ 연결 성공');
        
        // 전화번호 입력
        const phoneNumber = await input.text('📱 전화번호를 입력하세요 (예: +821012345678): ');
        console.log(`입력된 전화번호: ${phoneNumber}`);
        
        let phoneCodeHash;
        let code;
        let loginSuccessful = false;
        
        // 인증 코드 요청 및 재시도 루프
        while (!loginSuccessful) {
            try {
                // 인증 코드 요청
                console.log('📲 새로운 인증 코드 요청 중...');
                const codeResult = await client.sendCode({
                    apiId: apiId,
                    apiHash: apiHash,
                }, phoneNumber);
                
                phoneCodeHash = codeResult.phoneCodeHash;
                console.log('✅ 새로운 인증 코드가 텔레그램으로 전송되었습니다.');
                
                // 인증 코드 입력
                code = await input.text('🔢 받은 인증 코드를 입력하세요: ');
                
                try {
                    // 첫 번째 로그인 시도
                    console.log('🔐 인증 코드로 로그인 시도 중...');
                    const user = await client.invoke(
                        new Api.auth.SignIn({
                            phoneNumber: phoneNumber,
                            phoneCodeHash: phoneCodeHash,
                            phoneCode: code
                        })
                    );
                    
                    console.log('✅ 로그인 성공!');
                    console.log(`사용자: ${user.user.firstName} ${user.user.lastName || ''}`);
                    loginSuccessful = true;
                    
                } catch (error) {
                    if (error.message.includes('SESSION_PASSWORD_NEEDED')) {
                        console.log('🔒 2단계 인증이 설정되어 있습니다.');
                        const password = await input.text('🔑 2단계 인증 비밀번호를 입력하세요: ');
                        
                        console.log('🔐 2단계 인증 진행 중...');
                        
                        // 간단한 방법부터 시도
                        let passwordSuccess = false;
                        
                        try {
                            // 방법 1: 가장 간단한 start 방법 (새로운 세션)
                            console.log('방법 1: client.start() 사용...');
                            
                            // 새로운 클라이언트 인스턴스로 start 시도
                            const newSession = new StringSession('');
                            const newClient = new TelegramClient(newSession, apiId, apiHash, {
                                connectionRetries: 5,
                            });
                            
                            await newClient.connect();
                            
                            await newClient.start({
                                phoneNumber: () => phoneNumber,
                                password: () => password,
                                phoneCode: async () => {
                                    console.log('새로운 인증 코드가 필요합니다...');
                                    const newCodeResult = await newClient.sendCode({
                                        apiId: apiId,
                                        apiHash: apiHash,
                                    }, phoneNumber);
                                    const newCode = await input.text('🔢 새로운 인증 코드를 입력하세요: ');
                                    return newCode;
                                },
                                onError: (err) => {
                                    console.log('Start 진행 중 메시지:', err.message);
                                }
                            });
                            
                            console.log('✅ 2단계 인증 성공 (새로운 세션)');
                            
                            // 기존 클라이언트를 새 클라이언트로 교체
                            await client.disconnect();
                            client.session = newClient.session;
                            await client.connect();
                            
                            passwordSuccess = true;
                            loginSuccessful = true;
                            
                        } catch (startError) {
                            console.log('⚠️ 방법 1 실패:', startError.message);
                            
                            try {
                                // 방법 2: 직접 checkPassword 시도 (더 간단한 방법)
                                console.log('방법 2: 직접 인증 시도...');
                                
                                const result = await client.invoke(
                                    new Api.auth.CheckPassword({
                                        password: new Api.InputCheckPasswordEmpty()
                                    })
                                );
                                
                                console.log('✅ 2단계 인증 성공 (빈 비밀번호)');
                                passwordSuccess = true;
                                loginSuccessful = true;
                                
                            } catch (emptyPasswordError) {
                                console.log('⚠️ 방법 2 실패:', emptyPasswordError.message);
                                
                                // 방법 3: 텔레그램 웹 방식 제안
                                console.log('');
                                console.log('🔧 자동 2단계 인증이 실패했습니다.');
                                console.log('');
                                console.log('💡 해결 방법:');
                                console.log('1. 텔레그램 앱에서 2단계 인증을 일시적으로 비활성화');
                                console.log('2. 또는 텔레그램 웹(web.telegram.org)에서 로그인 후 세션 복사');
                                console.log('3. 스크립트를 다시 실행해보세요');
                                console.log('');
                                
                                const retry = await input.text('다시 시도하시겠습니까? (y/n): ');
                                if (retry.toLowerCase() !== 'y') {
                                    process.exit(1);
                                }
                                
                                break; // 내부 루프 종료, 외부 루프에서 재시도
                            }
                        }
                    } else if (error.message.includes('PHONE_CODE_INVALID') || error.message.includes('PHONE_CODE_EXPIRED')) {
                        console.log('⚠️ 인증 코드가 만료되었거나 잘못되었습니다. 새로운 코드를 요청합니다...');
                        break; // 외부 루프에서 새로운 코드 요청
                    } else {
                        throw error;
                    }
                }
            } catch (outerError) {
                if (outerError.message.includes('PHONE_NUMBER_INVALID')) {
                    console.error('❌ 잘못된 전화번호입니다. +국가코드를 포함해서 입력해주세요. (예: +821012345678)');
                    process.exit(1);
                } else if (outerError.message.includes('FLOOD_WAIT')) {
                    const waitTime = outerError.message.match(/(\d+)/)?.[1] || '60';
                    console.log(`⏰ 요청 제한이 걸렸습니다. ${waitTime}초 후에 다시 시도해주세요.`);
                    process.exit(1);
                } else {
                    console.error('❌ 예상치 못한 오류:', outerError.message);
                    const retry = await input.text('다시 시도하시겠습니까? (y/n): ');
                    if (retry.toLowerCase() !== 'y') {
                        process.exit(1);
                    }
                }
            }
        }
        
        // 세션 문자열 추출
        const sessionString = client.session.save();
        
        if (!sessionString || sessionString.length < 50) {
            console.error('❌ 세션 문자열 생성에 실패했습니다.');
            process.exit(1);
        }
        
        console.log('');
        console.log('🎉 세션 추출 완료!');
        console.log('='.repeat(80));
        console.log('📋 세션 문자열 (복사해서 웹사이트에 붙여넣으세요):');
        console.log('');
        console.log(sessionString);
        console.log('');
        console.log('='.repeat(80));
        console.log('');
        console.log('💡 사용법:');
        console.log('1. 위의 세션 문자열을 복사하세요');
        console.log('2. 웹 브라우저에서 http://localhost:3000 으로 이동하세요');
        console.log('3. "세션으로 연결" 버튼을 클릭하고 붙여넣으세요');
        console.log('4. 이 세션은 몇 개월간 유효합니다');
        console.log('');
        
        // 사용자 정보 확인
        try {
            const me = await client.getMe();
            console.log(`✅ 세션 검증 완료: ${me.firstName} ${me.lastName || ''} (@${me.username || 'N/A'})`);
            
            if (me.phone) {
                console.log(`📱 연결된 전화번호: ${me.phone}`);
            }
        } catch (e) {
            console.log('⚠️ 세션 검증 실패, 하지만 세션 문자열은 사용 가능할 수 있습니다.');
        }
        
    } catch (error) {
        console.error('❌ 치명적 오류 발생:', error.message);
        console.log('');
        console.log('💡 문제 해결 방법:');
        console.log('1. 인터넷 연결을 확인하세요');
        console.log('2. .env 파일의 API ID와 API Hash가 올바른지 확인하세요');
        console.log('3. 텔레그램 앱에서 다른 기기 세션을 확인해보세요');
        console.log('4. 잠시 후 다시 시도해보세요');
        
    } finally {
        try {
            await client.disconnect();
            console.log('');
            console.log('🔌 연결 종료');
        } catch (e) {
            // 연결 종료 오류는 무시
        }
        process.exit(0);
    }
}

// 스크립트 실행
console.log('🚀 텔레그램 세션 추출을 시작합니다...');
console.log('');
console.log('💡 팁: 인증 코드가 만료되면 자동으로 새로운 코드를 요청합니다.');
console.log('');
extractSession().catch(error => {
    console.error('스크립트 실행 중 오류:', error);
    process.exit(1);
}); 