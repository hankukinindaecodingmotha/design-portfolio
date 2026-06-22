import { profile } from '../data/portfolio';
import { useReveal } from '../hooks/useReveal';
import './About.css';

export default function About() {
  const headerRef = useReveal();
  const contentRef = useReveal();

  return (
    <section id="about" className="about">
      <div className="about__inner">
        <div ref={headerRef} className="about__header reveal reveal--left">
          <span className="about__label">About</span>
          <h2 className="about__title">
            디자인은<br />
            <em>번역</em>이다
          </h2>
        </div>

        <div ref={contentRef} className="about__content reveal reveal--right reveal-delay-2">
          <div className="about__text">
            {profile.about.map((paragraph, i) => (
              <p key={i} className="about__paragraph">{paragraph}</p>
            ))}
          </div>

          <div className="about__details">
            <div className="about__block">
              <h3 className="about__block-title">Services</h3>
              <ul className="about__list">
                {profile.services.map((service) => (
                  <li key={service}>{service}</li>
                ))}
              </ul>
            </div>

            <div className="about__block">
              <h3 className="about__block-title">Tools</h3>
              <ul className="about__list">
                {profile.tools.map((tool) => (
                  <li key={tool}>{tool}</li>
                ))}
              </ul>
            </div>

            <div className="about__block">
              <h3 className="about__block-title">Location</h3>
              <p className="about__location">{profile.location}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="about__marquee" aria-hidden="true">
        <div className="about__marquee-track">
          {[...Array(4)].map((_, i) => (
            <span key={i}>
              Brand Identity · UI/UX · Editorial · Art Direction ·&nbsp;
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
