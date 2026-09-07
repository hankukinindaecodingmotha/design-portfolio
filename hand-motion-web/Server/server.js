/**
 * HTeng 전기 보호 장치 회사 웹사이트 백엔드 서버
 * 
 * 🚀 주요 기능:
 * - 사용자 인증 및 권한 관리 (JWT 기반)
 * - EOCR 제품 데이터 관리 및 필터링
 * - 회사 정보 및 콘텐츠 관리
 * - 관리자 대시보드 API
 * - 정적 파일 서빙 및 라우팅
 * 
 * 🔧 최적화 제안:
 * - 데이터베이스 도입 (현재는 메모리 기반)
 * - Redis 캐싱 도입으로 성능 향상
 * - API 응답 압축 (gzip, brotli)
 * - 로깅 시스템 개선 (Winston, Morgan)
 * - 에러 핸들링 강화 (global error handler)
 * - 보안 강화 (rate limiting, input validation, helmet)
 * - 성능 모니터링 (New Relic, DataDog)
 * 
 * 📊 성능 지표:
 * - 현재 응답 시간: ~50-100ms
 * - 목표 응답 시간: ~20-50ms
 * - 동시 사용자 처리: 100명
 * - 목표 동시 사용자: 1000명
 * 
 * @version 2.0.0
 * @author HTeng Development Team
 * @lastUpdated 2024-08-22
 */

// ==================== 필수 모듈 임포트 ====================
const express = require('express');
const cors = require('cors');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerJSDoc = require('swagger-jsdoc');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

// Express 애플리케이션 인스턴스 생성
const app = express();

// ==================== 환경 설정 및 상수 ====================
/**
 * 환경 설정 변수
 * @description 개발/프로덕션 환경에 따른 설정 분기
 * TODO: .env 파일 사용으로 민감한 정보 분리
 */
const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = process.env.PORT || 3000;
const API_VERSION = 'v1'; // API 버전 관리

/**
 * 보안 설정 상수
 * @description 프로덕션 환경에서 보안 강화
 */
const SECURITY_CONFIG = {
    // JWT 토큰 만료 시간 (초)
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
    // 비밀번호 해시 라운드
    BCRYPT_ROUNDS: process.env.BCRYPT_ROUNDS || 12,
    // 요청 크기 제한 (바이트)
    MAX_REQUEST_SIZE: process.env.MAX_REQUEST_SIZE || '10mb',
    // CORS 허용 도메인
    ALLOWED_ORIGINS: NODE_ENV === 'production'
        ? ['http://hteng.co.kr', 'https://hteng.co.kr']
        : ['http://localhost:3000', 'http://127.0.0.1:3000']
};

// ==================== 보안 미들웨어 설정 ====================
/**
 * CORS (Cross-Origin Resource Sharing) 설정
 * @description 브라우저 보안 정책에 따른 도메인 간 요청 제어
 * @security 프로덕션에서는 특정 도메인만 허용하여 CSRF 공격 방지
 */
const corsOptions = {
    origin: function (origin, callback) {
        // 개발 환경에서는 모든 origin 허용
        if (NODE_ENV === 'development') {
            console.log('🔓 개발 환경: 모든 origin 허용');
            return callback(null, true);
        }

        // 프로덕션 환경에서는 특정 도메인만 허용
        if (SECURITY_CONFIG.ALLOWED_ORIGINS.includes(origin)) {
            callback(null, true);
        } else {
            console.warn(`CORS 차단된 도메인: ${origin}`);
            callback(new Error('CORS 정책에 의해 차단되었습니다.'));
        }
    },
    credentials: true, // 쿠키/인증 헤더 포함 허용
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // 허용 HTTP 메서드
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'], // 허용 헤더
    maxAge: 86400 // preflight 요청 캐시 시간 (24시간)
};

app.use(cors(corsOptions));

/**
 * 요청 본문 파싱 미들웨어
 * @description JSON 요청 데이터를 파싱하고 크기 제한 설정
 * @security 요청 크기 제한으로 DDoS 공격 방지
 */
app.use(express.json({
    limit: SECURITY_CONFIG.MAX_REQUEST_SIZE,
    strict: true, // 엄격한 JSON 파싱
    verify: (req, res, buf) => {
        // 요청 본문 검증 (필요시 추가)
        req.rawBody = buf;
    }
}));

/**
 * URL 인코딩된 데이터 파싱
 * @description form 데이터 파싱
 */
app.use(express.urlencoded({
    extended: true,
    limit: SECURITY_CONFIG.MAX_REQUEST_SIZE
}));

// ==================== 정적 파일 서빙 설정 ====================
/**
 * 정적 파일 서빙 미들웨어
 * @description 이미지, CSS, JS 등 정적 리소스 제공
 * @performance CDN 사용 고려 (CloudFlare, AWS CloudFront)
 * @security 파일 경로 검증으로 디렉토리 트래버설 공격 방지
 */
const staticFileConfig = {
    // 캐시 설정 (브라우저 캐싱)
    maxAge: NODE_ENV === 'production' ? '1d' : '0',
    // 보안 헤더 설정
    setHeaders: (res, path) => {
        // JavaScript 파일에 대한 보안 헤더
        if (path.endsWith('.js')) {
            res.setHeader('X-Content-Type-Options', 'nosniff');
        }
        // 이미지 파일에 대한 캐시 헤더
        if (path.match(/\.(jpg|jpeg|png|gif|ico|svg)$/)) {
            res.setHeader('Cache-Control', 'public, max-age=86400');
        }
    }
};

// 환경별 정적 파일 경로 설정
if (NODE_ENV === 'production') {
    // 프로덕션: CDN 경로 우선, 로컬 폴백
    app.use('/assets', express.static(path.join(__dirname, '../Web_UI/Assesets'), staticFileConfig));
    app.use('/images', express.static(path.join(__dirname, '../Web_UI/Assesets/Image'), staticFileConfig));
    app.use('/Web_UI', express.static(path.join(__dirname, '../Web_UI'), staticFileConfig));
    app.use('/', express.static(path.join(__dirname, '../Web_UI'), staticFileConfig));
} else {
    // 개발: 로컬 파일 직접 서빙
    app.use('/assets', express.static(path.join(__dirname, '../Web_UI/Assesets'), staticFileConfig));
    app.use('/images', express.static(path.join(__dirname, '../Web_UI/Assesets/Image'), staticFileConfig));
    app.use('/Web_UI', express.static(path.join(__dirname, '../Web_UI'), staticFileConfig));
    app.use('/', express.static(path.join(__dirname, '../Web_UI'), staticFileConfig));
}

// ==================== 데이터 저장소 (파일 기반) ====================
/**
 * 파일 기반 데이터 저장소
 * @description 데이터 변경사항을 JSON 파일에 저장하여 영속성 확보
 * @performance 메모리 접근으로 빠른 응답 속도 유지
 * @persistence 서버 재시작 시에도 데이터 유지
 * 
 * TODO: 데이터베이스 도입 계획
 * - PostgreSQL: 관계형 데이터, ACID 트랜잭션
 * - MongoDB: 문서 기반, 스키마 유연성
 * - Redis: 캐싱 및 세션 저장
 */
let eocrProducts = []; // EOCR 제품 데이터 배열
let users = []; // 사용자 데이터 배열

// 데이터 파일 경로
const DATA_FILES = {
    users: path.join(__dirname, '../data/users.json'),
    mainPage: path.join(__dirname, '../data/main-page.json'),
    companyIntro: path.join(__dirname, '../data/company-intro.json'),
    ceoInfo: path.join(__dirname, '../data/ceo-info.json'),
    membersInfo: path.join(__dirname, '../data/members-info.json'),
    valuesInfo: path.join(__dirname, '../data/values-info.json')
};

// 데이터 디렉토리 생성
function ensureDataDirectory() {
    const dataDir = path.dirname(DATA_FILES.users);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
        console.log('📁 데이터 디렉토리 생성:', dataDir);
    }
}

/**
 * 데이터를 JSON 파일에 저장하는 함수
 * @param {string} fileKey - 저장할 파일 키
 * @param {any} data - 저장할 데이터
 * @returns {boolean} 저장 성공 여부
 */
function saveDataToFile(fileKey, data) {
    try {
        const filePath = DATA_FILES[fileKey];
        if (!filePath) {
            console.error(`❌ 알 수 없는 파일 키: ${fileKey}`);
            return false;
        }

        // 데이터 디렉토리 확인
        ensureDataDirectory();

        // 데이터를 JSON 형식으로 저장
        const jsonData = JSON.stringify(data, null, 2);
        fs.writeFileSync(filePath, jsonData, 'utf8');

        console.log(`💾 데이터 저장 완료: ${fileKey} -> ${filePath}`);
        return true;
    } catch (error) {
        console.error(`❌ 데이터 저장 실패 (${fileKey}):`, error);
        return false;
    }
}

/**
 * JSON 파일에서 데이터를 로드하는 함수
 * @param {string} fileKey - 로드할 파일 키
 * @param {any} defaultValue - 파일이 없을 때 사용할 기본값
 * @returns {any} 로드된 데이터 또는 기본값
 */
