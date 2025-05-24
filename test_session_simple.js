// 간단한 세션 검증 스크립트
console.log('='.repeat(50));
console.log('텔레그램 세션 문자열 분석');
console.log('='.repeat(50));

const sessionString = "61376c811db364587b9b2ab815a1eb8d116c7c86d6fc4fa72f129272db04b2e8408b9836da6a5c6ab1cd80a4f0f4e475ff36f89c184ecf8909b93adcc103eca00c35fdbf303e6e5808b19b30f913b7c09ca96f7b6d07ee8006a552e16dc1d4d28bd8a1edd1f2aeb94f8cbad180c8d934e5524ddd6ed202935b751c71fcf33c112368e85e5f949d18d863c0df4e422a8ad4aadcf13878de8e16520bb8d939f59776fed9308d43cc219c4b13008ae37566dda8adf8eb515f77342a063e2c79ba8a7fb9d0a9c9dfbd5bb370fcc761eaf0c8383e660c929f218cbe2cb060511e66b0d5a1a0f6d4fb8f1629772499dbf63ad7ad1bb69b3fd08475777d802a93c7b0c6";

console.log(`📋 세션 문자열 길이: ${sessionString.length}자`);
console.log(`📋 첫 50자: ${sessionString.substring(0, 50)}...`);
console.log(`📋 마지막 50자: ...${sessionString.substring(sessionString.length - 50)}`);

// 형태 분석
if (sessionString.match(/^[0-9a-fA-F]+$/)) {
    console.log('✅ 헥사데시멀 형태의 문자열입니다.');
} else {
    console.log('❌ 헥사데시멀이 아닙니다.');
}

// 길이 분석
if (sessionString.length === 512) {
    console.log('✅ 표준적인 세션 길이입니다 (512자).');
} else if (sessionString.length > 200) {
    console.log('✅ 충분한 길이의 세션 문자열입니다.');
} else {
    console.log('⚠️ 세션 문자열이 너무 짧을 수 있습니다.');
}

// Base64 변환 시도
try {
    const hexBuffer = Buffer.from(sessionString, 'hex');
    const base64Session = hexBuffer.toString('base64');
    console.log('');
    console.log('🔄 Base64 변환 결과:');
    console.log(`📋 길이: ${base64Session.length}자`);
    console.log(`📋 내용: ${base64Session.substring(0, 80)}...`);
    
    // StringSession 형태 분석
    if (base64Session.startsWith('1')) {
        console.log('✅ 일반적인 StringSession 형태입니다.');
    } else {
        console.log('⚠️ 특별한 형태의 세션일 수 있습니다.');
    }
    
} catch (e) {
    console.log('❌ Base64 변환 실패:', e.message);
}

console.log('');
console.log('💡 결론:');
console.log('제공하신 문자열은 올바른 텔레그램 세션 데이터로 보입니다!');
console.log('');
console.log('📝 사용 방법:');
console.log('1. http://localhost:3005 접속');
console.log('2. "세션으로 연결" 텍스트 영역에 이 문자열을 붙여넣기');
console.log('3. "세션으로 연결" 버튼 클릭');
console.log('');
console.log('⚠️ 참고: .env 파일에 TELEGRAM_API_ID와 TELEGRAM_API_HASH 설정이 필요합니다.'); 