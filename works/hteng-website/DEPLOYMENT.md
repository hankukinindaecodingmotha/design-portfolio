# 🚀 HTENG 웹사이트 배포 가이드

## 📋 **배포 전 체크리스트**

### **1. 코드 준비 완료**
- ✅ 서버 코드 프로덕션 환경 설정
- ✅ 환경변수 설정 파일 생성
- ✅ PM2 프로세스 관리 설정
- ✅ CORS 보안 설정

### **2. 도메인 준비**
- ✅ `http://hteng.co.kr` 도메인 소유
- ✅ DNS 관리 권한 확인

## 🌐 **배포 방법 선택**

### **방법 1: 클라우드 서버 (AWS EC2) - 추천**

#### **1단계: AWS EC2 인스턴스 생성**
```bash
# Ubuntu 22.04 LTS 선택
# t3.micro (1GB RAM, 1 vCPU) - 월 $3.5
# 보안그룹: SSH(22), HTTP(80), HTTPS(443), 커스텀(3000)
```

#### **2단계: 서버 접속 및 환경 설정**
```bash
# 서버 접속
ssh -i your-key.pem ubuntu@your-server-ip

# 시스템 업데이트
sudo apt update && sudo apt upgrade -y

# Node.js 설치
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# PM2 설치
sudo npm install -g pm2

# Git 설치
sudo apt install git -y
```

#### **3단계: 프로젝트 배포**
```bash
# 프로젝트 클론
git clone https://github.com/your-username/HT_Eng_Project.git
cd HT_Eng_Project/Server

# 의존성 설치
npm install

# 프로덕션 환경으로 실행
npm run prod

# PM2로 프로세스 관리
npm run pm2-start
```

#### **4단계: Nginx 설정 (리버스 프록시)**
```bash
# Nginx 설치
sudo apt install nginx -y

# 설정 파일 생성
sudo nano /etc/nginx/sites-available/hteng
```

**Nginx 설정 내용:**
```nginx
server {
    listen 80;
    server_name hteng.co.kr www.hteng.co.kr;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # 정적 파일 직접 제공
    location /assets/ {
        alias /home/ubuntu/HT_Eng_Project/Web_UI/Assesets/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
# 설정 활성화
sudo ln -s /etc/nginx/sites-available/hteng /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### **방법 2: 호스팅 서비스 (가비아/호스팅케이알)**

#### **1단계: 호스팅 서비스 신청**
- **가비아**: 월 5,000원~ (Node.js 지원)
- **호스팅케이알**: 월 3,000원~ (Node.js 지원)

#### **2단계: 파일 업로드**
- FTP/SFTP로 프로젝트 파일 업로드
- `package.json`의 스크립트 실행

#### **3단계: 도메인 연결**
- 호스팅 서비스에서 도메인 연결 설정

## 🔒 **SSL 인증서 설정 (HTTPS)**

### **Let's Encrypt 무료 SSL 인증서**
```bash
# Certbot 설치
sudo apt install certbot python3-certbot-nginx -y

# SSL 인증서 발급
sudo certbot --nginx -d hteng.co.kr -d www.hteng.co.kr

# 자동 갱신 설정
sudo crontab -e
# 다음 줄 추가:
# 0 12 * * * /usr/bin/certbot renew --quiet
```

## 🌍 **DNS 설정**

### **도메인 관리 페이지에서 설정**
```
A 레코드:
- @ (루트 도메인) → 서버 IP 주소
- www → 서버 IP 주소

CNAME 레코드:
- www → hteng.co.kr
```

## 📱 **프론트엔드 배포**

### **정적 파일 서빙**
```bash
# Web_UI 폴더를 웹 루트로 설정
sudo cp -r Web_UI/* /var/www/html/

# 권한 설정
sudo chown -R www-data:www-data /var/www/html/
sudo chmod -R 755 /var/www/html/
```

## 🔧 **모니터링 및 유지보수**

### **PM2 명령어**
```bash
# 프로세스 상태 확인
pm2 status

# 로그 확인
pm2 logs hteng-server

# 재시작
pm2 restart hteng-server

# 모니터링 대시보드
pm2 monit
```

### **로그 관리**
```bash
# 로그 폴더 생성
mkdir -p logs

# 로그 로테이션 설정
sudo nano /etc/logrotate.d/hteng
```

## 🚨 **문제 해결**

### **일반적인 문제들**
1. **포트 3000 접근 불가**: 방화벽 설정 확인
2. **도메인 연결 안됨**: DNS 설정 확인 (최대 48시간 소요)
3. **SSL 인증서 오류**: Certbot 재실행
4. **정적 파일 404**: 파일 경로 및 권한 확인

### **디버깅 명령어**
```bash
# 서버 상태 확인
sudo systemctl status nginx
pm2 status

# 포트 사용 확인
sudo netstat -tlnp | grep :3000
sudo netstat -tlnp | grep :80

# 로그 확인
sudo tail -f /var/log/nginx/error.log
pm2 logs hteng-server
```

## 💰 **예상 비용**

### **AWS EC2 (월)**
- **t3.micro**: $3.5
- **데이터 전송**: $0.09/GB
- **총 예상**: $5-10/월

### **호스팅 서비스 (월)**
- **가비아**: 5,000원~
- **호스팅케이알**: 3,000원~

## 📞 **지원 및 문의**

배포 과정에서 문제가 발생하면:
1. 서버 로그 확인
2. PM2 상태 확인
3. Nginx 설정 확인
4. 방화벽 설정 확인

---

**🎯 목표: `http://hteng.co.kr`에서 정상 작동하는 HTENG 웹사이트 운영!**
