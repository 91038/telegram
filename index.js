require('dotenv').config();
const express = require('express');
const path = require('path');
const ejsLayouts = require('express-ejs-layouts');
const TelegramClientService = require('./services/telegramClientService');
const smsService = require('./services/smsService');
const config = require('./config');
const fs = require('fs').promises;

// 환경 변수 확인
const PORT = process.env.PORT || 3006;

// 서버 시작 시간 기록
const START_TIME = new Date();

// Express 앱 초기화
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// EJS 설정
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
// app.use(ejsLayouts);
// app.set('layout', 'layout');

// 상태 관리
const appState = {
  telegramConnected: false,
  recentActivities: [],
  targetChats: [],
  telegramPhoneNumber: '',
  lastLoginTime: null,
  appSettings: {
    useMultiMessage: true,
    messageDelay: 10,
    messageTemplate1: 'default',
    messageTemplate2: '',
    messageTemplate3: ''
  }
};

// 미들웨어 설정
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 메시지 템플릿 저장 파일
const MESSAGES_FILE = path.join(__dirname, 'data', 'messages.json');

// 데이터 폴더 생성
async function ensureDataFolder() {
    try {
        await fs.mkdir(path.join(__dirname, 'data'), { recursive: true });
    } catch (error) {
        console.error('데이터 폴더 생성 오류:', error);
    }
}

