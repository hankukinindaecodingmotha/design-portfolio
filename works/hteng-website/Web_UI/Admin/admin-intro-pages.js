// 소개 페이지 관리 기능
// ================================

// 소개 페이지 정보 로드
async function loadIntroPagesInfo() {
  try {
    const response = await fetch('http://localhost:3000/api/admin/intro-pages', {
      headers: {
        'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`
      }
    });

    if (response.ok) {
      const introPages = await response.json();

      // CEO 소개 페이지 미리보기 업데이트
      if (introPages.ceo) {
        document.getElementById('ceoPreviewName').textContent = introPages.ceo.name || '홍길동';
        document.getElementById('ceoPreviewPosition').textContent = introPages.ceo.position || '대표이사';
        document.getElementById('ceoPreviewImage').textContent = introPages.ceo.image || 'CEO.jpeg';
      }

      // 회사 구성원 소개 페이지 미리보기 업데이트
      if (introPages.members) {
        document.getElementById('membersPreviewCount').textContent = `${introPages.members.members ? introPages.members.members.length : 0}명`;
        document.getElementById('membersPreviewTitle').textContent = introPages.members.title || '직원 소개';
      }

      // 회사 소개 페이지 미리보기 업데이트
      if (introPages.company) {
        document.getElementById('companyIntroPreviewTitle').textContent = introPages.company.title || '회사 소개';
        document.getElementById('companyIntroPreviewSubtitle').textContent = introPages.company.subtitle || 'HTeng이 추구하는...';
        document.getElementById('companyIntroPreviewHistoryCount').textContent = `${introPages.company.history ? introPages.company.history.length : 0}개`;
        document.getElementById('companyIntroPreviewBusinessCount').textContent = `${introPages.company.businessItems ? introPages.company.businessItems.length : 0}개`;
      }
    }
  } catch (error) {
    console.error('소개 페이지 정보 로드 실패:', error);
  }
}

// 소개 페이지 수정 모달 열기
async function editIntroPage(pageType) {
  try {
    const response = await fetch('http://localhost:3000/api/admin/intro-pages', {
      headers: {
        'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`
      }
    });

    if (response.ok) {
      const introPages = await response.json();
      const pageData = introPages[pageType];

      if (pageData) {
        showIntroPageModal(pageType, pageData);
      }
    }
  } catch (error) {
    console.error('소개 페이지 정보 로드 실패:', error);
    alert('소개 페이지 정보를 불러오는데 실패했습니다.');
  }
}

