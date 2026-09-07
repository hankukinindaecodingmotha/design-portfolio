// EOCR 페이지 JavaScript 기능

// 고급 필터 상태 관리
let advancedFilters = {
  카테고리: '모든 조건',
  AC_DC: '모든 조건',
  보호종류: '모든 조건',
  통신여부: '모든 조건',
  통신종류: '모든 조건',
  '누설(지락)': '모든 조건',
  단락: '모든 조건',
  '과전류/저전류': '모든 조건',
  결상: '모든 조건',
  역상: '모든 조건',
  '과전압/저전압': '모든 조건',
  전력: '모든 조건',
  '내장 ZCT': '모든 조건'
};

// 사이드바 메뉴 클릭 이벤트
document.addEventListener('DOMContentLoaded', function () {
  // 인증 상태 확인 및 유지
  if (typeof maintainAuthState === 'function') {
    maintainAuthState();
  }

  // 사이드바 메뉴 이벤트 리스너 설정
  document.querySelectorAll('.sidebar-item').forEach(item => {
    item.addEventListener('click', function () {
      const sectionId = this.getAttribute('data-section');

      // 모든 메뉴 아이템 비활성화
      document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
      // 모든 섹션 숨기기
      document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));

      // 클릭된 메뉴 활성화
      this.classList.add('active');
      // 해당 섹션 표시
      document.getElementById(sectionId).classList.add('active');

      // 갤러리 섹션이 활성화되면 제품 로드
      if (sectionId === 'gallery') {
        loadProducts();
      }
    });
  });

  // 검색 이벤트 리스너 설정
  const searchInput = document.getElementById('productSearch');

  if (searchInput) {
    searchInput.addEventListener('input', filterProducts);
  }

  // 견적 요청 폼 이벤트 리스너 설정
  const quoteForm = document.getElementById('quoteForm');
  if (quoteForm) {
    quoteForm.addEventListener('submit', function (e) {
      e.preventDefault();
      alert('견적 요청이 접수되었습니다. 빠른 시일 내에 연락드리겠습니다.');
      this.reset();
    });
  }
});

// 제품 데이터 로드
let allProducts = [];

async function loadProducts() {
  const loadingMessage = document.getElementById('loadingMessage');
  const productsGrid = document.getElementById('productsGrid');
  const noProductsMessage = document.getElementById('noProductsMessage');

  try {
    loadingMessage.style.display = 'block';
    productsGrid.innerHTML = '';
    noProductsMessage.style.display = 'none';

    // 서버 URL을 절대 경로로 수정
    const response = await fetch('http://localhost:3000/api/products');
    if (response.ok) {
      allProducts = await response.json();
      renderProducts(allProducts);
    } else {
      throw new Error('제품 데이터를 불러올 수 없습니다.');
    }
  } catch (error) {
    console.error('Error loading products:', error);
    productsGrid.innerHTML = `
      <div class="error-message">
        <i class="fas fa-exclamation-circle"></i>
        <p>제품 데이터를 불러올 수 없습니다.</p>
        <p>${error.message}</p>
        <p>서버가 실행 중인지 확인해주세요.</p>
      </div>
    `;
  } finally {
    loadingMessage.style.display = 'none';
  }
}

// 제품 렌더링
function renderProducts(products) {
  const productsGrid = document.getElementById('productsGrid');
  const noProductsMessage = document.getElementById('noProductsMessage');

  console.log('renderProducts 호출됨 - 제품 수:', products.length); // 디버깅용 로그

  // 검색 결과가 없을 때 기존 제품들을 모두 제거
  if (products.length === 0) {
    console.log('검색 결과 없음 - 기존 제품들을 모두 제거'); // 디버깅용 로그
    productsGrid.innerHTML = ''; // 기존 제품들을 모두 제거
    noProductsMessage.style.display = 'block';
    return;
  }

  console.log('제품 렌더링 시작 - 제품 수:', products.length); // 디버깅용 로그
  noProductsMessage.style.display = 'none';

  const productsHTML = products.map(product => `
    <div class="product-card" onclick="showProductDetail('${product.제품 || product.모델명 || 'Unknown'}')">
      <div class="product-image">
        <i class="fas fa-cog"></i>
      </div>
      <div class="product-info">
        <h3>${product.제품 || product.모델명 || 'Unknown'}</h3>
        <p class="product-category">${product.제품군 || 'EOCR'}</p>
        <p class="product-description">${product.상세설명 || '제품 상세 정보를 확인하려면 클릭하세요.'}</p>
      </div>
      <div class="product-actions">
        <button class="detail-btn">
          <i class="fas fa-arrow-right"></i>
        </button>
      </div>
    </div>
  `).join('');

  productsGrid.innerHTML = productsHTML;
  console.log('제품 렌더링 완료'); // 디버깅용 로그
}

