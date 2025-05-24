# 문자 사이트 API 연동 가이드

이 문서는 THERICH2 API를 활용하여 시스템 통합 및 자동화를 시작할 수 있는 방법을 설명합니다.

## 기본 개념

### 요청 및 응답 형식
- 요청 및 응답은 JSON 형식입니다.
- 응답에 포함된 필드는 별도 안내 없이 추가될 수 있으므로, 알지 못하는 필드는 무시해도 됩니다.
- URL 경로 문자열은 반드시 이스케이프 처리해야 하며, 자바스크립트의 `encodeURIComponent` 함수를 사용할 수 있습니다.

### API Base URL
- 기본 URL : `https://therich2.com`
- 예시: `${baseUrl}/api/v1/token`

## 인증 방식

### 인증 개요
API를 사용하기 위해서는 API Secret Key가 필요하며, 인증을 위해 토큰을 발급받아야 합니다.

### 토큰 발급 API

#### 요청
`POST /api/v1/token`

#### 헤더
| 키               | 값                                      | 설명                     |
|------------------|-----------------------------------------|--------------------------|
| Authorization    | Basic {ENCODED_SECRET_KEY}              | Base64 인코딩된 액세스 키와 시크릿 키 |
| Content-Type     | application/x-www-form-urlencoded       | 고정 값                   |

#### 요청 시 엑세스 키와 시크릿 키 연결
ACCESS_KEY:SECRET_KEY

pgsql
복사
- 해당 문자열을 Base64로 인코딩하여 `Authorization` 헤더에 설정합니다.

#### 응답
**성공**
```json
{
  "token": "MjB8M2NjYjI1YzRiNzY1Y2ExMTIxZDZhMGQ5NDdlY2RhNTQuMDJjOTRhNWIwODU2",
  "expires_at": "2024-09-04T07:28:21.148947Z"
}
실패

HTTP 에러 코드와 함께 에러 객체가 반환됩니다.

크레딧 조회 API
요청
GET /api/v1/credits

헤더
키	값	설명
Authorization	Bearer {ACCESS_TOKEN}	발급받은 액세스 토큰

응답
성공

json
복사
{
  "balance_credits": 20360,
  "available_counts": {
    "sms": 1018,
    "lms": 509,
    "mms": 290.8571428571429,
    "kakao_fr": 2036,
    "kakao_fr_image": 581.7142857142858,
    "kakao_fr_wide": 509,
    "kakao_fr_list": 509,
    "kakao_fr_commerce": 509,
    "kakao_fr_feed": 509,
    "kakao_fr_carousel": 509,
    "kakao_fr_premium": 509,
    "kakao_no": 2036
  }
}
실패

HTTP 상태 코드와 함께 에러 객체가 반환됩니다.

글로벌 메시지 캠페인 API
글로벌 메시지 캠페인 객체
필드	타입	필수 여부	설명
management_code	string	필수	메시지 캠페인 코드
sender_id	string	필수	발신번호의 id 값
campaign_type	string	필수	메시지 캠페인 타입 (SMS, AGENT)
status	string	필수	캠페인의 상태 (PENDING, PROGRESS, SUCCESS 등)
subject	string	필수	메시지 제목
content	string	필수	메시지 내용
message_count	integer	필수	발송 메시지 총 수량
success_count	integer	필수	성공적으로 발송된 수량
pending_count	integer	필수	대기 중인 메시지 수량
failed_count	integer	필수	실패한 메시지 수량
canceled_count	integer	필수	취소된 메시지 수량
sending_at	string	선택	발송시간
items	array	필수	수신자 정보

글로벌 메시지 캠페인 발송 API
POST /api/v1/global-messages/send

요청 파라미터
필드	타입	필수 여부	설명
subject	string	필수	메시지 제목
content	string	필수	메시지 내용
contacts	array	필수	수신자 목록

예제 코드
PHP, Node.js 코드 예시 제공

주의사항
토큰 만료: 발급 후 24시간 내에 유효 기간이 만료되므로, 만료 전 새 토큰을 발급받는 것이 좋습니다.

크레딧 부족: 크레딧 잔액이 부족하면 메시지 발송이 실패할 수 있습니다. 각 메시지 유형별로 필요한 크레딧을 확인하여 발송 가능 여부를 체크하세요.

복사

이 마크다운 문서는 제공하신 API와 그 사용법에 대한 가이드를 포함하고 있습니다.