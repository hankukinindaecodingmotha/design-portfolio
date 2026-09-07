// Web_UI/SearchPage1/HT_eng-SearchPage1.js

// 페이지 로드 시 인증 상태 확인
document.addEventListener('DOMContentLoaded', function () {
  // 인증 상태 확인 및 유지
  if (typeof maintainAuthState === 'function') {
    maintainAuthState();
  }
});

// 검색 입력창 요소 선택
const input = document.getElementById('searchInput');

// 숨겨져 있는 검색 가능한 아이템 리스트 ul 요소 선택
const list = document.getElementById('itemList');

// ul 내부의 모든 li 요소들 (검색 가능한 아이템들)
const items = list.getElementsByTagName('li');

// 연관 검색어를 보여줄 박스 요소 선택
const suggestions = document.getElementById('suggestions');

// 최근 검색어를 보여줄 박스 요소 선택
const recentBox = document.getElementById('recentSearches');

// 최근 검색어 목록이 들어갈 ul 요소 선택
const recentList = document.getElementById('recentList');

// 사전에 정의된 연관 검색어 배열 (필터링에 사용됨)
const relatedWords = [
  "EOCR", "전기보호", "과전류", "저전류", "결상", "역상", "누설", "지락", "단락", "과전압", "저전압", "전력",
  "Digital", "Analog", "통신", "Modbus", "4-20mA", "TCP", "ZCT", "3BZ2", "3MZ2", "ISEM2"
];

// 최근 검색어 저장 배열 (최대 5개까지 저장)
let recentSearches = [];

// 현재 뷰 모드
let currentViewMode = 'grid-4';

// 필터 상태 - 새로운 CSV 데이터 구조에 맞게 업데이트
const filters = {
  보호종류: '모든조건',
  제품군: '모든조건',
  통신여부: '모든조건',
  통신종류: '모든조건',
  '내장 ZCT': '모든조건',
  '과전류/저전류': '모든조건',
  결상: '모든조건',
  역상: '모든조건',
  '누설(지락)': '모든조건',
  단락: '모든조건',
  '과전압/저전압': '모든조건',
  전력: '모든조건'
};

// 필터 토글
function toggleFilters() {
  const filterArea = document.getElementById('filterArea');
  const toggleText = document.getElementById('toggleText');
  const toggleIcon = document.getElementById('toggleIcon');
  const resetArea = document.querySelector('.reset-area');
  if (filterArea.classList.contains('expanded')) {
    filterArea.classList.remove('expanded');
    toggleText.textContent = '필터 보기';
    toggleIcon.style.transform = 'rotate(0deg)';
    resetArea.style.display = 'none';
  } else {
    filterArea.classList.add('expanded');
    toggleText.textContent = '필터 숨기기';
    toggleIcon.style.transform = 'rotate(180deg)';
    resetArea.style.display = 'block';
  }
}

// 필터 설정 - 새로운 로직 추가
function setFilter(key, value) {
  filters[key] = value;
  updateFilterButtons(key, value);

  // 통신여부가 '비통신'일 때 통신종류 필터 비활성화
  if (key === '통신여부') {
    if (value === '비통신') {
      filters['통신종류'] = '불가';
      updateFilterButtons('통신종류', '불가');
      disableFilterGroup('통신종류');
    } else if (value === '통신') {
      enableFilterGroup('통신종류');
      // 통신일 때는 통신종류를 '모든조건'으로 초기화
      filters['통신종류'] = '모든조건';
      updateFilterButtons('통신종류', '모든조건');
    }
  }

  // 보호종류가 '모든조건'이 아닐 때 관련 보호 기능 필터들 활성화/비활성화
  if (key === '보호종류') {
    if (value === '전류') {
      // 전류 보호만 활성화
      enableFilterGroup('과전류/저전류');
      disableFilterGroup('결상');
      disableFilterGroup('역상');
      disableFilterGroup('누설(지락)');
      disableFilterGroup('단락');
      disableFilterGroup('과전압/저전압');
      disableFilterGroup('전력');

      // 관련 필터 값 초기화
      filters['결상'] = '불가';
      filters['역상'] = '불가';
      filters['누설(지락)'] = '불가';
      filters['단락'] = '불가';
      filters['과전압/저전압'] = '불가';
      filters['전력'] = '불가';
    } else if (value === '모든조건') {
      // 모든 보호 기능 활성화
      enableFilterGroup('과전류/저전류');
      enableFilterGroup('결상');
      enableFilterGroup('역상');
      enableFilterGroup('누설(지락)');
      enableFilterGroup('단락');
      enableFilterGroup('과전압/저전압');
      enableFilterGroup('전력');
    }
  }

  performSearch();
}

