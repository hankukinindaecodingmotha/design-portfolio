/**
 * HTeng 홈페이지 JavaScript 기능
 * 
 * 주요 기능:
 * - 배너 슬라이더 (자동/수동 제어)
 * - 브랜드 애니메이션
 * - 메인페이지 데이터 동적 로딩
 * - 관리자 페이지와의 실시간 연동
 * - 인증 상태 관리
 * 
 * 최적화 제안:
 * - 이미지 lazy loading 구현
 * - 애니메이션 성능 최적화
 * - 데이터 캐싱 전략
 * - 에러 핸들링 강화
 * - 접근성 개선
 * - 모바일 최적화
 */

// ==================== 전역 변수 ====================
// 배너 슬라이더 관련 변수
let currentSlide = 0;        // 현재 활성 슬라이드 인덱스
let slideInterval;           // 자동 슬라이드 인터벌 ID
let slides;                  // 슬라이드 요소들
let indicators;              // 슬라이드 인디케이터 요소들

// ==================== 페이지 초기화 ====================
/**
 * 페이지 로드 시 실행되는 메인 함수
 * 
 * 주요 기능:
 * - 인증 상태 확인 및 유지
 * - 헤더 로딩 완료 감지
 * - 애니메이션 초기화
 * - 데이터 로딩
 * - 이벤트 리스너 설정
 */
document.addEventListener('DOMContentLoaded', function () {
    console.log('홈페이지 DOMContentLoaded 이벤트 발생');
    
    // 헤더 로딩 완료 감지 및 인증 상태 업데이트
    const checkHeaderAndAuth = () => {
        const headerContainer = document.getElementById('header-container');
        const authArea = document.getElementById('authArea');
        
        if (headerContainer && headerContainer.children.length > 0 && authArea) {
            console.log('헤더 로딩 완료 감지됨, 인증 상태 업데이트 시작');
            
            // 인증 상태 업데이트
            if (typeof maintainAuthState === 'function') {
                maintainAuthState();
            }
            
            return true;
        }
        
        return false;
    };
    
    // 헤더 로딩 완료까지 대기
    let headerCheckAttempts = 0;
    const maxHeaderCheckAttempts = 50;
    
    const waitForHeader = () => {
        if (checkHeaderAndAuth()) {
            console.log('헤더 로딩 완료 및 인증 상태 업데이트 성공');
        } else {
            headerCheckAttempts++;
            if (headerCheckAttempts < maxHeaderCheckAttempts) {
                console.log(`헤더 로딩 대기 중... ${headerCheckAttempts}/${maxHeaderCheckAttempts}`);
                setTimeout(waitForHeader, 100);
            } else {
                console.error('헤더 로딩 대기 시간 초과');
            }
        }
    };
    
    // 헤더 로딩 완료 확인 시작
    setTimeout(waitForHeader, 100);

    // 기존 애니메이션 기능 유지
    initBrandAnimations();

    // 서버에서 데이터 로드하여 업데이트
    loadMainPageData();

    // 관리자 페이지로부터의 메시지 리스너 추가
    window.addEventListener('message', handleAdminMessage);

    // 배너 슬라이더 초기화
    initBannerSlider();
    
    // 주기적으로 인증 상태 확인 (5초마다)
    setInterval(() => {
        if (typeof maintainAuthState === 'function') {
            maintainAuthState();
        }
    }, 5000);
});

// ==================== 관리자 페이지 연동 ====================
/**
 * 관리자 페이지로부터의 메시지를 처리하는 함수
 * 
 * @param {MessageEvent} event - postMessage 이벤트
 */
function handleAdminMessage(event) {
    if (event.data && event.data.type === 'UPDATE_MAIN_PAGE') {
        console.log('관리자 페이지로부터 업데이트 메시지 수신:', event.data.data);

        // 즉시 홈페이지 업데이트
        updateMainPage(event.data.data);

        // 사용자에게 알림
        showUpdateNotification('관리자 페이지에서 변경한 내용이 즉시 적용되었습니다!');
    }
}

// ==================== 업데이트 알림 시스템 ====================
/**
 * 사용자에게 업데이트 알림을 표시하는 함수
 * 
 * @param {string} message - 표시할 메시지
 */
