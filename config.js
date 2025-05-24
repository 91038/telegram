require('dotenv').config();

// SMS 메시지 템플릿 설정
const fs = require('fs');
const path = require('path');

const SMS_TEMPLATES = {
  default: "안녕하세요, 자동 발송 메시지입니다.",
  promotion: "[프로모션] 특별 할인 이벤트가 진행 중입니다. 지금 확인하세요!",
  reminder: "[알림] 예약하신 일정이 있습니다. 확인 부탁드립니다.",
  verification: "[인증] 인증번호는 [CODE]입니다. 3분 이내에 입력해주세요."
};

// 전화번호 정규식 패턴
const PHONE_PATTERNS = {
  // 하이픈 있는 형식 (010-1234-5678)
  withHyphen: /01[0-9]-\d{3,4}-\d{4}/g,
  // 하이픈 없는 형식 (01012345678)
  withoutHyphen: /01[0-9]\d{7,8}/g
};

// 템플릿 불러오기
try {
  const templatesPath = path.join(__dirname, 'data', 'templates.json');
  if (fs.existsSync(templatesPath)) {
    const templates = JSON.parse(fs.readFileSync(templatesPath, 'utf8'));
    Object.assign(SMS_TEMPLATES, templates);
  }
} catch (error) {
  console.warn('템플릿 파일을 불러오는데 실패했습니다:', error.message);
}

module.exports = {
  // 텔레그램 설정
  TELEGRAM_API_ID: process.env.TELEGRAM_API_ID,
  TELEGRAM_API_HASH: process.env.TELEGRAM_API_HASH,
  TELEGRAM_SESSION_STRING: process.env.TELEGRAM_SESSION_STRING,
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
  
  // SMS 설정
  SMS_API_KEY: process.env.SMS_API_KEY,
  SMS_API_SECRET: process.env.SMS_API_SECRET,
  SMS_SENDER_NUMBER: process.env.SMS_SENDER_NUMBER,
  
  // 메시지 템플릿
  MESSAGE_TEMPLATE_1: process.env.MESSAGE_TEMPLATE_1 || '안녕하세요! 첫 번째 자동 메시지입니다.',
  MESSAGE_TEMPLATE_2: process.env.MESSAGE_TEMPLATE_2 || '두 번째 메시지를 보내드립니다.',
  MESSAGE_TEMPLATE_3: process.env.MESSAGE_TEMPLATE_3 || '마지막 메시지입니다. 감사합니다.',
  
  // 기본 설정
  DEFAULT_TEMPLATE: 'template1',
  
  // SMS 템플릿 (기존 호환성)
  SMS_TEMPLATES: {
    template1: process.env.MESSAGE_TEMPLATE_1 || '안녕하세요! 첫 번째 자동 메시지입니다.',
    template2: process.env.MESSAGE_TEMPLATE_2 || '두 번째 메시지를 보내드립니다.',
    template3: process.env.MESSAGE_TEMPLATE_3 || '마지막 메시지입니다. 감사합니다.'
  },
  
  // 텔레그램 명령어
  COMMANDS: {
    help: '도움말 표시',
    status: '서버 상태 확인',
    template: '메시지 템플릿 변경'
  }
}; 