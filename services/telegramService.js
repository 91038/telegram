const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const input = require('input');
const dotenv = require('dotenv');

dotenv.config();

class TelegramService {
    constructor() {
        this.apiId = parseInt(process.env.TELEGRAM_API_ID);
        this.apiHash = process.env.TELEGRAM_API_HASH;
        this.session = new StringSession(process.env.TELEGRAM_SESSION || '');
        this.client = null;
    }

    async initialize() {
        try {
            this.client = new TelegramClient(this.session, this.apiId, this.apiHash, {
                connectionRetries: 5,
            });
            await this.client.connect();
            return true;
        } catch (error) {
            console.error('텔레그램 클라이언트 초기화 실패:', error);
            return false;
        }
    }

    async login(phoneNumber) {
        try {
            if (!this.client) {
                await this.initialize();
            }

            const { phoneCodeHash } = await this.client.sendCode({
                apiId: this.apiId,
                apiHash: this.apiHash,
                phoneNumber: phoneNumber,
            });

            return { success: true, phoneCodeHash };
        } catch (error) {
            console.error('로그인 실패:', error);
            return { success: false, error: error.message };
        }
    }

    async verifyCode(phoneNumber, phoneCodeHash, code) {
        try {
            await this.client.signIn({
                phoneNumber,
                phoneCodeHash,
                phoneCode: code,
            });

            const sessionString = this.client.session.save();
            return { success: true, session: sessionString };
        } catch (error) {
            console.error('인증 코드 확인 실패:', error);
            return { success: false, error: error.message };
        }
    }

    async sendMessage(chatId, message) {
        try {
            if (!this.client) {
                await this.initialize();
            }
            await this.client.sendMessage(chatId, { message });
            return { success: true };
        } catch (error) {
            console.error('메시지 전송 실패:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new TelegramService(); 