// 제품 검색
function filterProducts() {
  const searchTerm = document.getElementById('productSearch')?.value?.toLowerCase() || '';

  let filteredProducts = [...allProducts];

  console.log('필터링 시작 - 전체 제품 수:', allProducts.length); // 디버깅용 로그

  // 검색어 필터
  if (searchTerm) {
    filteredProducts = filteredProducts.filter(product =>
      (product.제품 || '').toLowerCase().includes(searchTerm) ||
      (product.모델명 || '').toLowerCase().includes(searchTerm) ||
      (product.상세설명 || '').toLowerCase().includes(searchTerm)
    );
    console.log('검색어 필터 적용 후:', filteredProducts.length); // 디버깅용 로그
  }

  // 고급 필터 적용
  filteredProducts = applyAdvancedFilters(filteredProducts);

  console.log('최종 필터링 결과:', filteredProducts.length); // 디버깅용 로그

  renderProducts(filteredProducts);
}

// 고급 필터 적용
function applyAdvancedFilters(products) {
  let filtered = [...products];

  console.log('현재 필터 상태:', advancedFilters); // 디버깅용 로그

  Object.entries(advancedFilters).forEach(([key, value]) => {
    if (value && value !== '모든 조건') {
      const beforeCount = filtered.length;

      switch (key) {
        case '카테고리':
          filtered = filtered.filter(p => p.제품군 === value);
          break;
        case 'AC_DC':
          filtered = filtered.filter(p => p['AC or DC'] === value);
          break;
        case '보호종류':
          filtered = filtered.filter(p => p.보호종류 === value);
          break;
        case '통신여부':
          filtered = filtered.filter(p => p.통신여부 === value);
          break;
        case '통신종류':
          filtered = filtered.filter(p => p.통신종류 === value);
          break;
        case '누설(지락)':
          filtered = filtered.filter(p => p['누설(지락)'] === value);
          break;
        case '단락':
          filtered = filtered.filter(p => p.단락 === value);
          break;
        case '과전류/저전류':
          filtered = filtered.filter(p => p['과전류/저전류'] === value);
          break;
        case '결상':
          filtered = filtered.filter(p => p.결상 === value);
          break;
        case '역상':
          filtered = filtered.filter(p => p.역상 === value);
          break;
        case '과전압/저전압':
          filtered = filtered.filter(p => p['과전압/저전압'] === value);
          break;
        case '전력':
          filtered = filtered.filter(p => p.전력 === value);
          break;
        case '내장 ZCT':
          filtered = filtered.filter(p => p['내장 ZCT'] === value);
          break;
      }

      console.log(`${key} 필터 적용: ${beforeCount} → ${filtered.length}`); // 디버깅용 로그
    }
  });

  return filtered;
}

// 고급 필터 토글
function toggleAdvancedFilters() {
  const filterArea = document.getElementById('advancedFilterArea');
  const toggleText = document.getElementById('advancedToggleText');
  const toggleIcon = document.getElementById('advancedToggleIcon');

  if (filterArea.style.display === 'none') {
    filterArea.style.display = 'block';
    toggleText.textContent = '고급 필터 숨기기';
    toggleIcon.className = 'fas fa-chevron-up';
  } else {
    filterArea.style.display = 'none';
    toggleText.textContent = '고급 필터 보기';
    toggleIcon.className = 'fas fa-chevron-down';
  }
}

