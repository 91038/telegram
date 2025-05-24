# 텔레그램 자동 문자 발송 시스템

텔레그램 채팅방에서 전화번호가 포함된 메시지를 감지하면 자동으로 SMS를 발송하는 웹 기반 시스템입니다.

## 🚀 주요 기능

- **웹 기반 텔레그램 로그인**: 콘솔 입력 없이 웹 페이지에서 텔레그램 로그인
- **자동 전화번호 감지**: 채팅방 메시지에서 010-XXXX-XXXX 패턴 자동 감지
- **다중 메시지 발송**: 하나의 전화번호에 최대 3개 메시지 순차 발송
- **웹 기반 설정 관리**: 메시지 템플릿과 채팅방 설정을 웹에서 관리
- **실시간 모니터링**: 텔레그램 채팅방 실시간 모니터링

## 📋 요구사항

- Node.js 14.0 이상
- 텔레그램 API 계정 (https://my.telegram.org/apps)
- SMS API 계정 (therich2.com)

## 🛠️ 설치 및 설정

### 1. 프로젝트 클론
```bash
git clone https://github.com/91038/telegram.git
cd telegram
```

### 2. 의존성 설치
```bash
npm install
```

### 3. 설정 파일 생성
```bash
cp config.example.txt config.txt
```

### 4. 설정 파일 편집
`config.txt` 파일을 열어 다음 정보를 입력하세요:

```
# 텔레그램 API 설정
TELEGRAM_API_ID=YOUR_API_ID
TELEGRAM_API_HASH=YOUR_API_HASH

# SMS API 설정
SMS_API_KEY=YOUR_SMS_API_KEY
SMS_API_SECRET=YOUR_SMS_API_SECRET
```

## 🚀 실행

### 웹 서버 실행
```bash
node web-server.js
```

브라우저에서 `http://localhost:3007`에 접속하세요.

## 📱 사용 방법

### 1. 텔레그램 로그인
1. 웹 페이지에서 전화번호 입력
2. 텔레그램으로 받은 인증 코드 입력
3. 2단계 인증 설정 시 비밀번호 입력

### 2. 메시지 템플릿 설정
1. "메시지 템플릿 설정" 섹션에서 3개 메시지 입력
2. "설정 저장" 버튼 클릭

### 3. 채팅방 모니터링 설정
1. 모니터링할 채팅방 ID 또는 사용자명 입력
2. "검색" 버튼으로 채팅방 확인
3. "모니터링 시작" 버튼 클릭

### 4. 자동 SMS 발송
- 설정된 채팅방에 전화번호(010-XXXX-XXXX)가 포함된 메시지 전송
- 시스템이 자동으로 감지하여 SMS 발송
- 12초 간격으로 3개 메시지 순차 발송

## 📁 프로젝트 구조

```
📁 프로젝트 루트/
├── 📄 web-server.js          # 웹 서버 메인 파일
├── 📄 config.txt             # 설정 파일 (생성 필요)
├── 📄 config.example.txt     # 설정 파일 예제
├── 📄 package.json           # Node.js 의존성
├── 📁 services/
│   ├── 📄 webTelegramService.js  # 텔레그램 서비스
│   └── 📄 smsService.js          # SMS 서비스
├── 📁 utils/
│   └── 📄 configManager.js       # 설정 관리
└── 📁 views/
    └── 📄 index.ejs              # 웹 인터페이스
```

## 🔧 API 설정

### 텔레그램 API
1. https://my.telegram.org/apps 접속
2. 새 애플리케이션 생성
3. API ID와 API Hash 복사

### SMS API (therich2.com)
1. https://therich2.com 회원가입
2. API 키와 시크릿 발급
3. 크레딧 충전

## ⚠️ 주의사항

- `config.txt` 파일에는 민감한 정보가 포함되므로 Git에 커밋하지 마세요
- SMS API는 10초 간격 제한이 있어 메시지 간 12초 대기합니다
- 텔레그램 세션은 자동으로 저장되어 재로그인이 필요하지 않습니다

## 🐛 문제 해결

### 텔레그램 로그인 실패
- API ID와 Hash가 올바른지 확인
- 전화번호 형식이 +821012345678 형태인지 확인

### SMS 발송 실패
- SMS API 크레딧이 충분한지 확인
- API 키와 시크릿이 올바른지 확인

### 모니터링 작동 안함
- 채팅방 ID가 올바른지 확인
- 텔레그램 로그인 상태 확인

## 📄 라이선스

MIT License

## 🤝 기여

이슈나 풀 리퀘스트는 언제든 환영합니다!

## 📞 지원

문제가 있으시면 GitHub Issues를 통해 문의해주세요. 