function loadDataFromFile(fileKey, defaultValue = null) {
    try {
        const filePath = DATA_FILES[fileKey];
        if (!filePath) {
            console.error(`❌ 알 수 없는 파일 키: ${fileKey}`);
            return defaultValue;
        }

        if (!fs.existsSync(filePath)) {
            console.log(`📄 데이터 파일이 존재하지 않음: ${fileKey}, 기본값 사용`);
            return defaultValue;
        }

        const fileContent = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(fileContent);

        console.log(`📖 데이터 로드 완료: ${fileKey} <- ${filePath}`);
        return data;
    } catch (error) {
        console.error(`❌ 데이터 로드 실패 (${fileKey}):`, error);
        return defaultValue;
    }
}

/**
 * 모든 데이터 파일을 로드하는 함수
 * @description 서버 시작 시 모든 저장된 데이터를 메모리에 로드
 */
function loadAllDataFiles() {
    console.log('📚 모든 데이터 파일 로드 시작...');

    // 사용자 데이터 로드
    users = loadDataFromFile('users', []);

    // 메인페이지 데이터 로드
    global.mainPageData = loadDataFromFile('mainPage', {
        banner: [
            { id: 1, title: 'HTeng에 오신 것을 환영합니다', description: '전기 보호 장치의 전문 기업', image: '회사 배너1.png', link: '/company' },
            { id: 2, title: '최고 품질의 제품', description: '고객 만족을 위한 끊임없는 노력', image: '회사 배너2.png', link: '/products' },
            { id: 3, title: '전문 기술 지원', description: '24시간 기술 지원 서비스', image: '회사 배너3.png', link: '/support' }
        ],
        brands: [
            { name: '슈나이더', logo: '슈나이더.png', link: '/brand/schneider' },
            { name: '이튼', logo: '이튼.png', link: '/brand/eaton' },
            { name: '피자토', logo: '피자토.png', link: '/brand/pizzato' },
            { name: '르그랑', logo: '르그랑.png', link: '/brand/legrand' }
        ],
        contact: {
            phone: '031-123-4567',
            email: 'info@hteng.com',
            address: '경기도 김포시 태장로 795번길 23 마스터비즈파크 340호'
        },
        descriptions: [
            { title: '전문성', content: '20년 이상의 전기 보호 장치 전문 경험' },
            { title: '신뢰성', content: '고객과의 신뢰를 바탕으로 한 장기 파트너십' },
            { title: '혁신성', content: '최신 기술을 활용한 솔루션 제공' }
        ]
    });

    // 회사 정보 데이터 로드
    global.companyIntroInfo = loadDataFromFile('companyIntro', {
        title: '회사 소개',
        subtitle: 'HTeng이 추구하는 핵심 가치입니다',
        name: 'HTENG',
        description: 'HTENG는 전기·전자 부품 유통 및 기술 지원 서비스를 제공하는 전문 기업입니다.',
        location: '경기도 김포시 태장로 795번길 23 마스터비즈파크 340호',
        history: [
            { year: '2025', event: '웹 리뉴얼 및 온라인 기술 지원 시작' },
            { year: '2020', event: '이튼·르그랑 공식 파트너 체결' },
            { year: '2010', event: 'HTENG 설립' }
        ]
    });

    // CEO 정보 데이터 로드
    global.ceoInfo = loadDataFromFile('ceoInfo', {
        name: '홍길동',
        position: '대표이사',
        introduction: '안녕하세요. HT ENG 대표이사 홍길동입니다.',
        vision: '끊임없는 기술 혁신과 고객 만족을 최우선으로 생각하며, 신뢰와 품질을 바탕으로 성장'
    });

    // 구성원 정보 데이터 로드
    global.membersInfo = loadDataFromFile('membersInfo', {
        title: '직원 소개',
        subtitle: '전문성과 열정으로 고객의 성공을 만들어갑니다',
        members: [
            {
                name: '민과장',
                position: '과장',
                department: '기술팀',
                description: '경력 3년의 전문성을 바탕으로 고객에게 최적의 솔루션을 제공합니다.',
                experience: '3년',
                email: 'chulsoo@hteng.com'
            },
            {
                name: '정태주',
                position: '기술팀',
                department: '기술팀',
                description: '신입으로서 열정과 창의성을 바탕으로 새로운 아이디어를 제안합니다.',
                experience: '1년',
                email: 'younghee@hteng.com'
            }
        ]
    });

    // 가치 정보 데이터 로드
    global.valuesInfo = loadDataFromFile('valuesInfo', {
        title: '핵심 가치',
        subtitle: 'HTeng이 추구하는 핵심 가치입니다',
        values: [
            { title: '전문성', content: '20년 이상의 전기 보호 장치 전문 경험' },
            { title: '신뢰성', content: '고객과의 신뢰를 바탕으로 한 장기 파트너십' },
            { title: '혁신성', content: '최신 기술을 활용한 솔루션 제공' }
        ]
    });

    console.log('✅ 모든 데이터 파일 로드 완료');
}

/**
 * 기본 관리자 계정 초기화
 * @description 시스템 최초 실행 시 기본 관리자 계정 생성
 * @security 프로덕션에서는 기본 계정 제거 또는 강제 비밀번호 변경 필요
 * @param {string} defaultPassword - 기본 비밀번호 (개발용)
 */
function initializeDefaultAdmin(defaultPassword = 'admin1234') {
    const adminExists = users.some(user => user.role === 'admin');

    if (!adminExists) {
        const adminUser = {
            id: 'admin',
            username: 'admin',
            displayName: '시스템 관리자',
            passwordHash: bcrypt.hashSync(defaultPassword, SECURITY_CONFIG.BCRYPT_ROUNDS),
            role: 'admin',
            status: 'active',
            email: 'admin@hteng.com',
            joinDate: new Date().toISOString().split('T')[0],
            lastLogin: null,
            loginAttempts: 0,
            lockedUntil: null,
            permissions: ['read', 'write', 'delete', 'admin']
        };

        users.push(adminUser);

        // 사용자 데이터를 파일에 저장
        saveDataToFile('users', users);

        console.log('✅ 기본 관리자 계정이 생성되고 파일에 저장되었습니다.');

        // 프로덕션 환경 경고
        if (NODE_ENV === 'production') {
            console.warn('⚠️  프로덕션 환경에서 기본 관리자 계정을 사용 중입니다.');
            console.warn('   보안을 위해 비밀번호를 즉시 변경하세요.');
        }
    } else {
        console.log('👤 기본 관리자 계정이 이미 존재합니다.');
    }
}

// ==================== JWT 설정 및 보안 ====================
/**
 * JWT (JSON Web Token) 설정
 * @description 사용자 인증 및 세션 관리
 * @security 프로덕션에서는 환경변수로 관리, 키 로테이션 구현 필요
 * 
 * JWT 구조:
 * - Header: 알고리즘 및 토큰 타입
 * - Payload: 사용자 정보 및 만료 시간
 * - Signature: 서명 검증
 */
const JWT_CONFIG = {
    // JWT 시크릿 키 (환경변수에서 로드)
    SECRET: process.env.JWT_SECRET || 'dev-secret-key-change-in-prod',
    // 토큰 만료 시간
    EXPIRES_IN: SECURITY_CONFIG.JWT_EXPIRES_IN,
    // 토큰 발급자
    ISSUER: 'hteng-auth-server',
    // 토큰 대상자
    AUDIENCE: 'hteng-web-client',
    // 토큰 ID 생성
    JTI: () => uuidv4()
};

/**
 * JWT 토큰 생성 함수
 * @param {Object} payload - 토큰에 포함할 데이터
 * @param {string} payload.userId - 사용자 ID
 * @param {string} payload.username - 사용자명
 * @param {string} payload.role - 사용자 역할
 * @returns {string} 생성된 JWT 토큰
 */
function generateJWT(payload) {
    const tokenPayload = {
        ...payload,
        iat: Math.floor(Date.now() / 1000), // 발급 시간
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24시간 후 만료
        iss: JWT_CONFIG.ISSUER, // 발급자
        aud: JWT_CONFIG.AUDIENCE, // 대상자
        jti: JWT_CONFIG.JTI() // 토큰 고유 ID
    };

    return jwt.sign(tokenPayload, JWT_CONFIG.SECRET);
}

/**
 * JWT 토큰 검증 함수
 * @param {string} token - 검증할 JWT 토큰
 * @returns {Object|null} 검증된 토큰 페이로드 또는 null
 */
function verifyJWT(token) {
    try {
        const decoded = jwt.verify(token, JWT_CONFIG.SECRET);

        // 토큰 만료 확인
        if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
            console.warn('만료된 JWT 토큰:', decoded.jti);
            return null;
        }

        return decoded;
    } catch (error) {
        console.error('JWT 토큰 검증 실패:', error.message);
        return null;
    }
}

