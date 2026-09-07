/**
 * HTeng 관리자 페이지 핵심 기능 스크립트
 * 
 * 주요 기능:
 * - 관리자 페이지 초기화
 * - 사용자 정보 표시
 * - 시스템 통계 로딩
 * - 콘텐츠 관리 섹션 제어
 * - 이벤트 리스너 관리
 * 
 * 최적화 제안:
 * - 데이터 캐싱 구현
 * - 에러 핸들링 강화
 * - 성능 모니터링 추가
 * - 보안 강화 (XSS 방지, 입력 검증)
 * - 접근성 개선
 * - 모바일 반응형 지원
 */

// ==================== 관리자 페이지 초기화 ====================
/**
 * 관리자 페이지를 초기화하는 메인 함수
 * 
 * 주요 기능:
 * - 사용자 정보 표시
 * - 시스템 통계 로딩
 * - 콘텐츠 관리 섹션 기본 표시
 * - 이벤트 리스너 설정
 * 
 * TODO: 
 * - 초기화 실패 시 재시도 메커니즘
 * - 로딩 상태 표시
 * - 에러 복구 로직
 */
function initAdmin() {
  console.log('관리자 페이지 초기화 시작');

  // 사용자 정보 표시
  displayUserInfo();

  // 초기 데이터 로드
  loadStats();
  // loadUsers(); // 사용자 관리 기능 제거됨
  // loadCompanyInfo(); // 이 함수가 존재하는지 확인 필요
  // loadIntroPagesInfo(); // 이 함수가 존재하는지 확인 필요

  // 콘텐츠 관리 섹션을 기본적으로 표시
  showContentManagement();
}

// ==================== 사용자 정보 관리 ====================
/**
 * 현재 로그인한 사용자 정보를 화면에 표시하는 함수
 * 
 * TODO: 
 * - 사용자 프로필 이미지 표시
 * - 마지막 로그인 시간 표시
 * - 권한 레벨 표시
 */
function displayUserInfo() {
  // localStorage 우선 확인, 없으면 sessionStorage 확인
  const username = localStorage.getItem('auth_user') || sessionStorage.getItem('auth_user');
  const displayName = localStorage.getItem('auth_displayName') || sessionStorage.getItem('auth_displayName');

  if (username && displayName) {
    const currentUserElement = document.getElementById('currentUser');
    if (currentUserElement) {
      currentUserElement.innerHTML = `
                <i class="fas fa-user"></i> ${displayName} (${username})
            `;
    }
  } else {
    console.warn('사용자 정보를 찾을 수 없음');
  }
}

// ==================== 로그아웃 기능 ====================
/**
 * 사용자 로그아웃을 처리하는 함수
 * 
 * 보안 강화 제안:
 * - 서버에 로그아웃 요청 전송
 * - 토큰 블랙리스트 관리
 * - 세션 정리
 */
function logout() {
  if (confirm('정말로 로그아웃하시겠습니까?')) {
    // TODO: 서버에 로그아웃 요청 전송
    // await fetch('/api/auth/logout', { method: 'POST' });

    // localStorage와 sessionStorage 모두 클리어
    localStorage.clear();
    sessionStorage.clear();

    // 로그인 페이지로 리다이렉트
    window.location.href = 'HT_eng-Admin-Login.html';
  }
}

// ==================== 이벤트 리스너 설정 ====================
/**
 * 관리자 페이지의 모든 이벤트 리스너를 설정하는 함수
 * 
 * TODO: 
 * - 이벤트 위임 패턴 사용
 * - 동적 요소에 대한 이벤트 바인딩
 * - 에러 핸들링 강화
 */
function setupEventListeners() {
  console.log('이벤트 리스너 설정 시작');

  // 사용자 관리 관련 이벤트 리스너 제거 (기능 제거됨)
  // document.getElementById('addUserForm').addEventListener('submit', handleAddUser);

  // 회사 정보 폼 이벤트 리스너 (존재하는 경우에만)
  const companyForm = document.getElementById('companyForm');
  if (companyForm) {
    companyForm.addEventListener('submit', handleCompanyUpdate);
    console.log('회사 정보 폼 이벤트 리스너 설정됨');
  } else {
    console.log('회사 정보 폼을 찾을 수 없음');
  }
}

// ==================== 시스템 통계 관리 ====================
/**
 * 서버에서 시스템 통계를 로드하고 표시하는 함수
 * 
 * 주요 기능:
 * - 인증 토큰 검증
 * - API 호출 및 응답 처리
 * - 통계 데이터 화면 업데이트
 * - 에러 핸들링
 * 
 * TODO: 
 * - 데이터 캐싱 구현
 * - 실시간 업데이트 (WebSocket)
 * - 차트 시각화
 * - 성능 메트릭 추가
 */
