/**
 * 공통 인증 관리 스크립트
 * 
 * 모든 페이지에서 관리자 인증 상태를 확인하고 유지할 수 있습니다.
 * 
 * 주요 기능:
 * - 인증 상태 확인 및 유지
 * - 관리자 권한 검증
 * - 페이지 이동 시 인증 상태 동기화
 * - JWT 토큰 유효성 검증
 * 
 * 최적화 제안:
 * - 토큰 갱신 메커니즘 구현
 * - 인증 상태 캐싱
 * - 에러 핸들링 강화
 * - 성능 모니터링 추가
 * - 보안 강화 (XSS, CSRF 방지)
 */

// ==================== 인증 상태 확인 함수 ====================
/**
 * 현재 저장된 인증 정보를 확인하고 반환하는 함수
 * 
 * @returns {Object} 인증 상태 정보
 * @returns {string} token - JWT 토큰
 * @returns {string} role - 사용자 역할 (admin/user)
 * @returns {string} username - 사용자명
 * @returns {boolean} isAuthenticated - 인증 여부
 */
function checkAuthStatus() {
    // localStorage 우선 확인, 없으면 sessionStorage 확인
    // TODO: 토큰 암호화 저장 고려
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    const role = localStorage.getItem('auth_role') || sessionStorage.getItem('auth_role') || 'user';
    const username = localStorage.getItem('auth_user') || sessionStorage.getItem('auth_user') || '사용자';

    console.log('checkAuthStatus 호출됨:', { token: !!token, role, username });
    return { token, role, username, isAuthenticated: !!token };
}

// ==================== 관리자 권한 확인 함수 ====================
/**
 * 현재 사용자가 관리자 권한을 가지고 있는지 확인하는 함수
 * 
 * @returns {boolean} 관리자 권한 여부
 */
function requireAdmin() {
    const { token, role, username } = checkAuthStatus();

    if (!token || !username || !role) {
        console.log('인증 정보 없음');
        return false;
    }

    if (role !== 'admin') {
        console.log('관리자 권한 없음');
        return false;
    }

    // JWT 토큰 유효성 검증 (선택적)
    try {
        const tokenPayload = JSON.parse(atob(token.split('.')[1]));
        const currentTime = Math.floor(Date.now() / 1000);

        if (tokenPayload.exp && tokenPayload.exp < currentTime) {
            console.log('토큰이 만료됨');
            // TODO: 토큰 갱신 시도
            localStorage.clear();
            sessionStorage.clear();
            return false;
        }

        console.log('토큰 유효성 확인 완료');
        return true;
    } catch (error) {
        console.log('토큰 파싱 오류, 계속 진행:', error);
        // TODO: 토큰 파싱 실패 시 재인증 요청
        return true; // 파싱 실패해도 계속 진행
    }
}

// ==================== 인증 상태 유지 함수 ====================
/**
 * 현재 인증 상태를 유지하고 헤더 UI를 업데이트하는 함수
 * @description 페이지 로드 및 이동 시 인증 상태를 자동으로 유지
 * @performance 인증 상태 확인을 최적화하여 불필요한 API 호출 방지
 * @security 토큰 만료 시 자동 로그아웃 처리
 * 
 * @returns {boolean} 인증 상태 유지 성공 여부
 */
function maintainAuthState() {
    console.log('🔐 maintainAuthState 호출됨');
    const { token, role, username } = checkAuthStatus();

    if (!token) {
        console.log('❌ 인증 토큰이 없습니다.');
        return false;
    }

    // 토큰 만료 확인
    if (isTokenExpired(token)) {
        console.log('⚠️  토큰이 만료되었습니다. 자동 로그아웃 처리');
        logoutUser();
        return false;
    }

    if (role === 'admin') {
        console.log('👑 관리자 인증 상태 유지됨:', username);
    } else {
        console.log('👤 일반 사용자 인증 상태 유지됨:', username);
    }

    // 헤더가 로드된 후 인증 상태 업데이트 (여러 번 시도)
    let attempts = 0;
    const maxAttempts = 30; // 최대 시도 횟수 증가
    const retryInterval = 100; // 재시도 간격 단축

    const tryUpdateAuth = () => {
        // authArea 요소가 존재하는지 확인
        const authArea = document.getElementById('authArea');
        if (!authArea) {
            attempts++;
            if (attempts < maxAttempts) {
                console.log(`⏳ authArea 요소를 찾을 수 없음, ${attempts}/${maxAttempts} 재시도...`);
                setTimeout(tryUpdateAuth, retryInterval);
            } else {
                console.error('❌ authArea 요소를 찾을 수 없음, 최대 시도 횟수 초과');
                // 최종 시도 실패 시 페이지 새로고침으로 재시도
                setTimeout(() => {
                    console.log('🔄 페이지 새로고침으로 재시도...');
                    window.location.reload();
                }, 1000);
            }
            return false;
        }

        if (typeof renderAuthUI === 'function') {
            console.log(`✅ 인증 상태 업데이트 시도 ${attempts + 1}/${maxAttempts}`);
            renderAuthUI();
            console.log('✅ 헤더 인증 상태 업데이트 완료');
            
            // 인증 상태 유지 성공 후 주기적 확인 설정
            setupPeriodicAuthCheck();
            
            return true;
        } else {
            attempts++;
            if (attempts < maxAttempts) {
                console.log(`⏳ renderAuthUI 함수를 찾을 수 없음, ${attempts}/${maxAttempts} 재시도...`);
                setTimeout(tryUpdateAuth, retryInterval);
            } else {
                console.error('❌ renderAuthUI 함수를 찾을 수 없음, 최대 시도 횟수 초과');
            }
            return false;
        }
    };

    // 즉시 시도
    return tryUpdateAuth();
}

