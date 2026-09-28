// The report after the opening: figure entrances, chart notes, the photographs, the live
// polythene count and the back-to-top button.
//
// Written for older phone browsers too (Safari 12+, Chrome 61+): no optional chaining, no ??,
// nothing that needs a build step.  Keep it that way when editing.

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// ------------------------------------------------------------------ figures enter once
// Figures start hidden only once this has run (reveal-on), so they can never stay invisible.
if ('IntersectionObserver' in window) {
  const revealer = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('is-in');
      revealer.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.15 });
  document.querySelectorAll('.reveal').forEach((el) => revealer.observe(el));
  document.documentElement.classList.add('reveal-on');
}

// ------------------------------------------------------------------ chart notes
// A bar pair or a bottle stack carries a short note ([data-tip]), as in the Flourish originals.
// A mouse shows it on hover, beside the pointer; a tap shows it where the finger lands, and a
// tap anywhere else, a scroll or Escape closes it.  One note serves the page.  It is fixed to
// the viewport and always kept inside it, so no chart edge or screen size can cut it off.
const tipTargets = [...document.querySelectorAll('[data-tip]')];
const tip = document.createElement('div');
tip.className = 'chart-tip';
tip.setAttribute('aria-hidden', 'true');
tip.innerHTML = '<p class="chart-tip__title"></p><p class="chart-tip__body"></p>';
const tipTitle = tip.firstChild;
const tipBody = tip.lastChild;
let tipFor = null;

function showTip(target, x, y) {
  if (tipFor !== target) {
    hideTip();
    tipFor = target;
    const group = target.parentElement;
    tip.classList.toggle('chart-tip--dark', group.dataset.tipStyle === 'dark');
    tipTitle.textContent = target.dataset.tipTitle || '';
    tipBody.textContent = target.dataset.tip;
    group.classList.add('has-tip');
    target.classList.add('is-tipped');
    tip.classList.add('is-on');
  }
  // Above the pointer when there is room, otherwise below it; never past a screen edge.
  const m = 8;
  const gap = 16;
  const w = tip.offsetWidth;
  const h = tip.offsetHeight;
  const vw = document.documentElement.clientWidth;
  const left = clamp(x - w / 2, m, Math.max(m, vw - w - m));
  let top = y - h - gap;
  if (top < m) top = y + gap;
  top = clamp(top, m, Math.max(m, innerHeight - h - m));
  tip.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
}

function hideTip() {
  if (!tipFor) return;
  tipFor.parentElement.classList.remove('has-tip');
  tipFor.classList.remove('is-tipped');
  tipFor = null;
  tip.classList.remove('is-on');
}

if (tipTargets.length) {
  document.body.append(tip);
  for (const target of tipTargets) {
    target.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') showTip(target, e.clientX, e.clientY); });
    target.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && tipFor === target) hideTip(); });
  }
  let lastPointer = 'mouse';
  document.addEventListener('pointerdown', (e) => { lastPointer = e.pointerType; }, { passive: true });
  document.addEventListener('click', (e) => {
    const target = e.target.closest ? e.target.closest('[data-tip]') : null;
    if (!target) { hideTip(); return; }
    if (lastPointer !== 'mouse' && tipFor === target) { hideTip(); return; }
    showTip(target, e.clientX, e.clientY);
  });
  addEventListener('scroll', hideTip, { passive: true });
  addEventListener('resize', hideTip);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideTip(); });
}

// ------------------------------------------------------------------ the live polythene count
// ESDO (2022): close to 1.4 million polythene bags are discarded after a single use in Dhaka
// every day.  Spread evenly over the day's 86,400 seconds, that is about 16 bags a second.
// The clock starts when the page is opened, so every visit starts again from zero.
//
//   band     reached for the first time: the number counts up to the total so far, then ticks.
//   dock     once the band has scrolled away, the count stays in the top-right corner.
//   ending   at the end of the report the corner counter comes down into the closing panel.
const BAGS_PER_SECOND = 1400000 / 86400;
const COUNT_UP_MS = 900;
const FLIGHT_MS = 850;
const fmt = new Intl.NumberFormat('en-GB');
const bagsAt = (ms) => Math.floor((ms / 1000) * BAGS_PER_SECOND);

const live = document.querySelector('[data-bag-live]');
const endNum = document.querySelector('[data-bag-end]');
const ending = document.getElementById('ending');
const elapsedEl = document.querySelector('[data-elapsed]');
const dock = document.querySelector('.bag-dock');
const dockNum = dock && dock.querySelector('[data-bag-dock]');
const story = document.getElementById('story');