function updateFilterButtons(key, value) {
  const buttons = document.querySelectorAll(`.filter-group .filter-btn[onclick*="setFilter('${key}',"]`);

  // 모두 비활성화
  buttons.forEach(btn => btn.classList.remove('active'));

  // 정확히 일치하는 버튼만 활성화 (부분 일치 방지: '가능' vs '불가능' 등)
  const exactMatchPattern = new RegExp(`setFilter\\('${escapeRegex(key)}'\\s*,\\s*'${escapeRegex(value)}'\\)`);
  const exact = Array.from(buttons).find(btn => {
    const onclick = btn.getAttribute('onclick') || '';
    return exactMatchPattern.test(onclick);
  });
  if (exact) exact.classList.add('active');
}

// 정규식 이스케이프 유틸리티
function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 필터 그룹 비활성화
function disableFilterGroup(filterKey) {
  const filterGroup = document.querySelector(`[onclick*="setFilter('${filterKey}',"]`).closest('.filter-group');
  if (filterGroup) {
    filterGroup.style.opacity = '0.5';
    filterGroup.style.pointerEvents = 'none';
  }
}

// 필터 그룹 활성화
function enableFilterGroup(filterKey) {
  const filterGroup = document.querySelector(`[onclick*="setFilter('${filterKey}',"]`).closest('.filter-group');
  if (filterGroup) {
    filterGroup.style.opacity = '1';
    filterGroup.style.pointerEvents = 'auto';
  }
}

// 필터 리셋
function resetFilters() {
  Object.keys(filters).forEach(key => {
    filters[key] = '모든조건';
  });

  // 모든 필터 버튼을 '모든조건' 상태로 초기화
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.textContent === '모든조건') {
      btn.classList.add('active');
    }
  });

  // 모든 필터 그룹 활성화
  enableAllFilterGroups();

  // 검색 실행
  performSearch();
}

// 모든 필터 그룹 활성화
function enableAllFilterGroups() {
  const filterGroups = document.querySelectorAll('.filter-group');
  filterGroups.forEach(group => {
    group.classList.remove('disabled');
    const buttons = group.querySelectorAll('.filter-btn');
    buttons.forEach(btn => {
      btn.disabled = false;
    });
  });
}

// 검색 실행 함수
function performSearch() {
  const query = input.value.trim();
  if (query) updateRecentSearches(query);

  const params = new URLSearchParams();
  if (query) params.append('제품명', query);
  Object.keys(filters).forEach(key => {
    if (filters[key] && filters[key] !== '모든조건') {
      params.append(key, filters[key]);
    }
  });

  fetch(`http://localhost:3000/api/products/filter?${params.toString()}`)
    .then(res => res.json())
    .then(data => {
      displayServerResults(data);
    })
    .catch(error => {
      console.error('서버 검색 오류:', error);
      alert('서버 연결에 실패했습니다. 서버가 실행 중인지 확인해주세요.');
    });

  suggestions.style.display = 'none';
}