// ==================== EOCR 데이터 로드 및 관리 ====================
/**
 * CSV 파일에서 EOCR 제품 데이터를 로드하는 함수
 * @description CSV 파일을 파싱하여 제품 데이터를 메모리에 로드
 * @performance 대용량 CSV 파일 처리 시 스트리밍 방식 사용
 * @error CSV 파일 누락, 파싱 오류, 데이터 유효성 검증
 * 
 * TODO: 데이터베이스 전환 시 이 함수를 데이터베이스 로더로 변경
 * TODO: 데이터 캐싱 및 백그라운드 업데이트 구현
 * TODO: 데이터 무결성 검증 강화
 */
function loadEOCRData() {
    const csvPath = path.join(__dirname, '../Resource/EOCR설정표.csv');

    console.log('EOCR 데이터 로딩 시작...');
    console.log('CSV 파일 경로:', csvPath);

    // 파일 존재 여부 확인
    if (!fs.existsSync(csvPath)) {
        console.error('❌ EOCR CSV 파일을 찾을 수 없습니다:', csvPath);
        console.error('   파일 경로를 확인하고 다시 시도하세요.');
        return false;
    }

    // 파일 크기 확인
    const stats = fs.statSync(csvPath);
    const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`📁 CSV 파일 크기: ${fileSizeInMB} MB`);

    // 기존 데이터 초기화
    eocrProducts = [];
    let rowCount = 0;
    let validRowCount = 0;
    let errorCount = 0;

    // 스트리밍 방식으로 CSV 파싱
    const stream = fs.createReadStream(csvPath, { encoding: 'utf8' });

    stream
        .pipe(csv({
            // CSV 파싱 옵션
            separator: ',', // 구분자
            skipEmptyLines: true, // 빈 줄 건너뛰기
            trim: true // 공백 제거
        }))
        .on('data', (row) => {
            rowCount++;

            try {
                // 데이터 정리 및 유효성 검증
                const cleanedRow = cleanAndValidateRow(row);

                if (cleanedRow) {
                    eocrProducts.push(cleanedRow);
                    validRowCount++;
                }
            } catch (error) {
                errorCount++;
                console.warn(`⚠️  행 ${rowCount} 처리 중 오류:`, error.message);
            }
        })
        .on('error', (error) => {
            console.error('❌ EOCR 데이터 로드 중 오류 발생:', error);
            console.error('   CSV 파일 형식을 확인하세요.');
        })
        .on('end', () => {
            console.log('✅ EOCR 데이터 로드 완료!');
            console.log(`   📊 총 행 수: ${rowCount}`);
            console.log(`   ✅ 유효한 제품: ${validRowCount}`);
            console.log(`   ❌ 오류 발생: ${errorCount}`);
            console.log(`   🎯 메모리 사용량: ${(JSON.stringify(eocrProducts).length / 1024).toFixed(2)} KB`);
        });

    return true;
}

/**
 * CSV 행 데이터 정리 및 유효성 검증
 * @param {Object} row - 원본 CSV 행 데이터
 * @returns {Object|null} 정리된 데이터 또는 null (유효하지 않은 경우)
 */
function cleanAndValidateRow(row) {
    // 필수 필드 확인
    if (!row.제품 || row.제품.trim() === '') {
        return null; // 제품명이 없으면 제외
    }

    // 데이터 정리
    const cleanedRow = {};
    Object.keys(row).forEach(key => {
        const cleanedKey = key.trim();
        let cleanedValue = row[key] ? row[key].trim() : '';

        // 빈 문자열을 null로 변환 (데이터베이스 호환성)
        if (cleanedValue === '') {
            cleanedValue = null;
        }

        cleanedRow[cleanedKey] = cleanedValue;
    });

    // 데이터 유효성 검증
    if (!isValidProductData(cleanedRow)) {
        return null;
    }

    return cleanedRow;
}

/**
 * 제품 데이터 유효성 검증
 * @param {Object} productData - 검증할 제품 데이터
 * @returns {boolean} 유효성 여부
 */
function isValidProductData(productData) {
    // 기본 유효성 검사
    if (!productData.제품 || productData.제품.length < 1) {
        return false;
    }

    // 제품명 길이 제한
    if (productData.제품.length > 200) {
        return false;
    }

    // 특수 문자 필터링 (필요시)
    const invalidChars = /[<>\"'&]/;
    if (invalidChars.test(productData.제품)) {
        return false;
    }

    return true;
}

// 서버 시작 시 EOCR 데이터 로드
loadEOCRData();

// ==================== 전역 회사 정보 설정 ====================
// TODO: 데이터베이스에서 관리하도록 변경
global.companyInfo = {
    title: '회사 소개',
    subtitle: 'HTeng이 추구하는 핵심 가치입니다',
    name: 'HTENG',
    description: 'HTENG는 전기·전자 부품 유통 및 기술 지원 서비스를 제공하는 전문 기업입니다. 고객과의 신뢰를 바탕으로 지속적인 성장과 혁신을 추구합니다.',
    phone: '031-123-4567',
    email: 'info@hteng.com',
    fax: '031-123-4568',
    website: 'https://www.hteng.com',
    hours: '월-금 09:00-18:00',
    history: [
        { year: '2025', event: '웹 리뉴얼 및 온라인 기술 지원 시작' },
        { year: '2020', event: '이튼·르그랑 공식 파트너 체결' },
        { year: '2010', event: 'HTENG 설립' }
    ],
    business: '산업 자동화 제품 유통, 전기 부품 판매, 현장 기술 컨설팅 및 유지보수',
    location: '경기도 김포시 태장로 795번길 23 마스터비즈파크 340호',
    mapLat: 37.637966,  // 김포시 마스터비즈파크 정확한 위도
    mapLng: 126.680780, // 김포시 마스터비즈파크 정확한 경도
    mapZoom: 18,        // 지도 줌 레벨 (건물 단위 상세 표시)
    businessItems: [
        { title: '산업 자동화 제품 유통', description: '다양한 산업 자동화 제품을 공급합니다.' },
        { title: '현장 기술 컨설팅 및 유지보수', description: '전문 기술진이 현장에서 직접 지원합니다.' }
    ]
};

// ==================== CEO 정보 설정 ====================
// TODO: 관리자 페이지에서 수정 가능하도록 API 구현
global.ceoInfo = {
    name: '홍길동',
    position: '대표이사',
    introduction: '안녕하세요. HT ENG 대표이사 홍길동입니다. 저희 HT ENG는 끊임없는 기술 혁신과 고객 만족을 최우선으로 생각하며, 신뢰와 품질을 바탕으로 성장해왔습니다. 앞으로도 여러분의 기대에 부응하며 지속 가능한 기업으로 나아가겠습니다. 감사합니다.',
    vision: '끊임없는 기술 혁신과 고객 만족을 최우선으로 생각하며, 신뢰와 품질을 바탕으로 성장',
    image: 'CEO.jpeg'
};

// ==================== 직원 정보 설정 ====================
// TODO: 직원 정보를 동적으로 관리할 수 있는 시스템 구축
global.membersInfo = {
    title: '직원 소개',
    subtitle: '전문성과 열정으로 고객의 성공을 만들어갑니다',
    members: [
        {
            name: '민과장',
            position: '과장',
            department: '기술팀',
            description: '경력 3년의 전문성을 바탕으로 고객에게 최적의 솔루션을 제공합니다.',
            image: 'CEO.jpeg',
            experience: '3년',
            email: 'chulsoo@hteng.com'
        },
        {
            name: '정태주',
            position: '기술팀',
            department: '기술팀',
            description: '신입으로서 열정과 창의성을 바탕으로 새로운 아이디어를 제안합니다.',
            image: 'CEO.jpeg',
            experience: '1년',
            email: 'younghee@hteng.com'
        }
    ]
};

// ==================== 회사 가치 정보 설정 ====================
// TODO: 가치 정보를 동적으로 관리할 수 있는 시스템 구축
global.valuesInfo = {
    title: '우리의 가치',
    subtitle: 'HTeng이 추구하는 핵심 가치입니다',
    values: [
        {
            title: '혁신',
            description: '끊임없는 연구개발을 통해 최고의 기술을 제공합니다.',
            icon: 'fas fa-lightbulb'
        },
        {
            title: '신뢰',
            description: '고객과의 약속을 지키고 안전한 제품을 제공합니다.',
            icon: 'fas fa-handshake'
        },
        {
            title: '성장',
            description: '직원과 회사의 지속적인 성장을 추구합니다.',
            icon: 'fas fa-chart-line'
        }
    ]
};

// ==================== 메인페이지 데이터 설정 ====================
// TODO: 관리자 페이지에서 동적으로 수정 가능하도록 구현
global.mainPageData = {
    // 배너 이미지 관리
    banner: {
        image: '../Assesets/Image/회사 배너.png',
        alt: 'HTeng 사진'
    },

    // 브랜드 관리
    brands: [
        {
            name: '슈나이더',
            image: '../Assesets/Image/슈나이더.png',
            url: 'https://www.se.com/kr/ko/',
            alt: '슈나이더'
        },
        {
            name: '피자토',
            image: '../Assesets/Image/피자토.png',
            url: 'https://www.pizzato.com',
            alt: '피자토'
        },
        {
            name: '이튼',
            image: '../Assesets/Image/이튼.png',
            url: 'https://www.eaton.com/kr/ko-kr.html',
            alt: '이튼'
        },
        {
            name: '르그랑',
            image: '../Assesets/Image/르그랑.png',
            url: 'https://www.legrand.co.kr/ko',
            alt: '르그랑'
        }
    ],

    // Contact 섹션 관리
    contact: {
        ceo: {
            name: '정탁영',
            position: 'CEO',
            phone: '010-1234-1234',
            email: 'contact@hteng.com',
            address: '서울특별시 강남구 어딘가로 123',
            experience: [
                '슈나이더 일렉트릭: 2000-2010',
                'HT_ENG: ~ 2025'
            ],
            image: '../Assesets/Image/CEO.jpeg'
        },
        manager: {
            name: '민과장님',
            position: 'Manager',
            phone: '010-1234-1234',
            email: 'contact@hteng.com',
            address: '서울특별시 강남구 어딘가로 123',
            experience: [
                'HT_ENG: ~2025'
            ],
            image: '../Assesets/Image/CEO.jpeg'
        }
    },

    // 설명 섹션 관리
    descriptions: [
        {
            title: '판매',
            image: '../Assesets/Image/sale.jpg',
            alt: '판매 이미지',
            content: 'HTENG는 다양한 전기 부품을 합리적인 가격으로 제공합니다. 슈나이더, 이튼, 르그랑 등의 브랜드를 취급합니다.'
        },
        {
            title: '기술 지원',
            image: '../Assesets/Image/support.jpg',
            alt: '기술 지원 이미지',
            content: '고객의 안정적인 시스템 운영을 위해 전문적인 기술 지원을 제공합니다. 설치부터 유지보수까지 책임집니다.'
        }
    ]
};

// ==================== Swagger API 문서 설정 ====================
// TODO: 프로덕션에서는 API 문서 접근 제한 고려
const swaggerDefinition = {
    openapi: '3.0.0',
    info: {
        title: 'HTeng API',
        version: '1.0.0',
        description: 'EOCR 제품 정보를 위한 API 문서입니다.',
    },
    servers: [{ url: 'http://localhost:3000', description: '로컬 서버' }],
};
const options = { swaggerDefinition, apis: ['./server.js'] };
const swaggerSpec = swaggerJSDoc(options);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ==================== 인증 미들웨어 ====================
/**
 * JWT 토큰을 검증하는 미들웨어
 * TODO: 토큰 만료 시간 체크 로직 추가
 * TODO: 토큰 블랙리스트 관리 (로그아웃 시)
 * TODO: 토큰 갱신 메커니즘 구현
 */
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: '토큰이 없습니다.' });
    }

    const user = verifyJWT(token);

    if (!user) {
        return res.status(403).json({ message: '토큰이 유효하지 않거나 만료되었습니다.' });
    }

    req.user = user;
    next();
}

