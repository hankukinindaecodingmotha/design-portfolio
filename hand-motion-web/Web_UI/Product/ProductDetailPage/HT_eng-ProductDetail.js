// Web_UI/ProductPage/ProductDetailPage/HT_eng-ProductDetail.js

// Web_UI/ProductPage/HT_eng-ProductDetail.js
function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
}

function renderSpecs(product) {
    const specGrid = document.getElementById('specGrid');

    // 표시할 필드 매핑 (표시명: 실제 키)
    const fields = [
        ['AC/DC', 'AC or DC'],
        ['제품군', '제품군'],
        ['보호종류', '보호종류'],
        ['통신여부', '통신여부'],
        ['통신종류', '통신종류'],
        ['누설(지락)', '누설(지락)'],
        ['단락', '단락'],
        ['과전류/저전류', '과전류/저전류'],
        ['결상', '결상'],
        ['역상', '역상'],
        ['과전압/저전압', '과전압/저전압'],
        ['전력', '전력'],
        ['내장 ZCT', '내장 ZCT'],
    ];

    specGrid.innerHTML = fields
        .filter(([_, key]) => product[key] && String(product[key]).trim() !== '')
        .map(([label, key]) => `
      <div class="spec-item">
        <div class="spec-key">${label}</div>
        <div class="spec-value">${product[key]}</div>
      </div>
    `)
        .join('');
}

async function loadProductDetail() {
    const name = getQueryParam('name');
    const productNameEl = document.getElementById('productName');
    const productMetaEl = document.getElementById('productMeta');
    const productDescEl = document.getElementById('productDesc');
    const imageBadgeEl = document.getElementById('imageBadge');

    if (!name) {
        productNameEl.textContent = '제품명을 찾을 수 없습니다';
        productDescEl.textContent = 'URL의 name 파라미터가 필요합니다.';
        return;
    }

    try {
        const res = await fetch(`http://localhost:3000/api/products/filter?제품명=${encodeURIComponent(name)}`);
        const list = await res.json();

        if (!Array.isArray(list) || list.length === 0) {
            productNameEl.textContent = name;
            productDescEl.textContent = '해당 제품 정보를 찾을 수 없습니다.';
            return;
        }

        const product = list[0];

        productNameEl.textContent = product.제품 || name;
        productDescEl.textContent = product.상세설명 || '-';
        productMetaEl.textContent = [
            product['AC or DC'] ? `AC/DC: ${product['AC or DC']}` : null,
            product.제품군 ? `제품군: ${product.제품군}` : null,
            product.보호종류 ? `보호종류: ${product.보호종류}` : null
        ].filter(Boolean).join(' · ');

        imageBadgeEl.textContent = (product.제품 || name).charAt(0);

        renderSpecs(product);
    } catch (e) {
        productNameEl.textContent = name;
        productDescEl.textContent = '서버 통신 중 오류가 발생했습니다.';
        console.error(e);
    }
}

document.getElementById('backBtn').addEventListener('click', () => history.back());
document.getElementById('homeBtn').addEventListener('click', () => {
    // ProductDetailPage 폴더 기준
    window.location.href = '../../HomePage/HT-eng-HomePage.html';
});
document.getElementById('contactBtn').addEventListener('click', () => {
    alert('문의는 고객센터로 연락 부탁드립니다.');
});

loadProductDetail();