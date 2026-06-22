import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import { profile } from '../data/portfolio';
import './HeroBanner.css';

const VideoBackground = lazy(() => import('./VideoBackground'));

function HeroFallback() {
  return (
    <div className="hero-banner__fallback" aria-hidden="true">
      <div className="hero-banner__orb hero-banner__orb--1" />
      <div className="hero-banner__orb hero-banner__orb--2" />
      <div className="hero-banner__orb hero-banner__orb--3" />
    </div>
  );
}

export default function HeroBanner({ loaded }) {
  const [videoReady, setVideoReady] = useState(false);
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const useVideo = profile.heroVideoUrl && !prefersReducedMotion;

  return (
    <section className="hero-banner">
      <div className="hero-banner__media">
        <HeroFallback />

        {useVideo && (
          <div className={`hero-banner__video ${videoReady ? 'hero-banner__video--ready' : ''}`}>
            <Suspense fallback={null}>
              <VideoBackground
                src={profile.heroVideoUrl}
                poster={profile.heroPoster}
                onReady={() => setVideoReady(true)}
                onError={() => setVideoReady(false)}
              />
            </Suspense>
          </div>
        )}
      </div>

      <div className="hero-banner__overlay" aria-hidden="true" />

      <div className={`hero-banner__content ${loaded ? 'hero-banner__content--loaded' : ''}`}>
        <p className="hero-banner__label">{profile.role}</p>
        <h1 className="hero-banner__title">
          {profile.name.split('').map((char, i) => (
            <span
              key={i}
              className="hero-banner__char"
              style={{ animationDelay: `${0.05 * i + 0.3}s` }}
            >
              {char === ' ' ? '\u00A0' : char}
            </span>
          ))}
        </h1>
        <p className="hero-banner__tagline">
          {profile.tagline.split('\n').map((line, i) => (
            <span key={i}>
              {line}
              {i === 0 && <br />}
            </span>
          ))}
        </p>
        <div className="hero-banner__actions">
          <Link to="/work" className="hero-banner__btn hero-banner__btn--primary">
            View Work
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
          <a href="#contact" className="hero-banner__btn hero-banner__btn--ghost">
            Get in touch
          </a>
        </div>
      </div>

      <div className={`hero-banner__scroll ${loaded ? 'hero-banner__scroll--loaded' : ''}`}>
        <span>Scroll</span>
        <div className="hero-banner__scroll-line" />
      </div>
    </section>
  );
}
