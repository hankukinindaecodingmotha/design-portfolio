import { Link } from 'react-router-dom';
import { useReveal } from '../hooks/useReveal';
import './WorkList.css';

function WorkListItem({ project, index }) {
  const ref = useReveal(0.08);

  return (
    <li
      ref={ref}
      className="work-list__item reveal reveal--work"
      style={{
        '--i': index,
        '--project-color': project.color,
        '--project-accent': project.accent,
      }}
    >
      <Link to={`/work/${project.slug}`} className="work-list__link">
        <span className="work-list__index" aria-hidden="true">
          {String(index + 1).padStart(2, '0')}
        </span>

        <div className="work-list__body">
          <h3 className="work-list__title">{project.title}</h3>
          <p className="work-list__desc">{project.description}</p>
        </div>

        <div className="work-list__meta">
          <span className="work-list__category">{project.category}</span>
          <span className="work-list__year">{project.year}</span>
        </div>

        <div className="work-list__preview" aria-hidden="true">
          <span className="work-list__preview-letter">{project.title.charAt(0)}</span>
        </div>

        <span className="work-list__arrow" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M5 15L15 5M15 5H7M15 5v8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </Link>
    </li>
  );
}

export default function WorkList({ projects, listKey = 'default' }) {
  return (
    <ul className="work-list" key={listKey}>
      {projects.map((project, i) => (
        <WorkListItem
          key={project.id}
          project={project}
          index={i}
        />
      ))}
    </ul>
  );
}