// 서버 검색 결과 표시 함수
function displayServerResults(data) {
  const resultGrid = document.getElementById('serverResultGrid');
  const resultContainer = document.getElementById('serverResultContainer');

  resultGrid.innerHTML = '';

  if (data.length === 0) {
    resultGrid.innerHTML = '<div class="no-results">검색 결과가 없습니다.</div>';
    resultContainer.classList.add('show');
    return;
  }

  data.forEach(item => {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.onclick = () => showProductModal(item);

    // 제품 이미지 (실제 이미지가 없으므로 플레이스홀더)
    const imageDiv = document.createElement('div');
    imageDiv.className = 'product-image';
    imageDiv.textContent = item.제품.charAt(0);

    // 제품 정보
    const infoDiv = document.createElement('div');
    infoDiv.className = 'product-info';

    const nameDiv = document.createElement('div');
    nameDiv.className = 'product-name';
    nameDiv.textContent = item.제품;

    const descDiv = document.createElement('div');
    descDiv.className = 'product-description';
    descDiv.textContent = item.상세설명;

    // 제품 상세 정보 추가
    const detailsDiv = document.createElement('div');
    detailsDiv.className = 'product-details';

    // 보호종류
    if (item.보호종류 && item.보호종류 !== '모든조건') {
      const protectionType = document.createElement('span');
      protectionType.className = 'detail-tag protection';
      protectionType.textContent = item.보호종류;
      detailsDiv.appendChild(protectionType);
    }

    // 제품군
    if (item.제품군 && item.제품군 !== '모든조건') {
      const productGroup = document.createElement('span');
      productGroup.className = 'detail-tag group';
      productGroup.textContent = item.제품군;
      detailsDiv.appendChild(productGroup);
    }

    // 통신여부
    if (item.통신여부 && item.통신여부 !== '모든조건') {
      const communication = document.createElement('span');
      communication.className = 'detail-tag communication';
      communication.textContent = item.통신여부;
      detailsDiv.appendChild(communication);
    }

    // ZCT 내장 여부
    if (item['내장 ZCT'] && item['내장 ZCT'] !== '모든조건') {
      const zct = document.createElement('span');
      zct.className = 'detail-tag zct';
      zct.textContent = item['내장 ZCT'] === 'O' ? 'ZCT 내장' : 'ZCT 미내장';
      detailsDiv.appendChild(zct);
    }

    // 액션 버튼 영역 생성
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'product-actions';

    // 구매 링크 버튼 (있는 경우에만)
    if (item.구매LINK && item.구매LINK !== 'X' && item.구매LINK.trim() !== '') {
      const purchaseBtn = document.createElement('a');
      purchaseBtn.className = 'action-btn purchase';
      purchaseBtn.href = item.구매LINK;
      purchaseBtn.target = '_blank';
      purchaseBtn.rel = 'noopener noreferrer';
      purchaseBtn.innerHTML = '<i class="fas fa-shopping-cart"></i> 구매';
      // 클릭 이벤트 전파 방지 (카드 클릭과 분리)
      purchaseBtn.onclick = (e) => {
        e.stopPropagation();
        window.open(item.구매LINK, '_blank');
      };
      actionsDiv.appendChild(purchaseBtn);
    }

    // 카탈로그 다운로드 버튼 (있는 경우에만)
    if (item['catalog down'] && item['catalog down'] !== 'X' && item['catalog down'].trim() !== '') {
      const catalogBtn = document.createElement('a');
      catalogBtn.className = 'action-btn catalog';
      catalogBtn.href = item['catalog down'];
      catalogBtn.target = '_blank';
      catalogBtn.rel = 'noopener noreferrer';
      catalogBtn.innerHTML = '<i class="fas fa-file-pdf"></i> 카탈로그';
      // 클릭 이벤트 전파 방지 (카드 클릭과 분리)
      catalogBtn.onclick = (e) => {
        e.stopPropagation();
        window.open(item['catalog down'], '_blank');
      };
      actionsDiv.appendChild(catalogBtn);
    }

    // 구매 링크와 카탈로그 링크가 모두 없는 경우에만 연락처 버튼 표시
    if ((!item.구매LINK || item.구매LINK === 'X' || item.구매LINK.trim() === '') &&
      (!item['catalog down'] || item['catalog down'] === 'X' || item['catalog down'].trim() === '')) {
      const contactBtn = document.createElement('button');
      contactBtn.className = 'action-btn contact';
      contactBtn.innerHTML = '<i class="fas fa-phone"></i> 연락처';
      contactBtn.onclick = (e) => {
        e.stopPropagation();
        showContactModal();
      };
      actionsDiv.appendChild(contactBtn);
    }

    infoDiv.appendChild(nameDiv);
    infoDiv.appendChild(descDiv);
    infoDiv.appendChild(detailsDiv);
    infoDiv.appendChild(actionsDiv);

    card.appendChild(imageDiv);
    card.appendChild(infoDiv);

    resultGrid.appendChild(card);
  });

  resultContainer.classList.add('show');
}



