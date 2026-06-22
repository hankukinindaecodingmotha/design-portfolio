import { useMemo, useState } from 'react';
import { categories, projects } from '../data/portfolio';
import ProjectCard from '../components/ProjectCard';
import { useReveal } from '../hooks/useReveal';
import './WorkPage.css';

export default function WorkPage() {
  const headerRef = useReveal();
  const [activeCategory, setActiveCategory] = useState('All');
  const [hoveredId, setHoveredId] = useState(null);

  const filtered = useMemo(() => {
    if (activeCategory === 'All') return projects;
    return projects.filter((p) => p.category === activeCategory);
  }, [activeCategory]);

  return (
    <main className="work-page">
      <header className="work-page__hero">
        <div ref={headerRef} className="work-page__header reveal">
          <span className="work-page__label">Portfolio</span>
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
        <div className="work-page__filters">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
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

        <div className="work-page__grid">
          {filtered.map((project, i) => (
            <ProjectCard
              key={project.id}
              project={project}
              index={i}
              isHovered={hoveredId === project.id}
              isDimmed={hoveredId !== null && hoveredId !== project.id}
              onHover={() => setHoveredId(project.id)}
              onLeave={() => setHoveredId(null)}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
