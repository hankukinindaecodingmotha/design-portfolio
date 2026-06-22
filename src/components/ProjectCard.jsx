import { Link } from 'react-router-dom';
import { useReveal } from '../hooks/useReveal';
import './ProjectCard.css';

export default function ProjectCard({
  project,
  index = 0,
  isHovered,
  isDimmed,
  onHover,
  onLeave,
  linkToDetail = true,
}) {
  const ref = useReveal(0.1);

  const thumb = (
    <div
      className="project-card__thumb"
      style={{ background: project.color }}
    >
      <div className="project-card__thumb-inner">
        <span className="project-card__letter" style={{ color: project.accent }}>
          {project.title.charAt(0)}
        </span>
      </div>
      <div className={`project-card__overlay ${isHovered ? 'project-card__overlay--visible' : ''}`}>
        <span>View Project</span>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M5 15L15 5M15 5H7M15 5v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
  );

  const info = (
    <div className="project-card__info">
      <div className="project-card__meta">
        <span className="project-card__category">{project.category}</span>
        <span className="project-card__year">{project.year}</span>
      </div>
      <h3 className="project-card__name">{project.title}</h3>
      <p className="project-card__desc">{project.description}</p>
      {project.tags && (
        <div className="project-card__tags">
          {project.tags.map((tag) => (
            <span key={tag} className="project-card__tag">{tag}</span>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <article
      ref={ref}
      className={`project-card reveal reveal-delay-${(index % 3) + 1} ${isDimmed ? 'project-card--dimmed' : ''}`}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      {linkToDetail ? (
        <Link to={`/work/${project.slug}`} className="project-card__link">
          {thumb}
          {info}
        </Link>
      ) : (
        <>
          {thumb}
          {info}
        </>
      )}
    </article>
  );
}
