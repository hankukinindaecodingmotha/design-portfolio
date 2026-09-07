// 메인페이지 관리 JavaScript

// 메인페이지 데이터 로드
async function loadMainPageData() {
  try {
    const response = await fetch('http://localhost:3000/api/main-page');
    if (response.ok) {
      const data = await response.json();
      populateMainPageForm(data);
      console.log('메인페이지 데이터를 성공적으로 불러왔습니다.');
    } else {
      throw new Error('메인페이지 데이터를 불러올 수 없습니다.');
    }
  } catch (error) {
    console.error('Error loading main page data:', error);
    console.log('메인페이지 데이터를 불러올 수 없습니다. 서버가 실행 중인지 확인하세요.');
  }
}

// 폼에 데이터 채우기
function populateMainPageForm(data) {
  // CEO 정보 로드
  document.getElementById('ceoName').value = data.contact.ceo.name || '';
  document.getElementById('ceoPosition').value = data.contact.ceo.position || '';
  document.getElementById('ceoPhone').value = data.contact.ceo.phone || '';
  document.getElementById('ceoEmail').value = data.contact.ceo.email || '';
  document.getElementById('ceoAddress').value = data.contact.ceo.address || '';
  renderExperience('ceoExperienceContainer', data.contact.ceo.experience);

  // Manager 정보
  document.getElementById('managerName').value = data.contact.manager.name || '';
  document.getElementById('managerPosition').value = data.contact.manager.position || '';
  document.getElementById('managerPhone').value = data.contact.manager.phone || '';
  document.getElementById('managerEmail').value = data.contact.manager.email || '';
  document.getElementById('managerAddress').value = data.contact.manager.address || '';
  document.getElementById('managerImage').value = data.contact.manager.image || '';
  renderExperience('managerExperienceContainer', data.contact.manager.experience);

  // 설명 섹션
  renderDescriptions(data.descriptions);
}

// 경력 렌더링
function renderExperience(containerId, experience) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = '';

  if (experience && Array.isArray(experience)) {
    experience.forEach((exp, index) => {
      const expDiv = document.createElement('div');
      expDiv.className = 'experience-item';
      expDiv.innerHTML = `
        <div class="form-row">
          <input type="text" name="${containerId}_${index}" value="${exp}" placeholder="경력을 입력하세요">
          <button type="button" class="btn btn-danger btn-small" onclick="removeExperience('${containerId}', ${index})">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      `;
      container.appendChild(expDiv);
    });
  }
}

// 설명 섹션 렌더링
function renderDescriptions(descriptions) {
  const container = document.getElementById('descriptionsContainer');
  if (!container) return;

  container.innerHTML = '';

  if (descriptions && Array.isArray(descriptions)) {
    descriptions.forEach((desc, index) => {
      const descDiv = document.createElement('div');
      descDiv.className = 'description-item';
      descDiv.innerHTML = `
        <div class="form-group">
          <label>제목:</label>
          <input type="text" name="descTitle_${index}" value="${desc.title || ''}">
        </div>
        <div class="form-group">
          <label>이미지 경로:</label>
          <input type="text" name="descImage_${index}" value="${desc.image || ''}">
        </div>
        <div class="form-group">
          <label>대체 텍스트:</label>
          <input type="text" name="descAlt_${index}" value="${desc.alt || ''}">
        </div>
        <div class="form-group">
          <label>내용:</label>
          <textarea name="descContent_${index}" rows="3">${desc.content || ''}</textarea>
        </div>
        <button type="button" class="btn btn-danger btn-small" onclick="removeDescription(${index})">
          <i class="fas fa-trash"></i> 제거
        </button>
      `;
      container.appendChild(descDiv);
    });
  }
}

// 경력 추가
function addExperience(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const index = container.children.length;

  const expDiv = document.createElement('div');
  expDiv.className = 'experience-item';
  expDiv.innerHTML = `
    <div class="form-row">
      <input type="text" name="${containerId}_${index}" placeholder="경력을 입력하세요">
      <button type="button" class="btn btn-danger btn-small" onclick="removeExperience('${containerId}', ${index})">
        <i class="fas fa-trash"></i>
      </button>
    </div>
  `;
  container.appendChild(expDiv);
}

// 경력 제거
function removeExperience(containerId, index) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const expItems = container.querySelectorAll('.experience-item');

  if (expItems[index]) {
    expItems[index].remove();
    reorderExperienceIndexes(containerId);
  }
}

// 경력 인덱스 재정렬
function reorderExperienceIndexes(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const expItems = container.querySelectorAll('.experience-item');

  expItems.forEach((item, newIndex) => {
    const input = item.querySelector('input');
    if (input) {
      input.name = `${containerId}_${newIndex}`;
    }

    const removeBtn = item.querySelector('button');
    if (removeBtn) {
      removeBtn.onclick = () => removeExperience(containerId, newIndex);
    }
  });
}

