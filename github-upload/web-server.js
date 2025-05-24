const express = require('express');
const path = require('path');
const configManager = require('./utils/configManager');
const webTelegramService = require('./services/webTelegramService');
const smsService = require('./services/smsService');

const app = express();
const PORT = 3007;

// 미들웨어 설정
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 메인 페이지
app.get('/', async (req, res) => {
    try {
        const config = configManager.getAll();
        const telegramState = webTelegramService.getLoginState();
        
        res.render('index', {
            title: '텔레그램 자동 문자 발송 시스템',
            config: config,
            telegramState: telegramState
        });
    } catch (error) {
        console.error('메인 페이지 로드 오류:', error);
        res.status(500).send('서버 오류가 발생했습니다.');
    }
});

// 설정 저장
app.post('/api/settings', (req, res) => {
    try {
        const { 
            MESSAGE_TEMPLATE_1, 
            MESSAGE_TEMPLATE_2, 
            MESSAGE_TEMPLATE_3,
            TELEGRAM_CHAT_ID 
        } = req.body;

        const updates = {};
        if (MESSAGE_TEMPLATE_1) updates.MESSAGE_TEMPLATE_1 = MESSAGE_TEMPLATE_1;
        if (MESSAGE_TEMPLATE_2) updates.MESSAGE_TEMPLATE_2 = MESSAGE_TEMPLATE_2;
        if (MESSAGE_TEMPLATE_3) updates.MESSAGE_TEMPLATE_3 = MESSAGE_TEMPLATE_3;
        if (TELEGRAM_CHAT_ID) updates.TELEGRAM_CHAT_ID = TELEGRAM_CHAT_ID;

        const success = configManager.updateMultiple(updates);
        
        if (success) {
            res.json({ success: true, message: '설정이 저장되었습니다.' });
        } else {
            res.json({ success: false, error: '설정 저장에 실패했습니다.' });
        }
    } catch (error) {
        console.error('설정 저장 오류:', error);
        res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
    }
});

// 텔레그램 초기화
app.post('/api/telegram/init', async (req, res) => {
    try {
        const result = await webTelegramService.initialize();
        res.json(result);
    } catch (error) {
        console.error('텔레그램 초기화 오류:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 텔레그램 인증 코드 요청
app.post('/api/telegram/send-code', async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        
        if (!phoneNumber) {
            return res.json({ success: false, error: '전화번호를 입력해주세요.' });
        }

        const result = await webTelegramService.sendCode(phoneNumber);
        res.json(result);
    } catch (error) {
        console.error('인증 코드 요청 오류:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 텔레그램 인증 코드 검증
app.post('/api/telegram/verify-code', async (req, res) => {
    try {
        const { phoneNumber, code } = req.body;
        
        if (!phoneNumber || !code) {
            return res.json({ success: false, error: '전화번호와 인증 코드를 입력해주세요.' });
        }

        const result = await webTelegramService.verifyCode(phoneNumber, code);
        res.json(result);
    } catch (error) {
        console.error('인증 코드 검증 오류:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 텔레그램 2단계 인증
app.post('/api/telegram/verify-password', async (req, res) => {
    try {
        const { phoneNumber, code, password } = req.body;
        
        if (!phoneNumber || !code || !password) {
            return res.json({ success: false, error: '모든 필드를 입력해주세요.' });
        }

        const result = await webTelegramService.verifyPassword(phoneNumber, code, password);
        res.json(result);
    } catch (error) {
        console.error('2단계 인증 오류:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 텔레그램 상태 확인
app.get('/api/telegram/status', (req, res) => {
    try {
        const state = webTelegramService.getLoginState();
        res.json(state);
    } catch (error) {
        console.error('텔레그램 상태 확인 오류:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// SMS 크레딧 확인
app.get('/api/sms/credits', async (req, res) => {
    try {
        const result = await smsService.checkCredits();
        res.json(result);
    } catch (error) {
        console.error('SMS 크레딧 확인 오류:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// SMS 테스트 발송
app.post('/api/sms/test', async (req, res) => {
    try {
        const { phoneNumber, message } = req.body;
        
        if (!phoneNumber || !message) {
            return res.json({ success: false, error: '전화번호와 메시지를 입력해주세요.' });
        }

        const result = await smsService.sendSMS(phoneNumber, message);
        res.json(result);
    } catch (error) {
        console.error('SMS 테스트 발송 오류:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 모니터링 시작
app.post('/api/monitoring/start', async (req, res) => {
    try {
        const { chatIdOrUsername } = req.body;
        
        if (!chatIdOrUsername) {
            return res.json({ success: false, error: '채팅방 ID 또는 사용자명을 입력해주세요.' });
        }

        const messageTemplates = [
            configManager.get('MESSAGE_TEMPLATE_1'),
            configManager.get('MESSAGE_TEMPLATE_2'),
            configManager.get('MESSAGE_TEMPLATE_3')
        ].filter(template => template && template.trim());

        if (messageTemplates.length === 0) {
            return res.json({ success: false, error: '메시지 템플릿이 설정되지 않았습니다.' });
        }

        const result = await webTelegramService.startMonitoring(chatIdOrUsername, messageTemplates);
        res.json(result);
    } catch (error) {
        console.error('모니터링 시작 오류:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 모니터링 중지
app.post('/api/monitoring/stop', async (req, res) => {
    try {
        const result = webTelegramService.stopMonitoring();
        res.json(result);
    } catch (error) {
        console.error('모니터링 중지 오류:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 채팅방 검색
app.post('/api/telegram/find-chat', async (req, res) => {
    try {
        const { chatIdOrUsername } = req.body;
        
        if (!chatIdOrUsername) {
            return res.json({ success: false, error: '채팅방 ID 또는 사용자명을 입력해주세요.' });
        }

        const result = await webTelegramService.findChatByIdOrUsername(chatIdOrUsername);
        res.json(result);
    } catch (error) {
        console.error('채팅방 검색 오류:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 서버 시작
app.listen(PORT, () => {
    console.log(`웹 서버가 포트 ${PORT}에서 시작되었습니다.`);
    console.log(`브라우저에서 http://localhost:${PORT} 를 열어주세요.`);
}); 