async function loadStats() {
  console.log('통계 로드 시작');

  try {
    const token = sessionStorage.getItem('auth_token');
    console.log('인증 토큰:', token ? '존재함' : '없음');

    if (!token) {
      console.error('인증 토큰이 없음');
      return;
    }

    const response = await fetch('http://localhost:3000/api/admin/summary', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('통계 API 응답 상태:', response.status);

    if (response.ok) {
      const data = await response.json();
      console.log('받은 통계 데이터:', data);

      // 사용자 관련 통계는 제거된 기능이므로 주석 처리
      // document.getElementById('totalUsers').textContent = data.totalUsers || '0';
      // document.getElementById('activeUsers').textContent = data.activeUsers || '0';
      // document.getElementById('pendingUsers').textContent = data.pendingUsers || '0';

      // 제품 통계만 업데이트
      const totalProductsElement = document.getElementById('totalProducts');
      if (totalProductsElement) {
        totalProductsElement.textContent = data.totalProducts || '0';
        console.log('제품 수 업데이트됨:', data.totalProducts || '0');
      } else {
        console.error('totalProducts 요소를 찾을 수 없음');
      }
    } else {
      console.error('통계 로드 실패:', response.status);
      // 실패 시 기본값 표시
      const totalProductsElement = document.getElementById('totalProducts');
      if (totalProductsElement) {
        totalProductsElement.textContent = '0';
      }
    }
  } catch (error) {
    console.error('통계 로드 실패:', error);
    // 에러 시 기본값 표시
    const totalProductsElement = document.getElementById('totalProducts');
    if (totalProductsElement) {
      totalProductsElement.textContent = '0';
    }
  }
}

// 탭 표시 함수
function showTab(tabName) {
  console.log('showTab 호출됨:', tabName);

  // 모든 탭 내용 숨기기
  const tabContents = document.querySelectorAll('.tab-content');
  tabContents.forEach(content => {
    content.style.display = 'none';
  });

  // 모든 탭 버튼 비활성화
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => {
    btn.classList.remove('active');
  });

  // 선택된 탭 내용 표시
  let targetTab = document.getElementById(tabName + 'Tab');
  if (!targetTab) {
    targetTab = document.getElementById(tabName);
  }

  console.log('찾은 탭 요소:', targetTab);

  if (targetTab) {
    targetTab.style.display = 'block';
    console.log('탭 표시됨:', tabName);
  } else {
    console.error('탭을 찾을 수 없음:', tabName);
  }

  // 선택된 탭 버튼 활성화
  const activeButton = document.querySelector(`[onclick="showTab('${tabName}')"]`);
  if (activeButton) {
    activeButton.classList.add('active');
  }
}

// 섹션 표시/숨기기 함수들
function showUserManagement() {
  document.getElementById('userManagement').style.display = 'block';
  document.getElementById('contentManagement').style.display = 'none';

  // 탭 버튼 활성화
  document.querySelector('[onclick="showUserManagement()"]').classList.add('active');
  document.querySelector('[onclick="showContentManagement()"]').classList.remove('active');
}

function showContentManagement() {
  console.log('showContentManagement 호출됨');

  // userManagement 섹션 숨기기 (이미 제거됨)
  // document.getElementById('userManagement').style.display = 'none';

  // contentManagement 섹션 표시
  const contentSection = document.getElementById('contentManagement');
  if (contentSection) {
    contentSection.style.display = 'block';
    console.log('콘텐츠 관리 섹션이 표시됨');
  } else {
    console.error('contentManagement 섹션을 찾을 수 없음');
  }

  // 탭 버튼 활성화
  const contentBtn = document.querySelector('[onclick="showContentManagement()"]');
  if (contentBtn) {
    contentBtn.classList.add('active');
    console.log('콘텐츠 관리 버튼이 활성화됨');
  }

  // 기본적으로 회사 정보 탭 표시
  showTab('company');
}

// 버튼 상태 관리 함수들
function setButtonLoading(button, isLoading) {
  if (isLoading) {
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 처리중...';
    button.classList.add('loading');
  } else {
    button.disabled = false;
    button.classList.remove('loading');
  }
}

function setButtonSuccess(button) {
  button.classList.remove('loading', 'error');
  button.classList.add('success');
  button.innerHTML = '<i class="fas fa-check"></i> 완료';

  setTimeout(() => {
    button.classList.remove('success');
    button.innerHTML = button.getAttribute('data-original-text') || '저장';
  }, 2000);
}

function setButtonError(button) {
  button.classList.remove('loading', 'success');
  button.classList.add('error');
  button.innerHTML = '<i class="fas fa-times"></i> 실패';

  setTimeout(() => {
    button.classList.remove('error');
    button.innerHTML = button.getAttribute('data-original-text') || '저장';
  }, 2000);
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', function () {
  initAdmin();
  setupEventListeners();
});
