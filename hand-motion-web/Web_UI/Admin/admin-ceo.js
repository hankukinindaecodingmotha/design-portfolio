// CEO 정보 관리 기능
// ================================

// CEO 정보 로드
async function loadCeoInfo() {
  try {
    console.log('CEO 정보 로드 시작...');
    const response = await fetch('http://localhost:3000/api/admin/ceo', {
      headers: {
        'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`
      }
    });

    if (response.ok) {
      const ceoInfo = await response.json();
      console.log('로드된 CEO 정보:', ceoInfo);

      // CEO 폼에 데이터 반영 (이미지 필드 제거)
      const ceoNameInput = document.getElementById('ceoName');
      const ceoPositionInput = document.getElementById('ceoPosition');
      const ceoIntroductionInput = document.getElementById('ceoIntroduction');
      const ceoVisionInput = document.getElementById('ceoVision');

      if (ceoNameInput) ceoNameInput.value = ceoInfo.name || '';
      if (ceoPositionInput) ceoPositionInput.value = ceoInfo.position || '';
      if (ceoIntroductionInput) ceoIntroductionInput.value = ceoInfo.introduction || '';
      if (ceoVisionInput) ceoVisionInput.value = ceoInfo.vision || '';

      console.log('CEO 폼 업데이트 완료');
    } else {
      console.error('CEO 정보 로드 실패:', response.status);
    }
  } catch (error) {
    console.error('CEO 정보 로드 실패:', error);
  }
}

// CEO 정보 업데이트 처리
async function handleCeoUpdate(e) {
  e.preventDefault();
  
  const submitBtn = e.target.querySelector('button[type="submit"]');
  setButtonLoading(submitBtn, true);

  try {
    const formData = new FormData(e.target);
    
    const ceoData = {
      name: formData.get('ceoName'),
      position: formData.get('ceoPosition'),
      introduction: formData.get('ceoIntroduction'),
      vision: formData.get('ceoVision')
    };

    const response = await fetch('http://localhost:3000/api/admin/ceo', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`
      },
      body: JSON.stringify(ceoData)
    });

    if (response.ok) {
      const result = await response.json();
      setButtonSuccess(submitBtn);
      alert('CEO 정보가 성공적으로 업데이트되었습니다.');
      console.log('CEO 정보 업데이트 성공:', result);
    } else {
      const errorData = await response.json();
      alert(`CEO 정보 업데이트 실패: ${errorData.message || response.statusText}`);
      setButtonError(submitBtn);
    }
  } catch (error) {
    console.error('CEO 정보 업데이트 실패:', error);
    alert('CEO 정보 업데이트 중 오류가 발생했습니다.');
    setButtonError(submitBtn);
  } finally {
    setButtonLoading(submitBtn, false);
  }
}
