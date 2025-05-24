const express = require('express');
const router = express.Router();
const telegramService = require('../services/telegramService');
const smsService = require('../services/smsService');

// 서버 상태 확인
router.get('/status', (req, res) => {
    res.json({
        status: 'running',
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        telegramConnected: false, // TODO: 실제 텔레그램 연결 상태 확인
        targetChats: [],
        currentTemplate: 'default'
    });
});

// 텔레그램 재연결
router.post('/telegram/reconnect', async (req, res) => {
    try {
        // TODO: 텔레그램 재연결 로직 구현
        res.json({ success: true, message: '텔레그램 재연결이 완료되었습니다.' });
    } catch (error) {
        console.error('텔레그램 재연결 오류:', error);
        res.status(500).json({ success: false, error: '재연결에 실패했습니다.' });
    }
});

// 채팅방 제거
router.delete('/chat/:chatId', async (req, res) => {
    try {
        const { chatId } = req.params;
        // TODO: 채팅방 제거 로직 구현
        res.json({ success: true, message: '채팅방이 제거되었습니다.' });
    } catch (error) {
        console.error('채팅방 제거 오류:', error);
        res.status(500).json({ success: false, error: '채팅방 제거에 실패했습니다.' });
    }
});

// 채팅방 추가
router.post('/chat/:identifier', async (req, res) => {
    try {
        const { identifier } = req.params;
        // TODO: 채팅방 추가 로직 구현
        res.json({ success: true, message: '채팅방이 추가되었습니다.' });
    } catch (error) {
        console.error('채팅방 추가 오류:', error);
        res.status(500).json({ success: false, error: '채팅방 추가에 실패했습니다.' });
    }
});

// 설정 저장 - SMS
router.post('/settings/sms', async (req, res) => {
    try {
        const { apiKey, apiSecret, senderId } = req.body;
        // TODO: SMS 설정 저장 로직 구현
        res.json({ success: true, message: 'SMS 설정이 저장되었습니다.' });
    } catch (error) {
        console.error('SMS 설정 저장 오류:', error);
        res.status(500).json({ success: false, error: 'SMS 설정 저장에 실패했습니다.' });
    }
});

// 설정 저장 - 텔레그램
router.post('/settings/telegram', async (req, res) => {
    try {
        const { apiId, apiHash } = req.body;
        // TODO: 텔레그램 설정 저장 로직 구현
        res.json({ success: true, message: '텔레그램 설정이 저장되었습니다.' });
    } catch (error) {
        console.error('텔레그램 설정 저장 오류:', error);
        res.status(500).json({ success: false, error: '텔레그램 설정 저장에 실패했습니다.' });
    }
});

// 설정 저장 - 다중 메시지
router.post('/settings/multi-message', async (req, res) => {
    try {
        const { useMultiMessage, messageDelay, messageTemplate1, messageTemplate2, messageTemplate3 } = req.body;
        // TODO: 다중 메시지 설정 저장 로직 구현
        res.json({ success: true, message: '다중 메시지 설정이 저장되었습니다.' });
    } catch (error) {
        console.error('다중 메시지 설정 저장 오류:', error);
        res.status(500).json({ success: false, error: '다중 메시지 설정 저장에 실패했습니다.' });
    }
});

// 채팅방 관리 - 추가
router.post('/chats', async (req, res) => {
    try {
        const { identifier } = req.body;
        // TODO: 채팅방 추가 로직 구현
        res.json({ success: true, message: '채팅방이 추가되었습니다.' });
    } catch (error) {
        console.error('채팅방 추가 오류:', error);
        res.status(500).json({ success: false, error: '채팅방 추가에 실패했습니다.' });
    }
});

// 채팅방 관리 - 제거
router.delete('/chats/:chatId', async (req, res) => {
    try {
        const { chatId } = req.params;
        // TODO: 채팅방 제거 로직 구현
        res.json({ success: true, message: '채팅방이 제거되었습니다.' });
    } catch (error) {
        console.error('채팅방 제거 오류:', error);
        res.status(500).json({ success: false, error: '채팅방 제거에 실패했습니다.' });
    }
});

// 텔레그램 로그인 요청
router.post('/telegram/login', async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        if (!phoneNumber) {
            return res.status(400).json({ success: false, error: '전화번호가 필요합니다.' });
        }

        const result = await telegramService.login(phoneNumber);
        if (result.success) {
            res.json({ success: true, phoneCodeHash: result.phoneCodeHash });
        } else {
            res.status(400).json({ success: false, error: result.error });
        }
    } catch (error) {
        console.error('텔레그램 로그인 오류:', error);
        res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
    }
});

// 텔레그램 인증 코드 확인
router.post('/telegram/verify', async (req, res) => {
    try {
        const { phoneNumber, phoneCodeHash, code } = req.body;
        if (!phoneNumber || !phoneCodeHash || !code) {
            return res.status(400).json({ success: false, error: '필수 정보가 누락되었습니다.' });
        }

        const result = await telegramService.verifyCode(phoneNumber, phoneCodeHash, code);
        if (result.success) {
            res.json({ success: true, session: result.session });
        } else {
            res.status(400).json({ success: false, error: result.error });
        }
    } catch (error) {
        console.error('텔레그램 인증 오류:', error);
        res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
    }
});

// SMS 발송
router.post('/sms/send', async (req, res) => {
    try {
        const { phoneNumber, message } = req.body;
        if (!phoneNumber || !message) {
            return res.status(400).json({ success: false, error: '전화번호와 메시지가 필요합니다.' });
        }

        const result = await smsService.sendSMS(phoneNumber, message);
        if (result.success) {
            res.json({ success: true, messageId: result.messageId });
        } else {
            res.status(400).json({ success: false, error: result.error });
        }
    } catch (error) {
        console.error('SMS 발송 오류:', error);
        res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
    }
});

module.exports = router; 