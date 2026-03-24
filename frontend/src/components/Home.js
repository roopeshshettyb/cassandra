import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  primary:            '#705d30',
  primaryDim:         '#635126',
  onPrimary:          '#fff8f0',
  primaryContainer:   '#fbdfa8',
  onPrimaryContainer: '#624f24',
  bg:                 '#faf9f8',
  onBg:               '#303333',
  onSurfaceVariant:   '#5d605f',
  surfaceContainer:   '#edeeed',
  surfaceContainerLow:'#f3f4f3',
  surface:            '#faf9f8',
};
const HL   = { fontFamily: "'Space Grotesk', sans-serif" };
const EASE = [0.22, 1, 0.36, 1];

// ─── Animation helpers ─────────────────────────────────────────────────────────
const FADE_UP = {
  hidden: { opacity: 0, y: 48 },
  show:   { opacity: 1, y: 0  },
};
const STAGGER_GRID = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.11 } },
};
const CARD_ITEM = {
  hidden: { opacity: 0, y: 56 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.72, ease: EASE } },
};
const reveal = (delay = 0) => ({
  variants:    FADE_UP,
  initial:     'hidden',
  whileInView: 'show',
  viewport:    { once: true, margin: '-60px' },
  transition:  { duration: 0.72, delay, ease: EASE },
});

// ─── Static data (outside component — never re-created) ────────────────────────
const NAV_LINKS = ['Experience', 'Technology', 'Portfolio', 'Concierge'];

const FEATURES = [
  {
    icon: 'concierge', title: '24/7 Concierge Support',
    desc: 'Multilingual, instantly available, handling complex room service or travel arrangements with zero wait time.',
    bg: '#fff', shadow: '0 2px 12px rgba(112,93,48,0.06)',
    titleColor: C.onBg, descColor: C.onSurfaceVariant, iconColor: C.primary,
    iconWeight: "'wght' 300", accent: false,
  },
  {
    icon: 'settings_input_component', title: 'Seamless Automation',
    desc: 'Direct integration with Opera, HMS, and luxury smart-room systems for effortless execution.',
    bg: C.primaryContainer, shadow: 'none',
    titleColor: C.onPrimaryContainer, descColor: C.onPrimaryContainer, iconColor: C.onPrimaryContainer,
    iconWeight: "'wght' 100", accent: true,
  },
  {
    icon: 'neurology', title: 'Human-Level Understanding',
    desc: 'Context-aware conversations that recognize guest tone, urgency, and specific brand preferences.',
    bg: '#fff', shadow: '0 2px 12px rgba(112,93,48,0.06)',
    titleColor: C.onBg, descColor: C.onSurfaceVariant, iconColor: C.primary,
    iconWeight: "'wght' 300", accent: false,
  },
];

const PROPERTIES = [
  {
    name: 'The Gilded Pavilion',
    location: 'Monaco',
    stars: 5,
    stat: '94% reduction in front-desk call volume within 30 days.',
    gradient: 'linear-gradient(135deg, #1B2340 0%, #2d3a60 100%)',
    accent: C.primaryContainer,
  },
  {
    name: 'Aurum Grand Dubai',
    location: 'Dubai, UAE',
    stars: 5,
    stat: '4.9 ★ guest satisfaction score across 6,000+ interactions.',
    gradient: 'linear-gradient(135deg, #3b2a0e 0%, #705d30 100%)',
    accent: '#fff8f0',
  },
  {
    name: 'Maison Éclat Paris',
    location: 'Paris, France',
    stars: 5,
    stat: 'Handles 12 languages — English to Mandarin — flawlessly.',
    gradient: 'linear-gradient(135deg, #2a2a2a 0%, #4a4a4a 100%)',
    accent: C.primaryContainer,
  },
];