// 소개 페이지 수정 모달 표시
function showIntroPageModal(pageType, pageData) {
  const modal = document.getElementById('introPageModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalContent = document.getElementById('modalContent');

  // 모달 제목 설정
  const pageNames = {
    'ceo': 'CEO 소개 페이지',
    'members': '회사 구성원 소개 페이지',
    'company': '회사 소개 페이지'
  };
  modalTitle.textContent = pageNames[pageType] + ' 수정';

  // 모달 내용 생성
  modalContent.innerHTML = generateIntroPageForm(pageType, pageData);

  // 모달 표시
  modal.style.display = 'flex';

  // 폼 이벤트 리스너 설정
  setupIntroPageFormListener(pageType);
}

// 소개 페이지 수정 폼 생성
function generateIntroPageForm(pageType, pageData) {
  switch (pageType) {
    case 'ceo':
      return generateCeoForm(pageData);
    case 'members':
      return generateMembersForm(pageData);
    case 'company':
      return generateCompanyForm(pageData);
    default:
      return '<p>지원하지 않는 페이지 타입입니다.</p>';
  }
}

// CEO 소개 폼 생성
function generateCeoForm(ceoData) {
  return `
    <form class="intro-page-form" id="ceoIntroForm">
      <div class="form-section">
        <h4>페이지 정보</h4>
        <div class="form-group">
          <label for="ceoTitle">페이지 제목</label>
          <input type="text" id="ceoTitle" name="ceoTitle" value="${ceoData.title || 'CEO 소개'}" required>
        </div>
        <div class="form-group">
          <label for="ceoSubtitle">페이지 부제목</label>
          <input type="text" id="ceoSubtitle" name="ceoSubtitle" value="${ceoData.subtitle || 'HTeng의 리더십'}" required>
        </div>
      </div>
      
      <div class="form-section">
        <h4>CEO 기본 정보</h4>
        <div class="form-row">
          <div class="form-group">
            <label for="ceoName">이름</label>
            <input type="text" id="ceoName" name="ceoName" value="${ceoData.name || ''}" required>
          </div>
          <div class="form-group">
            <label for="ceoPosition">직책</label>
            <input type="text" id="ceoPosition" name="ceoPosition" value="${ceoData.position || ''}" required>
          </div>
        </div>
        <div class="form-group">
          <label for="ceoIntroduction">소개</label>
          <textarea id="ceoIntroduction" name="ceoIntroduction" rows="4" required>${ceoData.introduction || ''}</textarea>
        </div>
        <div class="form-group">
          <label for="ceoVision">비전</label>
          <textarea id="ceoVision" name="ceoVision" rows="4" required>${ceoData.vision || ''}</textarea>
        </div>
      </div>
      
      <div class="form-actions">
        <button type="button" class="cancel-page-btn" onclick="closeIntroPageModal()">취소</button>
        <button type="submit" class="save-page-btn">저장</button>
      </div>
    </form>
  `;
}

// 회사 구성원 소개 폼 생성
function generateMembersForm(membersData) {
  const membersHTML = (membersData.members || []).map((member, index) => `
    <div class="member-item" data-index="${index}">
      <div class="member-header">
        <h5>구성원 ${index + 1}</h5>
        <button type="button" class="remove-member-btn" onclick="removeMemberFromIntro(${index})" title="제거">
          <i class="fas fa-trash"></i>
        </button>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>이름</label>
          <input type="text" name="memberName_${index}" value="${member.name || ''}" required>
        </div>
        <div class="form-group">
          <label>직책</label>
          <input type="text" name="memberPosition_${index}" value="${member.position || ''}" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>부서</label>
          <input type="text" name="memberDepartment_${index}" value="${member.department || ''}" required>
        </div>
        <div class="form-group">
          <label>경력</label>
          <input type="text" name="memberExperience_${index}" value="${member.experience || ''}" placeholder="3년">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>이메일</label>
          <input type="email" name="memberEmail_${index}" value="${member.email || ''}">
        </div>
        <div class="form-group">
          <label>이미지</label>
          <input type="text" name="memberImage_${index}" value="${member.image || ''}" placeholder="member1.jpg">
        </div>
      </div>
      <div class="form-group">
        <label>설명</label>
        <textarea name="memberDescription_${index}" rows="3" required>${member.description || ''}</textarea>
      </div>
    </div>
  `).join('');

  return `
    <form class="intro-page-form" id="membersIntroForm">
      <div class="form-section">
        <h4>페이지 정보</h4>
        <div class="form-group">
          <label for="membersTitle">페이지 제목</label>
          <input type="text" id="membersTitle" name="membersTitle" value="${membersData.title || ''}" required>
        </div>
        <div class="form-group">
          <label for="membersSubtitle">부제목</label>
          <input type="text" id="membersSubtitle" name="membersSubtitle" value="${membersData.subtitle || ''}" required>
        </div>
      </div>
      
      <div class="form-section">
        <h4>구성원 목록</h4>
        <div id="introMembersList">
          ${membersHTML}
        </div>
        <button type="button" class="add-member-btn" onclick="addMemberToIntro()">
          <i class="fas fa-plus"></i> 구성원 추가
        </button>
      </div>
      
      <div class="form-actions">
        <button type="button" class="cancel-page-btn" onclick="closeIntroPageModal()">취소</button>
        <button type="submit" class="save-page-btn">저장</button>
      </div>
    </form>
  `;
}

// 회사 소개 폼 생성
function generateCompanyForm(companyData) {
  const historyHTML = (companyData.history || []).map((history, index) => `
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
        <button type="button" class="remove-history-btn" onclick="removeHistoryFromIntro(${index})" title="제거">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>
  `).join('');

  const businessItemsHTML = (companyData.businessItems || []).map((business, index) => `
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
        <button type="button" class="remove-business-btn" onclick="removeBusinessFromIntro(${index})" title="제거">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>
  `).join('');

  return `
    <form class="intro-page-form" id="companyIntroForm">
      <div class="form-section">
        <h4>페이지 정보</h4>
        <div class="form-group">
          <label for="companyIntroTitle">페이지 제목</label>
          <input type="text" id="companyIntroTitle" name="companyIntroTitle" value="${companyData.title || '회사 소개'}" required>
        </div>
        <div class="form-group">
          <label for="companyIntroSubtitle">페이지 부제목</label>
          <input type="text" id="companyIntroSubtitle" name="companyIntroSubtitle" value="${companyData.subtitle || 'HTeng이 추구하는 핵심 가치입니다'}" required>
        </div>
      </div>
      
      <div class="form-section">
        <h4>기본 정보</h4>
        <div class="form-group">
          <label for="companyName">회사명</label>
          <input type="text" id="companyName" name="companyName" value="${companyData.name || ''}" required>
        </div>
        <div class="form-group">
          <label for="companyDesc">회사 설명</label>
          <textarea id="companyDesc" name="companyDesc" rows="4" required>${companyData.description || ''}</textarea>
        </div>
        <div class="form-group">
          <label for="companyBusiness">사업 분야</label>
          <textarea id="companyBusiness" name="companyBusiness" rows="3" required>${companyData.business || ''}</textarea>
        </div>
        <div class="form-group">
          <label for="companyLocation">주소</label>
          <input type="text" id="companyLocation" name="companyLocation" value="${companyData.location || ''}" required>
        </div>
      </div>
      
      <div class="form-section">
        <h4>연혁</h4>
        <div id="introHistoryList">
          ${historyHTML}
        </div>
        <button type="button" class="add-history-btn" onclick="addHistoryToIntro()">
          <i class="fas fa-plus"></i> 연혁 추가
        </button>
      </div>
      
      <div class="form-section">
        <h4>사업 항목 상세</h4>
        <div id="introBusinessList">
          ${businessItemsHTML}
        </div>
        <button type="button" class="add-business-btn" onclick="addBusinessToIntro()">
          <i class="fas fa-plus"></i> 사업 항목 추가
        </button>
      </div>
      
      <div class="form-actions">
        <button type="button" class="cancel-page-btn" onclick="closeIntroPageModal()">취소</button>
        <button type="submit" class="save-page-btn">저장</button>
      </div>
    </form>
  `;
}

// 소개 페이지 수정 모달 닫기
function closeIntroPageModal() {
  document.getElementById('introPageModal').style.display = 'none';
}

// 소개 페이지 폼 이벤트 리스너 설정
function setupIntroPageFormListener(pageType) {
  const form = document.getElementById(pageType + 'IntroForm');
  if (form) {
    form.addEventListener('submit', (e) => handleIntroPageUpdate(e, pageType));
  }
}

// 소개 페이지 업데이트 처리
async function handleIntroPageUpdate(e, pageType) {
  e.preventDefault();

  const submitBtn = e.target.querySelector('.save-page-btn');
  setButtonLoading(submitBtn, true);

  try {
    const formData = new FormData(e.target);
    const pageData = collectFormData(pageType, formData);

    const response = await fetch(`http://localhost:3000/api/admin/intro-pages/${pageType}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`
      },
      body: JSON.stringify(pageData)
    });

    if (response.ok) {
      const result = await response.json();
      setButtonSuccess(submitBtn);
      alert('소개 페이지 정보가 성공적으로 업데이트되었습니다.');

      // 미리보기 정보 새로고침
      await loadIntroPagesInfo();

      // 모달 닫기
      closeIntroPageModal();
    } else {
      const errorData = await response.json();
      alert(`소개 페이지 업데이트에 실패했습니다: ${errorData.message || response.statusText}`);
    }
  } catch (error) {
    console.error('소개 페이지 업데이트 실패:', error);
    setButtonError(submitBtn);
    alert('소개 페이지 업데이트에 실패했습니다.');
  } finally {
    setButtonLoading(submitBtn, false);
  }
}