// 제품 모달 표시
function showProductModal(item) {
  const modal = document.getElementById('productModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalImage = document.getElementById('modalImage');
  const modalSpecs = document.getElementById('modalSpecs');

  // 모달 제목 설정
  modalTitle.textContent = item.제품;

  // 모달 이미지 설정
  modalImage.textContent = item.제품.charAt(0);

  // 스펙 정보 생성
  modalSpecs.innerHTML = '';

  // 주요 스펙들을 그룹으로 표시
  const specGroups = [
    {
      title: '기본 정보',
      specs: [
        { label: '제품명', value: item.제품 },
        { label: '상세설명', value: item.상세설명 }
      ]
    },
    {
      title: '전기적 특성',
      specs: [
        { label: 'AC/DC', value: item['AC or DC'] },
        { label: '제품군', value: item.제품군 },
        { label: '보호종류', value: item.보호종류 }
      ]
    },
    {
      title: '통신 기능',
      specs: [
        { label: '통신여부', value: item.통신여부 },
        { label: '통신종류', value: item.통신종류 }
      ]
    },
    {
      title: '보호 기능',
      specs: [
        { label: '누설(지락)', value: item['누설(지락)'] },
        { label: '단락', value: item.단락 },
        { label: '과전류/저전류', value: item['과전류/저전류'] },
        { label: '결상', value: item.결상 },
        { label: '역상', value: item.역상 },
        { label: '과전압/저전압', value: item['과전압/저전압'] }
      ]
    },
    {
      title: '기타',
      specs: [
        { label: '전력', value: item.전력 },
        { label: '내장 ZCT', value: item['내장 ZCT'] }
      ]
    }
  ];

  specGroups.forEach(group => {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'spec-group';

    const groupTitle = document.createElement('div');
    groupTitle.className = 'spec-title';
    groupTitle.textContent = group.title;

    groupDiv.appendChild(groupTitle);

    group.specs.forEach(spec => {
      if (spec.value) {
        const specDiv = document.createElement('div');
        specDiv.className = 'spec-value';
        specDiv.innerHTML = `<strong>${spec.label}:</strong> ${spec.value}`;
        groupDiv.appendChild(specDiv);
      }
    });

    modalSpecs.appendChild(groupDiv);
  });

  // 모달 표시
  modal.style.display = 'block';

  // 모달 액션 버튼 설정
  const modalCatalogBtn = document.getElementById('modalCatalogBtn');
  const modalPurchaseBtn = document.getElementById('modalPurchaseBtn');

  // 구매 링크와 카탈로그 링크가 모두 없는 경우에만 연락처 버튼 표시
  const hasPurchaseLink = item.구매LINK && item.구매LINK !== 'X' && item.구매LINK.trim() !== '';
  const hasCatalogLink = item['catalog down'] && item['catalog down'] !== 'X' && item['catalog down'].trim() !== '';

  if (hasPurchaseLink && hasCatalogLink) {
    // 둘 다 있는 경우: 구매와 카탈로그 버튼 모두 표시
    modalPurchaseBtn.innerHTML = '<i class="fas fa-shopping-cart"></i> 구매';
    modalPurchaseBtn.className = 'modal-action-btn purchase';
    modalPurchaseBtn.style.display = 'inline-flex';
    modalPurchaseBtn.onclick = (e) => {
      e.preventDefault();
      window.open(item.구매LINK, '_blank');
    };

    modalCatalogBtn.innerHTML = '<i class="fas fa-file-pdf"></i> 카탈로그';
    modalCatalogBtn.className = 'modal-action-btn catalog';
    modalCatalogBtn.style.display = 'inline-flex';
    modalCatalogBtn.onclick = (e) => {
      e.preventDefault();
      window.open(item['catalog down'], '_blank');
    };
  } else if (hasPurchaseLink) {
    // 구매 링크만 있는 경우: 구매 버튼만 표시
    modalPurchaseBtn.innerHTML = '<i class="fas fa-shopping-cart"></i> 구매';
    modalPurchaseBtn.className = 'modal-action-btn purchase';
    modalPurchaseBtn.style.display = 'inline-flex';
    modalPurchaseBtn.onclick = (e) => {
      e.preventDefault();
      window.open(item.구매LINK, '_blank');
    };
    modalCatalogBtn.style.display = 'none';
  } else if (hasCatalogLink) {
    // 카탈로그 링크만 있는 경우: 카탈로그 버튼만 표시
    modalCatalogBtn.innerHTML = '<i class="fas fa-file-pdf"></i> 카탈로그';
    modalCatalogBtn.className = 'modal-action-btn catalog';
    modalCatalogBtn.style.display = 'inline-flex';
    modalCatalogBtn.onclick = (e) => {
      e.preventDefault();
      window.open(item['catalog down'], '_blank');
    };
    modalPurchaseBtn.style.display = 'none';
  } else {
    // 둘 다 없는 경우: 연락처 버튼만 표시
    modalPurchaseBtn.innerHTML = '<i class="fas fa-phone"></i> 연락처';
    modalPurchaseBtn.className = 'modal-action-btn contact';
    modalPurchaseBtn.style.display = 'inline-flex';
    modalPurchaseBtn.onclick = (e) => {
      e.preventDefault();
      showContactModal();
    };
    modalCatalogBtn.style.display = 'none';
  }

  // ESC 키로 모달 닫기
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeProductModal();
    }
  });

  // 모달 외부 클릭 시 닫기
  modal.addEventListener('click', function (e) {
    if (e.target === modal) {
      closeProductModal();
    }
  });
}

