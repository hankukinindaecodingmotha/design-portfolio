import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getFeaturedProjects } from '../data/portfolio';
import ProjectCard from './ProjectCard';
import { useReveal } from '../hooks/useReveal';
import './WorkPreview.css';

export default function WorkPreview() {
  const headerRef = useReveal();
  const [hoveredId, setHoveredId] = useState(null);
  const featured = getFeaturedProjects();

  return (
    <section id="work" className="work-preview">
      <div className="work-preview__inner">
        <div ref={headerRef} className="work-preview__header reveal">
          <span className="work-preview__label">Selected Work</span>
          <h2 className="work-preview__title">
            만든 것들,<br />
            <em>그리고 배운 것들</em>
          </h2>
          <Link to="/work" className="work-preview__all">
            전체 포트폴리오 보기
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
        </div>

        <div className="work-preview__grid">
          {featured.map((project, i) => (
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
    </section>
  );
}
