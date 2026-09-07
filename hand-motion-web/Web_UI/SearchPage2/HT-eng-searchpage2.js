// Web_UI/SearchPage2/HT-eng-searchpage2.js

// 현재 선택된 필터 상태
const filters = {
    AC_DC: '모든 조건',
    제품군: '모든 조건',
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

// 현재 뷰 모드
let currentViewMode = 'grid-4';

// 필터 토글 함수
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

// 뷰 모드 설정
function setViewMode(mode) {
    currentViewMode = mode;
    const resultGrid = document.getElementById('resultGrid');
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

    // 현재 결과 다시 표시
    displayResults(currentResults);
}

// 필터 버튼 클릭 시
function setFilter(key, value) {
    filters[key] = value;

    // 버튼 활성화 상태 업데이트
    updateFilterButtons(key, value);

    // 통신여부가 '비통신'일 때 통신종류 필터 비활성화
    if (key === '통신여부') {
        if (value === '비통신') {
            filters['통신종류'] = '불가';
            updateFilterButtons('통신종류', '불가');
            disableFilterGroup('통신종류');
        } else if (value === '통신') {
            enableFilterGroup('통신종류');
        }
    }

    search();
}

// 필터 버튼 활성화 상태 업데이트
function updateFilterButtons(key, value) {
    const buttons = document.querySelectorAll(`.filter-group .filter-btn[onclick*="setFilter('${key}',"]`);

    // 모두 비활성화
    buttons.forEach(btn => btn.classList.remove('active'));

    // 정확히 일치하는 버튼만 활성화
    const exactMatchPattern = new RegExp(`setFilter\\('${escapeRegex(key)}'\\s*,\\s*'${escapeRegex(value)}'\\)`);
    const exact = Array.from(buttons).find(btn => {
        const onclick = btn.getAttribute('onclick') || '';
        return exactMatchPattern.test(onclick);
    });
    if (exact) exact.classList.add('active');
}

// 정규식 이스케이프
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

// 필터 초기화
function resetFilters() {
    Object.keys(filters).forEach(key => {
        filters[key] = '모든 조건';
        updateFilterButtons(key, '모든 조건');
    });

    // 모든 필터 그룹 활성화
    enableFilterGroup('통신종류');

    // 현재 검색 결과 초기화
    currentResults = [];
    const resultGrid = document.getElementById('resultGrid');
    resultGrid.innerHTML = '';
}

// 현재 결과 저장
let currentResults = [];

// 검색 함수
function search(selectedSuggestion) {
    const input = document.getElementById('searchInput');
    const query = selectedSuggestion !== undefined ? selectedSuggestion : input.value;

    const params = new URLSearchParams();
    if (query) params.append('제품명', query);
    Object.keys(filters).forEach(key => {
        if (filters[key] && filters[key] !== '모든 조건') {
            params.append(key, filters[key]);
        }
    });

    fetch(`http://localhost:3000/api/products/filter?${params.toString()}`)
        .then(res => res.json())
        .then(data => {
            currentResults = data;
            displayResults(data);
        });

    document.getElementById('suggestions').style.display = 'none';
}

// 결과 표시 함수
function displayResults(data) {
    const resultGrid = document.getElementById('resultGrid');
    resultGrid.innerHTML = '';

    if (data.length === 0) {
        resultGrid.innerHTML = '<div class="no-results">검색 결과가 없습니다.</div>';
        return;
    }

    data.forEach(item => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.onclick = () => showProductDetail(item);

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

        infoDiv.appendChild(nameDiv);
        infoDiv.appendChild(descDiv);

        card.appendChild(imageDiv);
        card.appendChild(infoDiv);

        resultGrid.appendChild(card);
    });
}

// 제품 상세 페이지로 이동
function showProductDetail(item) {
    const name = item?.제품;
    if (!name) return;
    window.location.href = `../ProductPage/ProductDetailPage/HT_eng-ProductDetail.html?name=${encodeURIComponent(name)}`;
}

// 연관 검색어 표시
function showSuggestions() {
    const input = document.getElementById('searchInput');
    const value = input.value.trim();
    const suggestionsBox = document.getElementById('suggestions');

    if (!value) {
        suggestionsBox.style.display = 'none';
        return;
    }

    fetch(`http://localhost:3000/api/products/suggest?q=${encodeURIComponent(value)}`)
        .then(res => res.json())
        .then(suggestions => {
            if (suggestions.length === 0) {
                suggestionsBox.style.display = 'none';
                return;
            }
            suggestionsBox.innerHTML = suggestions.map(s => `<div onclick="selectSuggestion('${s}')">${s}</div>`).join('');
            suggestionsBox.style.display = 'block';
        });
}

function selectSuggestion(value) {
    document.getElementById('searchInput').value = value;
    search(value);
}

// 검색창 이외 클릭 시 자동완성 닫기
document.addEventListener('click', function (e) {
    if (!document.getElementById('searchInput').contains(e.target) &&
        !document.getElementById('suggestions').contains(e.target)) {
        document.getElementById('suggestions').style.display = 'none';
    }
});

// 페이지 진입 시 전체 목록 표시
window.onload = search;