// 폼 데이터 수집
function collectFormData(pageType, formData) {
  switch (pageType) {
    case 'ceo':
      return {
        title: formData.get('ceoTitle'),
        subtitle: formData.get('ceoSubtitle'),
        name: formData.get('ceoName'),
        position: formData.get('ceoPosition'),
        introduction: formData.get('ceoIntroduction'),
        vision: formData.get('ceoVision')
      };
    case 'members':
      const members = [];
      const memberItems = document.querySelectorAll('#introMembersList .member-item');
      memberItems.forEach((item, index) => {
        const member = {
          name: formData.get(`memberName_${index}`),
          position: formData.get(`memberPosition_${index}`),
          department: formData.get(`memberDepartment_${index}`),
          experience: formData.get(`memberExperience_${index}`),
          email: formData.get(`memberEmail_${index}`),
          description: formData.get(`memberDescription_${index}`)
        };
        if (member.name && member.position && member.description) {
          members.push(member);
        }
      });
      return {
        title: formData.get('membersTitle'),
        subtitle: formData.get('membersSubtitle'),
        members: members
      };
    case 'company':
      const history = [];
      const historyItems = document.querySelectorAll('#introHistoryList .history-item');
      historyItems.forEach((item, index) => {
        const year = formData.get(`historyYear_${index}`);
        const event = formData.get(`historyEvent_${index}`);
        if (year && event) {
          history.push({ year, event });
        }
      });

      const businessItems = [];
      const businessItemElements = document.querySelectorAll('#introBusinessList .business-item');
      businessItemElements.forEach((item, index) => {
        const title = formData.get(`businessTitle_${index}`);
        const description = formData.get(`businessDescription_${index}`);
        if (title && description) {
          businessItems.push({ title, description });
        }
      });

      return {
        title: formData.get('companyIntroTitle'),
        subtitle: formData.get('companyIntroSubtitle'),
        name: formData.get('companyName'),
        description: formData.get('companyDesc'),
        business: formData.get('companyBusiness'),
        location: formData.get('companyLocation'),
        history: history,
        businessItems: businessItems
      };
    default:
      return {};
  }
}