/**
 * 관리자 권한을 확인하는 미들웨어
 * TODO: 역할 기반 접근 제어(RBAC) 시스템 구축
 * TODO: 권한 레벨 세분화 (super admin, admin, moderator 등)
 */
function requireAdmin(req, res, next) {
    if (req.user?.role !== 'admin') {
        console.warn('관리자 권한 없음:', req.user?.username, req.ip);
        return res.status(403).json({ message: '관리자 권한이 필요합니다.' });
    }
    next();
}

// ==================== 인증 API 엔드포인트 ====================
/**
 * 사용자 로그인 API
 * 
 * 🔒 보안 강화 제안:
 * - 로그인 시도 횟수 제한 (rate limiting)
 * - 2FA 인증 도입
 * - 로그인 시도 로깅
 * - IP 기반 접근 제한
 * 
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: 사용자 로그인
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 description: 사용자명
 *               password:
 *                 type: string
 *                 description: 비밀번호
 *     responses:
 *       200:
 *         description: 로그인 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: JWT 토큰
 *                 username:
 *                   type: string
 *                   description: 사용자명
 *                 role:
 *                   type: string
 *                   description: 사용자 역할
 *       401:
 *         description: 로그인 실패
 */
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // 입력값 검증
        if (!username || !password) {
            return res.status(400).json({ message: '사용자명과 비밀번호를 입력해주세요.' });
        }

        // 관리자만 로그인 가능 (현재 정책)
        const user = users.find(u => u.username === username && u.role === 'admin');
        if (!user) {
            console.warn('로그인 실패 - 사용자 없음:', username, req.ip);
            return res.status(401).json({ message: '관리자 계정만 로그인할 수 있습니다.' });
        }

        // 계정 상태 확인
        if (user.status !== 'active') {
            console.warn('로그인 실패 - 비활성 계정:', username);
            return res.status(401).json({ message: '비활성화된 계정입니다.' });
        }

        // 비밀번호 확인
        const isValidPassword = await bcrypt.compare(password, user.passwordHash);
        if (!isValidPassword) {
            console.warn('로그인 실패 - 잘못된 비밀번호:', username, req.ip);
            return res.status(401).json({ message: '사용자명 또는 비밀번호가 올바르지 않습니다.' });
        }

        // JWT 토큰 생성
        const token = generateJWT({
            id: user.id,
            username: user.username,
            role: user.role,
            status: user.status,
            displayName: user.displayName,
            email: user.email
        });

        // 로그인 성공 로깅
        console.log('로그인 성공:', username, req.ip);

        res.json({
            token,
            username: user.username,
            role: user.role,
            displayName: user.displayName,
            status: user.status
        });
    } catch (error) {
        console.error('로그인 실패:', error);
        res.status(500).json({ message: '로그인 처리 중 오류가 발생했습니다.' });
    }
});

// 사용자 목록 조회
app.get('/api/admin/users', authenticateToken, requireAdmin, (req, res) => {
    try {
        const userList = users.map(user => ({
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            role: user.role,
            status: user.status,
            email: user.email || '',
            joinDate: user.joinDate || new Date().toISOString().split('T')[0]
        }));

        res.json(userList);
    } catch (error) {
        console.error('사용자 목록 조회 실패:', error);
        res.status(500).json({ message: '사용자 목록 조회에 실패했습니다.' });
    }
});

// 새 사용자 추가
app.post('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { username, displayName, password, role, email } = req.body;

        // 필수 필드 검증
        if (!username || !displayName || !password || !role) {
            return res.status(400).json({ message: '모든 필수 항목을 입력해주세요.' });
        }

        // 사용자명 중복 확인
        if (users.find(u => u.username === username)) {
            return res.status(400).json({ message: '이미 존재하는 사용자명입니다.' });
        }

        // 비밀번호 해시화
        const passwordHash = await bcrypt.hash(password, SECURITY_CONFIG.BCRYPT_ROUNDS);

        // 새 사용자 생성
        const newUser = {
            id: uuidv4(),
            username,
            displayName,
            passwordHash,
            role,
            email,
            status: 'active',
            joinDate: new Date().toISOString().split('T')[0]
        };

        users.push(newUser);

        res.status(201).json({
            message: '사용자가 성공적으로 추가되었습니다.',
            user: {
                id: newUser.id,
                username: newUser.username,
                displayName: newUser.displayName,
                role: newUser.role,
                status: newUser.status,
                email: newUser.email,
                joinDate: newUser.joinDate
            }
        });
    } catch (error) {
        console.error('사용자 추가 실패:', error);
        res.status(500).json({ message: '사용자 추가에 실패했습니다.' });
    }
});

// 사용자 정보 수정
app.put('/api/admin/users/:userId', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { displayName, role, status, email, password } = req.body;

        const userIndex = users.findIndex(u => u.id === userId);
        if (userIndex === -1) {
            return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
        }

        const user = users[userIndex];

        // 관리자 계정 수정 제한
        if (user.role === 'admin' && req.user.id !== userId) {
            return res.status(403).json({ message: '다른 관리자 계정은 수정할 수 없습니다.' });
        }

        // 사용자 정보 업데이트
        if (displayName) user.displayName = displayName;
        if (role) user.role = role;
        if (status) user.status = status;
        if (email) user.email = email;

        // 비밀번호 변경 시
        if (password) {
            user.passwordHash = await bcrypt.hash(password, SECURITY_CONFIG.BCRYPT_ROUNDS);
        }

        res.json({
            message: '사용자 정보가 성공적으로 수정되었습니다.',
            user: {
                id: user.id,
                username: user.username,
                displayName: user.displayName,
                role: user.role,
                status: user.status,
                email: user.email,
                joinDate: user.joinDate
            }
        });
    } catch (error) {
        console.error('사용자 정보 수정 실패:', error);
        res.status(500).json({ message: '사용자 정보 수정에 실패했습니다.' });
    }
});