// 제품 모달 닫기
function closeProductModal() {
  const modal = document.getElementById('productModal');
  modal.style.display = 'none';
}

// 모달에서 PDF 다운로드
function downloadPDFFromModal() {
  const productName = document.getElementById('modalTitle').textContent;
  // PDF 다운로드 함수 (사용하지 않음 - 제거)
  // alert(`${productName}의 PDF를 다운로드합니다.`);
}

// 모달에서 브랜드 사이트 열기
function openBrandSiteFromModal() {
  const productName = document.getElementById('modalTitle').textContent;
  // 브랜드 사이트 열기 함수 (사용하지 않음 - 제거)
  // alert(`${productName}의 브랜드 사이트를 엽니다.`);
}

// 뷰 모드 설정
function setViewMode(mode) {
  currentViewMode = mode;
  const resultGrid = document.getElementById('serverResultGrid');
  const viewBtns = document.querySelectorAll('.view-btn');

  // 클래스 업데이트
  resultGrid.className = `result-grid ${mode}`;

  // 버튼 활성화 상태 업데이트
  viewBtns.forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('onclick').includes(mode)) {
      btn.classList.add('active');
    }
  });
}

// 연관 검색어 표시 (서버 기반)
function showSuggestions() {
  const value = input.value.trim();

  if (!value) {
    suggestions.style.display = 'none';
    return;
  }

  fetch(`http://localhost:3000/api/products/suggest?q=${encodeURIComponent(value)}`)
    .then(res => res.json())
    .then(suggestions => {
      if (suggestions.length === 0) {
        document.getElementById('suggestions').style.display = 'none';
        return;
      }
      document.getElementById('suggestions').innerHTML = suggestions.map(s => `<div onclick="selectSuggestion('${s}')">${s}</div>`).join('');
      document.getElementById('suggestions').style.display = 'block';
    })
    .catch(error => {
      console.error('연관 검색어 오류:', error);
      document.getElementById('suggestions').style.display = 'none';
    });
}

function selectSuggestion(value) {
  document.getElementById('searchInput').value = value;
  performSearch();
}

// 검색어 필터링 함수 (기존 로컬 검색용)
function filterItems(filter) {
  for (let i = 0; i < items.length; i++) {
    const text = items[i].textContent.toLowerCase();
    // 포함되면 빈문자열로 보임 (style.display 기본값)
    // 포함 안되면 none으로 숨김
    items[i].style.display = text.includes(filter) ? "" : "none";
  }
}

