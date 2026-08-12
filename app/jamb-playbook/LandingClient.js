'use client';
import { useEffect, useRef, useState } from 'react';

const HERO_CARDS = [
  { i: '📘', tag: 'Core System', lbl: '100/100 AI Playbook' },
  { i: '💎', tag: '18 Months', lbl: 'Google AI Pro' },
  { i: '📚', tag: '1980–2026', lbl: 'Past Question Vault' },
  { i: '🤖', tag: '1,000 Credits', lbl: 'Your AI Tutor' },
  { i: '🎯', tag: 'Test & Improve', lbl: 'AI Mock Exams' },
];

const CHECKLIST = [
  ['How to Study for JAMB', 'the exact system that helps you cover the syllabus faster'],
  ['How to Read and Not Forget', 'AI-powered recall techniques that make information stick'],
  ['How to Recognize Patterns in JAMB', 'learn how questions are set and predict what comes out'],
  ['How to Use AI as Your Personal Tutor', 'step-by-step instructions, not just "use ChatGPT"'],
  ['How to Create a Study Schedule That Works', 'even if you have no time'],
  ['How to Master Each Subject', 'Biology, Chemistry, Physics, Mathematics, English, CRS/Government'],
  ['How to Analyse Past Questions', 'identify what JAMB repeats year after year'],
  ['How to Practice Like the Real Exam', 'mock tests that mirror the actual JAMB experience'],
  ['How to Stay Consistent', 'beat procrastination and study every day'],
  ['How to Score 300+', 'the proven system that got 312'],
];

const BONUSES = [
  { i: '💎', v: 'Worth ₦200,000+', h: 'Bonus 1: Google AI Pro — 18 Months Access',
    p: 'Veo 3 cinematic video, Gemini Pro, Flow Music, Gemini inside Gmail/Docs/Sheets, Google AI Studio, NotebookLM Premium, and 5TB of storage. One-time payment, no monthly fees.',
    featured: true },
  { i: '📚', v: 'Worth ₦50,000', h: 'Bonus 2: The Complete JAMB Past Question Vault',
    p: '1980–2026, every subject, plus all accredited textbooks (Lamlad, Hidden Fact, Remix, and more). Searchable by subject, topic, or year.' },
  { i: '🤖', v: 'Worth ₦50,000', h: 'Bonus 3: Your Personal JAMB AI Tutor',
    p: '1,000 AI study credits across Biology, Chemistry, Physics, English, and Maths. Like 5 private tutors in your pocket.' },
  { i: '🧠', v: 'Worth ₦30,000', h: 'Bonus 4: 1,000+ JAMB AI Prompts',
    p: 'Ready-made prompts for learning, revision, mock exams, weak-topic analysis, and study planning. Copy, paste, get results.' },
  { i: '🎯', v: 'Worth ₦30,000', h: 'Bonus 5: AI Mock Exam System',
    p: 'Personalised mock tests, instant feedback, mistake analysis. Test → analyse → improve → repeat.' },
  { i: '📅', v: 'Worth ₦25,000', h: 'Bonus 6: JAMB Study Command Centre',
    p: 'Daily and weekly planner, syllabus tracker, revision tracker, weak-topic tracker, score tracker, exam countdown.' },
  { i: '🎨', v: 'Worth ₦25,000', h: 'Bonus 7: AI Design Masterclass',
    p: 'Create study visuals — images, illustrations, diagrams — with AI. Built for visual learners.' },
  { i: '🎬', v: 'Worth ₦35,000', h: 'Bonus 8: AI Video Masterclass',
    p: 'AI scripts, voiceovers, and visuals — learn faster by creating your own educational videos.' },
  { i: '🔬', v: 'Worth ₦30,000', h: 'Bonus 9: AI Research Masterclass',
    p: 'Summarise long documents, analyse sources, create study notes, answer complex questions.' },
  { i: '💰', v: 'Worth ₦40,000', h: 'Bonus 10: AI Student Money-Making Playbook',
    p: 'Turn your AI skills into income — freelancing, content creation, design and writing services.' },
  { i: '🎁', v: 'Worth ₦50,000+', h: 'Bonus 11: AI Student Benefits Vault',
    p: 'Constantly updated free AI credits, student plans, trials, and education discounts — with claim guides.' },
  { i: '📦', v: 'Worth ₦20,000', h: 'Bonus 12: 100+ AI Student Templates',
    p: 'Study planners, research templates, assignment templates, CV templates, AI workflows — done for you.' },
];

const FAQS = [
  ["What exactly happens if I don't score 300+?", 'You message me, show that you actually followed the system, and get a full refund. No interrogation.'],
  ['Do I need to be tech-savvy?', 'No. If you can send a WhatsApp message, you can use this system.'],
  ['What if I have limited data?', 'Everything is optimized for mobile and low data usage.'],
  ['Is this for all JAMB subjects?', 'Yes — Science, Arts, and Commercial subject combinations are all covered.'],
  ['How long do I have access?', 'Lifetime access to the core system and bonuses. Google AI Pro is 18 months, one-time payment, no renewal.'],
];