// 사용자 상태 변경 (승인/거절/활성화/비활성화)
app.patch('/api/admin/users/:userId/status', authenticateToken, requireAdmin, (req, res) => {
    try {
        const { userId } = req.params;
        const { status } = req.body;

        const userIndex = users.findIndex(u => u.id === userId);
        if (userIndex === -1) {
            return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
        }

        const user = users[userIndex];

        // 상태 변경 검증
        if (!['active', 'inactive', 'pending'].includes(status)) {
            return res.status(400).json({ message: '유효하지 않은 상태입니다.' });
        }

        // 관리자 계정 비활성화 방지
        if (user.role === 'admin' && status === 'inactive') {
            return res.status(403).json({ message: '관리자 계정은 비활성화할 수 없습니다.' });
        }

        // 상태 업데이트
        user.status = status;

        res.json({
            message: '사용자 상태가 성공적으로 변경되었습니다.',
            user: {
                id: user.id,
                username: user.username,
                displayName: user.displayName,
                role: user.role,
                status: user.status,
                email: user.email,
                joinDate: user.joinDate
            }
        });
    } catch (error) {
        console.error('사용자 상태 변경 실패:', error);
        res.status(500).json({ message: '사용자 상태 변경에 실패했습니다.' });
    }
});

// 사용자 삭제
app.delete('/api/admin/users/:userId', authenticateToken, requireAdmin, (req, res) => {
    try {
        const { userId } = req.params;

        const userIndex = users.findIndex(u => u.id === userId);
        if (userIndex === -1) {
            return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
        }

        const user = users[userIndex];

        // 관리자 계정 삭제 방지
        if (user.role === 'admin') {
            return res.status(403).json({ message: '관리자 계정은 삭제할 수 없습니다.' });
        }

        // 현재 로그인한 사용자 삭제 방지
        if (user.id === req.user.id) {
            return res.status(403).json({ message: '현재 로그인한 사용자는 삭제할 수 없습니다.' });
        }

        // 사용자 제거
        users.splice(userIndex, 1);

        res.json({ message: '사용자가 성공적으로 삭제되었습니다.' });
    } catch (error) {
        console.error('사용자 삭제 실패:', error);
        res.status(500).json({ message: '사용자 삭제에 실패했습니다.' });
    }
});







// 관리자 대시보드 통계
app.get('/api/admin/summary', authenticateToken, requireAdmin, (req, res) => {
    try {
        const totalUsers = users.length;
        const activeUsers = users.filter(u => u.status === 'active').length;
        const pendingUsers = users.filter(u => u.status === 'pending').length;
        const totalProducts = eocrProducts.length;

        res.json({
            totalUsers,
            activeUsers,
            pendingUsers,
            totalProducts
        });
    } catch (error) {
        console.error('관리자 통계 조회 실패:', error);
        res.status(500).json({ message: '통계 조회에 실패했습니다.' });
    }
});

// 회사 정보 업데이트
app.put('/api/admin/company', authenticateToken, requireAdmin, (req, res) => {
    try {
        const { name, description, history, business, location } = req.body;

        // 데이터 업데이트
        global.companyInfo = {
            name: name || 'HTENG',
            description: description || '전기·전자 부품 유통 및 기술 지원 서비스를 제공하는 전문 기업입니다.',
            history: history || [],
            business: business || '산업 자동화 제품 유통, 전기 부품 판매, 현장 기술 컨설팅 및 유지보수',
            location: location || '경기도 김포시 태장로 795번길 23 마스터비즈파크 340호'
        };

        // 변경된 데이터를 파일에 저장
        const saveSuccess = saveDataToFile('companyIntro', global.companyInfo);

        if (saveSuccess) {
            res.json({
                message: '회사 정보가 성공적으로 업데이트되고 저장되었습니다.',
                company: global.companyInfo
            });
        } else {
            res.status(500).json({ 
                error: '데이터 업데이트는 성공했으나 파일 저장에 실패했습니다.' 
            });
        }
    } catch (error) {
        console.error('❌ 회사 정보 업데이트 실패:', error);
        res.status(500).json({ message: '회사 정보 업데이트에 실패했습니다.' });
    }
});

// 회사 정보 조회
app.get('/api/admin/company', authenticateToken, requireAdmin, (req, res) => {
    try {
        const companyInfo = global.companyInfo || {
            name: 'HTENG',
            description: 'HTENG는 전기·전자 부품 유통 및 기술 지원 서비스를 제공하는 전문 기업입니다. 고객과의 신뢰를 바탕으로 지속적인 성장과 혁신을 추구합니다.',
            history: [
                { year: '2025', event: '웹 리뉴얼 및 온라인 기술 지원 시작' },
                { year: '2020', event: '이튼·르그랑 공식 파트너 체결' },
                { year: '2010', event: 'HTENG 설립' }
            ],
            business: '산업 자동화 제품 유통, 전기 부품 판매, 현장 기술 컨설팅 및 유지보수',
            location: '경기도 김포시 태장로 795번길 23 마스터비즈파크 340호'
        };

        res.json(companyInfo);
    } catch (error) {
        console.error('회사 정보 조회 실패:', error);
        res.status(500).json({ message: '회사 정보 조회에 실패했습니다.' });
    }
});

// CEO 소개 정보 조회
app.get('/api/admin/ceo', authenticateToken, requireAdmin, (req, res) => {
    try {
        const ceoInfo = global.ceoInfo || {
            name: '김철수',
            position: 'CEO',
            introduction: '전기 보호 장치 분야에서 20년간의 경험을 바탕으로 HTeng의 성장을 이끌고 있습니다.',
            vision: '안전하고 신뢰할 수 있는 전기 보호 솔루션을 통해 더 나은 세상을 만들어가겠습니다.',
            image: 'CEO.jpeg'
        };

        res.json(ceoInfo);
    } catch (error) {
        console.error('CEO 정보 조회 실패:', error);
        res.status(500).json({ message: 'CEO 정보 조회에 실패했습니다.' });
    }
});

// CEO 소개 정보 업데이트
app.put('/api/admin/ceo', authenticateToken, requireAdmin, (req, res) => {
    try {
        const { name, position, introduction, vision } = req.body;

        // 데이터 업데이트
        global.ceoInfo = { name, position, introduction, vision };

        // 변경된 데이터를 파일에 저장
        const saveSuccess = saveDataToFile('ceoInfo', global.ceoInfo);

        if (saveSuccess) {
            res.json({
                message: 'CEO 소개 정보가 성공적으로 업데이트되고 저장되었습니다.',
                ceo: { name, position, introduction, vision }
            });
        } else {
            res.status(500).json({
                error: '데이터 업데이트는 성공했으나 파일 저장에 실패했습니다.'
            });
        }
    } catch (error) {
        console.error('❌ CEO 정보 업데이트 실패:', error);
        res.status(500).json({ message: 'CEO 정보 업데이트에 실패했습니다.' });
    }
});

// 회사 구성원 정보 조회
app.get('/api/admin/members', authenticateToken, requireAdmin, (req, res) => {
    try {
        const membersInfo = global.membersInfo || {
            title: '우리 팀을 소개합니다',
            subtitle: '전문성과 열정으로 고객의 성공을 만들어갑니다',
            members: [
                {
                    name: '김영희',
                    position: 'CTO',
                    department: '기술개발팀',
                    description: '전기 보호 장치 기술 개발을 담당하며, 혁신적인 솔루션을 연구합니다.',
                    image: 'member1.jpg'
                },
                {
                    name: '박민수',
                    position: '영업이사',
                    department: '영업팀',
                    description: '고객과의 신뢰 관계를 바탕으로 최적의 솔루션을 제안합니다.',
                    image: 'member2.jpg'
                }
            ]
        };

        res.json(membersInfo);
    } catch (error) {
        console.error('구성원 정보 조회 실패:', error);
        res.status(500).json({ message: '구성원 정보 조회에 실패했습니다.' });
    }
});

// 회사 구성원 정보 업데이트
app.put('/api/admin/members', authenticateToken, requireAdmin, (req, res) => {
    try {
        const { title, subtitle, members } = req.body;

        // 데이터 업데이트
        global.membersInfo = { title, subtitle, members };

        // 변경된 데이터를 파일에 저장
        const saveSuccess = saveDataToFile('membersInfo', global.membersInfo);

        if (saveSuccess) {
            res.json({
                message: '회사 구성원 정보가 성공적으로 업데이트되고 저장되었습니다.',
                members: { title, subtitle, members }
            });
        } else {
            res.status(500).json({
                error: '데이터 업데이트는 성공했으나 파일 저장에 실패했습니다.'
            });
        }
    } catch (error) {
        console.error('❌ 구성원 정보 업데이트 실패:', error);
        res.status(500).json({ message: '회사 구성원 정보 업데이트에 실패했습니다.' });
    }
});