// 고급 필터 설정
function setAdvancedFilter(filterType, value, event) {
  // 해당 필터 그룹의 모든 버튼 비활성화
  const filterGroup = event.target.closest('.filter-group');
  if (filterGroup) {
    filterGroup.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.remove('active');
    });

    // 클릭된 버튼 활성화
    event.target.classList.add('active');
  }

  // 필터 상태 업데이트
  advancedFilters[filterType] = value;

  console.log('필터 적용:', filterType, value); // 디버깅용 로그

  // 제품 필터링 적용
  filterProducts();
}

// 고급 필터 초기화
function resetAdvancedFilters() {
  // 모든 필터를 '모든 조건'으로 초기화
  Object.keys(advancedFilters).forEach(key => {
    advancedFilters[key] = '모든 조건';
  });

  // 모든 필터 버튼을 '모든 조건'으로 설정
  document.querySelectorAll('.filter-group').forEach(group => {
    const buttons = group.querySelectorAll('.filter-btn');
    buttons.forEach(btn => {
      if (btn.textContent === '모든 조건') {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  });

  // 제품 필터링 적용
  filterProducts();
}

// 보기 모드 변경
function setViewMode(mode) {
  const productsGrid = document.getElementById('productsGrid');
  const viewButtons = document.querySelectorAll('.view-mode-btn');

  // 모든 보기 모드 버튼 비활성화
  viewButtons.forEach(btn => btn.classList.remove('active'));

  // 클릭된 버튼 활성화
  event.target.classList.add('active');

  // 제품 그리드 클래스 변경
  productsGrid.className = `products-grid ${mode}`;
}

// 제품 상세 모달 표시
function showProductDetail(productName) {
  const product = allProducts.find(p =>
    (p.제품 || p.모델명) === productName
  );

  if (!product) return;

  const modal = document.getElementById('productModal');
  const modalContent = document.getElementById('productModalContent');

  modalContent.innerHTML = `
    <div class="product-detail-header">
      <h2>${product.제품 || product.모델명}</h2>
      <p class="product-category">${product.제품군 || 'EOCR'}</p>
    </div>
    <div class="product-detail-content">
      <div class="product-specs-detail">
        <h3>제품 사양</h3>
        <div class="specs-list">
          ${Object.entries(product).map(([key, value]) =>
    key !== '제품' && key !== '모델명' && key !== '제품군' && key !== '상세설명' && value ?
      `<div class="spec-row">
                <span class="spec-key">${key}</span>
                <span class="spec-value">${value}</span>
              </div>` : ''
  ).join('')}
        </div>
      </div>
      ${product.상세설명 ? `
      <div class="product-description-detail">
        <h3>제품 설명</h3>
        <p>${product.상세설명}</p>
      </div>
      ` : ''}
    </div>
  `;

  modal.style.display = 'flex';
}

// 제품 상세 모달 닫기
function closeProductModal() {
  document.getElementById('productModal').style.display = 'none';
}

// 이미지 모달 열기
function openImageModal(imageSrc) {
  const modal = document.getElementById('imageModal');
  const modalImg = document.getElementById('modalImage');

  if (imageSrc) {
    modalImg.src = imageSrc;
  }

  modal.style.display = 'flex';
}

// 이미지 모달 닫기
function closeImageModal() {
  document.getElementById('imageModal').style.display = 'none';
}

// 파일 다운로드 (실제로는 서버에서 파일 제공)
function downloadFile(type) {
  alert(`${type === 'catalog' ? '제품 카탈로그' : type === 'manual' ? '사용자 매뉴얼' : '기술 자료'} 다운로드가 시작됩니다.`);
}

// 모달 외부 클릭 시 닫기
window.onclick = function (event) {
  const modal = document.getElementById('productModal');
  const imageModal = document.getElementById('imageModal');

  if (event.target === modal) {
    modal.style.display = 'none';
  }

  if (event.target === imageModal) {
    imageModal.style.display = 'none';
  }
}
