/**
 * 경험 페이지 전환 네비 (모든 페이지 우측 상단 공통)
 * classic · quintessence · click
 */
const PAGES = [
  { id: "classic", href: "./classic.html", label: "클래식", title: "이전 전기·필터 이펙트" },
  { id: "quintessence", href: "./quintessence.html", label: "제5원소", title: "우주·원소 인터랙션" },
  { id: "click", href: "./click.html", label: "클릭", title: "손으로 마우스처럼 클릭" },
];

function detectPageId() {
  const fromBody = document.body?.dataset?.page;
  if (fromBody) return fromBody;
  const path = (location.pathname || "").split("/").pop() || "";
  if (path.includes("classic")) return "classic";
  if (path.includes("click")) return "click";
  if (path.includes("quintessence")) return "quintessence";
  return "hub";
}

function mountPagesNav() {
  if (document.getElementById("page-nav")) return;
  const nav = document.createElement("nav");
  nav.id = "page-nav";
  nav.setAttribute("aria-label", "경험 페이지");
  const current = detectPageId();
  nav.innerHTML = PAGES.map(
    (p) =>
      `<a class="page-link${p.id === current ? " active" : ""}" href="${p.href}" title="${p.title}" data-page="${p.id}">${p.label}</a>`
  ).join("");
  // 허브로 가는 홈
  const home = document.createElement("a");
  home.href = "./index.html";
  home.className = `page-link home${current === "hub" ? " active" : ""}`;
  home.title = "시작 허브";
  home.textContent = "홈";
  nav.prepend(home);
  document.body.appendChild(nav);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountPagesNav);
} else {
  mountPagesNav();
}

export { PAGES, detectPageId, mountPagesNav };
