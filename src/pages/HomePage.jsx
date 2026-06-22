import { useEffect, useState } from 'react';
import SplineHero from '../components/SplineHero';
import WorkPreview from '../components/WorkPreview';
import About from '../components/About';
import Contact from '../components/Contact';

export default function HomePage() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (window.location.hash) {
      const el = document.querySelector(window.location.hash);
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 300);
      }
    }
  }, []);

  return (
    <main>
      <SplineHero loaded={loaded} />
      <WorkPreview />
      <About />
      <Contact />
    </main>
  );
}
