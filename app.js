require('dotenv').config();
const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');
const TelegramClientService = require('./services/telegramClientService');
const apiRoutes = require('./routes/api');

// 환경 변수 확인
const TELEGRAM_API_ID = process.env.TELEGRAM_API_ID;
const TELEGRAM_API_HASH = process.env.TELEGRAM_API_HASH;
const TELEGRAM_SESSION = process.env.TELEGRAM_SESSION || '';
const TELEGRAM_TARGET_CHATS = (process.env.TELEGRAM_TARGET_CHATS || '').split(',').filter(Boolean);
const PORT = process.env.PORT || 3000;

// 필수 환경 변수 검증
if (!TELEGRAM_API_ID || !TELEGRAM_API_HASH) {
  console.error('텔레그램 API 설정이 누락되었습니다. .env 파일을 확인해주세요.');
  console.error('텔레그램 API ID와 API Hash는 https://my.telegram.org에서 얻을 수 있습니다.');
  process.exit(1);
}

// Express 앱 초기화
const app = express();

// 미들웨어 설정
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// 뷰 엔진 설정
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

// API 라우트
app.use('/api', apiRoutes);

// 텔레그램 클라이언트 서비스 초기화
const telegramClient = new TelegramClientService(
  parseInt(TELEGRAM_API_ID),
  TELEGRAM_API_HASH,
  TELEGRAM_SESSION
);

// 기본 라우트
app.get('/', (req, res) => {
  res.render('index', {
    title: '텔레그램 SMS 자동 발송 시스템',
    targetChats: telegramClient.targetChats || [],
    currentTemplate: telegramClient.currentTemplate || 'default',
    uptime: process.uptime(),
    recentActivities: [], // TODO: 최근 활동 로그 구현
    smsTemplates: {
      default: '기본 메시지',
      welcome: '환영 메시지',
      reminder: '알림 메시지'
    }
  });
});

// 설정 페이지
app.get('/settings', (req, res) => {
  res.render('settings', {
    title: '시스템 설정',
    telegramApiId: process.env.TELEGRAM_API_ID || '',
    telegramApiHash: process.env.TELEGRAM_API_HASH ? '********' : '',
    smsApiKey: process.env.SMS_API_KEY ? '********' : '',
    smsSenderId: process.env.SMS_SENDER_ID || '',
    smsApiUrl: process.env.SMS_API_URL || '',
    smsSettings: {
      apiKey: process.env.SMS_API_KEY || '',
      apiSecret: process.env.SMS_API_SECRET || '',
      senderId: process.env.SMS_SENDER_ID || ''
    },
    settings: {
      useMultiMessage: process.env.USE_MULTI_MESSAGE === 'true',
      messageDelay: parseInt(process.env.MESSAGE_DELAY || '10'),
      messageTemplate1: process.env.MESSAGE_TEMPLATE_1 || 'default',
      messageTemplate2: process.env.MESSAGE_TEMPLATE_2 || '',
      messageTemplate3: process.env.MESSAGE_TEMPLATE_3 || ''
    },
    templates: {
      default: '기본 메시지',
      welcome: '환영 메시지',
      reminder: '알림 메시지'
    },
    chats: telegramClient.targetChats || []
  });
});

// 템플릿 페이지
app.get('/templates', (req, res) => {
  res.render('templates', {
    title: '메시지 템플릿',
    templates: {
      default: '기본 메시지',
      welcome: '환영 메시지',
      reminder: '알림 메시지'
    },
    currentTemplate: telegramClient.currentTemplate || 'default'
  });
});

// 텔레그램 연결 페이지
app.get('/telegram', (req, res) => {
  res.render('telegram', {
    title: '텔레그램 연결',
    telegramSettings: {
      apiId: process.env.TELEGRAM_API_ID || '',
      apiHash: process.env.TELEGRAM_API_HASH || '',
      isConnected: telegramClient.isRunning,
      targetChats: telegramClient.targetChats || []
    }
  });
});

// 상태 확인 라우트
app.get('/status', (req, res) => {
  res.json({
    status: telegramClient.isRunning ? 'running' : 'stopped',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    template: telegramClient.currentTemplate,
    targetChats: telegramClient.targetChats
  });
});

// 템플릿 변경 API
app.post('/template/:name', (req, res) => {
  const templateName = req.params.name;
  if (telegramClient.setTemplate(templateName)) {
    res.json({ success: true, message: `템플릿이 "${templateName}"으로 변경되었습니다.` });
  } else {
    res.status(400).json({ success: false, message: `"${templateName}" 템플릿을 찾을 수 없습니다.` });
  }
});

// 채팅방 추가 API
app.post('/chat/:identifier', async (req, res) => {
  const chatIdentifier = req.params.identifier;
  const result = await telegramClient.addTargetChat(chatIdentifier);
  
  if (result) {
    res.json({ success: true, message: `채팅방 "${chatIdentifier}"이(가) 추가되었습니다.` });
  } else {
    res.status(400).json({ success: false, message: `채팅방 "${chatIdentifier}" 추가에 실패했습니다.` });
  }
});

// 서버 시작
app.listen(PORT, async () => {
  console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
  console.log('텔레그램 클라이언트를 초기화합니다...');
  
  // 텔레그램 클라이언트 초기화
  const initialized = await telegramClient.init();
  
  if (initialized) {
    // 대상 채팅방 설정
    if (TELEGRAM_TARGET_CHATS.length > 0) {
      console.log('대상 채팅방을 설정합니다...');
      for (const chatId of TELEGRAM_TARGET_CHATS) {
        await telegramClient.addTargetChat(chatId);
      }
    }
    
    // 메시지 모니터링 시작
    await telegramClient.startListening();
  } else {
    console.error('텔레그램 클라이언트 초기화에 실패했습니다. 서버를 종료합니다.');
    process.exit(1);
  }
});

// 종료 시 정리
process.once('SIGINT', async () => {
  console.log('서버를 종료합니다...');
  await telegramClient.stop();
  process.exit(0);
});

process.once('SIGTERM', async () => {
  console.log('서버를 종료합니다...');
  await telegramClient.stop();
  process.exit(0);
}); 

module.exports = app; 