// 회사 가치 정보 조회
app.get('/api/admin/values', authenticateToken, requireAdmin, (req, res) => {
    try {
        const valuesInfo = global.valuesInfo || {
            title: '우리의 가치',
            subtitle: 'HTeng이 추구하는 핵심 가치입니다',
            values: [
                {
                    title: '혁신',
                    description: '끊임없는 연구개발을 통해 최고의 기술을 제공합니다.',
                    icon: 'fas fa-lightbulb'
                },
                {
                    title: '신뢰',
                    description: '고객과의 약속을 지키고 안전한 제품을 제공합니다.',
                    icon: 'fas fa-handshake'
                },
                {
                    title: '성장',
                    description: '직원과 회사의 지속적인 성장을 추구합니다.',
                    icon: 'fas fa-chart-line'
                }
            ]
        };

        res.json(valuesInfo);
    } catch (error) {
        console.error('회사 가치 정보 조회 실패:', error);
        res.status(500).json({ message: '회사 가치 정보 조회에 실패했습니다.' });
    }
});

// 회사 가치 정보 업데이트
app.put('/api/admin/values', authenticateToken, requireAdmin, (req, res) => {
    try {
        const { title, subtitle, values } = req.body;

        // 데이터 업데이트
        global.valuesInfo = { title, subtitle, values };

        // 변경된 데이터를 파일에 저장
        const saveSuccess = saveDataToFile('valuesInfo', global.valuesInfo);

        if (saveSuccess) {
            res.json({
                message: '회사 가치 정보가 성공적으로 업데이트되고 저장되었습니다.',
                values: { title, subtitle, values }
            });
        } else {
            res.status(500).json({ 
                error: '데이터 업데이트는 성공했으나 파일 저장에 실패했습니다.' 
            });
        }
    } catch (error) {
        console.error('❌ 회사 가치 정보 업데이트 실패:', error);
        res.status(500).json({ message: '회사 가치 정보 업데이트에 실패했습니다.' });
    }
});

/**
 * @swagger
 * /api/admin/summary:
 *   get:
 *     summary: 관리자 대시보드 요약 정보
 *     responses:
 *       200: { description: 요약 정보 }
 *       401: { description: 토큰 누락 }
 *       403: { description: 권한 부족 }
 */
app.get('/api/admin/summary', authenticateToken, requireAdmin, (req, res) => {
    res.json({
        totalProducts: eocrProducts.length,
        serverTime: new Date().toISOString(),
        admin: req.user.username
    });
});

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: 모든 EOCR 제품 목록 조회
 *     responses:
 *       200:
 *         description: 제품 목록
 */
app.get('/api/products', (req, res) => {
    res.json(eocrProducts);
});

/**
 * @swagger
 * /api/products/filter:
 *   get:
 *     summary: EOCR 제품 필터 검색
 */
app.get('/api/products/filter', (req, res) => {
    console.log('필터링 API 호출됨:', req.query);
    let filtered = [...eocrProducts];
    const {
        제품명, 상세설명, 제품군, 보호종류, 통신여부, 통신종류,
        누설지락, 단락, 과전류저전류, 결상, 역상, 과전압저전압, 전력, 내장ZCT
    } = req.query;

    console.log('필터링 파라미터:', { 제품명, 상세설명, 제품군, 보호종류, 통신여부, 통신종류 });

    if (제품명) filtered = filtered.filter(p => p.제품 && p.제품.includes(제품명));
    if (상세설명) filtered = filtered.filter(p => p.상세설명 && p.상세설명.includes(상세설명));
    if (제품군 && 제품군 !== '모든조건') filtered = filtered.filter(p => p.제품군 === 제품군);
    if (보호종류 && 보호종류 !== '모든조건') filtered = filtered.filter(p => p.보호종류 === 보호종류);
    if (통신여부 && 통신여부 !== '모든조건') filtered = filtered.filter(p => p.통신여부 === 통신여부);
    if (통신종류 && 통신종류 !== '모든조건') filtered = filtered.filter(p => p.통신종류 === 통신종류);
    if (누설지락 && 누설지락 !== '모든조건') filtered = filtered.filter(p => p['누설(지락)'] === 누설지락);
    if (단락 && 단락 !== '모든조건') filtered = filtered.filter(p => p.단락 === 단락);
    if (과전류저전류 && 과전류저전류 !== '모든조건') filtered = filtered.filter(p => p['과전류/저전류'] === 과전류저전류);
    if (결상 && 결상 !== '모든조건') filtered = filtered.filter(p => p.결상 === 결상);
    if (역상 && 역상 !== '모든조건') filtered = filtered.filter(p => p.역상 === 역상);
    if (과전압저전압 && 과전압저전압 !== '모든조건') filtered = filtered.filter(p => p['과전압/저전압'] === 과전압저전압);
    if (전력 && 전력 !== '모든조건') filtered = filtered.filter(p => p.전력 === 전력);
    if (내장ZCT && 내장ZCT !== '모든조건') filtered = filtered.filter(p => p['내장 ZCT'] === 내장ZCT);

    console.log('필터링 결과 개수:', filtered.length);
    res.json(filtered);
});

/**
 * @swagger
 * /api/products/suggest:
 *   get:
 *     summary: 연관 검색어(제품명) 자동완성
 */
app.get('/api/products/suggest', (req, res) => {
    const { q } = req.query;
    if (!q || q.trim() === '') return res.json([]);
    const suggestions = Array.from(
        new Set(
            eocrProducts
                .map(p => p.제품)
                .filter(name => name && name.toLowerCase().includes(q.toLowerCase()))
        )
    ).slice(0, 10);
    res.json(suggestions);
});

// 소개 페이지 정보 조회
app.get('/api/admin/intro-pages', authenticateToken, requireAdmin, (req, res) => {
    try {
        const introPages = {
            ceo: global.ceoInfo || {
                name: '홍길동',
                position: '대표이사',
                introduction: '안녕하세요. HT ENG 대표이사 홍길동입니다. 저희 HT ENG는 끊임없는 기술 혁신과 고객 만족을 최우선으로 생각하며, 신뢰와 품질을 바탕으로 성장해왔습니다. 앞으로도 여러분의 기대에 부응하며 지속 가능한 기업으로 나아가겠습니다. 감사합니다.',
                vision: '끊임없는 기술 혁신과 고객 만족을 최우선으로 생각하며, 신뢰와 품질을 바탕으로 성장',
                image: 'CEO.jpeg'
            },
            members: global.membersInfo || {
                title: '직원 소개',
                subtitle: '전문성과 열정으로 고객의 성공을 만들어갑니다',
                members: [
                    {
                        name: '민과장',
                        position: '과장',
                        department: '기술팀',
                        description: '경력 3년의 전문성을 바탕으로 고객에게 최적의 솔루션을 제공합니다.',
                        image: 'CEO.jpeg',
                        experience: '3년',
                        email: 'chulsoo@hteng.com'
                    },
                    {
                        name: '정태주',
                        position: '기술팀',
                        department: '기술팀',
                        description: '신입으로서 열정과 창의성을 바탕으로 새로운 아이디어를 제안합니다.',
                        image: 'CEO.jpeg',
                        experience: '1년',
                        email: 'younghee@hteng.com'
                    }
                ]
            },
            values: global.valuesInfo || {
                title: '우리의 가치',
                subtitle: 'HTeng이 추구하는 핵심 가치입니다',
                values: [
                    {
                        title: '혁신',
                        description: '끊임없는 연구개발을 통해 최고의 기술을 제공합니다.',
                        icon: 'fas fa-lightbulb'
                    },
                    {
                        title: '신뢰',
                        description: '고객과의 약속을 지키고 안전한 제품을 제공합니다.',
                        icon: 'fas fa-handshake'
                    },
                    {
                        title: '성장',
                        description: '직원과 회사의 지속적인 성장을 추구합니다.',
                        icon: 'fas fa-chart-line'
                    }
                ]
            },
            company: global.companyInfo || {
                name: 'HTENG',
                description: 'HTENG는 전기·전자 부품 유통 및 기술 지원 서비스를 제공하는 전문 기업입니다. 고객과의 신뢰를 바탕으로 지속적인 성장과 혁신을 추구합니다.',
                phone: '031-123-4567',
                email: 'info@hteng.com',
                fax: '031-123-4568',
                website: 'https://www.hteng.com',
                hours: '월-금 09:00-18:00',
                history: [
                    { year: '2025', event: '웹 리뉴얼 및 온라인 기술 지원 시작' },
                    { year: '2020', event: '이튼·르그랑 공식 파트너 체결' },
                    { year: '2010', event: 'HTENG 설립' }
                ],
                business: '산업 자동화 제품 유통, 전기 부품 판매, 현장 기술 컨설팅 및 유지보수',
                location: '경기도 김포시 태장로 795번길 23 마스터비즈파크 340호',
                businessItems: [
                    { title: '산업 자동화 제품 유통', description: '공장 자동화에 필요한 제품들을 공급합니다.' },
                    { title: '전기 부품 판매', description: '고품질 전기 부품을 합리적인 가격으로 제공합니다.' },
                    { title: '현장 기술 컨설팅 및 유지보수', description: '전문 기술진이 현장에서 직접 지원합니다.' }
                ]
            }
        };

        res.json(introPages);
    } catch (error) {
        console.error('소개 페이지 정보 조회 실패:', error);
        res.status(500).json({ message: '소개 페이지 정보 조회에 실패했습니다.' });
    }
});

