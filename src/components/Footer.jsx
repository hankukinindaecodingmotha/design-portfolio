import { profile } from '../data/portfolio';
import './Footer.css';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer__inner">
        <div className="footer__top">
          <p className="footer__name hanja">{profile.nameHanja}</p>
          <p className="footer__role">{profile.role}</p>
        </div>
        <div className="footer__bottom">
          <p className="footer__copy">
            &copy; {year} {profile.nameHanja}. All rights reserved.
          </p>
          <a href="#" className="footer__top-link">
            Back to top
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 10V2M3 5l3-3 3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
        </div>
      </div>
    </footer>
  );
}
