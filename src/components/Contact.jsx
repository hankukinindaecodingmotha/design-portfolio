import { useState } from 'react';
import { profile } from '../data/portfolio';
import { useReveal } from '../hooks/useReveal';
import './Contact.css';

export default function Contact() {
  const headerRef = useReveal();
  const infoRef = useReveal();
  const formRef = useReveal();
  const [formState, setFormState] = useState({ name: '', email: '', message: '' });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
    setFormState({ name: '', email: '', message: '' });
  };

  return (
    <section id="contact" className="contact">
      <div className="contact__inner">
        <div ref={headerRef} className="contact__header reveal">
          <span className="contact__label">Contact</span>
          <h2 className="contact__title">
            함께 만들<br />
            <em>무언가</em>
          </h2>
          <p className="contact__subtitle">
            새로운 프로젝트, 협업, 또는 그냥 인사 — 언제든 환영합니다.
          </p>
        </div>

        <div className="contact__body">
          <div ref={infoRef} className="contact__info reveal reveal--left reveal-delay-1">
            <a href={`mailto:${profile.email}`} className="contact__email">
              {profile.email}
            </a>
            <div className="contact__socials">
              {profile.social.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="contact__social"
                >
                  {link.label}
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 11L11 3M11 3H5M11 3v6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </a>
              ))}
            </div>
          </div>

          <form
            ref={formRef}
            className="contact__form reveal reveal--right reveal-delay-2"
            onSubmit={handleSubmit}
          >
            <div className="contact__field">
              <label htmlFor="name">Name</label>
              <input
                id="name"
                type="text"
                required
                value={formState.name}
                onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                placeholder="이름"
              />
            </div>
            <div className="contact__field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                required
                value={formState.email}
                onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                placeholder="email@example.com"
              />
            </div>
            <div className="contact__field">
              <label htmlFor="message">Message</label>
              <textarea
                id="message"
                required
                rows={4}
                value={formState.message}
                onChange={(e) => setFormState({ ...formState, message: e.target.value })}
                placeholder="프로젝트에 대해 알려주세요"
              />
            </div>
            <button type="submit" className="contact__submit">
              {submitted ? 'Sent!' : 'Send Message'}
              {!submitted && (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
