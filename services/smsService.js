const axios = require('axios');
const configManager = require('../utils/configManager');

class SMSService {
    constructor() {
        this.baseUrl = 'https://therich2.com';
        this.token = null;
        this.tokenExpires = null;
    }

    get apiKey() {
        return configManager.get('SMS_API_KEY');
    }

    get apiSecret() {
        return configManager.get('SMS_API_SECRET');
    }

    isValidPhoneNumber(phoneNumber) {
        // 한국 휴대폰 번호 형식 검증 (010으로 시작하는 11자리 숫자)
        const phoneRegex = /^010\d{8}$/;
        return phoneRegex.test(phoneNumber);
    }

    async getToken() {
        // 토큰이 있고 만료되지 않았으면 기존 토큰 사용
        if (this.token && this.tokenExpires && new Date() < new Date(this.tokenExpires)) {
            return this.token;
        }

        try {
            // API 키와 시크릿이 없으면 에러
            if (!this.apiKey || !this.apiSecret) {
                throw new Error('SMS API 키와 시크릿이 설정되지 않았습니다.');
            }

            console.log(`SMS API 인증 요청: API 키=${this.apiKey}, 시크릿=${this.apiSecret ? '설정됨' : '없음'}`);

            // API 문서에 따른 인증 방식: ACCESS_KEY:SECRET_KEY를 Base64 인코딩
            const authString = `${this.apiKey}:${this.apiSecret}`;
            const encoded = Buffer.from(authString).toString('base64');

            // 토큰 요청
            const response = await axios({
                method: 'post',
                url: `${this.baseUrl}/api/v1/token`,
                headers: {
                    'Authorization': `Basic ${encoded}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            // 응답 로그 출력
            console.log('SMS API 토큰 응답:', response.data);

            // 실제 응답 구조에 맞게 토큰 파싱
            if (response.data && response.data.data && response.data.data.token) {
                this.token = response.data.data.token;
                this.tokenExpires = response.data.data.expires_at;
                console.log('SMS API 토큰 발급 성공:', this.token.substring(0, 10) + '...');
                return this.token;
            } else if (response.data && response.data.token) {
                // 백업: 직접 토큰이 있는 경우
                this.token = response.data.token;
                this.tokenExpires = response.data.expires_at;
                console.log('SMS API 토큰 발급 성공:', this.token.substring(0, 10) + '...');
                return this.token;
            } else {
                throw new Error('토큰이 응답에 포함되지 않았습니다');
            }
        } catch (error) {
            console.error('SMS API 토큰 발급 실패:', error.response?.data || error.message);
            if (error.response) {
                console.error('상태 코드:', error.response.status);
                console.error('헤더:', error.response.headers);
                console.error('데이터:', error.response.data);
            }
            throw new Error('SMS API 토큰 발급에 실패했습니다: ' + (error.response?.data?.message || error.message));
        }
    }

    async checkCredits() {
        try {
            const token = await this.getToken();
            
            const response = await axios.get(
                `${this.baseUrl}/api/v1/credits`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            // 실제 응답 구조에 맞게 수정
            const creditData = response.data.data || response.data;

            return {
                success: true,
                balanceCredits: creditData.balance_credits,
                availableCounts: creditData.available_counts
            };
        } catch (error) {
            console.error('크레딧 조회 실패:', error.response?.data || error.message);
            return {
                success: false,
                error: '크레딧 조회에 실패했습니다.'
            };
        }
    }

    async sendSMS(phoneNumber, message) {
        try {
            // 전화번호 형식 검증
            if (!this.isValidPhoneNumber(phoneNumber)) {
                return {
                    success: false,
                    error: '유효하지 않은 전화번호 형식입니다.'
                };
            }

            // 토큰 가져오기
            const token = await this.getToken();

            // API 문서에 따른 요청 구조
            const requestData = {
                subject: '[자동발송]',
                content: message,
                contacts: [
                    {
                        contact: phoneNumber,
                        name: '수신자'
                    }
                ]
            };

            console.log('SMS 발송 요청:', JSON.stringify(requestData, null, 2));

            // 메시지 발송 요청
            const response = await axios.post(
                `${this.baseUrl}/api/v1/global-messages/send`,
                requestData,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log('SMS 발송 응답:', JSON.stringify(response.data, null, 2));

            // API 응답 구조 확인 - message가 "Success"이면 성공
            if (response.data && response.data.message === 'Success') {
                return {
                    success: true,
                    messageId: response.data.data?.management_code || 'SMS 발송 성공'
                };
            } else if (response.data && response.data.management_code) {
                return {
                    success: true,
                    messageId: response.data.management_code
                };
            } else {
                return {
                    success: false,
                    error: response.data?.message || 'SMS 발송 실패'
                };
            }
        } catch (error) {
            console.error('SMS 발송 중 오류 발생:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.message || '서버 오류가 발생했습니다.'
            };
        }
    }
}

module.exports = new SMSService(); 