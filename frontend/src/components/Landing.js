import { useEffect, useRef, useState, Fragment } from 'react';
import './Landing.css';
import constants from '../constants.json';

const HERO_PHRASES = [
  { lines: [['Every', 'guest,'], ['answered.']], em: [['Every', 'time.']] },
  { lines: [['Every', 'booking,'], ['taken.']], em: [['Every', 'night.']] },
  { lines: [['Every', 'language,'], ['spoken.']], em: [['Every', 'house.']] },
];

const STATEMENT_PARTS = [
  { type: 'word', text: 'Samantha' },
  { type: 'word', text: 'answers' },
  { type: 'hl', text: 'every guest' },
  { type: 'word', text: 'on' },
  { type: 'word', text: 'the' },
  { type: 'word', text: 'first' },
  { type: 'word', text: 'ring,' },
  { type: 'word', text: 'in' },
  { type: 'word', text: 'any' },
  { type: 'word', text: 'language,' },
  { type: 'word', text: 'running' },
  { type: 'word', text: 'your' },
  { type: 'word', text: 'front desk' },
  { type: 'hl', text: 'around the clock' },
  { type: 'word', text: 'so' },
  { type: 'word', text: 'your' },
  { type: 'word', text: 'team' },
  { type: 'word', text: 'stays' },
  { type: 'word', text: 'human.' },
];

function HeroPhrase({ words, em, idx }) {
  const stride = 0.12;
  let i = 0;
  const renderLine = (line, li, keyPrefix) => (
    <span className="line" key={`${keyPrefix}-${idx}-${li}`}>
      {line.map((w, wi) => {
        const wd = `${(i++ * stride).toFixed(2)}s`;
        return (
          <Fragment key={`${keyPrefix}w-${idx}-${li}-${wi}`}>
            {wi > 0 && ' '}
            <span className="word" style={{ '--wd': wd }}>{w}</span>
          </Fragment>
        );
      })}
    </span>
  );
  return (
    <>
      {words.map((line, li) => renderLine(line, li, 'l'))}
      {em && <em>{em.map((line, li) => renderLine(line, li, 'el'))}</em>}
    </>
  );
}

