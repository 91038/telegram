const telegramClient = require('./services/telegramClientService');
const smsService = require('./services/smsService');
const config = require('./config');

async function main() {
    try {
        console.log('=== 텔레그램 자동 문자 발송 시스템 시작 ===');
        
        // 1. 텔레그램 클라이언트 초기화 및 로그인
        console.log('\n1. 텔레그램 클라이언트 초기화 중...');
        await telegramClient.initialize();
        
        // 2. SMS 서비스 테스트
        console.log('\n2. SMS 서비스 테스트 중...');
        const creditResult = await smsService.checkCredits();
        if (creditResult.success) {
            console.log(`✅ SMS 서비스 연결 성공`);
            console.log(`잔여 크레딧: ${creditResult.balanceCredits}`);
            console.log(`SMS 발송 가능: ${creditResult.availableCounts.sms}회`);
        } else {
            console.log(`⚠️ SMS 서비스 연결 실패: ${creditResult.error}`);
        }
        
        // 3. 메시지 템플릿 설정
        const messageTemplates = [
            config.MESSAGE_TEMPLATE_1 || '첫 번째 메시지입니다.',
            config.MESSAGE_TEMPLATE_2 || '두 번째 메시지입니다.',
            config.MESSAGE_TEMPLATE_3 || '세 번째 메시지입니다.'
        ].filter(template => template && template.trim());
        
        console.log(`\n3. 메시지 템플릿 ${messageTemplates.length}개 준비됨:`);
        messageTemplates.forEach((template, index) => {
            console.log(`   ${index + 1}. ${template.substring(0, 30)}...`);
        });
        
        // 4. 채팅방 모니터링 시작
        const chatId = config.TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID;
        if (!chatId) {
            console.error('❌ 채팅방 ID가 설정되지 않았습니다. config.js 또는 .env 파일을 확인하세요.');
            return;
        }
        
        console.log(`\n4. 채팅방 ${chatId} 모니터링 시작...`);
        await telegramClient.startMonitoring(chatId, messageTemplates);
        
        console.log('\n✅ 시스템이 성공적으로 시작되었습니다!');
        console.log('전화번호가 포함된 메시지를 기다리는 중...');
        console.log('종료하려면 Ctrl+C를 누르세요.');
        
        // 프로세스 종료 시 정리
        process.on('SIGINT', async () => {
            console.log('\n\n시스템 종료 중...');
            await telegramClient.disconnect();
            process.exit(0);
        });
        
        // 무한 대기
        await new Promise(() => {});
        
    } catch (error) {
        console.error('❌ 시스템 시작 실패:', error);
        process.exit(1);
    }
}

// 메인 함수 실행
main(); 