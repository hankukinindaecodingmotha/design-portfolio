import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import { profile } from '../data/portfolio';
import { useParallax } from '../hooks/useParallax';
import './HeroBanner.css';

const VideoBackground = lazy(() => import('./VideoBackground'));
const HeroScene3D = lazy(() => import('./HeroScene3D'));

function HeroFallback({ className = '' }) {
  return (
    <div className={`hero-banner__fallback ${className}`.trim()} aria-hidden="true">
      <div className="hero-banner__grain" />
      <div className="hero-banner__orb hero-banner__orb--1" />
      <div className="hero-banner__orb hero-banner__orb--2" />
      <div className="hero-banner__orb hero-banner__orb--3" />
    </div>
  );
}

function ScrollBadge() {
  const text = 'SCROLL TO EXPLORE · SCROLL TO EXPLORE · ';
  return (
    <div className="hero-banner__badge" aria-hidden="true">
      <svg viewBox="0 0 120 120" className="hero-banner__badge-ring">
        <defs>
          <path
            id="hero-badge-path"
            d="M60,60 m-42,0 a42,42 0 1,1 84,0 a42,42 0 1,1 -84,0"
          />
        </defs>
        <text className="hero-banner__badge-text">
          <textPath href="#hero-badge-path" startOffset="0">
            {text}
          </textPath>
        </text>
      </svg>
      <svg className="hero-banner__badge-arrow" width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M9 3v12M4 10l5 5 5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export default function HeroBanner({ loaded }) {
  const [mediaReady, setMediaReady] = useState(false);
  const { ref: parallaxRef, pointer } = useParallax();
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const use3d = profile.hero3d?.enabled && profile.hero3d.models?.length && !prefersReducedMotion;
  const useVideo = profile.heroVideoUrl && !prefersReducedMotion && !use3d;
  const { kicker, headline, intro } = profile.hero;

  return (
    <section className="hero-banner" ref={parallaxRef}>
      <div className="hero-banner__media">
        <HeroFallback className={use3d && mediaReady ? 'hero-banner__fallback--hidden' : ''} />

        {use3d && (
          <div className={`hero-banner__scene ${mediaReady ? 'hero-banner__scene--ready' : ''}`}>
            <Suspense fallback={null}>
              <HeroScene3D
                models={profile.hero3d.models}
                pointer={pointer}
                onReady={() => setMediaReady(true)}
              />
            </Suspense>
          </div>
        )}

        {useVideo && (
          <div className={`hero-banner__video ${mediaReady ? 'hero-banner__video--ready' : ''}`}>
            <Suspense fallback={null}>
              <VideoBackground
                src={profile.heroVideoUrl}
                poster={profile.heroPoster}
                onReady={() => setMediaReady(true)}
                onError={() => setMediaReady(false)}
              />
            </Suspense>
          </div>
        )}
      </div>

      <div className="hero-banner__overlay" aria-hidden="true" />
      <div className="hero-banner__vignette" aria-hidden="true" />

      <div className={`hero-banner__frame ${loaded ? 'is-loaded' : ''}`}>
        <p className="hero-banner__kicker">
          {kicker.split('\n').map((line, i) => (
            <span key={i}>{line}</span>
          ))}
        </p>

        <a
          href={profile.social[0]?.href || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="hero-banner__corner"
          aria-label="Behance"
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M6 16L16 6M16 6H8M16 6v8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>

        <div className="hero-banner__content">
          <h1 className="hero-banner__title">
            {headline.map((line, i) => (
              <span key={i} className="hero-banner__line">
                <span
                  className={
                    line.type === 'hanja'
                      ? 'hero-banner__word hanja'
                      : line.type === 'hanja-accent'
                        ? 'hero-banner__word hanja hero-banner__word--accent'
                        : line.type === 'serif'
                          ? 'hero-banner__word serif-accent'
                          : 'hero-banner__word display'
                  }
                  style={{ transitionDelay: `${0.15 * i + 0.25}s` }}
                >
                  {line.text}
                </span>
              </span>
            ))}
          </h1>

          <div className="hero-banner__aside">
            <p className="hero-banner__intro">{intro}</p>
            <div className="hero-banner__actions">
              <Link to="/work" className="hero-banner__btn hero-banner__btn--primary">
                View Work
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <a href="#contact" className="hero-banner__btn hero-banner__btn--ghost">
                Get in touch
              </a>
            </div>
          </div>
        </div>

        <ScrollBadge />
      </div>
    </section>
  );
}
