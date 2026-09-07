// 회사 정보 관리 기능
// ================================

// 회사 정보 로드
async function loadCompanyInfo() {
  try {
    const response = await fetch('http://localhost:3000/api/admin/company');

    if (response.ok) {
      const companyData = response.json();

      // 기본 회사 정보
      document.getElementById('companyName').value = companyData.name || '';
      document.getElementById('companyDesc').value = companyData.description || '';
      document.getElementById('companyBusiness').value = companyData.business || '';
      document.getElementById('companyLocation').value = companyData.location || '';

      // 연락처 정보
      document.getElementById('companyPhone').value = companyData.phone || '';
      document.getElementById('companyEmail').value = companyData.email || '';
      document.getElementById('companyFax').value = companyData.fax || '';
      document.getElementById('companyWebsite').value = companyData.website || '';
      document.getElementById('companyHours').value = companyData.hours || '';

      // 지도 설정
      document.getElementById('mapLat').value = companyData.mapLat || 37.637966;
      document.getElementById('mapLng').value = companyData.mapLng || 126.680780;
      document.getElementById('mapZoom').value = companyData.mapZoom || 18;

      // 회사 소개 페이지 정보
      document.getElementById('companyIntroTitle').value = companyData.title || '';
      document.getElementById('companyIntroSubtitle').value = companyData.subtitle || '';

      // 연혁 정보 로드
      loadHistoryToForm(companyData.history || []);

      // 사업 항목 로드
      loadBusinessToForm(companyData.businessItems || []);

    } else {
      console.error('회사 정보 로드 실패:', response.status);
    }
  } catch (error) {
    console.error('회사 정보 로드 오류:', error);
  }
}

// 기본 회사 정보 값 설정
function setDefaultCompanyValues() {
  // 연혁 기본값 설정
  const historyList = document.getElementById('historyList');
  if (historyList && historyList.children.length === 0) {
    const defaultHistory = [
      { year: '2020', event: '회사 설립' },
      { year: '2021', event: '사업 확장' },
      { year: '2022', event: '신기술 도입' }
    ];
    defaultHistory.forEach((history, index) => {
      addHistoryToForm(history, index);
    });
  }

  // 사업 분야 상세 기본값 설정
  const businessList = document.getElementById('businessList');
  if (businessList && businessList.children.length === 0) {
    const defaultBusiness = [
      { title: '전기 설비', description: '전기 설비 설계 및 시공' },
      { title: '자동화 시스템', description: '공장 자동화 시스템 구축' },
      { title: '에너지 관리', description: '에너지 효율성 최적화' }
    ];
    defaultBusiness.forEach((business, index) => {
      addBusinessToForm(business, index);
    });
  }
}

