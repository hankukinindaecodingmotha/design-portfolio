// 환경 설정 파일
module.exports = {
    // 환경 설정
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: process.env.PORT || 3000,
    
    // JWT 설정
    JWT_SECRET: process.env.JWT_SECRET || 'hteng-secret-key-2024',
    JWT_EXPIRES_IN: '24h',
    
    // CORS 설정
    CORS_ORIGINS: {
        development: true, // 개발 환경에서는 모든 도메인 허용
        production: ['http://hteng.co.kr', 'https://hteng.co.kr'] // 프로덕션에서는 특정 도메인만
    },
    
    // 파일 경로 설정
    STATIC_PATHS: {
        assets: '../Web_UI/Assesets',
        images: '../Web_UI/Assesets/Image'
    },
    
    // 보안 설정
    SECURITY: {
        bcryptRounds: 10,
        sessionTimeout: 24 * 60 * 60 * 1000 // 24시간
    }
};
