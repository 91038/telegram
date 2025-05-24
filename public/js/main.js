/**
 * 텔레그램 SMS 자동 발송 시스템 - 메인 자바스크립트 파일
 */

// 서버 상태 확인 함수
function checkServerStatus() {
    axios.get('/api/status')
        .then(function(response) {
            const status = response.data;
            updateStatusIndicators(status);
        })
        .catch(function(error) {
            console.error('서버 상태 확인 실패:', error);
        });
}

// 상태 표시기 업데이트
function updateStatusIndicators(status) {
    const telegramStatus = document.getElementById('telegramStatus');
    if (telegramStatus) {
        if (status.telegramConnected) {
            telegramStatus.className = 'badge bg-success';
            telegramStatus.textContent = '연결됨';
        } else {
            telegramStatus.className = 'badge bg-danger';
            telegramStatus.textContent = '연결 안됨';
        }
    }
    
    const chatCount = document.getElementById('chatCount');
    if (chatCount && status.targetChats) {
        chatCount.textContent = status.targetChats.length;
    }
    
    const currentTemplate = document.getElementById('currentTemplate');
    if (currentTemplate) {
        currentTemplate.textContent = status.currentTemplate || 'default';
    }
    
    const uptime = document.getElementById('uptime');
    if (uptime) {
        uptime.textContent = status.uptime || '-';
    }
}

// 최근 로그 업데이트
function updateActivityLog(activities) {
    const activityLog = document.getElementById('activityLog');
    if (!activityLog) return;
    
    // 기존 로그 비우기
    activityLog.innerHTML = '';
    
    if (activities && activities.length > 0) {
        // 로그 추가
        activities.forEach(function(activity) {
            const row = document.createElement('tr');
            
            // 시간
            const timeCell = document.createElement('td');
            timeCell.textContent = activity.timestamp;
            row.appendChild(timeCell);
            
            // 채팅방
            const chatCell = document.createElement('td');
            chatCell.textContent = activity.chatName;
            row.appendChild(chatCell);
            
            // 전화번호
            const phoneCell = document.createElement('td');
            phoneCell.textContent = activity.phoneNumber;
            row.appendChild(phoneCell);
            
            // 상태
            const statusCell = document.createElement('td');
            const statusBadge = document.createElement('span');
            statusBadge.className = activity.status === 'success' ? 'badge bg-success' : 'badge bg-danger';
            statusBadge.textContent = activity.status === 'success' ? '성공' : '실패';
            statusCell.appendChild(statusBadge);
            row.appendChild(statusCell);
            
            activityLog.appendChild(row);
        });
    } else {
        // 로그가 없을 경우
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.setAttribute('colspan', '4');
        cell.className = 'text-center';
        cell.textContent = '최근 활동이 없습니다.';
        row.appendChild(cell);
        activityLog.appendChild(row);
    }
}

// 토스트 알림 표시
function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        // 토스트 컨테이너 생성
        const container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'position-fixed bottom-0 end-0 p-3';
        container.style.zIndex = '5';
        document.body.appendChild(container);
    }
    
    // 토스트 ID 생성
    const toastId = 'toast-' + Date.now();
    
    // 토스트 HTML 생성
    const toastHtml = `
        <div id="${toastId}" class="toast align-items-center text-white bg-${type}" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="d-flex">
                <div class="toast-body">
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>
    `;
    
    // 토스트 추가
    document.getElementById('toastContainer').innerHTML += toastHtml;
    
    // 토스트 객체 생성 및 표시
    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement, { delay: 3000 });
    toast.show();
    
    // 토스트가 닫힌 후 DOM에서 제거
    toastElement.addEventListener('hidden.bs.toast', function() {
        toastElement.remove();
    });
}

// 페이지 로드 완료 시
document.addEventListener('DOMContentLoaded', function() {
    // 서버 상태 주기적 확인 (10초마다)
    checkServerStatus();
    setInterval(checkServerStatus, 10000);
    
    // 토스트 컨테이너 초기화
    if (!document.getElementById('toastContainer')) {
        const container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'position-fixed bottom-0 end-0 p-3';
        container.style.zIndex = '5';
        document.body.appendChild(container);
    }

    const telegramLoginForm = document.getElementById('telegramLoginForm');
    const telegramVerifyForm = document.getElementById('telegramVerifyForm');
    const smsForm = document.getElementById('smsForm');
    const statusMessage = document.getElementById('statusMessage');

    let phoneCodeHash = null;
    let phoneNumber = null;

    // 상태 메시지 업데이트 함수
    function updateStatus(message, type = 'info') {
        if (statusMessage) {
            statusMessage.className = `alert alert-${type}`;
            statusMessage.textContent = message;
        }
    }

    // 텔레그램 로그인 폼 제출
    if (telegramLoginForm) {
        telegramLoginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            phoneNumber = document.getElementById('phoneNumber').value;

            try {
                const response = await fetch('/api/telegram/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ phoneNumber })
                });

                const data = await response.json();
                if (data.success) {
                    phoneCodeHash = data.phoneCodeHash;
                    telegramLoginForm.style.display = 'none';
                    if (telegramVerifyForm) {
                        telegramVerifyForm.style.display = 'block';
                    }
                    updateStatus('인증 코드가 전송되었습니다. 텔레그램 앱을 확인해주세요.', 'success');
                } else {
                    updateStatus(data.error, 'danger');
                }
            } catch (error) {
                updateStatus('서버 오류가 발생했습니다.', 'danger');
            }
        });
    }

    // 텔레그램 인증 코드 확인
    if (telegramVerifyForm) {
        telegramVerifyForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const code = document.getElementById('verificationCode').value;

            try {
                const response = await fetch('/api/telegram/verify', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        phoneNumber,
                        phoneCodeHash,
                        code
                    })
                });

                const data = await response.json();
                if (data.success) {
                    updateStatus('텔레그램 로그인이 완료되었습니다.', 'success');
                    telegramVerifyForm.style.display = 'none';
                    if (telegramLoginForm) {
                        telegramLoginForm.style.display = 'block';
                    }
                } else {
                    updateStatus(data.error, 'danger');
                }
            } catch (error) {
                updateStatus('서버 오류가 발생했습니다.', 'danger');
            }
        });
    }

    // SMS 발송 폼 제출
    if (smsForm) {
        smsForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const phoneNumber = document.getElementById('smsPhoneNumber').value;
            const message = document.getElementById('message').value;

            try {
                const response = await fetch('/api/sms/send', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ phoneNumber, message })
                });

                const data = await response.json();
                if (data.success) {
                    updateStatus('SMS가 성공적으로 발송되었습니다.', 'success');
                    smsForm.reset();
                } else {
                    updateStatus(data.error, 'danger');
                }
            } catch (error) {
                updateStatus('서버 오류가 발생했습니다.', 'danger');
            }
        });
    }
}); 