/**
 * 토큰 만료 여부를 확인하는 함수
 * @param {string} token - JWT 토큰
 * @returns {boolean} 만료 여부
 */
function isTokenExpired(token) {
    try {
        const tokenPayload = JSON.parse(atob(token.split('.')[1]));
        const currentTime = Math.floor(Date.now() / 1000);
        
        if (tokenPayload.exp && tokenPayload.exp < currentTime) {
            console.log('⚠️  토큰 만료 시간:', new Date(tokenPayload.exp * 1000));
            console.log('⚠️  현재 시간:', new Date(currentTime * 1000));
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('❌ 토큰 파싱 오류:', error);
        return true; // 파싱 실패 시 만료된 것으로 간주
    }
}

/**
 * 사용자 로그아웃 처리
 * @description 모든 인증 데이터를 정리하고 로그인 페이지로 리다이렉트
 */
function logoutUser() {
    console.log('🚪 사용자 로그아웃 처리 중...');
    
    // 모든 인증 데이터 정리
    localStorage.clear();
    sessionStorage.clear();
    
    // 현재 페이지가 로그인 페이지가 아닌 경우에만 리다이렉트
    if (!window.location.pathname.includes('Admin-Login')) {
        console.log('🔄 로그인 페이지로 리다이렉트...');
        window.location.href = '/Web_UI/Admin/HT_eng-Admin-Login.html';
    }
}

/**
 * 주기적 인증 상태 확인 설정
 * @description 인증 상태를 주기적으로 확인하여 토큰 만료 시 자동 로그아웃
 */
function setupPeriodicAuthCheck() {
    // 이미 설정된 경우 중복 설정 방지
    if (window.authCheckInterval) {
        clearInterval(window.authCheckInterval);
    }
    
    // 5분마다 인증 상태 확인
    window.authCheckInterval = setInterval(() => {
        const { token } = checkAuthStatus();
        
        if (token && isTokenExpired(token)) {
            console.log('⚠️  주기적 확인: 토큰이 만료되었습니다.');
            logoutUser();
        }
    }, 5 * 60 * 1000); // 5분
    
    console.log('⏰ 주기적 인증 상태 확인 설정 완료 (5분 간격)');
}

/**
 * 페이지 가시성 변경 시 인증 상태 확인
 * @description 사용자가 다른 탭으로 이동했다가 돌아올 때 인증 상태 재확인
 */
function setupVisibilityChangeHandler() {
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            console.log('👁️  페이지 가시성 변경 감지, 인증 상태 재확인...');
            const { token } = checkAuthStatus();
            
            if (token && isTokenExpired(token)) {
                console.log('⚠️  페이지 복귀 시 토큰 만료 확인');
                logoutUser();
            } else if (token) {
                // 인증 상태가 유효한 경우 헤더 업데이트
                maintainAuthState();
            }
        }
    });
    
    console.log('👁️  페이지 가시성 변경 핸들러 설정 완료');
}

/**
 * 페이지 로드 완료 시 자동 인증 상태 유지 설정
 * @description 모든 페이지에서 자동으로 인증 상태를 유지하도록 설정
 */
function setupAutoAuthMaintenance() {
    // DOM 로드 완료 후 인증 상태 유지 시도
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(maintainAuthState, 100);
        });
    } else {
        setTimeout(maintainAuthState, 100);
    }
    
    // 페이지 가시성 변경 핸들러 설정
    setupVisibilityChangeHandler();
    
    console.log('🔧 자동 인증 상태 유지 설정 완료');
}

// ==================== 페이지 이동 시 인증 상태 유지 ====================
/**
 * 페이지 이동 시에도 인증 상태가 유지되도록 하는 함수
 * 
 * 주요 기능:
 * - beforeunload 이벤트 처리
 * - visibilitychange 이벤트 처리
 * - 페이지 로드 완료 감지
 * - DOMContentLoaded 이벤트 처리
 */
function preserveAuthOnNavigation() {
    console.log('preserveAuthOnNavigation 설정됨');

    // 페이지 이동 시 인증 상태 유지
    window.addEventListener('beforeunload', () => {
        console.log('페이지 이동 감지, 인증 상태 유지');
        // TODO: 페이지 이동 시 필요한 데이터 저장
        // 아무것도 하지 않음 (인증 상태 유지)
    });

    // 페이지 가시성 변경 시 인증 상태 확인
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            console.log('페이지 가시성 변경 감지, 인증 상태 확인');
            maintainAuthState();
        }
    });

    // 페이지 로드 완료 후 인증 상태 확인
    if (document.readyState === 'complete') {
        console.log('페이지 로드 완료, 인증 상태 확인');
        maintainAuthState();
    } else {
        window.addEventListener('load', () => {
            console.log('페이지 로드 이벤트 발생, 인증 상태 확인');
            maintainAuthState();
        });
    }

    // DOMContentLoaded 이벤트 후에도 인증 상태 확인
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            console.log('DOMContentLoaded 이벤트 발생, 인증 상태 확인');
            setTimeout(maintainAuthState, 500);
        });
    }
}

// ==================== 자동 실행 ====================
// 페이지 로드 상태에 따라 적절한 시점에 실행
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', preserveAuthOnNavigation);
} else {
    preserveAuthOnNavigation();
}

// ==================== 전역 함수 노출 ====================
// 다른 스크립트에서 사용할 수 있도록 전역 객체에 함수들을 노출
window.checkAuthStatus = checkAuthStatus;
window.requireAdmin = requireAdmin;
window.maintainAuthState = maintainAuthState;