const count = {
  started: false,       // the reader has reached the band
  countUpStart: 0,
  endShown: false,      // the closing number is showing
  endCountUpStart: 0,
  dockOn: false,
  flight: null,         // { start, home } while the corner counter flies down
  raf: 0,
  written: new Map(),
};

function write(el, text) {
  if (!el || count.written.get(el) === text) return;
  count.written.set(el, text);
  el.textContent = text;
}

function elapsedText(ms) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  const sec = `${s} second${s === 1 ? '' : 's'}`;
  if (!m) return sec;
  const min = `${m} minute${m === 1 ? '' : 's'}`;
  return s ? `${min} and ${sec}` : min;
}

function shown(value, start, now) {
  if (!start || reduceMotion.matches) return value;
  const k = clamp((now - start) / COUNT_UP_MS);
  return k >= 1 ? value : Math.round(value * easeOut(k));
}

function inView(el, top = 0, bottom = innerHeight) {
  const r = el.getBoundingClientRect();
  return r.bottom > top && r.top < bottom;
}

function setDock(on) {
  if (on === count.dockOn) return;
  count.dockOn = on;
  dock.classList.toggle('is-on', on);
}

function frame(now) {
  count.raf = 0;
  // The story is below the long intro. Avoid forcing layout of its offscreen content.
  if (story.getBoundingClientRect().top >= innerHeight) {
    // Back up in the opening mid-flight: the counter must not be left hanging over it.
    if (count.flight) land(now);
    setDock(false);
    return;
  }
  const value = bagsAt(now);
  const vh = innerHeight;

  // Reading the page: which parts of the count are on screen.
  const bandVisible = live && inView(live);
  if (!count.started && live && inView(live, 0, vh * 0.8)) {
    count.started = true;
    count.countUpStart = now;
  }
  const inStory = story.getBoundingClientRect().top < 0;
  const endRect = endNum.getBoundingClientRect();
  const endArrived = endRect.top < vh * 0.72;
  const endVisible = endRect.bottom > 0 && endRect.top < vh;

  // The corner counter comes down into the closing panel, the first time the reader gets there.
  // Coming back later, it simply steps aside: the closing number is already showing.
  if (endArrived && !count.flight) {
    if (!count.endShown && count.dockOn && !reduceMotion.matches) {
      dock.classList.add('is-flying');   // no transitions from here on
      count.flight = { start: now, home: restingRect() };
    } else {
      if (!count.endShown) showEnd(now, !count.dockOn);
      setDock(false);
    }
  }
  if (count.flight) fly(now, endRect);
  if (!endArrived && !count.flight) {
    // Scrolling back up: the ending keeps its number, the corner counter returns.
    setDock(count.started && inStory && !bandVisible);
  }

  write(live, fmt.format(count.started ? shown(value, count.countUpStart, now) : 0));
  if (count.dockOn || count.flight) write(dockNum, fmt.format(value));
  if (count.endShown || endVisible) {
    write(endNum, fmt.format(shown(value, count.endCountUpStart, now)));
    write(elapsedEl, elapsedText(now));
  }

  const busy = bandVisible || count.dockOn || count.flight || endVisible;
  if (busy) count.raf = requestAnimationFrame(frame);
}

function showEnd(now, countUp) {
  count.endShown = true;
  count.endCountUpStart = countUp ? now : 0;
  ending.classList.remove('is-waiting');
}

// The dock's place in its corner, measured without the flight's transform.  Only called while
// the dock is flying, when it has no transitions, so the measurement starts none.
function restingRect() {
  const t = dock.style.transform;
  dock.style.transform = 'none';
  const r = dock.getBoundingClientRect();
  dock.style.transform = t;
  return r;
}

function fly(now, endRect) {
  // A resize (a phone's address bar sliding away as the reader flicks down) can move the
  // corner: measure it again rather than fly from where it used to be.
  if (!count.flight.home) count.flight.home = restingRect();
  const home = count.flight.home;
  const k = clamp((now - count.flight.start) / FLIGHT_MS);
  const e = easeInOut(k);
  // Centre to centre, following the number even if the page keeps scrolling.
  const dx = (endRect.left + endRect.width / 2) - (home.left + home.width / 2);
  const dy = (endRect.top + endRect.height / 2) - (home.top + home.height / 2);
  const scale = 1 + 0.5 * e;
  dock.style.transform = `translate3d(${(dx * e).toFixed(1)}px, ${(dy * e).toFixed(1)}px, 0) scale(${scale.toFixed(3)})`;
  dock.style.opacity = String(1 - clamp((k - 0.62) / 0.3));
  if (k > 0.55 && !count.endShown) showEnd(now, false);
  if (k >= 1) land(now);
}

