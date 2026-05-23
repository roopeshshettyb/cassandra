import { useEffect, useRef, useState } from 'react';
import './Landing.css';

export default function Landing({ openLoginPopup }) {
  const rootRef = useRef(null);
  const navRef = useRef(null);
  const videoFrameRef = useRef(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.classList.add('has-js');

    const onScroll = () => {
      const nav = navRef.current;
      if (!nav) return;
      nav.classList.toggle('scrolled', window.scrollY > 12);
    };
    document.addEventListener('scroll', onScroll, { passive: true });

    const reveals = root.querySelectorAll('.reveal');
    let io;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add('in');
              io.unobserve(e.target);
            }
          });
        },
        { threshold: 0.05, rootMargin: '0px 0px -40px 0px' },
      );
      reveals.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight) el.classList.add('in');
        else io.observe(el);
      });
      const failsafe = setTimeout(() => reveals.forEach((el) => el.classList.add('in')), 1500);
      return () => {
        clearTimeout(failsafe);
        document.removeEventListener('scroll', onScroll);
        io.disconnect();
      };
    }
    reveals.forEach((el) => el.classList.add('in'));
    return () => document.removeEventListener('scroll', onScroll);
  }, []);

  const handleSignIn = (e) => {
    e.preventDefault();
    openLoginPopup?.();
  };

  const playVideo = () => {
    if (playing) return;
    setPlaying(true);
  };

  return (
    <div className="landing-root" ref={rootRef}>
      <nav className="l-top" id="topnav" ref={navRef}>
        <div className="nav-inner">
          <a className="brand" href="#top">
            <span className="mark">S</span>
            <span className="name">Samantha</span>
          </a>
          <div className="links">
            <a href="#how">How it works</a>
            <a href="#features">Features</a>
            <a href="#customers">Customers</a>
            <a href="#contact">Contact</a>
          </div>
          <div className="nav-actions">
            <a className="l-btn l-btn-ghost" href="#signin" onClick={handleSignIn}>Sign in</a>
            <a className="l-btn l-btn-primary" href="#demo">Book a demo <span className="arr">→</span></a>
          </div>
        </div>
      </nav>

      <section className="hero" id="top">
        <div className="l-container">
          <span className="eyebrow reveal"><span className="dot"></span>Voice AI · built for hotels</span>
          <h1 className="reveal d1">The voice of your front desk, <em>always answering.</em></h1>
          <p className="lede reveal d1">Samantha takes calls, handles guest requests, and speaks 38 languages — picking up on the first ring, every hour of the night, in the tone of your house.</p>
          <div className="hero-ctas reveal d2">
            <a className="l-btn l-btn-primary" href="#demo">Book a demo <span className="arr">→</span></a>
            <a className="l-btn l-btn-outline" href="#video">Watch 2-min demo</a>
          </div>
        </div>

        <div className="video-wrap reveal" id="video">
          <div
            className={`l-video${playing ? ' playing' : ''}`}
            id="videoFrame"
            ref={videoFrameRef}
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
                title="Samantha demo"
              />
            ) : (
              <div className="poster" id="videoPoster">
                <span className="badge"><span className="pulse"></span>Live product demo</span>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="label">Two minutes</div>
                  <div className="title">See Samantha take a real <em>guest call.</em></div>
                  <button className="play-btn" aria-label="Play demo video">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l16 9-16 9V3z"/></svg>
                  </button>
                </div>
                <div className="meta">2:14 · Watch on YouTube</div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="logobar">
        <div className="l-container">
          <div className="lead">Trusted by independent and group hotels in 14 countries</div>
          <div className="row">
            <div className="logo l-serif-font">Athenaeum</div>
            <div className="logo l-tracked">Maison&nbsp;Lutèce</div>
            <div className="logo l-bold">CAPE&nbsp;ROYALE</div>
            <div className="logo l-serif-font">Belle&nbsp;&amp;&nbsp;Beaux</div>
            <div className="logo l-tracked">Casa&nbsp;Magnolia</div>
            <div className="logo l-serif-font">The&nbsp;Northwood</div>
          </div>
        </div>
      </section>

      <section id="features">
        <div className="l-container">
          <div className="block-head reveal">
            <div className="eb">What she does</div>
            <h2>One agent, every <em>channel.</em></h2>
            <p>Train Samantha once on your house — your rates, your rooms, your manners — then put her on the line, on your booking page, and in the WhatsApp thread your guests already use.</p>
          </div>
          <div className="features">
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
              <p>The widget on your booking page, the SMS thread, the WhatsApp number — all answered by the same Samantha, with the same memory.</p>
            </div>
            <div className="feature reveal d2">
              <div className="ic">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18v-7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v7M3 14h18M3 18v3M21 18v3M7 11h4"/></svg>
              </div>
              <h3>Runs your back office</h3>
              <p>Every call becomes a logged action — housekeeping tickets, dining reservations, PMS updates — handed to your team as a clean morning digest.</p>
            </div>
          </div>
        </div>
      </section>

      <section style={{ paddingTop: 0 }}>
        <div className="l-container">
          <div className="stats reveal">
            <div className="stat"><div className="v"><em>62</em><span className="unit">%</span></div><div className="l">Calls resolved without staff</div></div>
            <div className="stat"><div className="v">38<em>+</em></div><div className="l">Languages spoken</div></div>
            <div className="stat"><div className="v">1.2<em>s</em></div><div className="l">First-word latency</div></div>
            <div className="stat"><div className="v">9<em>/10</em></div><div className="l">Guest-rated warmth</div></div>
          </div>
        </div>
      </section>

      <section id="how">
        <div className="l-container narrow">
          <div className="block-head reveal">
            <div className="eb">How it works</div>
            <h2>Live in <em>nine days,</em> not a quarter.</h2>
            <p>No replatforming, no custom middleware. Samantha reads your existing systems and learns your house&apos;s manners.</p>
          </div>
          <div className="steps">
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
      </section>

      <section className="quote" id="customers">
        <div className="l-container narrow reveal">
          <blockquote>I expected a robot. What I got was a <em>colleague</em> — one who never sleeps and somehow remembers the wine they ordered last spring.</blockquote>
          <div className="attrib">
            <div className="seal">M</div>
            <div className="who">
              <div className="nm">Maxine Rouvier</div>
              <div className="role">General Manager · Maison Lutèce, Paris</div>
            </div>
          </div>
        </div>
      </section>

      <section className="final" id="demo">
        <div className="l-container reveal">
          <h2>Hear her on a <em>real call.</em></h2>
          <p>Twenty minutes is enough to know whether Samantha belongs on your line.</p>
          <div className="ctas">
            <a className="l-btn l-btn-primary" href="#book">Book a demo <span className="arr">→</span></a>
            <a className="l-btn l-btn-outline" href="#call">Or call her now: +44 20 4538 1188</a>
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
              <a href="#customers">Customers</a>
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