function showUpdateNotification(message) {
    // 기존 알림이 있다면 제거
    const existingNotification = document.querySelector('.update-notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    // 새 알림 생성
    const notification = document.createElement('div');
    notification.className = 'update-notification';
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-check-circle"></i>
            <span>${message}</span>
            <button onclick="this.parentElement.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

    // 스타일 적용
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
    `;

    // 알림 내용 스타일
    notification.querySelector('.notification-content').style.cssText = `
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 14px;
    `;

    // 닫기 버튼 스타일
    notification.querySelector('button').style.cssText = `
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        padding: 0;
        font-size: 16px;
    `;

    // 애니메이션 CSS 추가
    if (!document.querySelector('#notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }

    // 알림 표시
    document.body.appendChild(notification);

    // 5초 후 자동 제거
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// ==================== 배너 슬라이더 시스템 ====================
/**
 * 배너 슬라이더를 초기화하는 함수
 * 
 * 주요 기능:
 * - 슬라이드 요소 및 인디케이터 참조 설정
 * - 자동 슬라이드 시작
 * - 이벤트 리스너 설정
 */
function initBannerSlider() {
    slides = document.querySelectorAll('.slide');
    indicators = document.querySelectorAll('.indicator');
    
    if (slides.length === 0) {
        console.warn('슬라이드 요소를 찾을 수 없음');
        return;
    }
    
    // 자동 슬라이드 시작
    startAutoSlide();
    
    console.log('배너 슬라이더 초기화 완료');
}

/**
 * 자동 슬라이드를 시작하는 함수
 * 
 * TODO: 사용자 상호작용 시 일시정지 기능 추가
 */
function startAutoSlide() {
    if (slideInterval) {
        clearInterval(slideInterval);
    }
    
    slideInterval = setInterval(() => {
        changeSlide(1);
    }, 5000); // 5초마다 다음 슬라이드
}

/**
 * 자동 슬라이드를 일시정지하는 함수
 */
function pauseAutoSlide() {
    if (slideInterval) {
        clearInterval(slideInterval);
        slideInterval = null;
    }
}

/**
 * 슬라이드를 변경하는 함수
 * 
 * @param {number} direction - 슬라이드 변경 방향 (-1: 이전, 1: 다음)
 */
function changeSlide(direction) {
    if (!slides || slides.length === 0) return;
    
    // 현재 슬라이드 비활성화
    slides[currentSlide].classList.remove('active');
    indicators[currentSlide].classList.remove('active');
    
    // 다음 슬라이드 계산
    currentSlide += direction;
    
    // 슬라이드 범위 체크
    if (currentSlide >= slides.length) {
        currentSlide = 0;
    } else if (currentSlide < 0) {
        currentSlide = slides.length - 1;
    }
    
    // 새 슬라이드 활성화
    slides[currentSlide].classList.add('active');
    indicators[currentSlide].classList.add('active');
    
    // 컨텐츠 애니메이션 효과
    const currentContent = slides[currentSlide].querySelector('.slide-content');
    if (currentContent) {
        currentContent.style.opacity = '0';
        currentContent.style.transform = 'translate(-50%, -50%) scale(0.9)';
        
        setTimeout(() => {
            currentContent.style.transition = 'all 0.6s ease';
            currentContent.style.opacity = '1';
            currentContent.style.transform = 'translate(-50%, -50%) scale(1)';
        }, 100);
    }
    
    // 자동 슬라이드 재시작
    pauseAutoSlide();
    startAutoSlide();
}

/**
 * 특정 슬라이드로 이동하는 함수
 * 
 * @param {number} slideIndex - 이동할 슬라이드 인덱스
 */
function goToSlide(slideIndex) {
    if (!slides || slideIndex < 0 || slideIndex >= slides.length) return;
    
    // 현재 슬라이드 비활성화
    slides[currentSlide].classList.remove('active');
    indicators[currentSlide].classList.remove('active');
    
    // 새 슬라이드 설정
    currentSlide = slideIndex;
    
    // 새 슬라이드 활성화
    slides[currentSlide].classList.add('active');
    indicators[currentSlide].classList.add('active');
    
    // 컨텐츠 애니메이션 효과
    const currentContent = slides[currentSlide].querySelector('.slide-content');
    if (currentContent) {
        currentContent.style.opacity = '0';
        currentContent.style.transform = 'translate(-50%, -50%) scale(0.9)';
        
        setTimeout(() => {
            currentContent.style.transition = 'all 0.6s ease';
            currentContent.style.opacity = '1';
            currentContent.style.transform = 'translate(-50%, -50%) scale(1)';
        }, 100);
    }
    
    // 자동 슬라이드 재시작
    pauseAutoSlide();
    startAutoSlide();
}

// ==================== 브랜드 애니메이션 ====================
/**
 * 브랜드 박스에 애니메이션 효과를 적용하는 함수
 * 
 * TODO: Intersection Observer API 사용으로 성능 최적화
 */
function initBrandAnimations() {
    const brandBoxes = document.querySelectorAll('.brand-box');
    
    brandBoxes.forEach((box, index) => {
        // 지연 애니메이션 적용
        box.style.animationDelay = `${index * 0.1}s`;
        box.classList.add('animate');
    });
}

// ==================== 메인페이지 데이터 관리 ====================
/**
 * 서버에서 메인페이지 데이터를 로드하는 함수
 * 
 * TODO: 데이터 캐싱 구현
 * TODO: 에러 핸들링 강화
 * TODO: 로딩 상태 표시
 */
async function loadMainPageData() {
    try {
        const response = await fetch('http://localhost:3000/api/main-page');
        
        if (response.ok) {
            const data = await response.json();
            updateMainPage(data);
        } else {
            console.error('메인페이지 데이터 로드 실패:', response.status);
        }
    } catch (error) {
        console.error('메인페이지 데이터 로드 중 오류:', error);
    }
}

/**
 * 메인페이지를 업데이트하는 함수
 * 
 * @param {Object} data - 업데이트할 데이터
 */
function updateMainPage(data) {
    // 브랜드 정보 업데이트
    if (data.brands) {
        updateBrands(data.brands);
    }
    
    // 기타 데이터 업데이트 로직 추가
    console.log('메인페이지 업데이트 완료');
}

/**
 * 브랜드 정보를 업데이트하는 함수
 * 
 * @param {Array} brands - 브랜드 정보 배열
 */
function updateBrands(brands) {
    const brandsContainer = document.getElementById('brandsContainer');
    if (!brandsContainer) return;
    
    // 기존 브랜드 제거
    brandsContainer.innerHTML = '';
    
    // 새 브랜드 추가
    brands.forEach(brand => {
        const brandBox = document.createElement('a');
        brandBox.href = brand.url;
        brandBox.className = 'brand-box';
        brandBox.target = '_blank';
        brandBox.innerHTML = `<img src="${brand.image}" alt="${brand.alt}" />`;
        
        brandsContainer.appendChild(brandBox);
    });
    
    // 애니메이션 재적용
    initBrandAnimations();
}