// The flight is over: the big number takes over and the counter goes back to its corner, hidden.
function land(now) {
  if (!count.endShown) showEnd(now, false);
  count.flight = null;
  count.dockOn = false;
  dock.classList.remove('is-on');
  // Let it rest invisibly in its corner again before transitions come back on.
  dock.style.transform = '';
  dock.style.opacity = '';
  requestAnimationFrame(() => dock.classList.remove('is-flying'));
}

function wake() {
  if (!count.raf) count.raf = requestAnimationFrame(frame);
}

if (live && endNum && ending && dock && story) {
  ending.classList.add('is-waiting');
  addEventListener('scroll', wake, { passive: true });
  addEventListener('resize', () => {
    if (count.flight) count.flight.home = null;
    wake();
  });
  document.addEventListener('visibilitychange', wake);
  wake();
}
// ------------------------------------------------------------------ the report, laid out early
// The browser skips the report until it comes near the screen (content-visibility in
// report.css), which keeps the first paint quick.  Laying it out the first time is one long
// frame, mostly shaping its text, and left to itself that frame lands just as the opening ends
// and the title scrolls in, or as a reader drags straight to the bottom.  So it is done ahead
// of time, the first time the reader pauses in the opening once the animation is running, and
// the report is then skipped again: the finished layout is kept for when the reader gets there.
const reportBody = document.querySelector('.report-body');
const heroEl = document.getElementById('hero');
const PAUSE_MS = 800;
const supportsSkipping = !!(window.CSS && CSS.supports && CSS.supports('content-visibility', 'auto'));
if (reportBody && heroEl && supportsSkipping) {
  let lastInput = 0;
  let touching = false;
  const note = () => { lastInput = performance.now(); };
  for (const type of ['scroll', 'wheel', 'keydown', 'pointerdown', 'touchmove']) {
    addEventListener(type, note, { passive: true, capture: true });
  }
  addEventListener('touchstart', () => { touching = true; note(); }, { passive: true, capture: true });
  for (const type of ['touchend', 'touchcancel']) {
    addEventListener(type, () => { touching = false; note(); }, { passive: true, capture: true });
  }
  const idle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 1000 }) : setTimeout(fn, 50));
  let since = 0;
  const layOut = () => {
    if (!since) since = performance.now();
    // Let the opening's animation get going first (or give up waiting for it after a while).
    const heroBusy = !heroEl.classList.contains('is-live') && performance.now() - since < 6000;
    const wait = PAUSE_MS - (performance.now() - lastInput);
    if (heroBusy || touching || wait > 0) { setTimeout(layOut, Math.max(wait, 200)); return; }
    idle(() => {
      if (touching || performance.now() - lastInput < PAUSE_MS) { setTimeout(layOut, 200); return; }
      reportBody.style.contentVisibility = 'visible';
      void reportBody.offsetHeight;      // style and layout, now, while nothing moves
      requestAnimationFrame(() => { reportBody.style.contentVisibility = ''; });
    });
  };
  const begin = () => {
    const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    fonts.then(() => setTimeout(layOut, 500));
  };
  if (document.readyState === 'complete') begin();
  else addEventListener('load', begin, { once: true });
}

// ------------------------------------------------------------------ back to top
// Checked at most once a frame, and the button is only touched when it has to change.
const backToTop = document.querySelector('.back-to-top');
let backToTopRaf = 0;
function updateBackToTop() {
  backToTopRaf = 0;
  const hide = story.getBoundingClientRect().top >= innerHeight;
  if (backToTop.hidden !== hide) backToTop.hidden = hide;
}
function queueBackToTop() {
  if (!backToTopRaf) backToTopRaf = requestAnimationFrame(updateBackToTop);
}
if (backToTop && story) {
  addEventListener('scroll', queueBackToTop, { passive: true });
  addEventListener('resize', queueBackToTop);
  updateBackToTop();
  backToTop.addEventListener('click', (event) => {
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    queueBackToTop();
    const firstLink = document.querySelector('.brand');
    if (firstLink) firstLink.focus({ preventScroll: true });
  });
}

// ------------------------------------------------------------------ photographs
// The browser scrolls the row itself (scroll snap), so a swipe is as smooth as the page.  This
// adds the dots and the autoplay, and fetches each photograph just before it is needed: the
// first two once the row comes near the screen, then always the next one.
//
// Autoplay: a new photograph every 2 seconds while the row is on screen.  Any interaction (a
// swipe, a dot, the arrow keys, the mouse moving over the photographs) pauses it, and it resumes
// 5 seconds after the last one.  Keyboard focus inside the row holds it until focus leaves.  It
// stays off while the tab is hidden and for readers whose system asks for reduced motion.
const AUTOPLAY_MS = 2000;
const RESUME_MS = 5000;
const focusVisible = (el) => {
  try { return el.matches(':focus-visible'); } catch (e) { return false; }
};