// 소개 페이지에 구성원 추가
function addMemberToIntro() {
  const membersList = document.getElementById('introMembersList');
  const memberCount = membersList.querySelectorAll('.member-item').length;
  const newIndex = memberCount;

  const newMember = {
    name: '',
    position: '',
    department: '',
    experience: '',
    email: '',
    image: '',
    description: ''
  };

  addMemberToIntroForm(newMember, newIndex);
}

// 소개 페이지 폼에 구성원 추가
function addMemberToIntroForm(member, index) {
  const membersList = document.getElementById('introMembersList');

  const memberHTML = `
    <div class="member-item" data-index="${index}">
      <div class="member-header">
        <h5>구성원 ${index + 1}</h5>
        <button type="button" class="remove-member-btn" onclick="removeMemberFromIntro(${index})" title="제거">
          <i class="fas fa-trash"></i>
        </button>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>이름</label>
          <input type="text" name="memberName_${index}" value="${member.name || ''}" required>
        </div>
        <div class="form-group">
          <label>직책</label>
          <input type="text" name="memberPosition_${index}" value="${member.position || ''}" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>부서</label>
          <input type="text" name="memberDepartment_${index}" value="${member.department || ''}" required>
        </div>
        <div class="form-group">
          <label>경력</label>
          <input type="text" name="memberExperience_${index}" value="${member.experience || ''}" placeholder="3년">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>이메일</label>
          <input type="email" name="memberEmail_${index}" value="${member.email || ''}">
        </div>
        <div class="form-group">
          <label>이미지</label>
          <input type="text" name="memberImage_${index}" value="${member.image || ''}" placeholder="member1.jpg">
        </div>
      </div>
      <div class="form-group">
        <label>설명</label>
        <textarea name="memberDescription_${index}" rows="3" required>${member.description || ''}</textarea>
      </div>
    </div>
  `;

  membersList.insertAdjacentHTML('beforeend', memberHTML);
}