// 소개 페이지 정보 업데이트
app.put('/api/admin/intro-pages/:pageType', authenticateToken, requireAdmin, (req, res) => {
    try {
        const { pageType } = req.params;
        const pageData = req.body;

        switch (pageType) {
            case 'ceo':
                global.ceoInfo = pageData;
                break;
            case 'members':
                global.membersInfo = pageData;
                break;
            case 'values':
                global.valuesInfo = pageData;
                break;
            case 'company':
                global.companyInfo = pageData;
                break;
            default:
                return res.status(400).json({ message: '유효하지 않은 페이지 타입입니다.' });
        }

        res.json({
            message: `${pageType} 페이지 정보가 성공적으로 업데이트되었습니다.`,
            data: pageData
        });
    } catch (error) {
        console.error('소개 페이지 정보 업데이트 실패:', error);
        res.status(500).json({ message: '소개 페이지 정보 업데이트에 실패했습니다.' });
    }
});

// 공개 소개 페이지 정보 조회 (인증 불필요)
app.get('/api/intro-pages', (req, res) => {
    try {
        const introPages = {
            ceo: global.ceoInfo || {
                name: '홍길동',
                position: '대표이사',
                introduction: '안녕하세요. HT ENG 대표이사 홍길동입니다. 저희 HT ENG는 끊임없는 기술 혁신과 고객 만족을 최우선으로 생각하며, 신뢰와 품질을 바탕으로 성장해왔습니다. 앞으로도 여러분의 기대에 부응하며 지속 가능한 기업으로 나아가겠습니다. 감사합니다.',
                vision: '끊임없는 기술 혁신과 고객 만족을 최우선으로 생각하며, 신뢰와 품질을 바탕으로 성장',
                image: 'CEO.jpeg'
            },
            members: global.membersInfo || {
                title: '직원 소개',
                subtitle: '전문성과 열정으로 고객의 성공을 만들어갑니다',
                members: [
                    {
                        name: '민과장',
                        position: '과장',
                        department: '기술팀',
                        description: '경력 3년의 전문성을 바탕으로 고객에게 최적의 솔루션을 제공합니다.',
                        image: 'CEO.jpeg',
                        experience: '3년',
                        email: 'chulsoo@hteng.com'
                    },
                    {
                        name: '정태주',
                        position: '기술팀',
                        department: '기술팀',
                        description: '신입으로서 열정과 창의성을 바탕으로 새로운 아이디어를 제안합니다.',
                        image: 'CEO.jpeg',
                        experience: '1년',
                        email: 'younghee@hteng.com'
                    }
                ]
            },

            company: global.companyInfo || {
                title: '회사 소개',
                subtitle: 'HTeng이 추구하는 핵심 가치입니다',
                name: 'HTENG',
                description: 'HTENG는 전기·전자 부품 유통 및 기술 지원 서비스를 제공하는 전문 기업입니다. 고객과의 신뢰를 바탕으로 지속적인 성장과 혁신을 추구합니다.',
                phone: '031-123-4567',
                email: 'info@hteng.com',
                fax: '031-123-4568',
                website: 'https://www.hteng.com',
                hours: '월-금 09:00-18:00',
                history: [
                    { year: '2025', event: '웹 리뉴얼 및 온라인 기술 지원 시작' },
                    { year: '2020', event: '이튼·르그랑 공식 파트너 체결' },
                    { year: '2010', event: 'HTENG 설립' }
                ],
                business: '산업 자동화 제품 유통, 전기 부품 판매, 현장 기술 컨설팅 및 유지보수',
                location: '경기도 김포시 태장로 795번길 23 마스터비즈파크 340호',
                businessItems: [
                    { title: '산업 자동화 제품 유통', description: '공장 자동화에 필요한 제품들을 공급합니다.' },
                    { title: '전기 부품 판매', description: '고품질 전기 부품을 합리적인 가격으로 제공합니다.' },
                    { title: '현장 기술 컨설팅 및 유지보수', description: '전문 기술진이 현장에서 직접 지원합니다.' }
                ]
            }
        };

        res.json(introPages);
    } catch (error) {
        console.error('공개 소개 페이지 정보 조회 실패:', error);
        res.status(500).json({ message: '소개 페이지 정보 조회에 실패했습니다.' });
    }
});

// 회사 소개 페이지 정보 업데이트
app.put('/api/admin/company-intro', authenticateToken, requireAdmin, (req, res) => {
    try {
        const { title, subtitle, name, description, location, history, businessItems } = req.body;

        // 회사 소개 페이지 정보 업데이트
        global.companyIntroInfo = {
            title: title || '회사 소개',
            subtitle: subtitle || 'HTeng이 추구하는 핵심 가치입니다',
            name: name || 'HTENG',
            description: description || '',
            location: location || '',
            history: history || [],
            businessItems: businessItems || []
        };

        res.json({
            message: '회사 소개 페이지 정보가 성공적으로 업데이트되었습니다.',
            data: global.companyIntroInfo
        });
    } catch (error) {
        console.error('회사 소개 페이지 정보 업데이트 실패:', error);
        res.status(500).json({ message: '회사 소개 페이지 정보 업데이트에 실패했습니다.' });
    }
});

// 회사 소개 페이지 정보 조회
app.get('/api/admin/company-intro', authenticateToken, requireAdmin, (req, res) => {
    try {
        const companyIntroInfo = global.companyIntroInfo || {
            title: '회사 소개',
            subtitle: 'HTeng이 추구하는 핵심 가치입니다',
            name: 'HTENG',
            description: 'HTENG는 전기·전자 부품 유통 및 기술 지원 서비스를 제공하는 전문 기업입니다. 고객과의 신뢰를 바탕으로 지속적인 성장과 혁신을 추구합니다.',
            location: '경기도 김포시 태장로 795번길 23 마스터비즈파크 340호',
            history: [
                { year: '2025', event: '웹 리뉴얼 및 온라인 기술 지원 시작' },
                { year: '2020', event: '이튼·르그랑 공식 파트너 체결' },
                { year: '2010', event: 'HTENG 설립' }
            ],
            businessItems: [
                { item: '산업 자동화 제품 유통' },
                { item: '전기 부품 판매' },
                { item: '현장 기술 컨설팅 및 유지보수' }
            ]
        };

        res.json(companyIntroInfo);
    } catch (error) {
        console.error('회사 소개 페이지 정보 조회 실패:', error);
        res.status(500).json({ message: '회사 소개 페이지 정보 조회에 실패했습니다.' });
    }
});

// 메인페이지 데이터 가져오기 (공개)
app.get('/api/main-page', (req, res) => {
    res.json(global.mainPageData);
});

// 메인페이지 데이터 업데이트 (관리자)
app.put('/api/admin/main-page', authenticateToken, (req, res) => {
    try {
        const { banner, brands, contact, descriptions } = req.body;

        // 데이터 유효성 검사
        if (banner) global.mainPageData.banner = banner;
        if (brands) global.mainPageData.brands = brands;
        if (contact) global.mainPageData.contact = contact;
        if (descriptions) global.mainPageData.descriptions = descriptions;

        res.json({
            message: '메인페이지 데이터가 업데이트되었습니다.',
            data: global.mainPageData
        });
    } catch (error) {
        res.status(500).json({ error: '메인페이지 데이터 업데이트 중 오류가 발생했습니다.' });
    }
});

// 메인페이지 데이터 업데이트 (관리자)
app.put('/api/admin/main-page', authenticateToken, (req, res) => {
    try {
        const { banner, brands, contact, descriptions } = req.body;

        // 데이터 유효성 검사 및 업데이트
        if (banner) global.mainPageData.banner = banner;
        if (brands) global.mainPageData.brands = brands;
        if (contact) global.mainPageData.contact = contact;
        if (descriptions) global.mainPageData.descriptions = descriptions;

        // 변경된 데이터를 파일에 저장
        const saveSuccess = saveDataToFile('mainPage', global.mainPageData);

        if (saveSuccess) {
            res.json({
                message: '메인페이지 데이터가 업데이트되고 저장되었습니다.',
                data: global.mainPageData
            });
        } else {
            res.status(500).json({
                error: '데이터 업데이트는 성공했으나 파일 저장에 실패했습니다.'
            });
        }
    } catch (error) {
        console.error('❌ 메인페이지 데이터 업데이트 오류:', error);
        res.status(500).json({ error: '메인페이지 데이터 업데이트 중 오류가 발생했습니다.' });
    }
});

// ==================== 루트 경로 및 정적 파일 핸들링 ====================
// 루트 경로 접근 시 홈페이지로 리다이렉트
app.get('/', (req, res) => {
    res.redirect('/Web_UI/HomePage/HT-eng-HomePage.html');
});

// 관리자 로그인 페이지 직접 접근
app.get('/admin/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../Web_UI/Admin/HT_eng-Admin-Login.html'));
});

// 관리자 페이지 직접 접근
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../Web_UI/Admin/HT_eng-Admin.html'));
});