for (const carousel of document.querySelectorAll('[data-carousel]')) {
  const track = carousel.querySelector('.carousel-track');
  const slides = Array.prototype.slice.call(track.children);
  const controls = carousel.querySelector('.carousel-controls');
  const dots = Array.prototype.slice.call(carousel.querySelectorAll('[data-carousel-dot]'));
  let current = 0;
  let near = false;        // close enough to the screen to start fetching photographs
  let onScreen = false;    // visible enough for autoplay
  let focused = false;
  let lastMove = 0;
  let ticking = 0;
  let timer = 0;

  const warm = (i) => {
    const img = slides[i] && slides[i].querySelector('img');
    if (img && img.getAttribute('loading') === 'lazy') img.setAttribute('loading', 'eager');
  };
  // Distance from one slide to the next, read from the layout so gaps and widths never matter.
  const step = () => (slides.length > 1 ? slides[1].offsetLeft - slides[0].offsetLeft : track.clientWidth) || 1;
  const show = (i) => {
    current = i;
    dots.forEach((dot, k) => {
      if (k === i) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
    if (near) { warm(i); warm(i + 1); }
  };
  const go = (i) => {
    const left = clamp(i, 0, slides.length - 1) * step();
    if (track.scrollTo) track.scrollTo({ left, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    else track.scrollLeft = left;
  };

  // Autoplay.
  const canPlay = () => onScreen && !focused && !document.hidden && !reduceMotion.matches;
  const schedule = (delay) => {
    clearTimeout(timer);
    timer = canPlay() ? setTimeout(advance, delay) : 0;
  };
  function advance() {
    go((current + 1) % slides.length);   // after the last photograph, back to the first
    schedule(AUTOPLAY_MS);
  }
  const interacted = () => schedule(RESUME_MS);

  track.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = requestAnimationFrame(() => {
      ticking = 0;
      const i = clamp(Math.round(track.scrollLeft / step()), 0, slides.length - 1);
      if (i !== current) show(i);
    });
  }, { passive: true });
  // A reader's own hand on the row: touch, pen, mouse button, or a sideways trackpad swipe
  // (the page scrolling past under a mouse wheel does not count).
  for (const type of ['pointerdown', 'touchstart']) {
    track.addEventListener(type, interacted, { passive: true });
  }
  track.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) interacted();
  }, { passive: true });
  dots.forEach((dot, k) => dot.addEventListener('click', () => { go(k); interacted(); }));
  // Arrow keys step exactly one photograph when the row has focus.
  track.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    go(current + (e.key === 'ArrowRight' ? 1 : -1));
    interacted();
  });
  // The mouse moving over the photographs counts too (checked a few times a second at most);
  // a mouse left resting on them does not hold autoplay beyond the 5 seconds.  Safari reports
  // a "move" whenever a photograph slides under a still cursor, so only a changed position counts.
  let lastX = -1;
  let lastY = -1;
  carousel.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const moved = Math.abs(e.screenX - lastX) + Math.abs(e.screenY - lastY) > 2;
    lastX = e.screenX;
    lastY = e.screenY;
    if (!moved || e.timeStamp - lastMove < 250) return;
    lastMove = e.timeStamp;
    interacted();
  }, { passive: true });
  // So does keyboard focus; focus left behind by a click or tap does not.
  carousel.addEventListener('focusin', (e) => {
    focused = focusVisible(e.target);
    if (focused) schedule(0);
  });
  carousel.addEventListener('focusout', (e) => {
    if (e.relatedTarget && carousel.contains(e.relatedTarget)) return;
    if (!focused) return;
    focused = false;
    interacted();
  });
  document.addEventListener('visibilitychange', () => schedule(AUTOPLAY_MS));
  if (reduceMotion.addEventListener) reduceMotion.addEventListener('change', () => schedule(AUTOPLAY_MS));

  const wakeUp = () => { near = true; warm(current); warm(current + 1); };
  if ('IntersectionObserver' in window) {
    const nearby = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      nearby.disconnect();
      wakeUp();
    }, { rootMargin: '600px 0px' });
    nearby.observe(carousel);
    // Autoplay only while most of the photograph is on screen.
    const visible = new IntersectionObserver((entries) => {
      const e = entries[entries.length - 1];
      const was = onScreen;
      onScreen = e.isIntersecting && e.intersectionRatio >= 0.5;
      if (onScreen !== was) schedule(AUTOPLAY_MS);
    }, { threshold: [0, 0.5, 0.75] });
    visible.observe(track);
  } else {
    wakeUp();
  }
  controls.hidden = false;
  show(0);
}
