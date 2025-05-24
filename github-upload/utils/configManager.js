const fs = require('fs');
const path = require('path');

class ConfigManager {
    constructor() {
        this.configFile = path.join(__dirname, '..', 'config.txt');
        this.config = {};
        this.loadConfig();
    }

    loadConfig() {
        try {
            if (fs.existsSync(this.configFile)) {
                const content = fs.readFileSync(this.configFile, 'utf8');
                const lines = content.split('\n');
                
                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (trimmedLine && !trimmedLine.startsWith('#')) {
                        const [key, ...valueParts] = trimmedLine.split('=');
                        if (key && valueParts.length > 0) {
                            this.config[key.trim()] = valueParts.join('=').trim();
                        }
                    }
                }
                console.log('설정 파일 로드 완료:', Object.keys(this.config).length, '개 항목');
            } else {
                console.log('설정 파일이 없습니다. 기본 설정으로 생성합니다.');
                this.createDefaultConfig();
            }
        } catch (error) {
            console.error('설정 파일 로드 오류:', error);
            this.config = {};
        }
    }

    createDefaultConfig() {
        const defaultConfig = `# 텔레그램 자동 문자 발송 시스템 설정 파일
# 각 줄은 KEY=VALUE 형식으로 작성하세요
# #으로 시작하는 줄은 주석입니다

# 텔레그램 API 설정
TELEGRAM_API_ID=22902844
TELEGRAM_API_HASH=795d4d7c1fad2f09e1f840d880335f19
TELEGRAM_SESSION_STRING=

# SMS API 설정 (therich2.com)
SMS_API_KEY=c3370f021b992043c0161b92c6da8c1f
SMS_API_SECRET=2783504dcf921ea305430b2e7812b7d403dcf5f00669f36df96098fa1d6b6a97

# 메시지 템플릿 (3개까지 설정 가능)
MESSAGE_TEMPLATE_1=안녕하세요! 첫 번째 메시지입니다.
MESSAGE_TEMPLATE_2=두 번째 메시지입니다.
MESSAGE_TEMPLATE_3=세 번째 메시지입니다.

# 모니터링할 텔레그램 채팅방 ID 또는 사용자명
TELEGRAM_CHAT_ID=
`;

        try {
            fs.writeFileSync(this.configFile, defaultConfig, 'utf8');
            console.log('기본 설정 파일이 생성되었습니다:', this.configFile);
            this.loadConfig();
        } catch (error) {
            console.error('기본 설정 파일 생성 오류:', error);
        }
    }

    saveConfig() {
        try {
            const lines = [];
            lines.push('# 텔레그램 자동 문자 발송 시스템 설정 파일');
            lines.push('# 각 줄은 KEY=VALUE 형식으로 작성하세요');
            lines.push('# #으로 시작하는 줄은 주석입니다');
            lines.push('');
            lines.push('# 텔레그램 API 설정');
            lines.push(`TELEGRAM_API_ID=${this.config.TELEGRAM_API_ID || '22902844'}`);
            lines.push(`TELEGRAM_API_HASH=${this.config.TELEGRAM_API_HASH || '795d4d7c1fad2f09e1f840d880335f19'}`);
            lines.push(`TELEGRAM_SESSION_STRING=${this.config.TELEGRAM_SESSION_STRING || ''}`);
            lines.push('');
            lines.push('# SMS API 설정 (therich2.com)');
            lines.push(`SMS_API_KEY=${this.config.SMS_API_KEY || 'c3370f021b992043c0161b92c6da8c1f'}`);
            lines.push(`SMS_API_SECRET=${this.config.SMS_API_SECRET || '2783504dcf921ea305430b2e7812b7d403dcf5f00669f36df96098fa1d6b6a97'}`);
            lines.push('');
            lines.push('# 메시지 템플릿 (3개까지 설정 가능)');
            lines.push(`MESSAGE_TEMPLATE_1=${this.config.MESSAGE_TEMPLATE_1 || ''}`);
            lines.push(`MESSAGE_TEMPLATE_2=${this.config.MESSAGE_TEMPLATE_2 || ''}`);
            lines.push(`MESSAGE_TEMPLATE_3=${this.config.MESSAGE_TEMPLATE_3 || ''}`);
            lines.push('');
            lines.push('# 모니터링할 텔레그램 채팅방 ID 또는 사용자명');
            lines.push(`TELEGRAM_CHAT_ID=${this.config.TELEGRAM_CHAT_ID || ''}`);

            fs.writeFileSync(this.configFile, lines.join('\n'), 'utf8');
            console.log('설정 파일 저장 완료');
            return true;
        } catch (error) {
            console.error('설정 파일 저장 오류:', error);
            return false;
        }
    }

    get(key) {
        return this.config[key] || '';
    }

    set(key, value) {
        this.config[key] = value;
        return this.saveConfig();
    }

    updateMultiple(updates) {
        try {
            for (const [key, value] of Object.entries(updates)) {
                this.config[key] = value;
            }
            return this.saveConfig();
        } catch (error) {
            console.error('다중 설정 업데이트 오류:', error);
            return false;
        }
    }

    getAll() {
        return { ...this.config };
    }

    reload() {
        this.loadConfig();
    }
}

module.exports = new ConfigManager(); 