// 최근 검색어 UI를 업데이트하는 함수
// keyword(최신 검색어)를 받아서 중복 제거 후 배열 앞에 추가
// 배열 길이가 5 초과하면 뒤에서부터 제거해서 5개 유지
// ul 요소 innerHTML을 최근검색어 li 목록으로 다시 생성
// li 각각에 클릭 이벤트를 달아 클릭 시 검색어가 입력창에 들어가고 필터링 실행되며 박스 숨김
function updateRecentSearches(keyword) {
  // 배열에 이미 있으면 제거
  const index = recentSearches.indexOf(keyword);
  if (index > -1) recentSearches.splice(index, 1);

  // 배열 앞에 새 검색어 추가
  recentSearches.unshift(keyword);

  // 최대 5개 유지
  if (recentSearches.length > 5) recentSearches.pop();

  // ul 내부를 li 목록 HTML로 업데이트
  recentList.innerHTML = recentSearches.map(word => `<li>${word}</li>`).join("");

  // 각 li에 클릭 이벤트 등록
  recentList.querySelectorAll("li").forEach(item => {
    item.addEventListener("click", () => {
      // 클릭된 li 텍스트를 입력창 값으로 세팅
      input.value = item.textContent;
      // 서버 검색 실행
      performSearch();
      // 최근 검색어 박스 숨김
      recentBox.style.display = "none";
    });
  });
}

// 검색 입력창에 내용이 바뀔 때마다 실행되는 이벤트 리스너
input.addEventListener('input', function () {
  // 입력된 값을 소문자와 양 끝 공백 제거해서 filter 변수에 저장
  const filter = input.value.toLowerCase().trim();

  // li 필터링 실행 (기존 로컬 검색)
  filterItems(filter);

  // 입력값이 비었을 때 처리
  if (filter === "") {
    // 연관검색어 박스 숨기고 내용 비우기
    suggestions.style.display = "none";
    suggestions.innerHTML = "";

    // 최근검색어가 있으면 최근검색어 박스 보이기, 없으면 숨기기
    if (recentSearches.length > 0) {
      recentBox.style.display = "block";
    } else {
      recentBox.style.display = "none";
    }

  } else { // 입력값이 있을 때 처리
    // 최근검색어 박스 보이기 (검색중에도 보이도록)
    recentBox.style.display = "block";

    // 서버 기반 연관 검색어 표시
    showSuggestions();
  }
});

// 검색창에서 엔터키 입력 시 실행 이벤트
input.addEventListener('keydown', function (event) {
  // 엔터키일 경우만 처리
  if (event.key === "Enter") {
    // 입력값 양쪽 공백 제거
    const keyword = input.value.trim();
    // 빈값이 아니면
    if (keyword !== "") {
      // 서버 검색 실행
      performSearch();
    }
  }
});

// 입력창에 포커스(클릭 또는 탭) 되었을 때 실행 이벤트
input.addEventListener('focus', () => {
  // 최근검색어 배열이 비어있지 않으면 박스 보이게, 아니면 숨김
  if (recentSearches.length > 0) {
    recentBox.style.display = 'block';
  } else {
    recentBox.style.display = 'none';
  }
});

// 입력창 포커스 해제(다른 곳 클릭 등) 시 실행 이벤트
input.addEventListener('blur', () => {
  // 딜레이를 두어 클릭 이벤트와 충돌 방지
  setTimeout(() => {
    // 최근검색어 박스 숨기기
    recentBox.style.display = 'none';
    // 연관검색어 박스 숨기기
    suggestions.style.display = 'none';
  }, 150);
});

// --- 홈 버튼 클릭 시 HomePage.html로 이동 --- //
// 홈 버튼 id 'homeBtn' 선택 후 클릭 이벤트 리스너 추가
document.getElementById('homeBtn').addEventListener('click', () => {
  // SearchPage1 폴더 기준
  window.location.href = '../HomePage/HT-eng-HomePage.html';
});

// 연락처 모달 표시
function showContactModal() {
  const modal = document.getElementById('contactModal');
  modal.style.display = 'block';

  // ESC 키로 모달 닫기
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeContactModal();
    }
  });

  // 모달 외부 클릭 시 닫기
  modal.addEventListener('click', function (e) {
    if (e.target === modal) {
      closeContactModal();
    }
  });
}

// 연락처 모달 닫기
function closeContactModal() {
  const modal = document.getElementById('contactModal');
  modal.style.display = 'none';
}