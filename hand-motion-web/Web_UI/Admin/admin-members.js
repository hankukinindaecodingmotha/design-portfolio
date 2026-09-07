// 회사 구성원 관리 기능
// ================================

// 회사 구성원 정보 로드
async function loadMembersInfo() {
  try {
    console.log('회사 구성원 정보 로드 시작...');
    const response = await fetch('http://localhost:3000/api/admin/members', {
      headers: {
        'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`
      }
    });

    if (response.ok) {
      const membersInfo = await response.json();
      console.log('로드된 구성원 정보:', membersInfo);

      // 구성원 폼에 데이터 반영
      const membersTitleInput = document.getElementById('membersTitle');
      const membersSubtitleInput = document.getElementById('membersSubtitle');

      if (membersTitleInput) membersTitleInput.value = membersInfo.title || '';
      if (membersSubtitleInput) membersSubtitleInput.value = membersInfo.subtitle || '';

      // 기존 구성원 목록 제거
      const membersList = document.getElementById('membersList');
      if (membersList) {
        const existingMembers = membersList.querySelectorAll('.member-item');
        existingMembers.forEach(member => member.remove());

        // 새로운 구성원 목록 생성
        if (membersInfo.members && Array.isArray(membersInfo.members)) {
          membersInfo.members.forEach((member, index) => {
            addMemberToForm(member, index);
          });
        }
      }

      console.log('구성원 폼 업데이트 완료');
    } else {
      console.error('구성원 정보 로드 실패:', response.status);
    }
  } catch (error) {
    console.error('구성원 정보 로드 실패:', error);
  }
}

// 회사 구성원 정보 업데이트 처리
async function handleMembersUpdate(e) {
  e.preventDefault();
  
  const submitBtn = e.target.querySelector('button[type="submit"]');
  setButtonLoading(submitBtn, true);

  try {
    const formData = new FormData(e.target);
    
    const membersData = {
      title: formData.get('membersTitle'),
      subtitle: formData.get('membersSubtitle'),
      members: []
    };

    // 구성원 항목들 수집
    const memberItems = document.querySelectorAll('#membersList .member-item');
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
        membersData.members.push(member);
      }
    });

    const response = await fetch('http://localhost:3000/api/admin/members', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`
      },
      body: JSON.stringify(membersData)
    });

    if (response.ok) {
      const result = await response.json();
      setButtonSuccess(submitBtn);
      alert('회사 구성원 정보가 성공적으로 업데이트되었습니다.');
      console.log('구성원 정보 업데이트 성공:', result);
    } else {
      const errorData = await response.json();
      alert(`구성원 정보 업데이트 실패: ${errorData.message || response.statusText}`);
      setButtonError(submitBtn);
    }
  } catch (error) {
    console.error('구성원 정보 업데이트 실패:', error);
    alert('구성원 정보 업데이트 중 오류가 발생했습니다.');
    setButtonError(submitBtn);
  } finally {
    setButtonLoading(submitBtn, false);
  }
}

// 구성원 관련 함수들
function addNewMember() {
  const membersList = document.getElementById('membersList');
  const memberCount = membersList.querySelectorAll('.member-item').length;
  const newIndex = memberCount;

  const newMember = {
    name: '',
    position: '',
    department: '',
    experience: '',
    email: '',
    description: ''
  };

  addMemberToForm(newMember, newIndex);
}

function addMemberToForm(member, index) {
  const membersList = document.getElementById('membersList');

  const memberHTML = `
    <div class="member-item" data-index="${index}">
      <div class="member-header">
        <h5>구성원 ${index + 1}</h5>
        <button type="button" class="remove-member-btn" onclick="removeMember(${index})" title="제거">
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
      </div>
      <div class="form-group">
        <label>설명</label>
        <textarea name="memberDescription_${index}" rows="3" required>${member.description || ''}</textarea>
      </div>
    </div>
  `;

  membersList.insertAdjacentHTML('beforeend', memberHTML);
}

function removeMember(index) {
  const memberItem = document.querySelector(`[data-index="${index}"]`);
  if (memberItem) {
    memberItem.remove();
    // 인덱스 재정렬
    reorderMemberIndexes();
  }
}

function reorderMemberIndexes() {
  const memberItems = document.querySelectorAll('#membersList .member-item');
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
      removeBtn.setAttribute('onclick', `removeMember(${newIndex})`);
    }
  });
}