// 메시지 템플릿 로드
async function loadMessages() {
    try {
        const data = await fs.readFile(MESSAGES_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // 파일이 없으면 기본값 반환
        return {
            message1: '안녕하세요! 첫 번째 메시지입니다.',
            message2: '두 번째 메시지입니다.',
            message3: '세 번째 메시지입니다.'
        };
    }
}

// 메시지 템플릿 저장
async function saveMessages(messages) {
    try {
        await fs.writeFile(MESSAGES_FILE, JSON.stringify(messages, null, 2));
        return true;
    } catch (error) {
        console.error('메시지 저장 오류:', error);
        return false;
    }
}

// 저장된 데이터 불러오기
async function loadSavedData() {
  try {
    // 데이터 디렉토리 확인
    const dataDir = path.join(__dirname, 'data');
    if (!await fs.access(dataDir).then(() => true).catch(() => false)) {
      await fs.mkdir(dataDir, { recursive: true });
    }
    
    // 설정 로드
    const settingsPath = path.join(dataDir, 'settings.json');
    if (await fs.access(settingsPath).then(() => true).catch(() => false)) {
      try {
        const settings = JSON.parse(await fs.readFile(settingsPath, 'utf8'));
        appState.appSettings = {
          ...appState.appSettings,
          ...settings
        };
        console.log('설정 파일을 불러왔습니다.');
      } catch (e) {
        console.error('설정 파일 로드 중 오류 발생:', e.message);
      }
    }
    
    // 채팅방 목록 로드
    const chatsPath = path.join(dataDir, 'chats.json');
    if (await fs.access(chatsPath).then(() => true).catch(() => false)) {
      try {
        appState.targetChats = JSON.parse(await fs.readFile(chatsPath, 'utf8'));
        console.log(`${appState.targetChats.length}개의 대화방 정보를 불러왔습니다.`);
      } catch (e) {
        console.error('채팅방 목록 로드 중 오류 발생:', e.message);
      }
    }
    
    // 환경 변수 로드 (.env 파일)
    const envPath = path.join(__dirname, '.env');
    if (await fs.access(envPath).then(() => true).catch(() => false)) {
      try {
        const envContent = await fs.readFile(envPath, 'utf8');
        
        // API 키와 같은 중요 정보를 환경변수에서 추출하여 실제 process.env에 설정
        const telegramApiId = envContent.match(/TELEGRAM_API_ID=([^\r\n]*)/)?.[1] || '';
        if (telegramApiId) process.env.TELEGRAM_API_ID = telegramApiId;
        
        const telegramApiHash = envContent.match(/TELEGRAM_API_HASH=([^\r\n]*)/)?.[1] || '';
        if (telegramApiHash) process.env.TELEGRAM_API_HASH = telegramApiHash;
        
        const smsApiKey = envContent.match(/SMS_API_KEY=([^\r\n]*)/)?.[1] || '';
        if (smsApiKey) process.env.SMS_API_KEY = smsApiKey;
        
        const smsApiSecret = envContent.match(/SMS_API_SECRET=([^\r\n]*)/)?.[1] || '';
        if (smsApiSecret) process.env.SMS_API_SECRET = smsApiSecret;
        
        const smsSenderNumber = envContent.match(/SMS_SENDER_NUMBER=([^\r\n]*)/)?.[1] || '';
        if (smsSenderNumber) process.env.SMS_SENDER_NUMBER = smsSenderNumber;
        
        console.log('환경 변수를 불러왔습니다.');
      } catch (e) {
        console.error('환경 변수 로드 중 오류 발생:', e.message);
      }
    }
  } catch (error) {
    console.error('데이터 로드 중 오류 발생:', error);
  }
}

// 서버 시작 시 데이터 로드
loadSavedData();

// 초기 환경 변수 확인
async function initializeEnv() {
  try {
    const envExists = await fs.access('.env').then(() => true).catch(() => false);
    if (!envExists) {
      // 기본 .env 파일 생성
      const defaultEnv = `PORT=3001\n`;
      await fs.writeFile('.env', defaultEnv, 'utf8');
      console.log('기본 .env 파일이 생성되었습니다.');
    }
  } catch (error) {
    console.error('.env 파일 생성 오류:', error);
  }
}

// 기본 라우트
app.get('/', async (req, res) => {
  try {
    const messages = await loadMessages();
    const telegramStatus = TelegramClientService.getStatus();
    
    res.render('index', { 
      title: '텔레그램 자동 SMS 시스템',
      messages,
      telegramStatus,
      success: req.query.success,
      error: req.query.error
    });
  } catch (error) {
    console.error('메인 페이지 로드 오류:', error);
    res.status(500).send('서버 오류가 발생했습니다.');
  }
});

// 설정 페이지
app.get('/settings', (req, res) => {
  res.render('settings', {
    title: '설정',
    telegramApiId: process.env.TELEGRAM_API_ID || '',
    telegramApiHash: process.env.TELEGRAM_API_HASH ? '********' : '',
    smsApiKey: process.env.SMS_API_KEY ? '********' : '',
    smsSenderId: process.env.SMS_SENDER_NUMBER || '',
    smsApiUrl: process.env.SMS_API_URL || '',
    smsSettings: {
      apiKey: process.env.SMS_API_KEY || '',
      apiSecret: process.env.SMS_API_SECRET || '',
      senderId: process.env.SMS_SENDER_NUMBER || ''
    },
    settings: appState.appSettings,
    templates: config.SMS_TEMPLATES,
    chats: appState.targetChats
  });
});

// 템플릿 관리 페이지
app.get('/templates', (req, res) => {
  res.render('templates', {
    title: '메시지 템플릿',
    templates: config.SMS_TEMPLATES,
    currentTemplate: 'default'
  });
});

// 텔레그램 연결 페이지
app.get('/telegram', (req, res) => {
  // 실제 연결 상태 확인
  const isConnected = global.telegramClient ? global.telegramClient.isRunning : false;
  
  res.render('telegram', {
    title: '텔레그램 연결',
    telegramSettings: {
      apiId: process.env.TELEGRAM_API_ID || '',
      apiHash: process.env.TELEGRAM_API_HASH || '',
      isConnected: isConnected,
      phoneNumber: appState.telegramPhoneNumber || '',
      lastLogin: appState.lastLoginTime ? new Date(appState.lastLoginTime).toLocaleString('ko-KR') : '없음'
    }
  });
});

// 서버 상태 API
app.get('/api/status', (req, res) => {
  res.json({
    status: 'running',
    telegramConnected: appState.telegramConnected,
    targetChats: appState.targetChats,
    currentTemplate: 'default',
    uptime: getUptime()
  });
});

// 설정 저장 API
app.post('/api/settings', async (req, res) => {
  try {
    const { smsApiKey, smsApiSecret, telegramApiId, telegramApiHash } = req.body;
    
    // 환경 변수 업데이트
    let envContent = '';
    const envExists = await fs.access('.env').then(() => true).catch(() => false);
    if (envExists) {
      envContent = await fs.readFile('.env', 'utf8');
    } else {
      envContent = 'PORT=3001\n';
    }
    
    // 기존 설정 업데이트 또는 추가
    const envLines = envContent.split('\n');
    const updateEnvVar = (key, value) => {
      const index = envLines.findIndex(line => line.startsWith(`${key}=`));
      if (index !== -1) {
        envLines[index] = `${key}=${value}`;
      } else {
        envLines.push(`${key}=${value}`);
      }
    };
    
    if (smsApiKey) updateEnvVar('SMS_API_KEY', smsApiKey);
    if (smsApiSecret) updateEnvVar('SMS_API_SECRET', smsApiSecret);
    if (telegramApiId) updateEnvVar('TELEGRAM_API_ID', telegramApiId);
    if (telegramApiHash) updateEnvVar('TELEGRAM_API_HASH', telegramApiHash);
    
    envContent = envLines.join('\n');
    
    // 파일에 저장
    await fs.writeFile('.env', envContent, 'utf8');
    console.log('.env 파일 저장 완료');
    
    // 설정 객체 생성
    const settings = {
      smsApiKey: smsApiKey || '',
      smsApiSecret: smsApiSecret || '',
      telegramApiId: telegramApiId || '',
      telegramApiHash: telegramApiHash || ''
    };
    
    // 설정 파일 저장
    const settingsDir = path.join(__dirname, 'data');
    const settingsDirExists = await fs.access(settingsDir).then(() => true).catch(() => false);
    if (!settingsDirExists) {
      await fs.mkdir(settingsDir, { recursive: true });
    }
    
    await fs.writeFile(path.join(settingsDir, 'settings.json'), JSON.stringify(settings, null, 2));
    res.json({ success: true, settings });
  } catch (error) {
    console.error('설정 저장 오류:', error);
    res.status(500).json({ success: false, error: '설정 저장에 실패했습니다.' });
  }
});

// 텔레그램 설정 저장 API
app.post('/api/telegram-settings', async (req, res) => {
  try {
    const { apiId, apiHash } = req.body;
    
    if (!apiId || !apiHash) {
      return res.status(400).json({ success: false, error: 'API ID와 API Hash를 모두 입력해주세요.' });
    }
    
    // 환경 변수 업데이트
    let envContent = '';
    const envExists = await fs.access('.env').then(() => true).catch(() => false);
    if (envExists) {
      envContent = await fs.readFile('.env', 'utf8');
    } else {
      envContent = 'PORT=3001\n';
    }
    
    // 기존 설정 업데이트 또는 추가
    const envLines = envContent.split('\n');
    const updateEnvVar = (key, value) => {
      const index = envLines.findIndex(line => line.startsWith(`${key}=`));
      if (index !== -1) {
        envLines[index] = `${key}=${value}`;
      } else {
        envLines.push(`${key}=${value}`);
      }
    };
    
    updateEnvVar('TELEGRAM_API_ID', apiId);
    updateEnvVar('TELEGRAM_API_HASH', apiHash);
    
    envContent = envLines.join('\n');
    
    // 파일에 저장
    await fs.writeFile('.env', envContent, 'utf8');
    console.log('.env 파일 저장 완료 (텔레그램 설정)');
    
    res.json({ success: true });
  } catch (error) {
    console.error('텔레그램 설정 저장 오류:', error);
    res.status(500).json({ success: false, error: '텔레그램 설정 저장에 실패했습니다.' });
  }
});

// 다중 메시지 설정 저장 API
app.post('/api/settings/multi-message', async (req, res) => {
  const { useMultiMessage, messageDelay, messageTemplate1, messageTemplate2, messageTemplate3 } = req.body;
  
  try {
    // 설정 저장
    const settings = {
      useMultiMessage: !!useMultiMessage,
      messageDelay: Math.min(Math.max(parseInt(messageDelay) || 10, 5), 60),
      messageTemplate1: messageTemplate1 || 'default',
      messageTemplate2: messageTemplate2 || '',
      messageTemplate3: messageTemplate3 || ''
    };
    
    // 설정 파일 저장
    const settingsDir = path.join(__dirname, 'data');
    const settingsDirExists = await fs.access(settingsDir).then(() => true).catch(() => false);
    if (!settingsDirExists) {
      await fs.mkdir(settingsDir, { recursive: true });
    }
    
    await fs.writeFile(path.join(settingsDir, 'settings.json'), JSON.stringify(settings, null, 2));
    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 템플릿 저장 API
app.post('/api/templates', async (req, res) => {
  try {
    const { templates } = req.body;
    
    if (!templates || typeof templates !== 'object') {
      return res.status(400).json({ success: false, error: '유효하지 않은 템플릿 데이터입니다.' });
    }
    
    // 기존 템플릿 업데이트
    Object.assign(config.SMS_TEMPLATES, templates);
    
    // 템플릿 저장
    const templatesDir = path.join(__dirname, 'data');
    const templatesDirExists = await fs.access(templatesDir).then(() => true).catch(() => false);
    if (!templatesDirExists) {
      await fs.mkdir(templatesDir, { recursive: true });
    }
    
    await fs.writeFile(
      path.join(templatesDir, 'templates.json'), 
      JSON.stringify(config.SMS_TEMPLATES, null, 2)
    );
    
    res.json({ success: true, templates: config.SMS_TEMPLATES });
  } catch (error) {
    console.error('템플릿 저장 오류:', error);
    res.status(500).json({ success: false, error: '템플릿 저장에 실패했습니다.' });
  }
});

// 템플릿 추가 API
app.post('/api/templates/add', async (req, res) => {
  try {
    const { name, content } = req.body;
    
    if (!name || !content) {
      return res.status(400).json({ success: false, error: '템플릿 이름과 내용을 모두 입력해주세요.' });
    }
    
    // 새 템플릿 추가
    config.SMS_TEMPLATES[name] = content;
    
    // 템플릿 저장
    const templatesDir = path.join(__dirname, 'data');
    await fs.writeFile(
      path.join(templatesDir, 'templates.json'), 
      JSON.stringify(config.SMS_TEMPLATES, null, 2)
    );
    
    res.json({ success: true, templates: config.SMS_TEMPLATES });
  } catch (error) {
    console.error('템플릿 추가 오류:', error);
    res.status(500).json({ success: false, error: '템플릿 추가에 실패했습니다.' });
  }
});

// 템플릿 삭제 API
app.delete('/api/templates/:name', async (req, res) => {
  try {
    const { name } = req.params;
    
    if (!config.SMS_TEMPLATES[name]) {
      return res.status(404).json({ success: false, error: '템플릿을 찾을 수 없습니다.' });
    }
    
    // 템플릿 삭제
    delete config.SMS_TEMPLATES[name];
    
    // 템플릿 저장
    const templatesDir = path.join(__dirname, 'data');
    await fs.writeFile(
      path.join(templatesDir, 'templates.json'), 
      JSON.stringify(config.SMS_TEMPLATES, null, 2)
    );
    
    res.json({ success: true, templates: config.SMS_TEMPLATES });
  } catch (error) {
    console.error('템플릿 삭제 오류:', error);
    res.status(500).json({ success: false, error: '템플릿 삭제에 실패했습니다.' });
  }
});

// 기본 템플릿 설정 API
app.post('/api/set-default-template', async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name || !config.SMS_TEMPLATES[name]) {
      return res.status(400).json({ success: false, error: '유효하지 않은 템플릿 이름입니다.' });
    }
    
    // 기본 템플릿 설정을 저장하는 코드
    const settingsDir = path.join(__dirname, 'data');
    const settingsDirExists = await fs.access(settingsDir).then(() => true).catch(() => false);
    if (!settingsDirExists) {
      await fs.mkdir(settingsDir, { recursive: true });
    }
    
    const settingsPath = path.join(settingsDir, 'settings.json');
    let settings = {};
    
    const settingsExists = await fs.access(settingsPath).then(() => true).catch(() => false);
    if (settingsExists) {
      try {
        settings = JSON.parse(await fs.readFile(settingsPath, 'utf8'));
      } catch (e) {
        console.error('설정 파일 파싱 오류:', e);
        settings = {};
      }
    }
    
    settings.messageTemplate1 = name;
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
    
    res.json({ success: true });
  } catch (error) {
    console.error('기본 템플릿 설정 오류:', error);
    res.status(500).json({ success: false, error: '기본 템플릿 설정에 실패했습니다.' });
  }
});

// 채팅방 추가 API
app.post('/api/chats', async (req, res) => {
  try {
    const { chatId, chatName } = req.body;
    
    if (!chatId) {
      return res.status(400).json({ success: false, error: '채팅방 ID를 입력해주세요.' });
    }
    
    // 중복 확인
    const existingChat = appState.targetChats.find(chat => chat.id === chatId);
    if (existingChat) {
      return res.status(400).json({ success: false, error: '이미 추가된 채팅방입니다.' });
    }
    
    // 새 채팅방 추가
    const newChat = {
      id: chatId,
      name: chatName || `채팅방 ${chatId}`,
      addedAt: new Date().toISOString()
    };
    
    appState.targetChats.push(newChat);
    
    // 채팅방 목록 저장
    const chatsDir = path.join(__dirname, 'data');
    const chatsDirExists = await fs.access(chatsDir).then(() => true).catch(() => false);
    if (!chatsDirExists) {
      await fs.mkdir(chatsDir, { recursive: true });
    }
    
    await fs.writeFile(
      path.join(chatsDir, 'chats.json'), 
      JSON.stringify(appState.targetChats, null, 2)
    );
    
    res.json({ success: true, chats: appState.targetChats });
  } catch (error) {
    console.error('채팅방 추가 오류:', error);
    res.status(500).json({ success: false, error: '채팅방 추가에 실패했습니다.' });
  }
});

// 채팅방 삭제 API
app.delete('/api/chats/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    
    // 채팅방 찾기 및 삭제
    const chatIndex = appState.targetChats.findIndex(chat => chat.id === chatId);
    if (chatIndex === -1) {
      return res.status(404).json({ success: false, error: '채팅방을 찾을 수 없습니다.' });
    }
    
    appState.targetChats.splice(chatIndex, 1);
    
    // 채팅방 목록 저장
    const chatsDir = path.join(__dirname, 'data');
    await fs.writeFile(
      path.join(chatsDir, 'chats.json'), 
      JSON.stringify(appState.targetChats, null, 2)
    );
    
    res.json({ success: true, chats: appState.targetChats });
  } catch (error) {
    console.error('채팅방 삭제 오류:', error);
    res.status(500).json({ success: false, error: '채팅방 삭제에 실패했습니다.' });
  }
});