// 설명 섹션 추가
function addDescription() {
  const container = document.getElementById('descriptionsContainer');
  if (!container) return;

  const index = container.children.length;

  const descDiv = document.createElement('div');
  descDiv.className = 'description-item';
  descDiv.innerHTML = `
    <div class="form-group">
      <label>제목:</label>
      <input type="text" name="descTitle_${index}" placeholder="제목을 입력하세요">
    </div>
    <div class="form-group">
      <label>이미지 경로:</label>
      <input type="text" name="descImage_${index}" placeholder="이미지 경로를 입력하세요">
    </div>
    <div class="form-group">
      <label>대체 텍스트:</label>
      <input type="text" name="descAlt_${index}" placeholder="대체 텍스트를 입력하세요">
    </div>
    <div class="form-group">
      <label>내용:</label>
      <textarea name="descContent_${index}" rows="3" placeholder="내용을 입력하세요"></textarea>
    </div>
    <button type="button" class="btn btn-danger btn-small" onclick="removeDescription(${index})">
      <i class="fas fa-trash"></i> 제거
    </button>
  `;
  container.appendChild(descDiv);
}

// 설명 섹션 제거
function removeDescription(index) {
  const container = document.getElementById('descriptionsContainer');
  if (!container) return;

  const descItems = container.querySelectorAll('.description-item');

  if (descItems[index]) {
    descItems[index].remove();
    reorderDescriptionIndexes();
  }
}

// 설명 섹션 인덱스 재정렬
function reorderDescriptionIndexes() {
  const container = document.getElementById('descriptionsContainer');
  if (!container) return;

  const descItems = container.querySelectorAll('.description-item');

  descItems.forEach((item, newIndex) => {
    const inputs = item.querySelectorAll('input, textarea');
    inputs.forEach(input => {
      const name = input.name;
      const newName = name.replace(/_\d+/, `_${newIndex}`);
      input.name = newName;
    });

    const removeBtn = item.querySelector('button');
    if (removeBtn) {
      removeBtn.onclick = () => removeDescription(newIndex);
    }
  });
}

// 메인페이지 데이터 저장
async function saveMainPageData() {
  try {
    const formData = collectMainPageFormData();

    const response = await fetch('http://localhost:3000/api/admin/main-page', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionStorage.getItem('token')}`
      },
      body: JSON.stringify(formData)
    });

    if (response.ok) {
              console.log('메인페이지가 성공적으로 저장되었습니다!');

      // 저장 후 즉시 홈페이지에 적용 확인
      await applyChangesToHomePage(formData);

    } else {
      throw new Error('저장에 실패했습니다.');
    }
  } catch (error) {
    console.error('Error saving main page data:', error);
    alert('메인페이지 저장 중 오류가 발생했습니다.');
  }
}

// 홈페이지에 변경사항 즉시 적용
async function applyChangesToHomePage(data) {
  try {
    // 현재 열려있는 홈페이지 탭 찾기
    const homePageTab = window.open('../HomePage/HT-eng-HomePage.html', '_blank');

    if (homePageTab) {
      // 홈페이지가 로드될 때까지 잠시 대기
      setTimeout(() => {
        // 홈페이지에 메시지 전송하여 데이터 업데이트 요청
        homePageTab.postMessage({
          type: 'UPDATE_MAIN_PAGE',
          data: data
        }, '*');
      }, 2000);
    }

    alert('변경사항이 홈페이지에 즉시 적용되었습니다!');

  } catch (error) {
    console.error('Error applying changes to home page:', error);
  }
}

// 폼 데이터 수집
function collectMainPageFormData() {
  // CEO 데이터
  const ceo = {
    name: document.getElementById('ceoName').value,
    position: document.getElementById('ceoPosition').value,
    phone: document.getElementById('ceoPhone').value,
    email: document.getElementById('ceoEmail').value,
    address: document.getElementById('ceoAddress').value,
    experience: collectExperience('ceoExperienceContainer')
  };

  // Manager 데이터
  const manager = {
    name: document.getElementById('managerName').value,
    position: document.getElementById('managerPosition').value,
    phone: document.getElementById('managerPhone').value,
    email: document.getElementById('managerEmail').value,
    address: document.getElementById('managerAddress').value,
    image: document.getElementById('managerImage').value,
    experience: collectExperience('managerExperienceContainer')
  };

  // 설명 섹션 데이터
  const descriptions = [];
  const descItems = document.querySelectorAll('#descriptionsContainer .description-item');
  descItems.forEach(item => {
    const title = item.querySelector('input[name^="descTitle_"]').value;
    const image = item.querySelector('input[name^="descImage_"]').value;
    const alt = item.querySelector('input[name^="descAlt_"]').value;
    const content = item.querySelector('textarea[name^="descContent_"]').value;

    if (title && image && content) {
      descriptions.push({ title, image, alt, content });
    }
  });

  return {
    contact: { ceo, manager },
    descriptions
  };
}

// 경력 데이터 수집
function collectExperience(containerId) {
  const experience = [];
  const container = document.getElementById(containerId);
  if (!container) return experience;

  const inputs = container.querySelectorAll('input');

  inputs.forEach(input => {
    if (input.value.trim()) {
      experience.push(input.value.trim());
    }
  });

  return experience;
}

// 페이지 로드 시 자동 데이터 로드 비활성화
// 필요시 수동으로 "데이터 불러오기" 버튼을 클릭하세요
