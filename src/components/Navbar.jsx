import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { profile } from '../data/portfolio';
import './Navbar.css';

const links = [
  { to: '/work', label: 'Work', route: true },
  { to: '/#about', label: 'About' },
  { to: '/#contact', label: 'Contact' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const isHome = location.pathname === '/';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const resolveHref = (to) => {
    if (to.startsWith('/#') && isHome) return to.replace('/', '');
    return to;
  };

  return (
    <header className={`nav ${scrolled || !isHome ? 'nav--scrolled' : ''}`}>
      <div className="nav__inner">
        <Link to="/" className="nav__logo" onClick={() => setMenuOpen(false)}>
          {profile.name.split(' ')[0]}
          <span className="nav__logo-dot" />
        </Link>

        <nav className={`nav__links ${menuOpen ? 'nav__links--open' : ''}`}>
          {links.map((link) =>
            link.route ? (
              <Link
                key={link.to}
                to={link.to}
                className="nav__link"
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </Link>
            ) : (
              <a
                key={link.to}
                href={resolveHref(link.to)}
                className="nav__link"
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </a>
            )
          )}
          <a
            href={isHome ? '#contact' : '/#contact'}
            className="nav__cta"
            onClick={() => setMenuOpen(false)}
          >
            Let's talk
          </a>
        </nav>

        <button
          className={`nav__toggle ${menuOpen ? 'nav__toggle--open' : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? '메뉴 닫기' : '메뉴 열기'}
        >
          <span />
          <span />
        </button>
      </div>
    </header>
  );
}