// 텔레그램 로그인 API
app.post('/api/telegram/login', async (req, res) => {
  const { phoneNumber, phoneCode, password } = req.body;
  
  try {
    if (!phoneNumber) {
      return res.status(400).json({ success: false, message: '전화번호를 입력해주세요.' });
    }
    
    console.log(`텔레그램 로그인 시도: ${phoneNumber}`);
    
    // 텔레그램 클라이언트 초기화
    if (!TelegramClientService) {
      return res.status(500).json({ success: false, message: '텔레그램 클라이언트 서비스를 사용할 수 없습니다.' });
    }
    
    let result;
    
    if (!phoneCode) {
      // 1단계: 인증 코드 요청
      result = await TelegramClientService.requestLoginCode(phoneNumber);
      
      if (result.success) {
        res.json({ 
          success: true, 
          step: 'code_required',
          phoneCodeHash: result.phoneCodeHash,
          message: '인증 코드가 발송되었습니다. 텔레그램에서 받은 코드를 입력해주세요.'
        });
      } else {
        res.status(400).json({ success: false, message: result.error });
      }
    } else {
      // 2단계: 인증 코드 확인
      const phoneCodeHash = req.body.phoneCodeHash;
      
      if (!phoneCodeHash) {
        return res.status(400).json({ success: false, message: '인증 코드 해시가 필요합니다.' });
      }
      
      result = await TelegramClientService.verifyCode(phoneNumber, phoneCodeHash, phoneCode);
      
      if (result.success) {
        if (result.requiresPassword) {
          // 3단계: 2단계 인증 필요
          res.json({ 
            success: true, 
            step: 'password_required',
            message: '2단계 인증 비밀번호를 입력해주세요.'
          });
        } else {
          // 로그인 완료
          appState.telegramConnected = true;
          
          // 세션 저장
          if (result.session) {
            try {
              let envContent = '';
              const envExists = await fs.access('.env').then(() => true).catch(() => false);
              if (envExists) {
                envContent = await fs.readFile('.env', 'utf8');
              } else {
                envContent = 'PORT=3005\n';
              }
              
              // 세션 정보 추가/업데이트
              const envLines = envContent.split('\n');
              const sessionIndex = envLines.findIndex(line => line.startsWith('TELEGRAM_SESSION='));
              
              if (sessionIndex !== -1) {
                envLines[sessionIndex] = `TELEGRAM_SESSION=${result.session}`;
              } else {
                envLines.push(`TELEGRAM_SESSION=${result.session}`);
              }
              
              await fs.writeFile('.env', envContent, 'utf8');
              console.log('세션이 .env 파일에 저장되었습니다.');
            } catch (envError) {
              console.error('세션 저장 오류:', envError);
            }
          }
          
          res.json({ 
            success: true, 
            step: 'completed',
            message: '텔레그램 로그인이 완료되었습니다.',
            session: result.session
          });
        }
      } else {
        res.status(400).json({ success: false, message: result.error });
      }
    }
  } catch (error) {
    console.error('텔레그램 로그인 오류:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2단계 인증 비밀번호 확인 API
app.post('/api/telegram/password', async (req, res) => {
  const { password } = req.body;
  
  try {
    if (!password) {
      return res.status(400).json({ success: false, message: '비밀번호를 입력해주세요.' });
    }
    
    console.log('2단계 인증 비밀번호 확인 시도');
    
    const result = await TelegramClientService.checkPassword(password);
    
    if (result.success) {
      appState.telegramConnected = true;
      
      // 세션 저장
      if (result.session) {
        try {
          let envContent = '';
          const envExists = await fs.access('.env').then(() => true).catch(() => false);
          if (envExists) {
            envContent = await fs.readFile('.env', 'utf8');
          } else {
            envContent = 'PORT=3005\n';
          }
          
          // 세션 정보 추가/업데이트
          const envLines = envContent.split('\n');
          const sessionIndex = envLines.findIndex(line => line.startsWith('TELEGRAM_SESSION='));
          
          if (sessionIndex !== -1) {
            envLines[sessionIndex] = `TELEGRAM_SESSION=${result.session}`;
          } else {
            envLines.push(`TELEGRAM_SESSION=${result.session}`);
          }
          
          await fs.writeFile('.env', envContent, 'utf8');
          console.log('세션이 .env 파일에 저장되었습니다.');
        } catch (envError) {
          console.error('세션 저장 오류:', envError);
        }
      }
      
      res.json({ 
        success: true, 
        message: '2단계 인증이 완료되었습니다.',
        session: result.session
      });
    } else {
      res.status(400).json({ success: false, message: result.error });
    }
  } catch (error) {
    console.error('2단계 인증 오류:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 유틸리티 함수
function getUptime() {
  const now = new Date();
  const diff = now - START_TIME;
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) {
    return `${days}일 ${hours}시간 ${minutes}분`;
  } else if (hours > 0) {
    return `${hours}시간 ${minutes}분`;
  } else {
    return `${minutes}분`;
  }
}

// 메시지 템플릿 저장
app.post('/save-messages', async (req, res) => {
    try {
        const { message1, message2, message3 } = req.body;
        
        if (!message1 || !message2 || !message3) {
            return res.redirect('/?error=' + encodeURIComponent('모든 메시지를 입력해주세요.'));
        }
        
        const messages = { message1, message2, message3 };
        const saved = await saveMessages(messages);
        
        if (saved) {
            res.redirect('/?success=' + encodeURIComponent('메시지가 저장되었습니다.'));
        } else {
            res.redirect('/?error=' + encodeURIComponent('메시지 저장에 실패했습니다.'));
        }
    } catch (error) {
        console.error('메시지 저장 오류:', error);
        res.redirect('/?error=' + encodeURIComponent('서버 오류가 발생했습니다.'));
    }
});

// 텔레그램 로그인 - 1단계: 전화번호로 인증코드 요청
app.post('/telegram/send-code', async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        
        if (!phoneNumber) {
            return res.json({ success: false, error: '전화번호를 입력해주세요.' });
        }
        
        const result = await TelegramClientService.sendCode(phoneNumber);
        res.json(result);
    } catch (error) {
        console.error('인증코드 발송 오류:', error);
        res.json({ success: false, error: '서버 오류가 발생했습니다.' });
    }
});

// 텔레그램 로그인 - 2단계: 인증코드 확인
app.post('/telegram/verify-code', async (req, res) => {
    try {
        const { phoneCode } = req.body;
        
        if (!phoneCode) {
            return res.json({ success: false, error: '인증코드를 입력해주세요.' });
        }
        
        const result = await TelegramClientService.signIn(phoneCode);
        res.json(result);
    } catch (error) {
        console.error('인증코드 확인 오류:', error);
        res.json({ success: false, error: '서버 오류가 발생했습니다.' });
    }
});

// 텔레그램 로그인 - 3단계: 2단계 인증 비밀번호
app.post('/telegram/verify-password', async (req, res) => {
    try {
        const { password } = req.body;
        
        if (!password) {
            return res.json({ success: false, error: '비밀번호를 입력해주세요.' });
        }
        
        const result = await TelegramClientService.signInWithPassword(password);
        res.json(result);
    } catch (error) {
        console.error('2단계 인증 오류:', error);
        res.json({ success: false, error: '서버 오류가 발생했습니다.' });
    }
});

// 저장된 세션으로 로그인
app.post('/telegram/login-session', async (req, res) => {
    try {
        const { sessionString } = req.body;
        
        if (!sessionString) {
            return res.json({ success: false, error: '세션 문자열을 입력해주세요.' });
        }
        
        const result = await TelegramClientService.loginWithSession(sessionString);
        res.json(result);
    } catch (error) {
        console.error('세션 로그인 오류:', error);
        res.json({ success: false, error: '서버 오류가 발생했습니다.' });
    }
});

// 메시지 감지 시작
app.post('/telegram/start-listener', async (req, res) => {
    try {
        const { chatId } = req.body;
        
        if (!chatId) {
            return res.json({ success: false, error: '채팅방 ID를 입력해주세요.' });
        }
        
        const result = await TelegramClientService.startMessageListener(chatId);
        res.json(result);
    } catch (error) {
        console.error('메시지 감지 시작 오류:', error);
        res.json({ success: false, error: '서버 오류가 발생했습니다.' });
    }
});

// 텔레그램 상태 확인
app.get('/telegram/status', (req, res) => {
    try {
        const status = TelegramClientService.getStatus();
        res.json(status);
    } catch (error) {
        console.error('상태 확인 오류:', error);
        res.json({ isConnected: false, hasSession: false, error: '상태 확인 실패' });
    }
});

// SMS 테스트 발송
app.post('/test-sms', async (req, res) => {
    try {
        const { phoneNumber, message } = req.body;
        
        if (!phoneNumber || !message) {
            return res.json({ success: false, error: '전화번호와 메시지를 모두 입력해주세요.' });
        }
        
        const result = await smsService.sendSMS(phoneNumber, message);
        res.json(result);
    } catch (error) {
        console.error('SMS 테스트 발송 오류:', error);
        res.json({ success: false, error: '서버 오류가 발생했습니다.' });
    }
});

// 서버 시작
async function startServer() {
    try {
        await ensureDataFolder();
        
        app.listen(PORT, () => {
            console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
            console.log(`웹 인터페이스: http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('서버 시작 오류:', error);
        process.exit(1);
    }
}

startServer();