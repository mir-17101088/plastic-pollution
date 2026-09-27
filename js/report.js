// Share URLs are constructed locally. Nothing is sent until a reader opens a link.
const shareUrl = new URL(location.href);
shareUrl.hash = '';
shareUrl.search = '';
const reportTitle = 'A city changes. Plastic remains. | The Daily Star';
const url = shareUrl.href;
const destinations = {
  facebook: ['https://www.facebook.com/sharer/sharer.php', { u: url }],
  x: ['https://twitter.com/intent/tweet', { url, text: reportTitle }],
  whatsapp: ['https://api.whatsapp.com/send', { text: `${reportTitle} ${url}` }],
  linkedin: ['https://www.linkedin.com/sharing/share-offsite/', { url }],
};
for (const anchor of document.querySelectorAll('[data-share]')) {
  const [base, params] = destinations[anchor.dataset.share];
  anchor.href = `${base}?${new URLSearchParams(params)}`;
}

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// ------------------------------------------------------------------ figures enter once
const revealer = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    e.target.classList.add('is-in');
    revealer.unobserve(e.target);
  }
}, { rootMargin: '0px 0px -12% 0px', threshold: 0.15 });
document.querySelectorAll('.reveal').forEach((el) => revealer.observe(el));

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
  flight: null,         // { start } while the corner counter flies down
  home: null,           // the dock's resting rectangle
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
  if (on) count.home = null;
}

function frame(now) {
  count.raf = 0;
  // The story is below the long intro. Avoid forcing layout of its offscreen content.
  if (story.getBoundingClientRect().top >= innerHeight) {
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
      count.home = count.home || dock.getBoundingClientRect();
      count.flight = { start: now };
      dock.classList.add('is-flying');
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

function fly(now, endRect) {
  const home = count.home;
  const k = clamp((now - count.flight.start) / FLIGHT_MS);
  const e = easeInOut(k);
  // Centre to centre, following the number even if the page keeps scrolling.
  const dx = (endRect.left + endRect.width / 2) - (home.left + home.width / 2);
  const dy = (endRect.top + endRect.height / 2) - (home.top + home.height / 2);
  const scale = 1 + 0.5 * e;
  dock.style.transform = `translate3d(${(dx * e).toFixed(1)}px, ${(dy * e).toFixed(1)}px, 0) scale(${scale.toFixed(3)})`;
  dock.style.opacity = String(1 - clamp((k - 0.62) / 0.3));
  if (k > 0.55 && !count.endShown) showEnd(now, false);
  if (k >= 1) {
    count.flight = null;
    count.dockOn = false;
    dock.classList.remove('is-on');
    // Let it rest invisibly in its corner again before transitions come back on.
    dock.style.transform = '';
    dock.style.opacity = '';
    requestAnimationFrame(() => dock.classList.remove('is-flying'));
  }
}

function wake() {
  if (!count.raf) count.raf = requestAnimationFrame(frame);
}

if (live && endNum && ending && dock && story) {
  ending.classList.add('is-waiting');
  addEventListener('scroll', wake, { passive: true });
  addEventListener('resize', () => { count.home = null; wake(); });
  document.addEventListener('visibilitychange', wake);
  wake();
}
const backToTop = document.querySelector('.back-to-top');
function updateBackToTop() {
  if (backToTop) backToTop.hidden = story.getBoundingClientRect().top >= innerHeight;
}
addEventListener('scroll', updateBackToTop, { passive: true });
addEventListener('resize', updateBackToTop);
updateBackToTop();
backToTop?.addEventListener('click', (event) => {
  event.preventDefault();
  window.scrollTo({ top: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
  updateBackToTop();
  const firstLink = document.querySelector('.brand');
  firstLink?.focus({ preventScroll: true });
});
