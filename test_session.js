const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
require('dotenv').config();

async function testSession() {
    console.log('='.repeat(50));
    console.log('텔레그램 세션 검증 도구');
    console.log('='.repeat(50));
    
    const apiId = parseInt(process.env.TELEGRAM_API_ID);
    const apiHash = process.env.TELEGRAM_API_HASH;
    
    if (!apiId || !apiHash) {
        console.error('❌ .env 파일에서 TELEGRAM_API_ID와 TELEGRAM_API_HASH를 확인해주세요.');
        return;
    }
    
    // 제공된 세션 문자열
    const sessionString = "61376c811db364587b9b2ab815a1eb8d116c7c86d6fc4fa72f129272db04b2e8408b9836da6a5c6ab1cd80a4f0f4e475ff36f89c184ecf8909b93adcc103eca00c35fdbf303e6e5808b19b30f913b7c09ca96f7b6d07ee8006a552e16dc1d4d28bd8a1edd1f2aeb94f8cbad180c8d934e5524ddd6ed202935b751c71fcf33c112368e85e5f949d18d863c0df4e422a8ad4aadcf13878de8e16520bb8d939f59776fed9308d43cc219c4b13008ae37566dda8adf8eb515f77342a063e2c79ba8a7fb9d0a9c9dfbd5bb370fcc761eaf0c8383e660c929f218cbe2cb060511e66b0d5a1a0f6d4fb8f1629772499dbf63ad7ad1bb69b3fd08475777d802a93c7b0c6";
    
    console.log(`📋 테스트할 세션 문자열 길이: ${sessionString.length}자`);
    console.log(`📋 첫 50자: ${sessionString.substring(0, 50)}...`);
    console.log('');
    
    try {
        // 세션 문자열 형태 분석
        if (sessionString.match(/^[0-9a-fA-F]+$/)) {
            console.log('✅ 헥사데시멀 형태의 세션 문자열입니다.');
        } else {
            console.log('⚠️ 일반적이지 않은 형태의 세션 문자열입니다.');
        }
        
        // StringSession 생성 시도 (헥사데시멀 → base64 변환)
        let finalSessionString = sessionString;
        
        // 헥사데시멀을 base64로 변환 시도
        try {
            const hexBuffer = Buffer.from(sessionString, 'hex');
            const base64Session = hexBuffer.toString('base64');
            console.log(`🔄 Base64 변환 시도: ${base64Session.substring(0, 50)}...`);
            finalSessionString = base64Session;
        } catch (e) {
            console.log('⚠️ Base64 변환 실패, 원본 문자열 사용');
        }
        
        // 여러 형태로 테스트
        const testSessions = [
            sessionString,  // 원본 헥사데시멀
            finalSessionString,  // base64 변환
            `1${sessionString}`,  // 앞에 1 추가
            sessionString.substring(0, 256),  // 절반 길이
        ];
        
        for (let i = 0; i < testSessions.length; i++) {
            const testSession = testSessions[i];
            console.log(`\n🔍 테스트 ${i + 1}: ${testSession.substring(0, 30)}... (${testSession.length}자)`);
            
            try {
                const stringSession = new StringSession(testSession);
                const client = new TelegramClient(stringSession, apiId, apiHash, {
                    connectionRetries: 3,
                    timeout: 10000,
                });
                
                console.log('📡 연결 시도 중...');
                await client.connect();
                
                if (client.connected) {
                    console.log('✅ 연결 성공!');
                    
                    try {
                        const me = await client.getMe();
                        console.log('🎉 세션 검증 성공!');
                        console.log(`👤 사용자: ${me.firstName} ${me.lastName || ''}`);
                        console.log(`📱 전화번호: ${me.phone || 'N/A'}`);
                        console.log(`🆔 사용자명: @${me.username || 'N/A'}`);
                        
                        // .env 파일에 저장
                        const fs = require('fs');
                        const envContent = fs.readFileSync('.env', 'utf8');
                        const newContent = envContent.includes('TELEGRAM_SESSION=') 
                            ? envContent.replace(/TELEGRAM_SESSION=.*/, `TELEGRAM_SESSION="${testSession}"`)
                            : envContent + `\nTELEGRAM_SESSION="${testSession}"`;
                        
                        fs.writeFileSync('.env', newContent);
                        console.log('💾 세션이 .env 파일에 저장되었습니다.');
                        
                        await client.disconnect();
                        return true;
                        
                    } catch (meError) {
                        console.log('❌ 사용자 정보 조회 실패:', meError.message);
                        await client.disconnect();
                    }
                } else {
                    console.log('❌ 연결 실패');
                }
                
            } catch (error) {
                console.log('❌ 테스트 실패:', error.message);
                
                if (error.message.includes('AUTH_KEY_INVALID')) {
                    console.log('💡 이 세션은 만료되었거나 잘못된 형태입니다.');
                } else if (error.message.includes('SESSION_REVOKED')) {
                    console.log('💡 이 세션은 취소되었습니다.');
                }
            }
        }
        
        console.log('\n❌ 모든 형태로 테스트했지만 유효한 세션을 찾지 못했습니다.');
        console.log('\n💡 해결 방법:');
        console.log('1. 새로운 세션을 생성해보세요: node extract_session.js');
        console.log('2. 텔레그램 웹에서 다시 세션을 추출해보세요');
        console.log('3. 세션 문자열이 완전히 복사되었는지 확인하세요');
        
    } catch (error) {
        console.error('❌ 테스트 중 오류 발생:', error.message);
    }
}

// 실행
testSession().catch(console.error); 