// 회사 정보 업데이트
async function handleCompanyUpdate(e) {
  e.preventDefault();

  const formData = new FormData(e.target);

  // 기본 회사 정보
  const companyData = {
    name: formData.get('companyName'),
    description: formData.get('companyDesc'),
    business: formData.get('companyBusiness'),
    location: formData.get('companyLocation'),

    // 연락처 정보
    phone: formData.get('companyPhone'),
    email: formData.get('companyEmail'),
    fax: formData.get('companyFax'),
    website: formData.get('companyWebsite'),
    hours: formData.get('companyHours'),

    // 지도 설정
    mapLat: parseFloat(formData.get('mapLat')),
    mapLng: parseFloat(formData.get('mapLng')),
    mapZoom: parseInt(formData.get('mapZoom')),

    // 회사 소개 페이지 정보
    title: formData.get('companyIntroTitle'),
    subtitle: formData.get('companyIntroSubtitle'),

    // 연혁 정보
    history: getHistoryFromForm(),

    // 사업 항목
    businessItems: getBusinessFromForm()
  };

  try {
    const response = await fetch('http://localhost:3000/api/admin/company', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionStorage.getItem('token')}`
      },
      body: JSON.stringify(companyData)
    });

    if (response.ok) {
      setButtonSuccess(e.target.querySelector('.save-btn'), '저장 완료!');
      setTimeout(() => {
        setButtonLoading(e.target.querySelector('.save-btn'), '저장 중...');
      }, 2000);
    } else {
      setButtonError(e.target.querySelector('.save-btn'), '저장 실패');
    }
  } catch (error) {
    console.error('회사 정보 업데이트 오류:', error);
    setButtonError(e.target.querySelector('.save-btn'), '저장 실패');
  }
}

// 연혁 관련 함수들
function addHistory() {
  const historyList = document.getElementById('historyList');
  const historyCount = historyList.querySelectorAll('.history-item').length;
  const newIndex = historyCount;

  const newHistory = {
    year: '',
    event: ''
  };

  addHistoryToForm(newHistory, newIndex);
}

function addHistoryToForm(history, index) {
  const historyList = document.getElementById('historyList');

  const historyHTML = `
    <div class="history-item" data-index="${index}">
      <div class="form-row">
        <div class="form-group">
          <label>연도</label>
          <input type="text" name="historyYear_${index}" value="${history.year || ''}" required>
        </div>
        <div class="form-group">
          <label>내용</label>
          <input type="text" name="historyEvent_${index}" value="${history.event || ''}" required>
        </div>
        <button type="button" class="remove-history-btn" onclick="removeHistory(${index})" title="제거">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>
  `;

  historyList.insertAdjacentHTML('beforeend', historyHTML);
}

function removeHistory(index) {
  const historyItem = document.querySelector(`[data-index="${index}"]`);
  if (historyItem) {
    historyItem.remove();
    // 인덱스 재정렬
    reorderHistoryIndexes();
  }
}

function reorderHistoryIndexes() {
  const historyItems = document.querySelectorAll('#historyList .history-item');
  historyItems.forEach((item, newIndex) => {
    item.setAttribute('data-index', newIndex);

    // input name 속성 업데이트
    const inputs = item.querySelectorAll('input');
    inputs.forEach(input => {
      const oldName = input.getAttribute('name');
      if (oldName) {
        const newName = oldName.replace(/_\d+$/, `_${newIndex}`);
        input.setAttribute('name', newName);
      }
    });

    // onclick 이벤트 업데이트
    const removeBtn = item.querySelector('.remove-history-btn');
    if (removeBtn) {
      removeBtn.setAttribute('onclick', `removeHistory(${newIndex})`);
    }
  });
}

// 사업 분야 상세 관련 함수들
function addBusiness() {
  const businessList = document.getElementById('businessList');
  const businessCount = businessList.querySelectorAll('.business-item').length;
  const newIndex = businessCount;

  const newBusiness = {
    title: '',
    description: ''
  };

  addBusinessToForm(newBusiness, newIndex);
}

function addBusinessToForm(business, index) {
  const businessList = document.getElementById('businessList');

  const businessHTML = `
    <div class="business-item" data-index="${index}">
      <div class="form-row">
        <div class="form-group">
          <label>사업명</label>
          <input type="text" name="businessTitle_${index}" value="${business.title || ''}" required>
        </div>
        <div class="form-group">
          <label>설명</label>
          <textarea name="businessDescription_${index}" rows="2" required>${business.description || ''}</textarea>
        </div>
        <button type="button" class="remove-business-btn" onclick="removeBusiness(${index})" title="제거">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>
  `;

  businessList.insertAdjacentHTML('beforeend', businessHTML);
}

function removeBusiness(index) {
  const businessItem = document.querySelector(`[data-index="${index}"]`);
  if (businessItem) {
    businessItem.remove();
    // 인덱스 재정렬
    reorderBusinessIndexes();
  }
}

function reorderBusinessIndexes() {
  const businessItems = document.querySelectorAll('#businessList .business-item');
  businessItems.forEach((item, newIndex) => {
    item.setAttribute('data-index', newIndex);

    // input name 속성 업데이트
    const inputs = item.querySelectorAll('input, textarea');
    inputs.forEach(input => {
      const oldName = input.getAttribute('name');
      if (oldName) {
        const newName = oldName.replace(/_\d+$/, `_${newIndex}`);
        input.setAttribute('name', newName);
      }
    });

    // onclick 이벤트 업데이트
    const removeBtn = item.querySelector('.remove-business-btn');
    if (removeBtn) {
      removeBtn.setAttribute('onclick', `removeBusiness(${newIndex})`);
    }
  });
}

// 현재 위치 가져오기
function getCurrentLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      function (position) {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        document.getElementById('mapLat').value = lat.toFixed(6);
        document.getElementById('mapLng').value = lng.toFixed(6);
        document.getElementById('mapZoom').value = 15;

        alert(`현재 위치가 설정되었습니다.\n위도: ${lat.toFixed(6)}\n경도: ${lng.toFixed(6)}`);
      },
      function (error) {
        console.error('위치 정보 가져오기 실패:', error);
        alert('위치 정보를 가져올 수 없습니다. 브라우저 설정을 확인해주세요.');
      }
    );
  } else {
    alert('이 브라우저에서는 위치 정보를 지원하지 않습니다.');
  }
}

// 주소로 검색
function searchAddress() {
  const address = document.getElementById('companyLocation').value;
  if (!address) {
    alert('먼저 주소를 입력해주세요.');
    return;
  }

  // 네이버 지도 API를 사용하여 주소 검색
  // 실제 구현에서는 네이버 지도 API 키가 필요합니다
  alert(`주소 검색 기능을 사용하려면 네이버 지도 API 키가 필요합니다.\n주소: ${address}\n\n수동으로 좌표를 입력하거나, 네이버 지도에서 해당 주소를 찾아 좌표를 복사해주세요.`);
}
