import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import { profile } from '../data/portfolio';
import './SplineHero.css';

const Spline = lazy(() => import('@splinetool/react-spline'));

function SplineFallback() {
  return (
    <div className="spline-hero__fallback" aria-hidden="true">
      <div className="spline-hero__orb spline-hero__orb--1" />
      <div className="spline-hero__orb spline-hero__orb--2" />
      <div className="spline-hero__orb spline-hero__orb--3" />
    </div>
  );
}

export default function SplineHero({ loaded }) {
  const [sceneReady, setSceneReady] = useState(false);
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const useSpline = profile.splineSceneUrl && !prefersReducedMotion;

  return (
    <section className="spline-hero">
      <div className={`spline-hero__canvas ${sceneReady ? 'spline-hero__canvas--ready' : ''}`}>
        {useSpline ? (
          <Suspense fallback={<SplineFallback />}>
            <Spline
              scene={profile.splineSceneUrl}
              onLoad={() => setSceneReady(true)}
            />
          </Suspense>
        ) : (
          <SplineFallback />
        )}
      </div>

      <div className="spline-hero__overlay" aria-hidden="true" />

      <div className={`spline-hero__content ${loaded ? 'spline-hero__content--loaded' : ''}`}>
        <p className="spline-hero__label">{profile.role}</p>
        <h1 className="spline-hero__title">
          {profile.name.split('').map((char, i) => (
            <span
              key={i}
              className="spline-hero__char"
              style={{ animationDelay: `${0.05 * i + 0.3}s` }}
            >
              {char === ' ' ? '\u00A0' : char}
            </span>
          ))}
        </h1>
        <p className="spline-hero__tagline">
          {profile.tagline.split('\n').map((line, i) => (
            <span key={i}>
              {line}
              {i === 0 && <br />}
            </span>
          ))}
        </p>
        <div className="spline-hero__actions">
          <Link to="/work" className="spline-hero__btn spline-hero__btn--primary">
            View Work
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
          <a href="#contact" className="spline-hero__btn spline-hero__btn--ghost">
            Get in touch
          </a>
        </div>
      </div>

      <div className={`spline-hero__scroll ${loaded ? 'spline-hero__scroll--loaded' : ''}`}>
        <span>Scroll</span>
        <div className="spline-hero__scroll-line" />
      </div>
    </section>
  );
}
