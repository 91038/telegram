/**
 * 전화번호 추출 유틸리티
 * 메시지에서 다양한 형식의 한국 전화번호를 추출합니다.
 */

class PhoneExtractor {
    constructor() {
        // 다양한 전화번호 패턴들
        this.patterns = [
            // 010-1234-5678 형식
            /01[0-9]-\d{3,4}-\d{4}/g,
            // 010 1234 5678 형식 (공백)
            /01[0-9]\s+\d{3,4}\s+\d{4}/g,
            // 01012345678 형식 (하이픈 없음)
            /01[0-9]\d{7,8}/g,
            // 010.1234.5678 형식 (점으로 구분)
            /01[0-9]\.\d{3,4}\.\d{4}/g,
            // 010_1234_5678 형식 (언더스코어)
            /01[0-9]_\d{3,4}_\d{4}/g,
            // (010) 1234-5678 형식
            /\(01[0-9]\)\s*\d{3,4}-\d{4}/g,
            // +82 10 1234 5678 형식
            /\+82\s*10\s*\d{3,4}\s*\d{4}/g,
            // +82-10-1234-5678 형식
            /\+82-10-\d{3,4}-\d{4}/g,
            // 070 인터넷전화 (070-1234-5678)
            /070-\d{3,4}-\d{4}/g,
            // 070 인터넷전화 (공백)
            /070\s+\d{3,4}\s+\d{4}/g,
            // 070 인터넷전화 (하이픈 없음)
            /070\d{7,8}/g,
            // 02 지역번호 (02-123-4567)
            /02-\d{3,4}-\d{4}/g,
            // 02 지역번호 (공백)
            /02\s+\d{3,4}\s+\d{4}/g,
            // 031-070 지역번호 (031-123-4567)
            /0[3-6][1-4]-\d{3,4}-\d{4}/g
        ];
    }

    /**
     * 메시지에서 전화번호를 추출합니다
     * @param {string} message - 분석할 메시지
     * @returns {Array} 추출된 전화번호 배열 (중복 제거됨)
     */
    extractPhoneNumbers(message) {
        if (!message || typeof message !== 'string') {
            return [];
        }

        const foundNumbers = new Set();

        // 각 패턴으로 전화번호 검색
        for (const pattern of this.patterns) {
            const matches = message.match(pattern);
            if (matches) {
                matches.forEach(match => {
                    const cleaned = this.cleanPhoneNumber(match);
                    if (this.isValidKoreanPhoneNumber(cleaned)) {
                        foundNumbers.add(cleaned);
                    }
                });
            }
        }

        return Array.from(foundNumbers);
    }

    /**
     * 전화번호에서 불필요한 문자를 제거하고 정규화합니다
     * @param {string} phoneNumber - 정리할 전화번호
     * @returns {string} 정리된 전화번호
     */
    cleanPhoneNumber(phoneNumber) {
        if (!phoneNumber) return '';

        let cleaned = phoneNumber.toString();

        // +82로 시작하는 경우 처리
        if (cleaned.startsWith('+82')) {
            cleaned = cleaned.replace('+82', '0');
        }

        // 모든 특수문자와 공백 제거
        cleaned = cleaned.replace(/[\s\-\.\(\)_]/g, '');

        // 숫자만 남기기
        cleaned = cleaned.replace(/[^\d]/g, '');

        return cleaned;
    }

    /**
     * 한국 휴대폰 번호 형식인지 검증합니다
     * @param {string} phoneNumber - 검증할 전화번호
     * @returns {boolean} 유효한 번호인지 여부
     */
    isValidKoreanPhoneNumber(phoneNumber) {
        if (!phoneNumber || typeof phoneNumber !== 'string') {
            return false;
        }

        // 010, 011, 016, 017, 018, 019로 시작하는 10-11자리 번호
        const mobilePattern = /^01[0-9]\d{7,8}$/;
        
        // 02, 031-070으로 시작하는 지역번호 (일반전화)
        const landlinePattern = /^(02|0[3-6][1-4]|070)\d{7,8}$/;

        return mobilePattern.test(phoneNumber) || landlinePattern.test(phoneNumber);
    }

    /**
     * 전화번호를 표준 형식으로 포맷팅합니다
     * @param {string} phoneNumber - 포맷팅할 전화번호
     * @returns {string} 포맷팅된 전화번호
     */
    formatPhoneNumber(phoneNumber) {
        const cleaned = this.cleanPhoneNumber(phoneNumber);
        
        if (!this.isValidKoreanPhoneNumber(cleaned)) {
            return phoneNumber; // 유효하지 않으면 원본 반환
        }

        // 휴대폰 번호 포맷팅
        if (cleaned.startsWith('01')) {
            if (cleaned.length === 10) {
                return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
            } else if (cleaned.length === 11) {
                return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
            }
        }

        // 지역번호 포맷팅
        if (cleaned.startsWith('02')) {
            if (cleaned.length === 9) {
                return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 5)}-${cleaned.slice(5)}`;
            } else if (cleaned.length === 10) {
                return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
            }
        }

        return cleaned;
    }

    /**
     * 메시지에서 전화번호를 찾고 상세 정보를 반환합니다
     * @param {string} message - 분석할 메시지
     * @returns {Object} 추출 결과 정보
     */
    analyzeMessage(message) {
        const phoneNumbers = this.extractPhoneNumbers(message);
        
        return {
            message: message,
            phoneNumbers: phoneNumbers,
            count: phoneNumbers.length,
            formattedNumbers: phoneNumbers.map(num => this.formatPhoneNumber(num)),
            hasPhoneNumbers: phoneNumbers.length > 0
        };
    }
}

module.exports = new PhoneExtractor(); 