export default function Landing({ openLoginPopup }) {
  const rootRef = useRef(null);
  const navRef = useRef(null);
  const statementRef = useRef(null);
  const trackRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [activePhrase, setActivePhrase] = useState(0);
  const [exitingPhrase, setExitingPhrase] = useState(null);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches);
  const [menuOpen, setMenuOpen] = useState(false);

  const heroVideoSrc = constants.LANDING_HERO_VIDEO.startsWith('http')
    ? constants.LANDING_HERO_VIDEO
    : `${process.env.PUBLIC_URL || ''}/${constants.LANDING_HERO_VIDEO}`;

  const setMenu = (next) => {
    setMenuOpen(next);
    document.body.style.overflow = next ? 'hidden' : '';
  };

  const openCalendly = (e) => {
    e?.preventDefault?.();
    setMenu(false);
    if (window.Calendly?.initPopupWidget) {
      window.Calendly.initPopupWidget({ url: 'https://calendly.com/roopesh-flashpact/samantha-demo' });
    } else {
      window.open('https://calendly.com/roopesh-flashpact/samantha-demo', '_blank', 'noopener');
    }
  };

  useEffect(() => {
    const root = rootRef.current;
    document.body.classList.add('landing-active');
    root?.classList.add('has-js');

    const mq = window.matchMedia('(max-width: 720px)');
    const mqHandler = (e) => setIsMobile(e.matches);
    mq.addEventListener ? mq.addEventListener('change', mqHandler) : mq.addListener(mqHandler);

    if (!document.getElementById('calendly-css')) {
      const link = document.createElement('link');
      link.id = 'calendly-css';
      link.rel = 'stylesheet';
      link.href = 'https://assets.calendly.com/assets/external/widget.css';
      document.head.appendChild(link);
    }
    if (!document.getElementById('calendly-js')) {
      const script = document.createElement('script');
      script.id = 'calendly-js';
      script.src = 'https://assets.calendly.com/assets/external/widget.js';
      script.async = true;
      document.body.appendChild(script);
    }

    const track = trackRef.current;
    let marqueeOriginalCount = 0;
    if (track) {
      marqueeOriginalCount = track.children.length;
      [...track.children].forEach((c) => track.appendChild(c.cloneNode(true)));
    }

    const WORD_ANIM = 950;
    const STRIDE = 120;
    const NUM_WORDS = 5;
    const HOLD = 4500;
    const TOTAL_EXIT = (NUM_WORDS - 1) * STRIDE + WORD_ANIM + 50;
    const phraseRef = { current: 0 };
    const phraseTimeouts = [];
    const phraseId = setInterval(() => {
      const cur = phraseRef.current;
      const nxt = (cur + 1) % HERO_PHRASES.length;
      setActivePhrase(-1);
      setExitingPhrase(cur);
      phraseTimeouts.push(setTimeout(() => { setActivePhrase(nxt); phraseRef.current = nxt; }, WORD_ANIM));
      phraseTimeouts.push(setTimeout(() => setExitingPhrase(null), TOTAL_EXIT));
    }, HOLD);

    const onScroll = () => {
      const nav = navRef.current;
      if (nav) nav.classList.toggle('scrolled', window.scrollY > 12);
    };
    document.addEventListener('scroll', onScroll, { passive: true });

    // statement word cascade
    const stmt = statementRef.current;
    let stmtIo;
    if (stmt) {
      const wordStride = 0.09;
      const letterStride = 0.06;
      let wIdx = 0;
      stmt.querySelectorAll('h2 > .stm-word, h2 > .stm-hl').forEach((el) => {
        if (el.classList.contains('stm-hl')) {
          const wordSpan = el.querySelector('.stm-word');
          if (!wordSpan) return;
          const text = wordSpan.textContent;
          wordSpan.style.setProperty('--sd', `${wIdx * wordStride}s`);
          wordSpan.innerHTML = '';
          [...text].forEach((ch, li) => {
            const s = document.createElement('span');
            s.className = 'stm-letter';
            s.textContent = ch === ' ' ? ' ' : ch;
            s.style.setProperty('--ld', `${wIdx * wordStride + 0.15 + li * letterStride}s`);
            wordSpan.appendChild(s);
          });
          wIdx += Math.ceil((text.length * letterStride) / wordStride);
        } else {
          el.style.setProperty('--sd', `${wIdx * wordStride}s`);
          wIdx += 1;
        }
      });
      stmtIo = new IntersectionObserver((es) => {
        es.forEach((e) => { if (e.isIntersecting) { stmt.classList.add('in'); stmtIo.disconnect(); } });
      }, { threshold: 0.25 });
      stmtIo.observe(stmt);
    }

    let revealIo;
    let revealFailsafe;
    const reveals = root ? root.querySelectorAll('.reveal') : [];
    if ('IntersectionObserver' in window) {
      revealIo = new IntersectionObserver((es) => {
        es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); revealIo.unobserve(e.target); } });
      }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
      reveals.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight) el.classList.add('in');
        else revealIo.observe(el);
      });
      revealFailsafe = setTimeout(() => reveals.forEach((el) => el.classList.add('in')), 2000);
    } else {
      reveals.forEach((el) => el.classList.add('in'));
    }

    return () => {
      document.body.classList.remove('landing-active');
      document.body.style.overflow = '';
      mq.removeEventListener ? mq.removeEventListener('change', mqHandler) : mq.removeListener(mqHandler);
      document.removeEventListener('scroll', onScroll);
      if (track) while (track.children.length > marqueeOriginalCount) track.removeChild(track.lastChild);
      revealIo?.disconnect();
      stmtIo?.disconnect();
      clearTimeout(revealFailsafe);
      clearInterval(phraseId);
      phraseTimeouts.forEach((t) => clearTimeout(t));
    };
  }, []);

  const handleSignIn = (e) => {
    e.preventDefault();
    openLoginPopup?.();
  };

  const playVideo = () => {
    if (!playing) setPlaying(true);
  };

  return (
    <div className="landing-root" ref={rootRef}>
      <nav className={`l-top${menuOpen ? ' menu-open' : ''}`} ref={navRef}>
        <div className="nav-inner">
          <a className="brand" href="#top" onClick={() => setMenu(false)}>
            <span className="mark">S</span>
            <span className="name">Samantha</span>
          </a>
          <div className="links">
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <a href="#videoSection">Watch demo</a>
            {/* <a href="#customers">Customers</a> */}
          </div>
          <div className="nav-actions">
            <a className="l-btn l-btn-ghost desktop-only" href="#signin" onClick={handleSignIn}>Sign in</a>
            <a className="l-btn l-btn-primary desktop-only" href="#demo" onClick={openCalendly}>Book a demo <span className="arr">→</span></a>
            <button
              className="hamburger"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenu(!menuOpen)}
            >
              <span /><span /><span />
            </button>
          </div>
        </div>
      </nav>

      <div className={`mobile-menu${menuOpen ? ' open' : ''}`} aria-hidden={!menuOpen}>
        <div className="mobile-menu-inner">
          <a href="#features" onClick={() => setMenu(false)}>Features</a>
          <a href="#how" onClick={() => setMenu(false)}>How it works</a>
          <a href="#videoSection" onClick={() => setMenu(false)}>Watch demo</a>
          {/* <a href="#customers" onClick={() => setMenu(false)}>Customers</a> */}
          <div className="mobile-menu-cta">
            <a className="l-btn l-btn-ghost" href="#signin" onClick={(e) => { handleSignIn(e); setMenu(false); }}>Sign in</a>
            <a className="l-btn l-btn-primary" href="#demo" onClick={openCalendly}>Book a demo <span className="arr">→</span></a>
          </div>
        </div>
      </div>

      <section className="hero" id="top">
        <video
          className="hero-video"
          src={heroVideoSrc}
          type="video/mp4"
          poster={`${process.env.PUBLIC_URL || ''}/${isMobile ? 'mobile_hero.png' : 'landing-hero-bg.png'}`}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          aria-hidden="true"
        />
        <div className="l-container">
          <div className="hero-top">
            <div className="hero-headline">
              <h1>
                {HERO_PHRASES.map((p, i) => {
                  const cls = i === activePhrase ? 'phrase active' : i === exitingPhrase ? 'phrase exiting' : 'phrase';
                  return (
                    <span className={cls} key={`p-${i}`}>
                      <HeroPhrase words={p.lines} em={p.em} idx={i} />
                    </span>
                  );
                })}
              </h1>
            </div>

            <div className="hero-block">
              <div className="eyebrow"><strong>New</strong> Samantha 2.0 for hotels</div>
              <h2>The voice AI built for <em>hospitality.</em></h2>
              <p>Samantha picks up on the first ring, books rooms, handles in-stay requests and speaks 38 languages, in the tone of your house, every hour of the night.</p>
              <div className="ctas">
                <a className="l-btn l-btn-white" href="#demo" onClick={openCalendly}>Book a demo <span className="arr">→</span></a>
                <a className="l-btn l-btn-glass" href="#voice">Hear her speak</a>
              </div>
            </div>
          </div>

          {/* Hotel customer marquee — commented out until we have real customers
          <div className="hero-marquee">
            <div className="track" ref={trackRef}>
              <div className="hl serif"><span className="wm">A</span><span className="nm">Athenaeum</span></div>
              <div className="hl">
                <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M20 4 L34 12 L34 28 L20 36 L6 28 L6 12 Z"/>
                  <path d="M14 18 L20 22 L26 18 M20 22 V30"/>
                </svg>
                <span className="nm">CAPE&nbsp;ROYALE</span>
              </div>
              <div className="hl serif">
                <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.4">
                  <circle cx="20" cy="20" r="14"/>
                  <path d="M12 24 q4 -10 8 -10 t8 10"/>
                  <circle cx="20" cy="20" r="2" fill="currentColor"/>
                </svg>
                <span className="nm">Maison Lutèce</span>
              </div>
              <div className="hl thin">
                <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <rect x="6" y="14" width="28" height="20" rx="1"/>
                  <path d="M6 22 H34 M14 14 V8 H26 V14"/>
                </svg>
                <span className="nm">The Northwood</span>
              </div>
              <div className="hl serif"><span className="wm" style={{ borderRadius: 6 }}>B</span><span className="nm">Belle &amp; Beaux</span></div>
              <div className="hl">
                <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M20 6 C28 14 28 22 20 34 C12 22 12 14 20 6 Z"/>
                  <circle cx="20" cy="18" r="2" fill="currentColor"/>
                </svg>
                <span className="nm">CASA&nbsp;MAGNOLIA</span>
              </div>
              <div className="hl serif">
                <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.4">
                  <path d="M8 30 L20 8 L32 30 Z"/>
                  <path d="M14 30 V22 H26 V30"/>
                </svg>
                <span className="nm">Conservatory</span>
              </div>
              <div className="hl">
                <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M6 30 Q14 18 20 24 T34 18"/>
                  <path d="M6 34 H34"/>
                  <circle cx="30" cy="12" r="3"/>
                </svg>
                <span className="nm">ATRIUM&nbsp;BAY</span>
              </div>
              <div className="hl thin">
                <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.4">
                  <rect x="8" y="10" width="24" height="24" rx="2"/>
                  <path d="M14 16 H26 M14 22 H26 M14 28 H20"/>
                </svg>
                <span className="nm">The Mercer</span>
              </div>
              <div className="hl serif">
                <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.4">
                  <path d="M10 12 C10 26 20 32 30 28 C26 30 16 24 16 12 Z" fill="currentColor" opacity="0.15"/>
                  <path d="M10 12 C10 26 20 32 30 28"/>
                </svg>
                <span className="nm">Pavillon d&apos;Or</span>
              </div>
            </div>
          </div>
          */}
        </div>
      </section>

      <div className="video-wrap reveal" id="videoSection">
        <div
          className={`l-video${playing ? ' playing' : ''}`}
          onClick={playVideo}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') playVideo(); }}
        >
          {playing ? (
            <iframe
              src="https://www.youtube.com/embed/I9_GFTV5P2w?autoplay=1&rel=0&modestbranding=1"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="Samantha product demo"
            />
          ) : (
            <div className="poster">
              <span className="badge"><span className="live-dot"></span>Product walkthrough</span>
              <div className="label">Two minutes</div>
              <div className="title">See the staff dashboard <em>in action.</em></div>
              <button className="play-btn" aria-label="Play product video">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l16 9-16 9V3z"/></svg>
              </button>
            </div>
          )}
        </div>
      </div>

      <section className="statement" id="statement" ref={statementRef}>
        <div className="l-container">
          <div className="why"><span className="braces">{'{ '}</span>Why Samantha<span className="braces">{' }'}</span></div>
          <h2>
            {STATEMENT_PARTS.map((p, i) => (
              <Fragment key={`s-${i}`}>
                {i > 0 && ' '}
                {p.type === 'hl' ? (
                  <span className="stm-hl"><span className="stm-word">{p.text}</span></span>
                ) : (
                  <span className="stm-word">{p.text}</span>
                )}
              </Fragment>
            ))}
          </h2>
          <div className="stm-caption">A voice agent built for hospitality</div>

          <div className="flower" aria-hidden="true">
            <span className="flwr-dot d1"></span>
            <span className="flwr-dot d2"></span>
            <span className="flwr-dot d3"></span>
            <svg className="squiggle" viewBox="0 0 80 100" fill="none" stroke="var(--l-navy)" strokeWidth="2" strokeLinecap="round">
              <path d="M10 96 Q 30 70, 22 50 T 38 18 T 60 6"/>
            </svg>
            <svg className="asterisk" viewBox="0 0 100 100" fill="none">
              <defs>
                <linearGradient id="l-astGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#D4AF37"/>
                  <stop offset="1" stopColor="#B8860B"/>
                </linearGradient>
              </defs>
              <g stroke="url(#l-astGrad)" strokeWidth="9" strokeLinecap="round">
                <line x1="50" y1="6" x2="50" y2="94"/>
                <line x1="6" y1="50" x2="94" y2="50"/>
                <line x1="18" y1="18" x2="82" y2="82"/>
                <line x1="82" y1="18" x2="18" y2="82"/>
              </g>
            </svg>
            <svg className="sparkle" viewBox="0 0 24 24" fill="var(--l-navy)">
              <path d="M12 0 L13.5 9 L24 12 L13.5 15 L12 24 L10.5 15 L0 12 L10.5 9 Z"/>
            </svg>
          </div>
        </div>
      </section>

      <section id="features">
        <div className="l-container">
          <div className="split">
            <div className="split-head">
              <div className="eb">What she does</div>
              <h2>One agent, every <em>channel.</em></h2>
              <p>Train Samantha once on your house, your rates, your rooms, your manners, then put her on the line, on your booking page, and in the WhatsApp thread your guests already use.</p>
            </div>
            <div className="split-body">
              <div className="feature reveal">
                <div className="ic">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92V21a1 1 0 0 1-1.1 1 19 19 0 0 1-8.3-3.06 18.9 18.9 0 0 1-6-6 19 19 0 0 1-3-8.3A1 1 0 0 1 4.6 3h4.1a1 1 0 0 1 1 .76 12 12 0 0 0 .57 2.6 1 1 0 0 1-.23 1L8.5 9a16 16 0 0 0 6 6l1.65-1.55a1 1 0 0 1 1-.23 12 12 0 0 0 2.6.57 1 1 0 0 1 .76 1Z"/></svg>
                </div>
                <h3>Voice that picks up</h3>
                <p>Sub-second latency, native barge-in, and a brand-tuned voice your guests recognise call after call. Routes seamlessly to a human when needed.</p>
              </div>
              <div className="feature reveal d1">
                <div className="ic">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/></svg>
                </div>
                <h3>Chat &amp; SMS</h3>
                <p>The widget on your booking page, the SMS thread, the WhatsApp number, all answered by the same Samantha, with the same memory.</p>
              </div>
              <div className="feature reveal d2">
                <div className="ic">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18v-7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v7M3 14h18M3 18v3M21 18v3M7 11h4"/></svg>
                </div>
                <h3>Runs your back office</h3>
                <p>Every call becomes a logged action: housekeeping tickets, dining reservations, PMS updates, handed to your team as a clean morning digest.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats section — commented out until we have real usage data
      <section style={{ paddingTop: 0 }}>
        <div className="l-container">
          <div className="split">
            <div className="split-head">
              <div className="eb">By the numbers</div>
              <h2>Quiet results, in the <em>background.</em></h2>
              <p>Hotels using Samantha typically see these shifts within ninety days.</p>
            </div>
            <div className="split-body">
              <div className="stats reveal-scale reveal">
                <div className="stat"><div className="v"><em>62</em><span className="unit">%</span></div><div className="l">Calls resolved without staff</div></div>
                <div className="stat"><div className="v">38<em>+</em></div><div className="l">Languages spoken</div></div>
                <div className="stat"><div className="v">1.2<em>s</em></div><div className="l">First-word latency</div></div>
                <div className="stat"><div className="v">9<em>/10</em></div><div className="l">Guest-rated warmth</div></div>
              </div>
            </div>
          </div>
        </div>
      </section>
      */}

      <section id="how">
        <div className="l-container">
          <div className="split">
            <div className="split-head">
              <div className="eb">How it works</div>
              <h2>Live in <em>hours,</em> not days.</h2>
              <p>No replatforming, no custom middleware. Samantha reads your existing systems and learns your house&apos;s manners.</p>
            </div>
            <div className="split-body">
              <div className="step reveal">
                <div className="num">i.</div>
                <h3>Connect</h3>
                <p>Plug into your PMS, telephony, and channel manager in a single afternoon. We support Opera, Mews, Cloudbeds, SiteMinder, Twilio, and more.</p>
              </div>
              <div className="step reveal d1">
                <div className="num">ii.</div>
                <h3>Tune</h3>
                <p>Choose a voice and tone. Add house policies, signature phrases, and the wines you&apos;d like recommended. Test on a private number first.</p>
              </div>
              <div className="step reveal d2">
                <div className="num">iii.</div>
                <h3>Go live</h3>
                <p>Switch your forwarding rule. Samantha picks up overflow first, then full coverage at the pace you choose. Full audit and rollback any time.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Customer testimonial — commented out until we have real customers
      <section className="quote" id="customers">
        <div className="l-container">
          <div className="split">
            <div className="split-head">
              <div className="eb">Customers</div>
              <h2>What hoteliers <em>say.</em></h2>
              <p>From boutique to luxury collections, in fourteen countries.</p>
            </div>
            <div className="split-body reveal">
              <div className="qmark">&ldquo;</div>
              <blockquote>I expected a robot. What I got was a <em>colleague</em>, one who never sleeps and somehow remembers the wine they ordered last spring.</blockquote>
              <div className="attrib">
                <div className="seal">M</div>
                <div className="who">
                  <div className="nm">Maxine Rouvier</div>
                  <div className="role">General Manager · Maison Lutèce, Paris</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      */}

      <section className="final" id="demo">
        <div className="l-container reveal">
          <h2>Hear her on a <em>real call.</em></h2>
          <p>Twenty minutes is enough to know whether Samantha belongs on your line.</p>
          <div className="ctas">
            <a className="l-btn l-btn-primary" href="#book" onClick={openCalendly}>Book a demo <span className="arr">→</span></a>
          </div>
        </div>
      </section>

      <footer className="l-footer" id="contact">
        <div className="l-container">
          <div className="row">
            <a className="brand" href="#top">
              <span className="mark">S</span>
              <span className="name">Samantha</span>
            </a>
            <div className="links-foot">
              <a href="#features">Features</a>
              <a href="#how">How it works</a>
              <a href="#contact">Contact</a>
              <a href="/privacy-policy">Privacy</a>
              <a href="/terms-conditions">Terms</a>
            </div>
            <div className="legal">© 2026 Samantha Hospitality Ltd.</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
