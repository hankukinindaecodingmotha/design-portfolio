export const profile = {
  name: '정태주',
  nameHanja: '鄭太柱',
  role: 'Visual Designer',
  tagline: '감각과 구조가 만나는 곳에서\n브랜드의 이야기를 디자인합니다.',
  email: 'hello@example.com',
  location: 'Seoul, Korea',
  social: [
    { label: 'Behance', href: 'https://behance.net' },
    { label: 'Instagram', href: 'https://instagram.com' },
    { label: 'LinkedIn', href: 'https://linkedin.com' },
  ],
  about: [
    '브랜드 아이덴티티부터 디지털 경험까지, 일관된 시각 언어로 메시지를 전달합니다.',
    '미니멀한 구성과 대담한 타이포그래피를 좋아하며, 감정과 기능이 균형을 이루는 디자인을 추구합니다.',
  ],
  services: ['Brand Identity', 'UI/UX Design', 'Editorial Design', 'Art Direction'],
  tools: ['Figma', 'Adobe CC', 'Blender', 'After Effects'],
  // 히어로 헤드라인 — type: 'display'(와이드 그로테스크) / 'serif'(우아한 이탤릭)
  hero: {
    kicker: 'Creative\nVisual Designer',
    headline: [
      { text: '鄭太', type: 'hanja' },
      { text: '柱', type: 'hanja-accent' },
    ],
    intro:
      'Seoul 기반 비주얼 디자이너 — 감각과 구조가 만나는 곳에서 대담한 브랜드 시스템과 디지털 경험을 만듭니다.',
  },
  // 3D 히어로 — public/models/ 에 GLB 배치
  hero3d: {
    enabled: true,
    models: [
      {
        file: 'Meshy_AI_Exploded_view_of_a_me_0604055323_texture.glb',
        scale: 2.4,
        position: [0.35, 0, 0],
        rotation: [0.12, -0.55, 0.05],
        parallax: { rotate: 0.22, float: 0.1 },
        scrollBoost: 0.25,
      },
      {
        file: 'Meshy_AI_Watch_Balance_Wheel_E_0604071602_image-to-3d-texture.glb',
        scale: 1.1,
        position: [0.9, 0.45, 0.25],
        rotation: [0.35, 0.15, 0.4],
        parallax: { rotate: 0.5, float: 0.22 },
        scrollBoost: 0.45,
      },
      {
        file: 'Meshy_AI_Watch_Crown_External__0604071508_image-to-3d-texture.glb',
        scale: 0.85,
        position: [0.1, -0.35, 0.35],
        rotation: [-0.15, 0.7, 0],
        parallax: { rotate: 0.42, float: 0.18 },
        scrollBoost: 0.35,
      },
      {
        file: 'Meshy_AI_Watch_Middle_Gold_Gea_0604071552_image-to-3d-texture.glb',
        scale: 0.9,
        position: [1.05, -0.15, -0.15],
        rotation: [0.1, -0.3, 0.2],
        parallax: { rotate: 0.38, float: 0.16 },
        scrollBoost: 0.3,
      },
      {
        file: 'swatch_logo.glb',
        scale: 0.55,
        position: [-0.15, 0.75, 0.45],
        rotation: [0, 0, 0],
        parallax: { rotate: 0.65, float: 0.3 },
        scrollBoost: 0.55,
      },
    ],
  },
  heroVideoUrl: null,
  heroPoster: undefined,
};

export const categories = [
  'All',
  'Brand Identity',
  'UI/UX Design',
  'Editorial Design',
  'Art Direction',
];

export const projects = [
  {
    id: 1,
    slug: 'hand-motion',
    title: 'Hand Motion',
    category: 'Art Direction',
    year: '2025',
    description: '웹캠 손 움직임에 반응하는 인터랙티브 비주얼 데모',
    longDescription:
      '브라우저와 맥 로컬 환경에서 손 제스처를 인식해 비주얼·사운드를 구동하는 인터랙티브 작품입니다. MediaPipe 기반 트래킹과 실시간 모션 그래픽을 결합했습니다.',
    color: '#1A1A1A',
    accent: '#E8E8E8',
    tags: ['Interactive', 'Web', 'Motion'],
    featured: true,
    client: 'Personal',
    role: 'Designer / Developer',
    sourcePath: 'works/hand-motion',
    liveUrl: 'demos/hand-motion/',
    liveLabel: 'Live Demo',
  },
  {
    id: 2,
    slug: 'hteng-website',
    title: 'HTeng Website',
    category: 'UI/UX Design',
    year: '2025',
    description: '전기·전자 부품 유통사 공식 웹사이트와 관리자 패널',
    longDescription:
      '제품 검색, 회사 소개, 멤버십, 관리자 CMS까지 포함한 기업 웹 프로젝트입니다. 정적 프론트엔드와 Express 백엔드로 콘텐츠를 운영합니다.',
    color: '#D4E4F7',
    accent: '#1E3A5F',
    tags: ['Web', 'Admin', 'Corporate'],
    featured: true,
    client: 'HTeng',
    role: 'UI/UX Designer',
    sourcePath: 'works/hteng-website',
    liveUrl: 'http://hteng.co.kr',
    liveLabel: 'Visit hteng.co.kr',
  },
];

/** Absolute http(s) URL 그대로, 상대 경로는 Vite BASE_URL 기준 */
export function resolveLiveUrl(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  const base = import.meta.env.BASE_URL || '/';
  return `${base}${url.replace(/^\//, '')}`;
}

export function getProjectBySlug(slug) {
  return projects.find((p) => p.slug === slug);
}

export function getFeaturedProjects() {
  return projects.filter((p) => p.featured);
}
