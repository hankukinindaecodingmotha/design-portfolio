import { useMemo, useState } from 'react';
import { categories, projects } from '../data/portfolio';
import WorkList from '../components/WorkList';
import { useReveal } from '../hooks/useReveal';
import './WorkPage.css';

export default function WorkPage() {
  const headerRef = useReveal();
  const [activeCategory, setActiveCategory] = useState('All');

  const filtered = useMemo(() => {
    if (activeCategory === 'All') return projects;
    return projects.filter((p) => p.category === activeCategory);
  }, [activeCategory]);

  return (
    <main className="work-page">
      <header className="work-page__hero">
        <div ref={headerRef} className="work-page__header reveal reveal--work">
          <span className="eyebrow work-page__label">Portfolio</span>
          <h1 className="work-page__title">
            Work<br />
            <em>Archive</em>
          </h1>
          <p className="work-page__desc">
            브랜딩, UI/UX, 에디토리얼까지 — 지금까지 만든 프로젝트를 모았습니다.
          </p>
        </div>
      </header>

      <div className="work-page__inner">
        <div className="work-page__filters" role="tablist" aria-label="프로젝트 카테고리">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={activeCategory === cat}
              className={`work-page__filter ${activeCategory === cat ? 'work-page__filter--active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
              {cat !== 'All' && (
                <span className="work-page__filter-count">
                  {projects.filter((p) => p.category === cat).length}
                </span>
              )}
            </button>
          ))}
        </div>

        <p className="work-page__count">{filtered.length} projects</p>

        <div className="work-page__list-wrap work-list--filtered" key={activeCategory}>
          <WorkList projects={filtered} listKey={activeCategory} />
        </div>
      </div>
    </main>
  );
}
