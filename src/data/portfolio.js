export const profile = {
  name: '정태주',
  nameHanja: '鄭泰柱',
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
      { text: '鄭泰', type: 'hanja' },
      { text: '柱', type: 'hanja-accent' },
    ],
    intro:
      'Seoul 기반 비주얼 디자이너 — 감각과 구조가 만나는 곳에서 대담한 브랜드 시스템과 디지털 경험을 만듭니다.',
  },
  // 3D 히어로 — public/models/ 에 GLB 배치 (Desktop/3D 폴더 심볼릭 링크)
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
    slug: 'lumiere-cosmetics',
    title: 'Lumière Cosmetics',
    category: 'Brand Identity',
    year: '2025',
    description: '럭셔리 뷰티 브랜드의 비주얼 아이덴티티와 패키지 시스템',
    longDescription:
      '프리미엄 뷰티 시장을 타깃으로 로고, 컬러 시스템, 타이포그래피, 패키지 가이드를 일관되게 설계했습니다. 오프라인 매장과 이커머스 채널 모두에서 동일한 브랜드 경험을 제공하는 것이 핵심 목표였습니다.',
    color: '#E8D5C4',
    accent: '#8B5E3C',
    tags: ['Branding', 'Packaging', 'Guidelines'],
    featured: true,
    client: 'Lumière Beauty Co.',
    role: 'Lead Designer',
  },
  {
    id: 2,
    slug: 'nexus-finance',
    title: 'Nexus Finance',
    category: 'UI/UX Design',
    year: '2025',
    description: '핀테크 앱의 대시보드와 온보딩 플로우 리디자인',
    longDescription:
      '복잡한 금융 데이터를 직관적으로 읽을 수 있도록 정보 구조를 재정의하고, 대시보드·온보딩·알림 화면을 통합 디자인 시스템으로 정리했습니다.',
    color: '#D4E4F7',
    accent: '#2C5282',
    tags: ['Mobile App', 'Dashboard', 'Design System'],
    featured: true,
    client: 'Nexus Labs',
    role: 'Product Designer',
  },
  {
    id: 3,
    slug: 'mono-magazine',
    title: 'Mono Magazine',
    category: 'Editorial Design',
    year: '2024',
    description: '독립 아트 매거진 12호 타이포그래피 중심 레이아웃',
    longDescription:
      '아트·디자인 크리에이터를 위한 독립 매거진 12호의 편집 디자인을 담당했습니다. 그리드 시스템과 타이포 계층을 중심으로 장문 인터뷰와 비주얼 아트워크가 공존하는 레이아웃을 구성했습니다.',
    color: '#E8E8E8',
    accent: '#1A1A1A',
    tags: ['Print', 'Typography', 'Layout'],
    featured: true,
    client: 'Mono Press',
    role: 'Editorial Designer',
  },
  {
    id: 4,
    slug: 'terra-studio',
    title: 'Terra Studio',
    category: 'Art Direction',
    year: '2024',
    description: '건축 스튜디오 웹사이트와 프로젝트 아카이브',
    longDescription:
      '건축 프로젝트의 스케일과 질감이 온라인에서도 전달되도록 이미지 중심의 아카이브 구조와 미니멀한 내비게이션을 설계했습니다.',
    color: '#D5E8D4',
    accent: '#3D5A3D',
    tags: ['Web', 'Art Direction', 'Photography'],
    featured: false,
    client: 'Terra Studio',
    role: 'Art Director',
  },
  {
    id: 5,
    slug: 'pulse-festival',
    title: 'Pulse Festival',
    category: 'Brand Identity',
    year: '2024',
    description: '전자음악 페스티벌 시즌 캠페인 비주얼 시스템',
    longDescription:
      '사운드의 리듬과 에너지를 시각 언어로 번역한 시즌 캠페인입니다. 포스터, SNS, 현장 사이니지까지 확장 가능한 모션 그래픽 시스템을 제안했습니다.',
    color: '#2A1A3D',
    accent: '#FF4D6D',
    tags: ['Campaign', 'Motion', 'Event'],
    featured: false,
    client: 'Pulse Festival',
    role: 'Visual Designer',
  },
  {
    id: 6,
    slug: 'atelier-cafe',
    title: 'Atelier Café',
    category: 'UI/UX Design',
    year: '2023',
    description: '스페셜티 카페 브랜드 앱과 키오스크 인터페이스',
    longDescription:
      '매장 경험을 디지털로 확장하는 주문 앱과 키오스크 UI를 디자인했습니다. 브랜드 톤을 유지하면서 빠른 주문 플로우에 집중했습니다.',
    color: '#F0E6D3',
    accent: '#6B4226',
    tags: ['Kiosk', 'Mobile', 'Hospitality'],
    featured: false,
    client: 'Atelier Café',
    role: 'UX Designer',
  },
];

export function getProjectBySlug(slug) {
  return projects.find((p) => p.slug === slug);
}

export function getFeaturedProjects() {
  return projects.filter((p) => p.featured);
}