const HOW_STEPS = [
  {
    num: '01',
    icon: 'mic',
    title: 'Guest Speaks Naturally',
    desc: 'In any language, in any tone. No commands, no menus — just a conversation.',
  },
  {
    num: '02',
    icon: 'psychology',
    title: 'Cassendra Understands Intent',
    desc: 'Deep context awareness reads urgency, sentiment, and preference from every word.',
  },
  {
    num: '03',
    icon: 'bolt',
    title: 'Instant Personalised Response',
    desc: 'The right answer, action, or escalation — delivered in under 500ms.',
  },
];

const FOOTER_LINKS = [
  { label: 'Privacy Policy',  path: '/privacy-policy'  },
  { label: 'Terms of Service',path: '/terms-conditions'},
  { label: 'Press Kit',       path: null               },
  { label: 'Contact',         path: '/contact'         },
];

// ─── Star renderer ─────────────────────────────────────────────────────────────
const Stars = ({ n }) => (
  <div style={{ display: 'flex', gap: '3px', marginBottom: '1rem' }}>
    {Array.from({ length: n }).map((_, i) => (
      <span key={i} style={{ color: C.primaryContainer, fontSize: '1rem' }}>★</span>
    ))}
  </div>
);

// ─── Component ─────────────────────────────────────────────────────────────────
const Home = ({ openLoginPopup, navigate, isMobile, account }) => {
  const [activeSection, setActiveSection] = useState('experience');
  const [menuOpen,      setMenuOpen]      = useState(false);
  const [scrolled,      setScrolled]      = useState(false);

  const handleCta = () => {
    if (account) navigate('/dashboard');
    else openLoginPopup();
  };

  // Smooth scroll to section
  const scrollTo = useCallback((id) => {
    setMenuOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Inject fonts once
  useEffect(() => {
    [
      'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Manrope:wght@300;400;500;600&display=swap',
      'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap',
    ].forEach(href => {
      if (!document.querySelector(`link[href="${href}"]`)) {
        const l = document.createElement('link');
        l.rel = 'stylesheet'; l.href = href;
        document.head.appendChild(l);
      }
    });
    if (!document.getElementById('lp-ms')) {
      const s = document.createElement('style');
      s.id = 'lp-ms';
      s.textContent = `.material-symbols-outlined{font-family:'Material Symbols Outlined';font-weight:normal;font-style:normal;font-size:24px;display:inline-block;vertical-align:middle;white-space:nowrap;direction:ltr;font-variation-settings:'FILL' 0,'wght' 300,'GRAD' 0,'opsz' 24;}`;
      document.head.appendChild(s);
    }
  }, []);

  // Active section via IntersectionObserver — trigger zone is centre of viewport
  useEffect(() => {
    const ids = ['experience', 'technology', 'portfolio', 'concierge'];
    const observers = ids.map(id => {
      const el = document.getElementById(id);
      if (!el) return null;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveSection(id); },
        { threshold: 0, rootMargin: '-35% 0px -55% 0px' }
      );
      obs.observe(el);
      return obs;
    });
    return () => observers.forEach(o => o?.disconnect());
  }, []);

  // Navbar shadow on scroll
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Lock body scroll when mobile menu open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const px = isMobile ? '1.5rem' : '3rem';
  const sb = isMobile ? '5rem' : '8rem'; // section bottom padding

  return (
    <div style={{ fontFamily: "'Manrope', sans-serif", backgroundColor: C.bg, color: C.onBg, minHeight: '100vh', overflowX: 'hidden' }}>

      {/* ── Navbar ──────────────────────────────────────────────────────────── */}
      <motion.nav
        initial={{ y: -72, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.65, ease: EASE }}
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
          background: 'rgba(250,249,248,0.88)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          borderBottom: `1px solid rgba(176,178,177,${scrolled ? 0.25 : 0.12})`,
          boxShadow: scrolled ? '0 4px 24px rgba(112,93,48,0.07)' : 'none',
          transition: 'box-shadow 0.3s, border-color 0.3s',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `1.25rem ${px}` }}>
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3, ease: EASE }}
            onClick={() => scrollTo('experience')}
            style={{ ...HL, fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.02em', color: C.primary, cursor: 'pointer', userSelect: 'none' }}
          >
            Cassendra
          </motion.div>

          {/* Desktop nav links */}
          {!isMobile && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.4, ease: EASE }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
            >
              {NAV_LINKS.map(label => {
                const id = label.toLowerCase();
                const isActive = activeSection === id;
                return (
                  <motion.button
                    key={label}
                    onClick={() => scrollTo(id)}
                    whileHover={{ color: C.primary }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ duration: 0.18 }}
                    style={{
                      ...HL, position: 'relative', background: 'none', border: 'none',
                      padding: '0.5rem 1rem', borderRadius: '0.375rem', cursor: 'pointer',
                      fontWeight: 500, fontSize: '0.9375rem',
                      color: isActive ? C.primary : C.onSurfaceVariant,
                    }}
                  >
                    {label}
                    {/* Sliding underline indicator */}
                    {isActive && (
                      <motion.div
                        layoutId="nav-indicator"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                        style={{
                          position: 'absolute', bottom: 2, left: '1rem', right: '1rem',
                          height: 2, background: C.primary, borderRadius: 2,
                        }}
                      />
                    )}
                  </motion.button>
                );
              })}
            </motion.div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <motion.button
              initial={{ opacity: 0, scale: 0.88 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.5 }}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.94 }}
              onClick={handleCta}
              style={{ ...HL, background: C.primary, color: C.onPrimary, border: 'none', padding: '0.6rem 1.4rem', borderRadius: '0.375rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}
            >
              Book Demo
            </motion.button>

            {/* Hamburger — mobile only */}
            {isMobile && (
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setMenuOpen(v => !v)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.4rem', display: 'flex', flexDirection: 'column', gap: '5px', zIndex: 51 }}
                aria-label="Toggle menu"
              >
                {[0, 1, 2].map(i => (
                  <motion.span
                    key={i}
                    animate={
                      menuOpen
                        ? i === 0 ? { rotate: 45,  y: 7,  opacity: 1 }
                        : i === 1 ? { opacity: 0 }
                        :           { rotate: -45, y: -7, opacity: 1 }
                        : { rotate: 0, y: 0, opacity: 1 }
                    }
                    transition={{ duration: 0.25, ease: EASE }}
                    style={{ display: 'block', width: 22, height: 2, background: C.onBg, borderRadius: 2, transformOrigin: 'center' }}
                  />
                ))}
              </motion.button>
            )}
          </div>
        </div>

        {/* Mobile full-screen menu */}
        <AnimatePresence>
          {isMobile && menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.3, ease: EASE }}
              style={{
                position: 'fixed', top: 64, left: 0, right: 0, bottom: 0,
                background: C.bg, zIndex: 49,
                display: 'flex', flexDirection: 'column',
                padding: '2.5rem 2rem', gap: '0.5rem',
                borderTop: `1px solid rgba(176,178,177,0.2)`,
              }}
            >
              {NAV_LINKS.map((label, i) => {
                const id = label.toLowerCase();
                const isActive = activeSection === id;
                return (
                  <motion.button
                    key={label}
                    initial={{ opacity: 0, x: -24 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.07, ease: EASE }}
                    whileTap={{ scale: 0.97, x: 4 }}
                    onClick={() => scrollTo(id)}
                    style={{
                      ...HL, background: isActive ? C.primaryContainer : 'none',
                      border: 'none', padding: '1rem 1.25rem',
                      borderRadius: '0.5rem', cursor: 'pointer',
                      fontWeight: 600, fontSize: '1.25rem', textAlign: 'left',
                      color: isActive ? C.onPrimaryContainer : C.onBg,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}
                  >
                    {label}
                    {isActive && <span className="material-symbols-outlined" style={{ fontSize: '1.25rem', color: C.primary }}>arrow_forward</span>}
                  </motion.button>
                );
              })}
              <div style={{ marginTop: 'auto', paddingTop: '2rem', borderTop: `1px solid rgba(176,178,177,0.15)` }}>
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={handleCta}
                  style={{ ...HL, background: C.primary, color: C.onPrimary, border: 'none', width: '100%', padding: '1rem', borderRadius: '0.5rem', fontWeight: 700, fontSize: '1.1rem', cursor: 'pointer' }}
                >
                  {account ? 'Go to Dashboard' : 'Book a Demo'}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <main style={{ paddingTop: '5.5rem' }}>

        {/* ── Experience / Hero ────────────────────────────────────────────── */}
        <section id="experience" style={{ padding: `2.5rem ${px} ${sb}` }}>
          <div style={{ paddingLeft: isMobile ? 0 : '8.333%', maxWidth: isMobile ? '100%' : '75%' }}>
            <div style={{ overflow: 'hidden', marginBottom: '2rem' }}>
              <motion.h1
                initial={{ y: '108%', opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.95, ease: EASE }}
                style={{ ...HL, fontSize: isMobile ? '2.6rem' : '4.5rem', fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.1, color: C.onBg, margin: 0 }}
              >
                The Future of Guest Experience:{' '}
                <span style={{ color: C.primary, fontStyle: 'italic' }}>Lifelike Voice AI</span>{' '}
                for Luxury Hotels
              </motion.h1>
            </div>

            <motion.p
              initial={{ opacity: 0, y: 36 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, delay: 0.18, ease: EASE }}
              style={{ fontSize: isMobile ? '1.05rem' : '1.3rem', color: C.onSurfaceVariant, lineHeight: 1.75, maxWidth: '40rem', margin: '0 0 3rem' }}
            >
              Seamlessly blending human warmth with digital precision. Elevate your property's service standards with the world's first AI engineered for the high-end hospitality sector.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.34, ease: EASE }}
              style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '1.25rem', alignItems: isMobile ? 'stretch' : 'center' }}
            >
              <motion.button
                whileHover={{ scale: 1.03, boxShadow: '0 10px 36px rgba(112,93,48,0.28)' }}
                whileTap={{ scale: 0.96 }}
                onClick={handleCta}
                style={{ ...HL, background: C.primary, color: C.onPrimary, border: 'none', padding: '1rem 2rem', borderRadius: '0.375rem', fontWeight: 600, fontSize: '1.05rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 4px 18px rgba(112,93,48,0.22)' }}
              >
                Experience the Voice
                <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>arrow_forward</span>
              </motion.button>
              <motion.button
                whileHover={{ color: C.primaryDim }}
                whileTap={{ scale: 0.97 }}
                onClick={() => scrollTo('technology')}
                style={{ ...HL, background: 'none', border: 'none', color: C.primary, fontWeight: 700, fontSize: '1.05rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '1rem 0.5rem' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', fontVariationSettings: "'FILL' 0" }}>play_circle</span>
                See How It Works
              </motion.button>
            </motion.div>
          </div>
        </section>

        {/* ── Video Demo ──────────────────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, scale: 0.96, y: 64 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.88, ease: EASE }}
          style={{ padding: `0 ${px} ${sb}` }}
        >
          <motion.div
            whileHover={{ scale: 1.01 }}
            transition={{ duration: 0.45, ease: EASE }}
            style={{ position: 'relative', width: '100%', paddingTop: isMobile ? '56.25%' : '42.86%', background: C.surfaceContainer, borderRadius: '1rem', overflow: 'hidden', cursor: 'pointer', boxShadow: '0 8px 48px rgba(112,93,48,0.1)' }}
          >
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDrg8CYJdGkpibxrXCaUNBj5W0qiVEYfs00Fbl0i9N1Fvoo_yq11rslcouQWW-LrSh8Ln1mnxyQRkIbJmZfaVyBy04e67T54mwYO39fzReeoLOqYtBIeeZKptTrRN8keYGhsSdHeDFK11PNI6goyeWVDal4wiUK1Mix92q9WGJ06c9w1Pw9rvlewV_ng0I55CPySJDKP1OS7TVkR1nI7duq0VjG-7HuvnRlCYRVkaYuN-AoMGKO8HiCQIMxoXSOKwCmz0zNsj4Om2mg"
              alt="Luxury Hotel Lobby" loading="eager" decoding="async"
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.9 }}
            />
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <motion.div
                whileHover={{ scale: 1.12 }}
                transition={{ duration: 0.28, ease: EASE }}
                style={{ width: '5.5rem', height: '5.5rem', borderRadius: '50%', background: 'rgba(250,249,248,0.93)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.primary, boxShadow: '0 20px 52px rgba(0,0,0,0.24)' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '2.75rem', fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
              </motion.div>
            </div>
            <div style={{ position: 'absolute', bottom: '2rem', left: '2rem', color: '#fff', textShadow: '0 1px 6px rgba(0,0,0,0.5)' }}>
              <p style={{ ...HL, fontWeight: 700, fontSize: '1.2rem', margin: 0 }}>Watch Cassendra in Action</p>
              <p style={{ margin: '0.2rem 0 0', opacity: 0.88, fontSize: '0.95rem' }}>4.5ms response latency — live concierge demo</p>
            </div>
          </motion.div>
        </motion.section>

        {/* ── Technology / Features ───────────────────────────────────────────── */}
        <section id="technology" style={{ padding: `0 ${px} ${isMobile ? '5rem' : '9rem'}` }}>
          <motion.h2 {...reveal()} style={{ ...HL, fontSize: isMobile ? '1.875rem' : '2.25rem', fontWeight: 700, marginBottom: '1rem', color: C.onBg }}>
            Defined by Excellence
          </motion.h2>
          <motion.p {...reveal(0.08)} style={{ color: C.onSurfaceVariant, fontSize: '1.05rem', marginBottom: '3.5rem', maxWidth: '38rem' }}>
            Every feature engineered to the uncompromising standards of five-star hospitality.
          </motion.p>

          <motion.div
            variants={STAGGER_GRID} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }}
            style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '1.75rem' }}
          >
            {FEATURES.map((f) => (
              <motion.div
                key={f.title} variants={CARD_ITEM}
                whileHover={{ y: -7, boxShadow: f.accent ? '0 20px 52px rgba(112,93,48,0.1)' : '0 20px 52px rgba(112,93,48,0.12)' }}
                style={{ background: f.bg, padding: '2.5rem', borderRadius: '0.75rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: isMobile ? 'auto' : '23rem', overflow: 'hidden', position: 'relative', boxShadow: f.shadow }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '2.5rem', color: f.iconColor, marginBottom: '2rem', fontVariationSettings: f.iconWeight }}>{f.icon}</span>
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <h3 style={{ ...HL, fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.875rem', color: f.titleColor }}>{f.title}</h3>
                  <p style={{ color: f.descColor, opacity: f.accent ? 0.82 : 1, lineHeight: 1.75, margin: 0, fontSize: '0.95rem' }}>{f.desc}</p>
                </div>
                {f.accent && (
                  <div style={{ position: 'absolute', bottom: '-2.5rem', right: '-2.5rem', opacity: 0.16, transform: 'rotate(12deg)', pointerEvents: 'none' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '12rem', fontVariationSettings: "'wght' 100" }}>settings_input_component</span>
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* ── Portfolio ───────────────────────────────────────────────────────── */}
        <section id="portfolio" style={{ background: C.surfaceContainerLow, padding: `${isMobile ? '5rem' : '8rem'} ${px}` }}>
          <motion.p {...reveal()} style={{ ...HL, color: C.primary, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: '0.8rem', marginBottom: '1rem' }}>
            Portfolio
          </motion.p>
          <motion.h2 {...reveal(0.06)} style={{ ...HL, fontSize: isMobile ? '1.875rem' : '2.5rem', fontWeight: 700, marginBottom: '1rem', color: C.onBg, maxWidth: '32rem' }}>
            Trusted by the World's Finest Properties
          </motion.h2>
          <motion.p {...reveal(0.12)} style={{ color: C.onSurfaceVariant, fontSize: '1.05rem', marginBottom: '3.5rem', maxWidth: '38rem' }}>
            Cassendra is live at some of the most prestigious hotels on earth — and delivering measurable results from day one.
          </motion.p>

          <motion.div
            variants={STAGGER_GRID} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }}
            style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '1.75rem' }}
          >
            {PROPERTIES.map((p) => (
              <motion.div
                key={p.name} variants={CARD_ITEM}
                whileHover={{ y: -6, scale: 1.01 }}
                style={{ background: p.gradient, borderRadius: '0.875rem', padding: '2.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '16rem', cursor: 'default', overflow: 'hidden', position: 'relative' }}
              >
                <div>
                  <Stars n={p.stars} />
                  <h3 style={{ ...HL, fontSize: '1.375rem', fontWeight: 700, color: p.accent, marginBottom: '0.4rem' }}>{p.name}</h3>
                  <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.825rem', letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0 }}>{p.location}</p>
                </div>
                <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.9rem', lineHeight: 1.65, margin: '2rem 0 0', fontStyle: 'italic' }}>
                  "{p.stat}"
                </p>
              </motion.div>
            ))}
          </motion.div>

          {/* Stats bar */}
          <motion.div
            {...reveal(0.1)}
            style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: '1.5rem', marginTop: '3.5rem', padding: '2rem', background: '#fff', borderRadius: '0.875rem', boxShadow: '0 2px 16px rgba(112,93,48,0.07)' }}
          >
            {[['50+','Properties live'],['98%','Guest satisfaction'],['4.5ms','Avg. response time'],['12','Languages supported']].map(([num, label]) => (
              <div key={label} style={{ textAlign: 'center', padding: '0.5rem' }}>
                <div style={{ ...HL, fontSize: isMobile ? '2rem' : '2.5rem', fontWeight: 700, color: C.primary, lineHeight: 1 }}>{num}</div>
                <div style={{ color: C.onSurfaceVariant, fontSize: '0.85rem', marginTop: '0.4rem', letterSpacing: '0.03em' }}>{label}</div>
              </div>
            ))}
          </motion.div>
        </section>

        {/* ── Concierge / How It Works ────────────────────────────────────────── */}
        <section id="concierge" style={{ padding: `${isMobile ? '5rem' : '8rem'} ${px}` }}>
          <motion.p {...reveal()} style={{ ...HL, color: C.primary, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: '0.8rem', marginBottom: '1rem' }}>
            Concierge
          </motion.p>
          <motion.h2 {...reveal(0.06)} style={{ ...HL, fontSize: isMobile ? '1.875rem' : '2.5rem', fontWeight: 700, marginBottom: '1rem', color: C.onBg, maxWidth: '32rem' }}>
            Your AI Concierge, Always On
          </motion.h2>
          <motion.p {...reveal(0.12)} style={{ color: C.onSurfaceVariant, fontSize: '1.05rem', marginBottom: isMobile ? '3rem' : '4rem', maxWidth: '38rem' }}>
            No scripts. No menus. Just natural conversation — resolved in milliseconds, personalised to every guest.
          </motion.p>

          {/* How it works — 3 steps */}
          <motion.div
            variants={STAGGER_GRID} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }}
            style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '1.75rem', marginBottom: isMobile ? '3rem' : '5rem' }}
          >
            {HOW_STEPS.map((step) => (
              <motion.div
                key={step.num} variants={CARD_ITEM}
                style={{ padding: '2.5rem', borderRadius: '0.875rem', background: '#fff', boxShadow: '0 2px 12px rgba(112,93,48,0.06)', position: 'relative', overflow: 'hidden' }}
              >
                <div style={{ ...HL, fontSize: '5rem', fontWeight: 800, color: C.primaryContainer, lineHeight: 1, marginBottom: '1.5rem', userSelect: 'none' }}>{step.num}</div>
                <span className="material-symbols-outlined" style={{ fontSize: '2rem', color: C.primary, marginBottom: '1rem', display: 'block', fontVariationSettings: "'FILL' 1, 'wght' 400" }}>{step.icon}</span>
                <h3 style={{ ...HL, fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem', color: C.onBg }}>{step.title}</h3>
                <p style={{ color: C.onSurfaceVariant, lineHeight: 1.75, margin: 0, fontSize: '0.95rem' }}>{step.desc}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* Live conversation card */}
          <motion.div
            {...reveal(0.1)}
            style={{ background: 'linear-gradient(135deg, #1B2340 0%, #263462 100%)', borderRadius: '1.25rem', padding: isMobile ? '2rem' : '3rem', maxWidth: '52rem', margin: '0 auto' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px #4ade80' }} />
              <span style={{ ...HL, color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Live Session — Room 412</span>
            </div>

            {/* Guest message */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.25rem' }}>
              <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '1rem 1rem 0.25rem 1rem', padding: '1rem 1.25rem', maxWidth: '72%' }}>
                <p style={{ color: 'rgba(255,255,255,0.9)', margin: 0, lineHeight: 1.6, fontSize: '0.95rem' }}>
                  "I'd like a late checkout tomorrow and dinner reservations for two — somewhere with a view."
                </p>
              </div>
            </div>

            {/* AI response */}
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: C.primaryContainer, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 4 }}>
                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', color: C.primary, fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
              </div>
              <div>
                <p style={{ ...HL, color: C.primaryContainer, fontWeight: 700, fontSize: '0.78rem', margin: '0 0 0.5rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Cassendra</p>
                <div style={{ background: C.primaryContainer, borderRadius: '0.25rem 1rem 1rem 1rem', padding: '1rem 1.25rem' }}>
                  <p style={{ color: C.onPrimaryContainer, margin: 0, lineHeight: 1.65, fontSize: '0.95rem' }}>
                    Of course. I've arranged a 2 PM checkout and reserved a table at Altitude for 8 PM — floor-to-ceiling windows, city panorama.{' '}
                    <span style={{ fontWeight: 700 }}>Shall I add a champagne welcome?</span>
                  </p>
                </div>
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem', margin: '0.4rem 0 0 0.25rem' }}>Responded in 412ms</p>
              </div>
            </div>
          </motion.div>
        </section>

        {/* ── Testimonial ─────────────────────────────────────────────────────── */}
        <section style={{ background: C.surfaceContainerLow, padding: `${isMobile ? '5rem' : '8rem'} ${px}`, textAlign: 'center' }}>
          <div style={{ maxWidth: '68rem', margin: '0 auto' }}>
            <motion.p {...reveal()} style={{ ...HL, color: C.primary, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: '0.8rem', marginBottom: '1.5rem' }}>
              The Art of Invisible Service
            </motion.p>
            <motion.div {...reveal(0.1)} style={{ ...HL, fontSize: isMobile ? '1.75rem' : '3.25rem', fontWeight: 500, lineHeight: 1.25, margin: '0 0 3.5rem', color: C.onBg }}>
              "The hallmark of true luxury is being{' '}
              <span style={{ color: C.primaryDim }}>understood</span>{' '}
              before you even finish your sentence."
            </motion.div>
            <motion.div {...reveal(0.2)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: '4.5rem', height: '4.5rem', borderRadius: '50%', overflow: 'hidden', marginBottom: '1.25rem', background: C.surfaceContainer, flexShrink: 0 }}>
                <img
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuAYTW7pdud6IhmWX_4Ro3aBXekNA4SBMxbVhzspOKeFA8Q3LBMYAXNmntQsgK0C56bsIbzq0CkvJwWSoKNuYvNXe-t-fQRRJ9TNBc4ewSeh7ULe7DOdJ3t3aURlJ4uM-Rdihj1Nl6OY1w2qWpT9eN7CTDyNDDtOSHiAm4bAo7iPM2EIG3hbAljxwzq2e5L_Jd-IXGgib5_15yIANhYXaul_8eN6bZ4PsqAzaB5mDtpYbZCV-SngzCN1h60Zp9DTPJMkJynYxHGGYSYY"
                  alt="Julian Vance" loading="lazy" decoding="async" width={72} height={72}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <p style={{ ...HL, fontWeight: 700, fontSize: '1.05rem', margin: '0 0 0.2rem' }}>Julian Vance</p>
              <p style={{ color: C.onSurfaceVariant, fontSize: '0.825rem', letterSpacing: '0.05em', textTransform: 'uppercase', margin: 0 }}>
                Director of Operations, The Gilded Pavilion
              </p>
            </motion.div>
          </div>
        </section>

        {/* ── CTA ─────────────────────────────────────────────────────────────── */}
        <section style={{ padding: `${isMobile ? '5rem' : '9rem'} ${px}`, textAlign: 'center' }}>
          <motion.h2 {...reveal()} style={{ ...HL, fontSize: isMobile ? '2.1rem' : '3.5rem', fontWeight: 700, maxWidth: '46rem', margin: '0 auto 1.75rem' }}>
            Set a New Standard for Your Hotel
          </motion.h2>
          <motion.p {...reveal(0.1)} style={{ fontSize: '1.15rem', color: C.onSurfaceVariant, maxWidth: '34rem', margin: '0 auto 3rem' }}>
            Join an exclusive cohort of five-star properties reimagining the guest journey with Cassendra.
          </motion.p>
          <motion.div {...reveal(0.2)} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '1.25rem' }}>
            <motion.button
              whileHover={{ scale: 1.03, boxShadow: '0 12px 44px rgba(112,93,48,0.38)' }}
              whileTap={{ scale: 0.96 }}
              onClick={handleCta}
              style={{ ...HL, background: C.primary, color: C.onPrimary, border: 'none', padding: '1.1rem 2.25rem', borderRadius: '0.375rem', fontWeight: 700, fontSize: '1.1rem', cursor: 'pointer', boxShadow: '0 4px 22px rgba(112,93,48,0.3)' }}
            >
              Schedule a Private Demo
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.03, background: C.surfaceContainer }}
              whileTap={{ scale: 0.96 }}
              onClick={() => navigate('/contact')}
              style={{ ...HL, background: C.surface, color: C.primary, border: '1px solid rgba(112,93,48,0.22)', padding: '1.1rem 2.25rem', borderRadius: '0.375rem', fontWeight: 700, fontSize: '1.1rem', cursor: 'pointer' }}
            >
              Request Whitepaper
            </motion.button>
          </motion.div>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <motion.footer
        {...reveal()}
        style={{ background: C.surfaceContainerLow, display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', padding: `2.75rem ${px}`, borderTop: '1px solid rgba(176,178,177,0.18)', gap: '1.75rem' }}
      >
        <div>
          <div style={{ ...HL, fontSize: '1.1rem', fontWeight: 700, color: C.primary, marginBottom: '0.4rem' }}>Cassendra</div>
          <p style={{ fontSize: '0.85rem', letterSpacing: '0.03em', color: C.onSurfaceVariant, margin: 0 }}>
            © 2024 Lumina Gilded. The Modern Maître D'.
          </p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.75rem', fontSize: '0.85rem', letterSpacing: '0.03em' }}>
          {FOOTER_LINKS.map(({ label, path }) => (
            <motion.a
              key={label}
              href={path || '#'}
              whileHover={{ opacity: 1, color: C.primary }}
              transition={{ duration: 0.16 }}
              onClick={path ? e => { e.preventDefault(); navigate(path); } : undefined}
              style={{ color: C.onSurfaceVariant, textDecoration: 'underline', textUnderlineOffset: '4px', opacity: 0.75 }}
            >
              {label}
            </motion.a>
          ))}
        </div>
      </motion.footer>
    </div>
  );
};

export default Home;