// 소개 페이지에서 구성원 제거
function removeMemberFromIntro(index) {
  const memberItem = document.querySelector(`#introMembersList [data-index="${index}"]`);
  if (memberItem) {
    memberItem.remove();
    // 인덱스 재정렬
    reorderMemberIndexesInIntro();
  }
}

// 소개 페이지 구성원 인덱스 재정렬
function reorderMemberIndexesInIntro() {
  const memberItems = document.querySelectorAll('#introMembersList .member-item');
  memberItems.forEach((item, newIndex) => {
    item.setAttribute('data-index', newIndex);
    item.querySelector('h5').textContent = `구성원 ${newIndex + 1}`;

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
    const removeBtn = item.querySelector('.remove-member-btn');
    if (removeBtn) {
      removeBtn.setAttribute('onclick', `removeMemberFromIntro(${newIndex})`);
    }
  });
}

// 소개 페이지에 연혁 추가
function addHistoryToIntro() {
  const historyList = document.getElementById('introHistoryList');
  const historyCount = historyList.querySelectorAll('.history-item').length;
  const newIndex = historyCount;

  const newHistory = {
    year: '',
    event: ''
  };

  addHistoryToIntroForm(newHistory, newIndex);
}

// 소개 페이지 폼에 연혁 추가
function addHistoryToIntroForm(history, index) {
  const historyList = document.getElementById('introHistoryList');

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
        <button type="button" class="remove-history-btn" onclick="removeHistoryFromIntro(${index})" title="제거">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>
  `;

  historyList.insertAdjacentHTML('beforeend', historyHTML);
}

// 소개 페이지에서 연혁 제거
function removeHistoryFromIntro(index) {
  const historyItem = document.querySelector(`#introHistoryList [data-index="${index}"]`);
  if (historyItem) {
    historyItem.remove();
    // 인덱스 재정렬
    reorderHistoryIndexesInIntro();
  }
}

// 소개 페이지 연혁 인덱스 재정렬
function reorderHistoryIndexesInIntro() {
  const historyItems = document.querySelectorAll('#introHistoryList .history-item');
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
      removeBtn.setAttribute('onclick', `removeHistoryFromIntro(${newIndex})`);
    }
  });
}

// 소개 페이지에 사업 항목 추가
function addBusinessToIntro() {
  const businessList = document.getElementById('introBusinessList');
  const businessCount = businessList.querySelectorAll('.business-item').length;
  const newIndex = businessCount;

  const newBusiness = {
    title: '',
    description: ''
  };

  addBusinessToIntroForm(newBusiness, newIndex);
}

// 소개 페이지 폼에 사업 항목 추가
function addBusinessToIntroForm(business, index) {
  const businessList = document.getElementById('introBusinessList');

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
        <button type="button" class="remove-business-btn" onclick="removeBusinessFromIntro(${index})" title="제거">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>
  `;

  businessList.insertAdjacentHTML('beforeend', businessHTML);
}

// 소개 페이지에서 사업 항목 제거
function removeBusinessFromIntro(index) {
  const businessItem = document.querySelector(`#introBusinessList [data-index="${index}"]`);
  if (businessItem) {
    businessItem.remove();
    // 인덱스 재정렬
    reorderBusinessIndexesInIntro();
  }
}

// 소개 페이지 사업 항목 인덱스 재정렬
function reorderBusinessIndexesInIntro() {
  const businessItems = document.querySelectorAll('#introBusinessList .business-item');
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
      removeBtn.setAttribute('onclick', `removeBusinessFromIntro(${newIndex})`);
    }
  });
}