function naira(n) {
  return `₦${Number(n).toLocaleString('en-NG')}`;
}

export default function LandingClient({ basePrice, screenshots = [], quotes = [] }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [slotShots, setSlotShots] = useState(screenshots);
  const [uploadingSlot, setUploadingSlot] = useState(null);
  const slotFileRefs = [useRef(null), useRef(null), useRef(null)];

  useEffect(() => {
    fetch('/api/admin/landing/is-admin')
      .then(r => r.json())
      .then(d => setIsAdmin(!!d.isAdmin))
      .catch(() => {});
  }, []);

  async function handleSlotFile(slot, file) {
    if (!file) return;
    setUploadingSlot(slot);
    try {
      const fd = new FormData();
      fd.append('slot', String(slot));
      fd.append('image', file);
      const res = await fetch('/api/admin/landing/testimonials/screenshot-slot', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (res.ok && data.testimonial) {
        setSlotShots(prev => {
          const next = prev.filter(s => s.sort_order !== slot);
          next.push(data.testimonial);
          return next;
        });
      } else {
        alert(data.error || 'Upload failed.');
      }
    } catch {
      alert('Upload failed.');
    } finally {
      setUploadingSlot(null);
    }
  }

  async function handleSlotRemove(slot) {
    if (!confirm('Remove this screenshot?')) return;
    setUploadingSlot(slot);
    try {
      const res = await fetch('/api/admin/landing/testimonials/screenshot-slot', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot }),
      });
      const data = await res.json();
      if (res.ok) {
        setSlotShots(prev => prev.filter(s => s.sort_order !== slot));
      } else {
        alert(data.error || 'Remove failed.');
      }
    } catch {
      alert('Remove failed.');
    } finally {
      setUploadingSlot(null);
    }
  }

  const heroPinRef = useRef(null);
  const fieldRef = useRef(null);
  const captionRef = useRef(null);
  const hintRef = useRef(null);
  const stampRef = useRef(null);
  const stickyRef = useRef(null);
  const finalRef = useRef(null);

  const [openFaq, setOpenFaq] = useState(0);
  const [couponCode, setCouponCode] = useState('');
  const [couponState, setCouponState] = useState(null);
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [checkoutError, setCheckoutError] = useState('');
  const [paying, setPaying] = useState(false);

  const price = couponState && couponState.valid ? couponState.finalPrice : basePrice;

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const chaos = [
      { x: -150, y: -70, z: 10, rx: 18, ry: -24, rz: -10 },
      { x: 120, y: -100, z: 60, rx: -14, ry: 20, rz: 8 },
      { x: -190, y: 60, z: -30, rx: 8, ry: 26, rz: 14 },
      { x: 160, y: 80, z: 20, rx: -20, ry: -16, rz: -6 },
      { x: 10, y: -150, z: -50, rx: 24, ry: 6, rz: 18 },
    ];
    const lerp = (a, b, t) => a + (b - a) * t;

    function layout(progress) {
      const field = fieldRef.current;
      if (!field) return;
      const cards = field.querySelectorAll('.fcard');
      const rect = field.getBoundingClientRect();
      const w = rect.width;
      const isMobile = w < 640;
      const cardW = isMobile ? 108 : 150;
      const gap = isMobile ? 10 : 22;
      const n = cards.length;
      const totalW = n * cardW + (n - 1) * gap;
      const startX = -totalW / 2 + cardW / 2;

      cards.forEach((card, idx) => {
        const c = chaos[idx];
        const targetX = startX + idx * (cardW + gap);
        const x = lerp(c.x, targetX, progress);
        const y = lerp(c.y, 0, progress);
        const z = lerp(c.z, 0, progress);
        const rx = lerp(c.rx, 0, progress);
        const ry = lerp(c.ry, 0, progress);
        const rz = lerp(c.rz, 0, progress);
        card.style.transform = `translate3d(${x}px,${y}px,${z}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`;
      });

      if (captionRef.current && hintRef.current) {
        if (progress > 0.82) {
          captionRef.current.classList.add('show');
          hintRef.current.style.opacity = '0';
        } else {
          captionRef.current.classList.remove('show');
          hintRef.current.style.opacity = '1';
        }
      }
    }

    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const pinWrap = heroPinRef.current;
        if (!pinWrap) { ticking = false; return; }
        const rect = pinWrap.getBoundingClientRect();
        const total = pinWrap.offsetHeight - window.innerHeight;
        const scrolled = -rect.top;
        let progress = total > 0 ? Math.min(1, Math.max(0, scrolled / total)) : 0;
        if (reduceMotion) progress = 1;
        layout(progress);
        ticking = false;
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  useEffect(() => {
    function onScroll() {
      if (!stickyRef.current || !finalRef.current) return;
      const pastHero = window.scrollY > window.innerHeight * 1.4;
      const finalRect = finalRef.current.getBoundingClientRect();
      const atFinal = finalRect.top < window.innerHeight * 0.6;
      stickyRef.current.classList.toggle('show', pastHero && !atFinal);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!stampRef.current || !('IntersectionObserver' in window)) {
      stampRef.current?.classList.add('in');
      return;
    }
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.5 });
    io.observe(stampRef.current);
    return () => io.disconnect();
  }, []);

  async function applyCoupon() {
    if (!couponCode.trim()) { setCouponState(null); return; }
    setCheckingCoupon(true);
    const res = await fetch('/api/landing/coupon/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: couponCode, productSlug: 'jamb-playbook' }),
    });
    const data = await res.json();
    setCouponState(data);
    setCheckingCoupon(false);
  }

  async function startCheckout(e) {
    e.preventDefault();
    setCheckoutError('');
    setPaying(true);
    const res = await fetch('/api/landing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email, name, productSlug: 'jamb-playbook',
        couponCode: couponState && couponState.valid ? couponCode : null,
      }),
    });
    const data = await res.json();
    setPaying(false);
    if (!res.ok) { setCheckoutError(data.error || 'Something went wrong.'); return; }
    window.location.href = data.authorization_url;
  }

  const PriceCta = ({ className = '' }) => (
    <div className={className}>
      {couponState && couponState.valid && (
        <div className="coupon-applied mono">Code applied — <s>{naira(basePrice)}</s> {naira(price)}</div>
      )}
      <button className="btn btn-primary" onClick={() => setCheckoutOpen(true)}>
        Get Instant Access — {naira(price)}
      </button>
      <span className="btn-price mono">98% off · first 100 students only</span>
      <span className="money-back-tag">✓ Score 300+ or every kobo back</span>
    </div>
  );

  return (
    <>
      <div className="grain" />
      <div className="bg-glow" />

      <header className="topbar">
        <div className="brand"><span className="mark">SB</span> Shiney Brain Academy</div>
        <a href="#final" className="top-cta">{naira(price)} →</a>
      </header>

      {/* ================= HERO ================= */}
      <div className="hero-pin-wrap" ref={heroPinRef}>
        <div className="stage">
          <div className="card-field" ref={fieldRef}>
            {HERO_CARDS.map((s, idx) => (
              <div className="fcard" key={idx}>
                <div className="fcard-inner">
                  <span className="ico">{s.i}</span>
                  <div><div className="tag">{s.tag}</div><div className="lbl">{s.lbl}</div></div>
                </div>
              </div>
            ))}
          </div>

          <div className="stage-text">
            <div className="stage-kicker siren">🚨 JAMB 300+ OR YOUR MONEY BACK 🚨</div>
            <h1>Score <span className="hi">300+</span> in 30 Days<br />— Without Reading Every Page</h1>
            <p className="stage-sub">The complete AI-powered study system that turns you into a JAMB machine. One core playbook, twelve bonuses, one price.</p>
            <div className="stage-cta"><PriceCta /></div>
          </div>

          <div className="stage-caption" ref={captionRef}>One system. <b>Thirteen tools inside.</b> Scroll to see it assemble.</div>
          <div className="scroll-hint" ref={hintRef}><span>Scroll</span><span className="chevron"></span></div>
        </div>
      </div>

      {/* ================= CORE CHECKLIST ================= */}
      <section className="core">
        <div className="wrap">
          <div className="core-head">
            <div className="eyebrow">The 100/100 AI Playbook for JAMB Students</div>
            <h2>The core system that shows you exactly how to study smarter.</h2>
            <div className="core-value">Standalone value: ₦20,000</div>
          </div>
          <div className="check-grid">
            {CHECKLIST.map(([h, p], idx) => <CheckItem key={idx} h={h} p={p} />)}
          </div>
        </div>
      </section>

      {/* ================= PROOF ================= */}
      <section className="proof">
        <div className="wrap">
          <div className="core-head">
            <div className="eyebrow">Real students, real screenshots</div>
            <h2 style={{ fontSize: 'clamp(24px,3.6vw,34px)' }}>This isn't a promise. It's what students are already doing, this month.</h2>
          </div>
          <div className="proof-grid">
            {[0, 1, 2].map(idx => {
              const shot = slotShots.find(s => s.sort_order === idx);
              const busy = uploadingSlot === idx;
              return (
                <div className="phone" key={idx} style={{ position: 'relative' }}>
                  <div className="phone-bar" />
                  {shot ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={shot.image_url} alt={shot.result_label || shot.student_name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 14 }} />
                  ) : (
                    <div className="phone-dash">
                      <span className="ico">{['📈', '🎓', '🗓️'][idx]}</span>
                      <span className="cap">{['Mock score\nprogression', "312 in JAMB —\nthe founder's own result", 'Before / after\nstudy plan'][idx]}</span>
                    </div>
                  )}

                  {isAdmin && (
                    <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 8 }}>
                      <input
                        ref={slotFileRefs[idx]}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        style={{ display: 'none' }}
                        onChange={e => handleSlotFile(idx, e.target.files?.[0])}
                      />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => slotFileRefs[idx].current?.click()}
                        style={{
                          fontSize: 12, padding: '5px 10px', borderRadius: 999,
                          background: 'rgba(0,0,0,0.75)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)',
                          cursor: busy ? 'default' : 'pointer',
                        }}
                      >
                        {busy ? '…' : shot ? '+ Replace' : '+ Add'}
                      </button>
                      {shot && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleSlotRemove(idx)}
                          style={{
                            fontSize: 12, padding: '5px 10px', borderRadius: 999,
                            background: 'rgba(0,0,0,0.75)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)',
                            cursor: busy ? 'default' : 'pointer',
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {slotShots.length === 0 && !isAdmin && (
            <p className="proof-note">Screenshot space reserved for real results — added from the admin panel as they come in.</p>
          )}
        </div>
      </section>

      {quotes.length > 0 && (
        <section className="proof" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="bonus-grid">
              {quotes.map(q => (
                <div className="bonus-card" key={q.id}>
                  <div className="bonus-top"><span className="ico">💬</span></div>
                  <h3>{q.student_name}{q.result_label ? ` · ${q.result_label}` : ''}</h3>
                  <p>{q.quote}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ================= BONUSES ================= */}
      <section className="bonuses">
        <div className="wrap">
          <div className="bonuses-head">
            <div className="eyebrow">But that's not all</div>
            <h2>You also get these massive bonuses.</h2>
          </div>
          <div className="bonus-grid">
            {BONUSES.map((b, idx) => (
              <div className={`bonus-card${b.featured ? ' featured' : ''}`} key={idx}>
                <div className="bonus-top"><span className="ico">{b.i}</span><span className="bonus-value">{b.v}</span></div>
                <h3>{b.h}</h3>
                <p>{b.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= VALUE / RECEIPT ================= */}
      <section className="value">
        <div className="wrap value-inner">
          <div className="value-copy">
            <div className="eyebrow">What this is actually worth</div>
            <h2>Everything above, priced out — then cut down to one number.</h2>
            <p>This price holds for the first 100 students while we're still early and collecting results. After that, it goes back up.</p>
          </div>
          <div className="receipt">
            <div className="receipt-row"><span>100/100 AI Playbook (core system)</span><span>₦20,000</span></div>
            <div className="receipt-row"><span>Google AI Pro — 18 months</span><span>₦200,000</span></div>
            <div className="receipt-row"><span>Past Question Vault (1980–2026)</span><span>₦50,000</span></div>
            <div className="receipt-row"><span>Personal JAMB AI Tutor</span><span>₦50,000</span></div>
            <div className="receipt-row"><span>9 more bonuses</span><span>₦285,000</span></div>
            <div className="receipt-total"><span>Total value</span><span className="num">₦605,000+</span></div>
            <div className="price-stamp">
              <div className="today">Your price today</div>
              <div className="off mono">98% OFF</div><br />
              <div className="amount" ref={stampRef}>{naira(price)}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= GUARANTEE ================= */}
      <section className="guarantee">
        <div className="wrap g-wrap">
          <div className="seal">SCORE 300+<br />OR YOUR<br />MONEY BACK</div>
          <div className="g-copy">
            <h2>Score 300+ in 30 days. Or your money back.</h2>
            <p>No questions. No hassles. Follow the system, do the work, and if you don't hit 300+ in 30 days — message me for a full refund. You keep everything.</p>
          </div>
        </div>
      </section>

      {/* ================= CATCH ================= */}
      <section className="catch">
        <div className="wrap">
          <div className="catch-badge">⚠️ Limited spots</div>
          <h2>First 100 students only.</h2>
          <p>After that, the price goes to ₦50,000. This isn't a countdown gimmick — once 100 students are in, the price changes for real.</p>
        </div>
      </section>

      {/* ================= FAQ ================= */}
      <section className="faq">
        <div className="wrap">
          <div className="eyebrow">Questions</div>
          <h2 style={{ fontSize: 'clamp(24px,3.6vw,32px)' }}>Frequently asked</h2>
          <div className="faq-list">
            {FAQS.map(([q, a], idx) => (
              <div className={`faq-item${openFaq === idx ? ' open' : ''}`} key={idx}>
                <button className="faq-q" onClick={() => setOpenFaq(openFaq === idx ? -1 : idx)}>
                  <span>{q}</span><span className="plus">+</span>
                </button>
                <div className="faq-a" style={{ maxHeight: openFaq === idx ? 200 : 0 }}>
                  <div className="faq-a-inner">{a}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= FINAL ================= */}
      <section className="final" id="final" ref={finalRef}>
        <div className="wrap">
          <div className="eyebrow" style={{ justifyContent: 'center' }}>Stop struggling. Start scoring.</div>
          <h2>The Ultimate JAMB Domination System</h2>

          <div className="coupon-row">
            <input
              className="coupon-input mono"
              placeholder="Have a coupon code?"
              value={couponCode}
              onChange={e => { setCouponCode(e.target.value); setCouponState(null); }}
            />
            <button className="btn btn-ghost" onClick={applyCoupon} disabled={checkingCoupon}>
              {checkingCoupon ? 'Checking…' : 'Apply'}
            </button>
          </div>
          {couponState && !couponState.valid && (
            <div className="coupon-error mono">That code isn't valid or has expired.</div>
          )}

          <PriceCta className="final-cta" />
          <div className="final-tag">First 100 students only</div>

          <div className="ps-block">
            <p><b>P.S.</b> — Google AI Pro alone is worth ₦200,000+. You get 18 months. The past question vault alone is worth ₦50,000+. Everything else is included. All for {naira(price)}.</p>
            <p><b>P.P.S.</b> — If you don't score 300+ in 30 days, every kobo back. No questions asked. You keep everything.</p>
            <p><b>P.P.P.S.</b> — After 100 students, the price goes to ₦50,000. Don't wait.</p>
          </div>
        </div>
      </section>

      <footer>
        <div className="fbrand">Shiney Brain Academy</div>
        shineybrainacademy.vercel.app · Created by Mentor Florryshine
      </footer>

      <div className="sticky-cta" ref={stickyRef}>
        <div className="info">JAMB 300+ System<br /><b>{naira(price)}</b> · first 100 only</div>
        <button className="btn btn-primary" onClick={() => setCheckoutOpen(true)}>Get it now</button>
      </div>

      {checkoutOpen && (
        <div className="checkout-modal" role="dialog" aria-modal="true">
          <div className="checkout-card">
            <button className="checkout-close" onClick={() => setCheckoutOpen(false)} aria-label="Close">×</button>
            <h3>Almost there</h3>
            <p className="muted" style={{ fontSize: 14 }}>
              {couponState && couponState.valid
                ? <>Paying <b>{naira(price)}</b> with code <b>{couponCode.toUpperCase()}</b>.</>
                : <>Paying <b>{naira(price)}</b>.</>}
            </p>
            <form onSubmit={startCheckout} style={{ display: 'grid', gap: 10 }}>
              <input placeholder="Full name" value={name} onChange={e => setName(e.target.value)} />
              <input placeholder="Email" type="email" required value={email} onChange={e => setEmail(e.target.value)} />
              <button className="btn btn-primary" type="submit" disabled={paying}>
                {paying ? 'Redirecting…' : `Pay ${naira(price)} with Paystack`}
              </button>
              {checkoutError && <div className="coupon-error mono">{checkoutError}</div>}
            </form>
          </div>
        </div>
      )}

      <style jsx global>{`${LANDING_CSS}`}</style>
    </>
  );
}

function CheckItem({ h, p }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !('IntersectionObserver' in window)) { ref.current?.classList.add('in'); return; }
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.2 });
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  return (
    <div className="check-item" ref={ref}>
      <span className="tick">✅</span>
      <span><b>{h}</b> — {p}</span>
    </div>
  );
}

const LANDING_CSS = `
:root{--ink:#080C18;--ink-2:#0F1730;--ink-3:#16204A;--ink-4:#1C2A5C;--green:#39E39A;--green-dim:#1F6E52;--amber:#FFC24B;--amber-2:#FF9B3D;--red:#FF5B5B;--cream:#F6F0E3;--text:#EAEEFC;--muted:#8E9BC4;--muted-2:#5D6890;--line:rgba(234,238,252,0.10);--line-strong:rgba(234,238,252,0.18);--shadow:0 30px 80px -30px rgba(0,0,0,0.6);--radius:18px;}
*{box-sizing:border-box;}
html{scroll-behavior:smooth;}
body{margin:0;background:var(--ink);color:var(--text);font-family:'Inter',system-ui,sans-serif;-webkit-font-smoothing:antialiased;overflow-x:hidden;}
h1,h2,h3{font-family:'Space Grotesk',system-ui,sans-serif;font-weight:700;letter-spacing:-0.02em;margin:0;}
.mono{font-family:'IBM Plex Mono',monospace;}
.wrap{max-width:1080px;margin:0 auto;padding:0 24px;}
.eyebrow{font-family:'IBM Plex Mono',monospace;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--green);display:flex;align-items:center;gap:10px;margin-bottom:18px;}
.eyebrow::before{content:"";width:22px;height:1px;background:var(--green);display:inline-block;}
.muted{color:var(--muted);}
section{position:relative;}
.grain{position:fixed;inset:0;pointer-events:none;z-index:0;opacity:.5;background-image:radial-gradient(rgba(255,255,255,.035) 1px,transparent 1px);background-size:3px 3px;}
.bg-glow{position:fixed;top:-20%;left:50%;transform:translateX(-50%);width:900px;height:900px;border-radius:50%;background:radial-gradient(circle,rgba(57,227,154,.10),transparent 60%);pointer-events:none;z-index:0;}
.topbar{position:fixed;top:0;left:0;right:0;z-index:50;display:flex;align-items:center;justify-content:space-between;padding:16px 24px;background:linear-gradient(to bottom,rgba(8,12,24,.9),rgba(8,12,24,0));backdrop-filter:blur(6px);}
.brand{display:flex;align-items:center;gap:10px;font-family:'Space Grotesk';font-weight:700;font-size:15px;}
.brand .mark{width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,var(--green),var(--amber));display:flex;align-items:center;justify-content:center;color:#0A0F1F;font-size:14px;font-weight:800;transform:rotate(-6deg);}
.top-cta{font-family:'IBM Plex Mono';font-size:12px;font-weight:600;padding:9px 16px;border-radius:100px;background:var(--amber);color:#221400;text-decoration:none;white-space:nowrap;}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;font-family:'Space Grotesk';font-weight:700;font-size:16px;padding:18px 30px;border-radius:14px;text-decoration:none;cursor:pointer;border:none;transition:transform .18s ease,box-shadow .18s ease;}
.btn-primary{background:linear-gradient(135deg,var(--amber),var(--amber-2));color:#241400;box-shadow:0 16px 40px -12px rgba(255,178,39,.55);}
.btn-primary:hover{transform:translateY(-3px) scale(1.02);}
.btn-price{font-family:'IBM Plex Mono';font-size:14px;opacity:.85;}
.btn-ghost{background:transparent;border:1px solid var(--line-strong);color:var(--text);padding:14px 22px;font-size:14px;}
.coupon-applied{color:var(--green);font-size:12px;margin-bottom:8px;}
.money-back-tag{font-family:'IBM Plex Mono';font-size:11px;color:var(--green);letter-spacing:.06em;display:block;margin-top:4px;}
.hero-pin-wrap{height:230vh;position:relative;}
.stage{position:sticky;top:0;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;perspective:1400px;}
.stage-text{position:relative;z-index:5;text-align:center;max-width:780px;padding:0 20px;margin-top:-30px;}
.stage-kicker{font-family:'IBM Plex Mono';font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--red);margin-bottom:14px;}
.stage-text h1{font-size:clamp(28px,5.6vw,54px);line-height:1.06;}
.stage-text h1 .hi{color:var(--amber);}
.stage-sub{margin:20px auto 0;max-width:560px;color:var(--muted);font-size:16px;line-height:1.6;}
.stage-cta{margin-top:28px;display:flex;flex-direction:column;align-items:center;gap:8px;}
.scroll-hint{position:absolute;bottom:34px;left:50%;transform:translateX(-50%);font-family:'IBM Plex Mono';font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted-2);display:flex;flex-direction:column;align-items:center;gap:8px;transition:opacity .3s ease;}
.scroll-hint .chevron{width:14px;height:14px;border-right:2px solid var(--muted-2);border-bottom:2px solid var(--muted-2);transform:rotate(45deg);animation:bob 1.6s ease-in-out infinite;}
@keyframes bob{0%,100%{transform:rotate(45deg) translate(0,0);}50%{transform:rotate(45deg) translate(4px,4px);}}
.card-field{position:absolute;inset:0;transform-style:preserve-3d;}
.fcard{position:absolute;top:50%;left:50%;width:150px;height:190px;margin:-95px 0 0 -75px;border-radius:16px;transform-style:preserve-3d;will-change:transform;}
.fcard-inner{width:100%;height:100%;border-radius:16px;background:linear-gradient(160deg,var(--ink-3),var(--ink-2));border:1px solid var(--line-strong);box-shadow:var(--shadow);display:flex;flex-direction:column;justify-content:space-between;padding:16px;animation:floaty 5s ease-in-out infinite;}
@keyframes floaty{0%,100%{transform:translateY(0);}50%{transform:translateY(-9px);}}
.fcard .ico{font-size:26px;}
.fcard .lbl{font-family:'Space Grotesk';font-weight:700;font-size:13px;line-height:1.25;color:var(--text);}
.fcard .tag{font-family:'IBM Plex Mono';font-size:9px;color:var(--green);text-transform:uppercase;letter-spacing:.08em;}
.stage-caption{position:absolute;bottom:56px;left:0;right:0;text-align:center;z-index:4;font-family:'IBM Plex Mono';font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted-2);opacity:0;transition:opacity .4s ease;}
.stage-caption.show{opacity:1;}
.stage-caption b{color:var(--green);}
.core{padding:120px 0 100px;border-top:1px solid var(--line);}
.core-head h2{font-size:clamp(26px,4vw,38px);max-width:640px;}
.core-value{margin-top:14px;font-family:'IBM Plex Mono';font-size:13px;color:var(--muted-2);}
.check-grid{margin-top:44px;display:grid;grid-template-columns:1fr 1fr;gap:14px 32px;}
.check-item{display:flex;gap:12px;align-items:flex-start;padding:14px 0;border-bottom:1px solid var(--line);opacity:0;transform:translateY(16px);transition:opacity .5s ease,transform .5s ease;}
.check-item.in{opacity:1;transform:translateY(0);}
.check-item .tick{color:var(--green);font-size:16px;flex:none;margin-top:1px;}
.check-item span:last-child{font-size:14.5px;line-height:1.55;color:var(--text);}
.proof{padding:110px 0;border-top:1px solid var(--line);}
.proof-grid{margin-top:50px;display:grid;grid-template-columns:repeat(3,1fr);gap:28px;perspective:1200px;}
.phone{aspect-ratio:9/17.5;border-radius:26px;background:linear-gradient(160deg,var(--ink-4),var(--ink-3));border:1px solid var(--line-strong);padding:16px 14px;display:flex;flex-direction:column;gap:10px;box-shadow:var(--shadow);overflow:hidden;}
.phone:nth-child(1){transform:rotate3d(0,1,0,10deg) rotate(-3deg);}
.phone:nth-child(3){transform:rotate3d(0,1,0,-10deg) rotate(3deg);}
.phone-dash{flex:1;border:1.5px dashed var(--line-strong);border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:var(--muted-2);text-align:center;padding:14px;white-space:pre-line;}
.phone-bar{height:5px;width:36%;background:var(--line-strong);border-radius:4px;margin:0 auto;}
.proof-note{margin-top:26px;text-align:center;color:var(--muted);font-size:14px;max-width:480px;margin-left:auto;margin-right:auto;}
.bonuses{padding:110px 0;background:var(--ink-2);border-top:1px solid var(--line);}
.bonuses-head h2{font-size:clamp(26px,4vw,38px);max-width:640px;}
.bonus-grid{margin-top:46px;display:grid;grid-template-columns:repeat(3,1fr);gap:16px;}
.bonus-card{background:linear-gradient(160deg,var(--ink-3),var(--ink-2));border:1px solid var(--line-strong);border-radius:16px;padding:22px 20px;display:flex;flex-direction:column;gap:10px;transition:transform .15s ease,border-color .15s ease;}
.bonus-card:hover{transform:translateY(-5px);border-color:rgba(255,194,75,.4);}
.bonus-card.featured{grid-column:span 3;background:linear-gradient(135deg,rgba(255,194,75,0.14),var(--ink-3));border-color:rgba(255,194,75,.5);}
.bonus-top{display:flex;align-items:center;justify-content:space-between;gap:10px;}
.bonus-card .ico{font-size:24px;}
.bonus-value{font-family:'IBM Plex Mono';font-size:11px;color:var(--amber);white-space:nowrap;}
.bonus-card h3{font-size:14.5px;line-height:1.3;}
.bonus-card p{font-size:12.5px;color:var(--muted);line-height:1.55;margin:0;}
.value{padding:120px 0;border-top:1px solid var(--line);}
.value-inner{display:grid;grid-template-columns:1.1fr .9fr;gap:60px;align-items:center;}
.value-copy h2{font-size:clamp(26px,4vw,36px);max-width:420px;}
.value-copy p{color:var(--muted);margin-top:18px;max-width:420px;line-height:1.7;}
.receipt{background:var(--cream);color:#241a08;border-radius:14px;padding:34px 30px;box-shadow:var(--shadow);transform:rotate(-1.4deg);font-family:'IBM Plex Mono';}
.receipt-row{display:flex;justify-content:space-between;align-items:baseline;padding:9px 0;border-bottom:1px dashed rgba(36,26,8,.2);font-size:12.5px;}
.receipt-total{display:flex;justify-content:space-between;align-items:baseline;padding-top:16px;margin-top:6px;font-weight:700;font-size:15px;}
.receipt-total .num{text-decoration:line-through;opacity:.55;}
.price-stamp{margin-top:22px;text-align:center;}
.price-stamp .today{font-family:'Space Grotesk';font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#6b5218;}
.price-stamp .off{display:inline-block;margin-top:2px;font-size:11px;background:#241a08;color:var(--cream);padding:2px 8px;border-radius:20px;}
.price-stamp .amount{font-family:'Space Grotesk';font-weight:700;font-size:44px;color:#241a08;display:inline-block;margin-top:8px;border:3px solid #241a08;border-radius:10px;padding:6px 22px;transform:rotate(-3deg) scale(.9);opacity:0;transition:transform .5s cubic-bezier(.2,1.4,.4,1),opacity .5s ease;}
.price-stamp .amount.in{transform:rotate(-3deg) scale(1);opacity:1;}
.guarantee{padding:100px 0;background:var(--ink-2);border-top:1px solid var(--line);}
.g-wrap{display:grid;grid-template-columns:auto 1fr;gap:40px;align-items:center;}
.seal{width:130px;height:130px;border-radius:50%;border:2px solid var(--green);display:flex;align-items:center;justify-content:center;text-align:center;font-family:'Space Grotesk';font-weight:700;font-size:14px;color:var(--green);line-height:1.3;flex:none;box-shadow:0 0 0 6px rgba(57,227,154,.08);}
.g-copy h2{font-size:clamp(22px,3.4vw,30px);margin-bottom:14px;}
.g-copy p{color:var(--muted);line-height:1.7;margin:0 0 10px;max-width:640px;}
.catch{padding:90px 0;border-top:1px solid var(--line);text-align:center;}
.catch-badge{display:inline-flex;align-items:center;gap:10px;padding:10px 20px;border-radius:100px;border:1px solid rgba(255,91,91,0.4);background:rgba(255,91,91,0.08);color:var(--red);font-family:'IBM Plex Mono';font-size:12.5px;margin-bottom:20px;}
.catch h2{font-size:clamp(24px,3.6vw,32px);max-width:560px;margin:0 auto 12px;}
.catch p{color:var(--muted);max-width:480px;margin:0 auto;line-height:1.6;font-size:14.5px;}
.faq{padding:110px 0;border-top:1px solid var(--line);}
.faq-list{margin-top:44px;max-width:760px;}
.faq-item{border-bottom:1px solid var(--line);}
.faq-q{width:100%;text-align:left;background:none;border:none;color:var(--text);font-family:'Space Grotesk';font-weight:600;font-size:16px;padding:22px 0;display:flex;justify-content:space-between;align-items:center;cursor:pointer;}
.faq-q .plus{font-family:'IBM Plex Mono';color:var(--green);font-size:18px;transition:transform .25s ease;}
.faq-item.open .plus{transform:rotate(45deg);}
.faq-a{max-height:0;overflow:hidden;transition:max-height .3s ease;color:var(--muted);font-size:14.5px;line-height:1.7;}
.faq-a-inner{padding-bottom:22px;}
.final{padding:130px 0 100px;text-align:center;background:radial-gradient(ellipse at 50% 0%,rgba(255,194,75,.10),transparent 60%),var(--ink-2);border-top:1px solid var(--line);}
.final h2{font-size:clamp(28px,5vw,44px);max-width:680px;margin:0 auto 18px;}
.final .final-tag{font-family:'IBM Plex Mono';font-size:12px;color:var(--red);letter-spacing:.08em;text-transform:uppercase;margin-top:14px;}
.final-cta{display:flex;flex-direction:column;align-items:center;gap:8px;margin-top:14px;}
.coupon-row{display:flex;gap:10px;justify-content:center;margin:0 auto 8px;max-width:360px;}
.coupon-input{flex:1;padding:14px 16px;border-radius:12px;border:1px solid var(--line-strong);background:var(--ink-3);color:var(--text);font-size:13px;}
.coupon-error{color:#ff8a8a;font-size:12px;margin-bottom:20px;}
.ps-block{max-width:560px;margin:56px auto 0;text-align:left;border-top:1px solid var(--line);padding-top:30px;}
.ps-block p{font-size:12.5px;color:var(--muted-2);line-height:1.7;margin:0 0 10px;}
.ps-block b{color:var(--muted);}
footer{padding:40px 24px 120px;text-align:center;color:var(--muted-2);font-size:13px;background:var(--ink-2);}
footer .fbrand{font-family:'Space Grotesk';font-weight:700;color:var(--muted);margin-bottom:4px;}
.sticky-cta{position:fixed;left:0;right:0;bottom:0;z-index:60;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 18px;background:rgba(15,23,48,.92);backdrop-filter:blur(10px);border-top:1px solid var(--line-strong);transform:translateY(120%);transition:transform .35s ease;}
.sticky-cta.show{transform:translateY(0);}
.sticky-cta .info{font-family:'IBM Plex Mono';font-size:12px;color:var(--muted);}
.sticky-cta .info b{color:var(--amber);font-size:14px;}
.sticky-cta .btn{padding:12px 20px;font-size:14px;}
.checkout-modal{position:fixed;inset:0;z-index:80;background:rgba(4,6,14,.7);display:flex;align-items:center;justify-content:center;padding:20px;}
.checkout-card{background:var(--ink-2);border:1px solid var(--line-strong);border-radius:16px;padding:28px;max-width:360px;width:100%;position:relative;}
.checkout-card h3{margin-bottom:6px;}
.checkout-card input{padding:12px 14px;border-radius:10px;border:1px solid var(--line-strong);background:var(--ink-3);color:var(--text);font-size:14px;}
.checkout-close{position:absolute;top:14px;right:16px;background:none;border:none;color:var(--muted);font-size:20px;cursor:pointer;}
::selection{background:var(--green);color:#06140D;}
@media (max-width:860px){.value-inner{grid-template-columns:1fr;gap:40px;}.bonus-grid{grid-template-columns:repeat(2,1fr);}.bonus-card.featured{grid-column:span 2;}.g-wrap{grid-template-columns:1fr;text-align:center;}.g-wrap .seal{margin:0 auto;}.check-grid{grid-template-columns:1fr;}}
@media (max-width:640px){.bonus-grid{grid-template-columns:1fr;}.bonus-card.featured{grid-column:span 1;}.proof-grid{grid-template-columns:1fr;max-width:220px;margin-left:auto;margin-right:auto;}.phone:nth-child(1),.phone:nth-child(3){transform:none;}.fcard{width:108px;height:140px;margin:-70px 0 0 -54px;padding:0;}.fcard-inner{padding:12px;}.receipt{transform:none;}}
@media (prefers-reduced-motion:reduce){.fcard,.fcard-inner,.price-stamp .amount,.check-item{animation:none!important;transition:none!important;}}
`;
