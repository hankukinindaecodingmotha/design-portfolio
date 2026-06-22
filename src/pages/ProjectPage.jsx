import { Link, Navigate, useParams } from 'react-router-dom';
import { getProjectBySlug, projects } from '../data/portfolio';
import { useReveal } from '../hooks/useReveal';
import './ProjectPage.css';

export default function ProjectPage() {
  const { slug } = useParams();
  const project = getProjectBySlug(slug);
  const headerRef = useReveal();
  const contentRef = useReveal();

  if (!project) {
    return <Navigate to="/work" replace />;
  }

  const related = projects
    .filter((p) => p.category === project.category && p.id !== project.id)
    .slice(0, 2);

  return (
    <main className="project-page">
      <div className="project-page__hero" style={{ background: project.color }}>
        <div className="project-page__hero-inner">
          <Link to="/work" className="project-page__back">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M13 8H3M7 4L3 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            All Work
          </Link>
          <span
            className="project-page__letter"
            style={{ color: project.accent }}
            aria-hidden="true"
          >
            {project.title.charAt(0)}
          </span>
        </div>
      </div>

      <article className="project-page__body">
        <header ref={headerRef} className="project-page__header reveal">
          <div className="project-page__meta">
            <span className="project-page__category">{project.category}</span>
            <span className="project-page__year">{project.year}</span>
          </div>
          <h1 className="project-page__title">{project.title}</h1>
          <p className="project-page__summary">{project.description}</p>
        </header>

        <div ref={contentRef} className="project-page__grid reveal reveal-delay-2">
          <div className="project-page__details">
            <div className="project-page__detail">
              <h2>Client</h2>
              <p>{project.client}</p>
            </div>
            <div className="project-page__detail">
              <h2>Role</h2>
              <p>{project.role}</p>
            </div>
            <div className="project-page__detail">
              <h2>Year</h2>
              <p>{project.year}</p>
            </div>
            {project.tags && (
              <div className="project-page__detail">
                <h2>Tags</h2>
                <div className="project-page__tags">
                  {project.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="project-page__content">
            <p className="project-page__long">{project.longDescription}</p>
            <p className="project-page__note">
              실제 프로젝트 이미지는 `src/data/portfolio.js`에서 추가하거나,
              Behance·Figma 링크를 연결할 수 있습니다.
            </p>
          </div>
        </div>

        {related.length > 0 && (
          <section className="project-page__related">
            <h2>Related Work</h2>
            <div className="project-page__related-grid">
              {related.map((item) => (
                <Link
                  key={item.id}
                  to={`/work/${item.slug}`}
                  className="project-page__related-card"
                  style={{ background: item.color }}
                >
                  <span style={{ color: item.accent }}>{item.title}</span>
                  <small>{item.category}</small>
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>
    </main>
  );
}