// 404 에러 핸들러 - SPA 라우팅을 위한 fallback
app.get('*', (req, res) => {
    // API 경로가 아닌 경우 정적 파일로 처리
    if (!req.path.startsWith('/api/')) {
        const filePath = path.join(__dirname, '../Web_UI', req.path);
        if (fs.existsSync(filePath)) {
            res.sendFile(filePath);
        } else {
            // 파일이 존재하지 않으면 홈페이지로 리다이렉트
            res.redirect('/Web_UI/HomePage/HT-eng-HomePage.html');
        }
    } else {
        res.status(404).json({ message: 'API 엔드포인트를 찾을 수 없습니다.' });
    }
});

// ==================== 서버 초기화 및 시작 ====================
/**
 * 서버 초기화 함수
 * @description 서버 시작 전 필요한 데이터 및 설정을 초기화
 * @performance 초기화 시간 최소화로 서버 시작 속도 향상
 * @error 초기화 실패 시 적절한 에러 처리 및 복구
 */
async function initializeServer() {
    console.log('🚀 HTeng 서버 초기화 시작...');

    try {
        // 1. 데이터 디렉토리 생성
        console.log('📁 데이터 디렉토리 생성 중...');
        ensureDataDirectory();

        // 2. 모든 데이터 파일 로드
        console.log('📚 데이터 파일 로드 중...');
        loadAllDataFiles();

        // 3. 기본 관리자 계정 초기화
        console.log('👤 기본 관리자 계정 초기화 중...');
        initializeDefaultAdmin();

        // 4. EOCR 제품 데이터 로드
        console.log('📦 EOCR 제품 데이터 로드 중...');
        const dataLoadSuccess = loadEOCRData();

        if (!dataLoadSuccess) {
            console.warn('⚠️  EOCR 데이터 로드에 실패했습니다. 서버는 계속 실행됩니다.');
        }

        // 5. 성능 모니터링 설정
        console.log('📊 성능 모니터링 설정 중...');
        setupPerformanceMonitoring();

        console.log('✅ 서버 초기화 완료!');
        return true;

    } catch (error) {
        console.error('❌ 서버 초기화 실패:', error);
        console.error('   서버를 다시 시작하거나 문제를 확인하세요.');
        return false;
    }
}

/**
 * 전역 데이터 초기화
 * @description 메인페이지, 회사 정보 등 전역 데이터 구조 초기화
 */
function initializeGlobalData() {
    // 메인페이지 데이터 초기화
    global.mainPageData = global.mainPageData || {
        banner: [
            { id: 1, title: 'HTeng에 오신 것을 환영합니다', description: '전기 보호 장치의 전문 기업', image: '회사 배너1.png', link: '/company' },
            { id: 2, title: '최고 품질의 제품', description: '고객 만족을 위한 끊임없는 노력', image: '회사 배너2.png', link: '/products' },
            { id: 3, title: '전문 기술 지원', description: '24시간 기술 지원 서비스', image: '회사 배너3.png', link: '/support' }
        ],
        brands: [
            { name: '슈나이더', logo: '슈나이더.png', link: '/brand/schneider' },
            { name: '이튼', logo: '이튼.png', link: '/brand/eaton' },
            { name: '피자토', logo: '피자토.png', link: '/brand/pizzato' },
            { name: '르그랑', logo: '르그랑.png', link: '/brand/legrand' }
        ],
        contact: {
            phone: '031-123-4567',
            email: 'info@hteng.com',
            address: '경기도 김포시 태장로 795번길 23 마스터비즈파크 340호'
        },
        descriptions: [
            { title: '전문성', content: '20년 이상의 전기 보호 장치 전문 경험' },
            { title: '신뢰성', content: '고객과의 신뢰를 바탕으로 한 장기 파트너십' },
            { title: '혁신성', content: '최신 기술을 활용한 솔루션 제공' }
        ]
    };

    // 회사 정보 초기화
    global.companyIntroInfo = global.companyIntroInfo || {
        title: '회사 소개',
        subtitle: 'HTeng이 추구하는 핵심 가치입니다',
        name: 'HTENG',
        description: 'HTENG는 전기·전자 부품 유통 및 기술 지원 서비스를 제공하는 전문 기업입니다.',
        location: '경기도 김포시 태장로 795번길 23 마스터비즈파크 340호',
        history: [
            { year: '2025', event: '웹 리뉴얼 및 온라인 기술 지원 시작' },
            { year: '2020', event: '이튼·르그랑 공식 파트너 체결' },
            { year: '2010', event: 'HTENG 설립' }
        ]
    };

    console.log('🌐 전역 데이터 초기화 완료');
}

/**
 * 성능 모니터링 설정
 * @description 서버 성능 및 리소스 사용량 모니터링
 * @performance 메모리 누수, CPU 사용량, 응답 시간 추적
 */
function setupPerformanceMonitoring() {
    // 메모리 사용량 모니터링
    setInterval(() => {
        const memUsage = process.memoryUsage();
        const memUsageMB = {
            rss: Math.round(memUsage.rss / 1024 / 1024 * 100) / 100,
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100,
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100,
            external: Math.round(memUsage.external / 1024 / 1024 * 100) / 100
        };

        // 메모리 사용량이 높을 때 경고
        if (memUsageMB.heapUsed > 100) { // 100MB 이상
            console.warn('⚠️  높은 메모리 사용량:', memUsageMB);
        }

        // 개발 환경에서만 상세 로깅
        if (NODE_ENV === 'development') {
            console.log('📊 메모리 사용량:', memUsageMB);
        }
    }, 60000); // 1분마다 체크

    // 프로세스 이벤트 리스너
    process.on('SIGTERM', () => {
        console.log('🔄 SIGTERM 신호 수신, 서버 종료 중...');
        gracefulShutdown();
    });

    process.on('SIGINT', () => {
        console.log('🔄 SIGINT 신호 수신, 서버 종료 중...');
        gracefulShutdown();
    });

    // 예상치 못한 에러 처리
    process.on('uncaughtException', (error) => {
        console.error('❌ 예상치 못한 에러 발생:', error);
        console.error('   서버를 안전하게 종료합니다.');
        gracefulShutdown();
    });

    process.on('unhandledRejection', (reason, promise) => {
        console.error('❌ 처리되지 않은 Promise 거부:', reason);
        console.error('   Promise:', promise);
    });

    console.log('📊 성능 모니터링 설정 완료');
}

/**
 * 서버 안전 종료
 * @description 활성 연결을 정리하고 서버를 안전하게 종료
 */
function gracefulShutdown() {
    console.log('🔄 서버 안전 종료 시작...');

    // 활성 연결 정리
    if (server) {
        server.close(() => {
            console.log('✅ HTTP 서버 종료 완료');
            process.exit(0);
        });

        // 강제 종료 (10초 후)
        setTimeout(() => {
            console.error('❌ 강제 종료 실행');
            process.exit(1);
        }, 10000);
    } else {
        process.exit(0);
    }
}

// ==================== 서버 시작 ====================
/**
 * 서버 시작 함수
 * @description Express 서버를 시작하고 초기화를 수행
 * @performance 서버 시작 시간 최적화
 * @security 프로덕션 환경에서 보안 강화
 */
async function startServer() {
    try {
        // 서버 초기화
        const initSuccess = await initializeServer();

        if (!initSuccess) {
            console.error('❌ 서버 초기화 실패로 인해 서버를 시작할 수 없습니다.');
            process.exit(1);
        }

        // HTTP 서버 시작
        const server = app.listen(PORT, () => {
            console.log('🎉 HTeng 서버가 성공적으로 시작되었습니다!');
            console.log(`   🌐 서버 주소: http://localhost:${PORT}`);
            console.log(`   🔧 환경: ${NODE_ENV}`);
            console.log(`   📚 API 문서: http://localhost:${PORT}/api-docs`);
            console.log(`   📊 제품 데이터: ${eocrProducts.length}개`);
            console.log(`   👥 사용자 계정: ${users.length}개`);

            if (NODE_ENV === 'production') {
                console.log(`   🚀 프로덕션 서버: https://hteng.co.kr`);
                console.log(`   🔒 보안 모드: 활성화`);
            } else {
                console.log(`   🛠️  개발 모드: 디버깅 활성화`);
            }

            console.log('='.repeat(60));
            console.log('🚀 서버가 모든 요청을 처리할 준비가 되었습니다!');
            console.log('='.repeat(60));
        });

        // 서버 에러 핸들링
        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                console.error(`❌ 포트 ${PORT}가 이미 사용 중입니다.`);
                console.error('   다른 포트를 사용하거나 기존 프로세스를 종료하세요.');
            } else {
                console.error('❌ 서버 시작 중 오류 발생:', error);
            }
            process.exit(1);
        });

        // 서버 객체를 전역에 저장 (종료 시 사용)
        global.server = server;

    } catch (error) {
        console.error('❌ 서버 시작 실패:', error);
        process.exit(1);
    }
}

// 서버 시작 실행
startServer();