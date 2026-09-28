/*
 * The Buriganga, 1610 to today, seen from one fixed camera.
 *
 * Everything is drawn in DESIGN units: the present-day photograph scaled to 1600 px wide.
 * The historical plates were reconstructed from that photograph, so the camera never moves.
 *
 *   base      plates (1610, 1850, 1980) cross-dissolve; the photograph is then revealed
 *             region by region and piece by piece of litter (assets/hero/stage.webp).
 *   berth     boats move along one vertical plane, the launch's side, so every vessel shares
 *             the photograph's perspective and waterline.  The last one is the real launch,
 *             which docks exactly where it is moored in the photograph.
 *   bag       a thin polythene sheet falls, flutters and settles; on landing it becomes the
 *             real bag lying in the photograph, and never moves again.
 *
 * Scroll drives everything; nothing plays on a clock.  Frames are drawn only when needed.
 *
 * Old and slow phones: the code avoids syntax newer than 2017 (no ?. or ??) so older browsers
 * can run it, never reads the layout while scrolling, lowers its own resolution if frames
 * come too slowly (see quality), and rebuilds itself if the phone takes the GPU away.
 */

const DW = 1600;
const DH = 1066.8;
const FOCUS = [880, 520];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const range = (v, a, b) => clamp((v - a) / (b - a));
const smooth = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeIn = (t) => t * t * t;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const hero = document.getElementById('hero');
const stage = hero.querySelector('.hero-stage');
const canvas = hero.querySelector('.hero-canvas');
const poster = hero.querySelector('.hero-poster');
const yearEl = document.getElementById('year');
const loadingBar = hero.querySelector('.hero-loading');
const params = new URLSearchParams(location.search);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

// ------------------------------------------------------------------ choreography
// Scroll position s is measured in viewport heights from the top of the hero.
const css = getComputedStyle(document.documentElement);
const cssNum = (name) => parseFloat(css.getPropertyValue(name));
const CARD2_TOP = cssNum('--card-two-top') / 100;
const LAPSE0 = CARD2_TOP + 0.3;
const TIMES = {
  row: [0.02, 0.55],                          // a country boat rows in while the first card is read
  fall: [CARD2_TOP - 0.98, CARD2_TOP + 0.2],  // the bag falls while the second card crosses the screen
  // The third card rises from the bottom edge to the top edge while four centuries pass;
  // the photograph is complete the moment it reaches the top.
  lapse: [LAPSE0, LAPSE0 + cssNum('--lapse-length') / 100],
};
const card3 = hero.querySelector('.hero-card--three');
// The year label stays hidden on the opening frames and appears once the second card is well
// into view (its top 85% of the way down the screen).
const YEAR_IN = CARD2_TOP - 0.85;
function placeYear(s) {
  hero.classList.toggle('has-year', s >= YEAR_IN);
}
const GLOW_SECONDS = 2.6;

// The ring that marks the bag once it lies on the mud (see .hero-ring).  It closes in on the bag
// as the sheet settles and stays, in the same place on screen, through the time-lapse.
const ring = hero.querySelector('.hero-ring');
const RING_R = 56;                       // design px around the bag's centre
function placeRing(s) {
  if (!ring || !state.cfg) return;
  const fall = range(s, TIMES.fall[0], TIMES.fall[1]);
  const on = reduceMotion.matches ? fall : smooth(range(fall, 0.93, 1));
  ring.style.opacity = on.toFixed(3);
  if (on <= 0) return;
  const [cx, cy] = state.cfg.bag.center;
  const [x0, y0, vw] = state.view;
  const k = state.cw / vw;
  const r = Math.round(clamp(RING_R * k, 32, 72));
  const box = r + 5;
  if (r !== state.ringR) {
    state.ringR = r;
    ring.setAttribute('width', 2 * box);
    ring.setAttribute('height', 2 * box);
    ring.setAttribute('viewBox', `${-box} ${-box} ${2 * box} ${2 * box}`);
    // Whole dashes only, so there is no seam where the circle closes.
    const around = 2 * Math.PI * r;
    const seg = around / Math.round(around / 12.5);
    for (const c of ring.children) c.setAttribute('r', r);
    ring.lastElementChild.setAttribute('stroke-dasharray', `${(seg * 0.58).toFixed(2)} ${(seg * 0.42).toFixed(2)}`);
  }
  const grow = reduceMotion.matches ? 1 : 1 + 0.4 * (1 - on);
  ring.style.transform = `translate3d(${((cx - x0) * k - box).toFixed(1)}px, ${((cy - y0) * k - box).toFixed(1)}px, 0) scale(${grow.toFixed(3)})`;
}

// Screen position of the third card for scroll position s, in px from the top of the stage.
function card3Top(s) {
  const [a, b] = TIMES.lapse;
  return state.ch * (1 - (s - a) / (b - a));
}
// Scroll position at which the third card has left the top of the screen.
function card3Gone() {
  const [a, b] = TIMES.lapse;
  return b + (b - a) * (state.card3H / state.ch);
}
function placeCard3(s) {
  const y = Math.min(state.ch + 20, card3Top(s));
  const t = `translate3d(0, ${y.toFixed(1)}px, 0)`;
  if (t !== state.card3T) { state.card3T = t; card3.style.transform = t; }
}

// Years along the time-lapse, tau in [0, 1].
const YEARS = [[0, 1610], [0.08, 1650], [0.18, 1820], [0.26, 1860], [0.31, 1890], [0.37, 1930],
  [0.43, 1965], [0.49, 1975], [0.56, 1988], [0.75, 2004], [1, 2026]];

function yearAt(tau) {
  for (let i = 1; i < YEARS.length; i++) {
    if (tau <= YEARS[i][0]) {
      const [t0, y0] = YEARS[i - 1];
      const [t1, y1] = YEARS[i];
      return lerp(y0, y1, (tau - t0) / (t1 - t0));
    }
  }
  return 2026;
}

// How old the picture looks: a brown, faded print in 1610 that clears as the years pass.
const AGE = [[1610, 1], [1760, 0.94], [1860, 0.8], [1930, 0.6], [1970, 0.38], [1995, 0.13], [2012, 0]];
function ageAt(year) {
  if (year <= AGE[0][0]) return 1;
  for (let i = 1; i < AGE.length; i++) {
    if (year <= AGE[i][0]) {
      const [y0, a0] = AGE[i - 1];
      const [y1, a1] = AGE[i];
      return lerp(a0, a1, smooth((year - y0) / (y1 - y0)));
    }
  }
  return 0;
}

// Plate weights, from the 1610 reconstruction through 1850 to 1980.
function plateWeights(tau) {
  const a = smooth(range(tau, 0.04, 0.19));
  const b = smooth(range(tau, 0.33, 0.44));
  return [(1 - a), a * (1 - b), b];
}

// Boats that dock at the berth.  shift is how far back along the berth (in window bays)
// the boat is; 0 means moored.  They arrive bow first from behind the jetty and back out.
const VOYAGES = [
  { boat: 'dinghy', stern: 3.2, from: -1, arrive: [-1, -1], leave: [0.0, 0.08], dist: 9, rowIn: 7 },
  { boat: 'steamer', stern: -7.6, from: 0.17, arrive: [0.17, 0.26], leave: [0.3, 0.37], dist: 24 },
  { boat: 'launch80', stern: -1.7, from: 0.41, arrive: [0.41, 0.49], leave: [0.52, 0.575], dist: 17 },
];
// Islam Khan's fleet, at anchor in 1610 (drawn only when assets/hero/fleet.webp exists).
// r is how far out from the ghat the boat's line lies (1 = the berth); x is where its stern sits
// on screen.  Because the river recedes to the left, a boat further right is also nearer the
// camera: its true distance is r * 706 / (x + 158) times the ghat's.
// They are drawn far to near, re-sorted every frame as they move.  When the years start, the
// barge backs out behind the jetty and the others leave downstream; all are gone by about 1650.
const FLEET = [
  { boat: 'pal', r: 4.7, x: 1120, leave: [0.008, 0.062], dist: -11 },
  { boat: 'kosa', r: 2.46, x: 1000, leave: [0.004, 0.056], dist: -15 },
  { boat: 'bajra', r: 1, x: 574, leave: [0.012, 0.068], dist: 13 },
  { boat: 'jaliya', r: 1.6, x: 1180, leave: [0.0, 0.046], dist: -9, rowIn: 2.2 },
];
const PRESENT = 0.56;                // tau at which the present-day reveal begins
const LAUNCH_ARRIVE = [0.12, 0.46];  // in present-phase progress
const LAUNCH_DIST = 14.5;

function voyageState(v, tau, reduced) {
  const [a0, a1] = v.arrive;
  const [l0, l1] = v.leave;
  if (tau < v.from && v.from >= 0) return null;
  if (tau > l1) return null;
  if (reduced) {
    const fadeIn = a0 < 0 ? 1 : range(tau, a0, a1);
    return { shift: 0, alpha: fadeIn * (1 - range(tau, l0, l1)) };
  }
  let shift = 0;
  if (v.rowIn) shift = v.rowIn * (1 - easeInOut(range(state.s, TIMES.row[0], TIMES.row[1])));
  if (a0 >= 0 && tau < a1) shift = v.dist * (1 - easeOut(range(tau, a0, a1)));
  if (tau > l0) shift = v.dist * easeIn(range(tau, l0, l1));
  return { shift, alpha: 1 };
}

// ------------------------------------------------------------------ the falling bag
// f in [0, 1].  Returns the sheet's pose in metres around the landing point.
const FALL_H = 5.6;
const BAG_SIZE = [0.43, 0.29];
const BAG_K = 136;                       // design px per metre at the landing point
const LAND_YAW = -0.85;               // lies along the same diagonal as the real bag
function bagPose(f) {
  const a = range(f, 0, 0.9);            // airborne until 0.9, then it settles
  const T = a * 5.4;                     // seconds of fall, for the flutter
  const w = Math.PI * 2 * 0.52;
  const decay = Math.pow(1 - a, 1.15);
  const e = 1 - Math.pow(1 - a, 1.35);
  const h = FALL_H * (1 - e) * (1 + 0.035 * Math.sin(T * w * 2.0) * (1 - a));
  const x = 0.62 * Math.sin(w * T + 0.9) * decay - 0.75 * Math.pow(1 - a, 1.6);
  const z = 0.28 * Math.sin(0.63 * w * T + 1.7) * (1 - a);
  const land = smooth(range(f, 0.76, 0.93));
  const roll = lerp(0.62 * Math.cos(w * T + 0.9) * Math.pow(1 - a, 0.55), 0, land);
  const tumble = 2.4 * Math.pow(1 - a, 3) * Math.sin(1.6 * T + 0.3);
  const pitch = lerp(-Math.PI / 2 + 0.85 * Math.sin(0.83 * w * T + 0.4) * Math.pow(1 - a, 0.7) + tumble, -Math.PI / 2, land);
  const yaw = LAND_YAW + 1.7 * Math.pow(1 - a, 1.25) * Math.sin(0.33 * w * T + 0.5) + 2.1 * Math.pow(1 - a, 2.2);
  const amp = lerp(0.055 + 0.05 * (1 - a), 0.004, land);
  const cup = lerp(0.05 * Math.sin(0.9 * T), -0.008, land);
  return { h, x, z, roll, pitch, yaw, amp, cup, T };
}

function rotation(yaw, pitch, roll) {
  // R = Ry(yaw) * Rz(roll) * Rx(pitch); column-major for GLSL.
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cz = Math.cos(roll), sz = Math.sin(roll);
  const cx = Math.cos(pitch), sx = Math.sin(pitch);
  const Rx = [1, 0, 0, 0, cx, sx, 0, -sx, cx];
  const Rz = [cz, sz, 0, -sz, cz, 0, 0, 0, 1];
  const Ry = [cy, 0, -sy, 0, 1, 0, sy, 0, cy];
  return mul3(Ry, mul3(Rz, Rx));
}
function mul3(a, b) {
  const o = new Array(9);
  for (let c = 0; c < 3; c++) {
    for (let r = 0; r < 3; r++) {
      o[c * 3 + r] = a[r] * b[c * 3] + a[3 + r] * b[c * 3 + 1] + a[6 + r] * b[c * 3 + 2];
    }
  }
  return o;
}

// ------------------------------------------------------------------ WebGL
let gl;
let isGL2 = false;

const VS_QUAD = `
attribute vec2 aPos;
uniform vec4 uView;
varying vec2 vD;
void main() {
  vD = aPos;
  vec2 c = (aPos - uView.xy) / uView.zw;
  gl_Position = vec4(c.x * 2.0 - 1.0, 1.0 - c.y * 2.0, 0.0, 1.0);
}`;

const COMMON = `
precision highp float;
uniform vec4 uTexRect;
uniform vec3 uGain;
uniform vec3 uBias;
uniform float uLook;
uniform float uTau;
uniform float uGrain;
uniform float uAge;
vec2 tuv(vec2 d) { return (d - uTexRect.xy) / uTexRect.zw; }
float reveal(vec4 st) { return smoothstep(st.r, st.r + max(st.g, 0.004), uTau); }
vec3 plateLook(vec3 c) { return mix(c, c * uGain + uBias, uLook); }
vec3 photoLook(vec3 c) { return mix((c - uBias) / uGain, c, uLook); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec3 grain(vec3 c, float amount) {
  return c + (hash(floor(gl_FragCoord.xy)) - 0.5) * uGrain * (amount + uAge * 0.8);
}
// An old albumen print: brown, lifted blacks, softer contrast.  Affine, so it composes
// exactly with alpha blending and every layer can apply it on its own.
vec3 aged(vec3 c) {
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  vec3 print = vec3(0.14, 0.1, 0.065) + l * vec3(0.84, 0.72, 0.56);
  return mix(c, print, uAge * 0.9);
}`;

const FS_BASE = `${COMMON}
varying vec2 vD;
uniform sampler2D uP0;
uniform sampler2D uP1;
uniform sampler2D uP2;
uniform sampler2D uNow;
uniform sampler2D uStage;
uniform vec3 uW;
uniform vec2 uPlateTexel;
uniform float uSharpen;
uniform float uSkyGrey;
vec3 plates(vec2 uv) {
  vec3 c = vec3(0.0);
  if (uW.x > 0.0) c += texture2D(uP0, uv).rgb * uW.x;
  if (uW.y > 0.0) c += texture2D(uP1, uv).rgb * uW.y;
  if (uW.z > 0.0) c += texture2D(uP2, uv).rgb * uW.z;
  return c;
}
void main() {
  vec2 uv = tuv(vD);
  vec4 st = texture2D(uStage, uv);
  float rv = reveal(st);
  vec3 p = plates(uv);
  if (uSharpen > 0.0) {
    vec3 n = plates(uv + vec2(uPlateTexel.x, 0.0)) + plates(uv - vec2(uPlateTexel.x, 0.0))
           + plates(uv + vec2(0.0, uPlateTexel.y)) + plates(uv - vec2(0.0, uPlateTexel.y));
    p += (p - n * 0.25) * uSharpen;
  }
  p = plateLook(p);
  float lum = dot(p, vec3(0.299, 0.587, 0.114));
  vec3 overcast = vec3(lum * 0.97, lum * 0.985, lum * 1.0) * 0.93 + 0.03;
  p = mix(p, overcast, st.b * uSkyGrey);
  vec3 c = mix(p, photoLook(texture2D(uNow, uv).rgb), rv);
  gl_FragColor = vec4(grain(aged(c), 1.0 - rv), 1.0);
}`;

const FS_BERTH = `${COMMON}
varying vec2 vD;
uniform sampler2D uTex;
uniform sampler2D uOcc;
uniform sampler2D uStage;
uniform vec4 uBerth;      // xv, yh, wRef, bayW
uniform float uTWater;
uniform vec4 uSpr;        // U of stern, length in bays, t of top, t of bottom
uniform vec4 uAtlas;      // sprite rectangle in the texture
uniform float uShift;
uniform float uAlpha;
uniform float uRefl;      // > 0: draw the reflection with this strength
uniform float uClip;      // 1: hide the hull below the water surface
uniform float uPhoto;     // 1: pixels come from the photograph
uniform float uHaze;
uniform float uRipple;
uniform float uFleet;     // 1: Islam Khan's fleet (see fleetMain)
uniform float uDepth;     // distance from the camera per unit of w, relative to the ghat
uniform float uMetreT;    // t per metre of height on this boat's line
uniform vec3 uHazeCol;    // the 1610 air over the far bank
uniform vec3 uWaterCol;   // the 1610 river
// Sprite coordinates for (U, t), and whether they fall on the sprite at all.  Sampling always
// happens, clamped, and is masked afterwards: texture reads inside per-pixel branches or after
// a discard get undefined mip levels on some GPUs and in software renderers.
vec3 sprAt(float U, float t) {
  vec2 st = vec2((U - uSpr.x) / uSpr.y, (t - uSpr.z) / (uSpr.w - uSpr.z));
  vec2 inside = step(vec2(0.0), st) * step(st, vec2(1.0));
  vec2 q = uAtlas.xy + clamp(st, 0.0, 1.0) * uAtlas.zw;
  return vec3(q, inside.x * inside.y);
}
// The fleet is composited like a photographed object rather than a cut-out: haze by its true
// distance, a waterline that moves, wet planking at the water, light from the river wrapping
// its edges, and a reflection broken up by the current.
vec4 fleetColor(float w, float t, float U, vec3 oc, float rv) {
  float occ = mix(oc.r, oc.g, rv);
  float D = uDepth * w;                                  // 1 at the ghat, larger further out
  float air = clamp(0.1 * (D - 0.7), 0.0, 0.45);
  vec3 col;
  float a;
  if (uRefl > 0.0) {
    float m = max(t - uTWater, 0.0) / uMetreT;           // metres below the surface
    float fade = (1.0 - smoothstep(0.0, 2.4, m)) * step(uTWater, t);
    float wob = smoothstep(0.0, 0.2, m);
    U += (0.6 * sin(m * 23.0 + U * 3.1 + uRipple) + 0.4 * sin(m * 41.0 - U * 1.7 + uRipple * 1.3)) * 0.07 * wob;
    float tm = 2.0 * uTWater - t;
    // Smear the mirror image vertically, more the further it is from the hull.
    float sp = (0.05 + 0.1 * m) * uMetreT;
    vec4 acc = vec4(0.0);
    for (int i = -2; i <= 2; i++) {
      vec3 q = sprAt(U, tm + float(i) * sp);
      vec4 c = texture2D(uTex, q.xy, 1.2);
      c.a *= q.z;
      acc += vec4(c.rgb * c.a, c.a);
    }
    col = acc.rgb / max(acc.a, 1e-4);
    a = acc.a / 5.0;
    float streaks = 0.62 + 0.38 * sin(m * 17.0 + sin(U * 5.0 + uRipple) * 1.6);
    col = mix(plateLook(col) * 0.8, uWaterCol, 0.3 + 0.2 * air);
    a *= uRefl * oc.b * fade * streaks * (1.0 - occ) * uAlpha;
  } else {
    vec3 q = sprAt(U, t);
    vec4 c = texture2D(uTex, q.xy, 0.4);
    float soft = texture2D(uTex, q.xy, 2.5).a;           // the silhouette, blurred by the mip chain
    c.a *= q.z;
    // The river's surface is never a ruler line against a hull.
    float wl = uTWater + w * (0.55 * sin(U * 13.0 + uRipple * 1.7) + 0.3 * sin(U * 29.0 - uRipple * 2.3 + 1.3));
    c.a *= 1.0 - smoothstep(wl - 1.1 * w, wl + 0.5 * w, t);
    col = plateLook(c.rgb);
    float above = (wl - t) / uMetreT;                    // metres above the water
    col *= 1.0 - 0.32 * (1.0 - smoothstep(0.0, 0.4, above));
    // Light from the water and the sky spills over the silhouette's edges.
    col = mix(col, mix(uHazeCol, uWaterCol, 0.5), clamp(1.0 - soft, 0.0, 1.0) * 0.4);
    col = mix(col, uHazeCol, air);
    a = c.a * (1.0 - occ) * uAlpha;
  }
  return vec4(col, a);
}
void main() {
  float w = 1.0 / (vD.x - uBerth.x);
  float t = (vD.y - uBerth.y) * w;
  float U = (uBerth.z - w) / uBerth.w + uShift;
  if (uFleet > 0.5) {
    vec2 uv = tuv(vD);
    vec3 oc = texture2D(uOcc, uv).rgb;
    float rv = reveal(texture2D(uStage, uv));
    vec4 f = fleetColor(w, t, U, oc, rv);
    if (f.a < 0.003) discard;
    gl_FragColor = vec4(grain(aged(f.rgb), 1.0 - rv), f.a);
    return;
  }
  float fade = 1.0;
  if (uRefl > 0.0) {
    if (t < uTWater) discard;
    float depth = t - uTWater;
    fade = 1.0 - smoothstep(0.0, 0.12, depth);
    U += sin(depth * 900.0 + U * 2.3 + uRipple) * 0.035 * smoothstep(0.0, 0.02, depth);
    t = 2.0 * uTWater - t + sin(U * 31.0 + uRipple * 0.7) * 0.0012;
  }
  float s = (U - uSpr.x) / uSpr.y;
  float ts = (t - uSpr.z) / (uSpr.w - uSpr.z);
  if (s < 0.0 || s > 1.0 || ts < 0.0 || ts > 1.0) discard;
  vec4 c = texture2D(uTex, uAtlas.xy + vec2(s, ts) * uAtlas.zw);
  if (uClip > 0.0 && uRefl <= 0.0) c.a *= 1.0 - smoothstep(uTWater - 0.9 * w, uTWater + 0.6 * w, t);
  vec2 uv = tuv(vD);
  vec3 oc = texture2D(uOcc, uv).rgb;
  float rv = reveal(texture2D(uStage, uv));
  float occ = mix(oc.r, oc.g, rv);
  c.a *= (1.0 - occ) * uAlpha * fade;
  vec3 col = uPhoto > 0.5 ? photoLook(c.rgb) : plateLook(c.rgb);
  float far = clamp(w / uBerth.z, 0.0, 1.2);
  col = mix(col, vec3(0.74, 0.77, 0.78), uHaze * far * far);
  if (uRefl > 0.0) {
    c.a *= uRefl * oc.b;
    col = mix(col * 0.72, vec3(0.42, 0.45, 0.44), 0.35);
  }
  if (c.a < 0.003) discard;
  gl_FragColor = vec4(grain(aged(col), 1.0 - rv), c.a);
}`;

const FS_FLAT = `${COMMON}
varying vec2 vD;
uniform sampler2D uTex;
uniform vec4 uRect;       // design rect of the texture
uniform float uAlpha;
uniform float uMode;      // 0: the photographed bag, 1: soft shadow, 2: halo, 3: bag lit up
uniform vec4 uShadow;     // centre x, y, radius x, radius y
void main() {
  if (uMode > 0.5 && uMode < 2.5) {
    vec2 q = (vD - uShadow.xy) / uShadow.zw;
    if (uMode > 1.5) {
      float d = dot(q, q);
      float a = (exp(-d * 1.3) * 0.7 + exp(-d * 5.0) * 0.45) * uAlpha;
      gl_FragColor = vec4(vec3(1.0, 0.93, 0.78) * a, 1.0);
      return;
    }
    float a = exp(-dot(q, q) * 2.2) * uAlpha;
    gl_FragColor = vec4(aged(vec3(0.08, 0.07, 0.05)), a);
    return;
  }
  vec2 uv = (vD - uRect.xy) / uRect.zw;
  vec4 c = texture2D(uTex, uv);
  if (uMode > 2.5) {
    gl_FragColor = vec4((c.rgb * 0.55 + vec3(0.16, 0.14, 0.1)) * c.a * uAlpha, 1.0);
    return;
  }
  gl_FragColor = vec4(aged(photoLook(c.rgb)), c.a * uAlpha);
}`;

// The print's paper: a warm vignette and faint mottling, multiplied over the frame.
const FS_PAPER = `
precision highp float;
varying vec2 vD;
uniform vec4 uView;
uniform float uAge;
uniform vec2 uAspect;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + 1.0), f.x), f.y);
}
void main() {
  vec2 uv = (vD - uView.xy) / uView.zw;
  vec2 q = (uv - 0.5) * uAspect;
  float edge = smoothstep(0.35, 0.95, length(q));
  vec2 np = uv * uAspect;
  float mottle = noise(np * 3.5) * 0.6 + noise(np * 11.0) * 0.4;
  vec3 tint = mix(vec3(1.0), vec3(0.72, 0.6, 0.47), edge * 0.8);
  tint *= 1.0 - (mottle - 0.5) * 0.09;
  gl_FragColor = vec4(mix(vec3(1.0), tint, uAge), 1.0);
}`;

const VS_BAG = `
attribute vec2 aUV;
uniform vec4 uView;
uniform vec2 uCenter;     // design px of the sheet's centre
uniform mat3 uRot;
uniform vec2 uSize;       // metres
uniform vec4 uWave;       // amplitude, time, cup, unused
uniform float uK;         // design px per metre
uniform float uEps;       // how steeply the camera looks down at the sheet
uniform vec3 uLight;
varying vec2 vUV;
varying float vShade;
varying float vSpec;
float sheet(vec2 p) {
  vec2 q = p / uSize;
  float T = uWave.y;
  return uWave.x * (sin(q.x * 7.0 + T * 2.3) * cos(q.y * 5.2 - T * 1.7)
                   + 0.55 * sin(q.y * 9.0 + q.x * 3.0 + T * 3.4))
       + uWave.z * dot(q, q) * 4.0;
}
vec3 local(vec2 p) { return vec3(p.x, p.y, sheet(p)); }
void main() {
  vUV = aUV;
  vec2 p = (vec2(aUV.x, 1.0 - aUV.y) - 0.5) * uSize;
  vec3 P = uRot * local(p);
  vec3 tx = uRot * (local(p + vec2(0.01, 0.0)) - local(p - vec2(0.01, 0.0)));
  vec3 ty = uRot * (local(p + vec2(0.0, 0.01)) - local(p - vec2(0.0, 0.01)));
  vec3 n = normalize(cross(tx, ty));
  vec3 view = normalize(vec3(0.0, sin(uEps), cos(uEps)));
  float lit = abs(dot(n, uLight));
  vShade = 0.62 + 0.5 * lit;
  vec3 r = reflect(-uLight, n * sign(dot(n, view)));
  vSpec = pow(max(dot(r, view), 0.0), 18.0) * 0.55;
  float up = P.y * cos(uEps) - P.z * sin(uEps);
  vec2 d = uCenter + vec2(P.x, -up) * uK;
  vec2 c = (d - uView.xy) / uView.zw;
  gl_Position = vec4(c.x * 2.0 - 1.0, 1.0 - c.y * 2.0, 0.0, 1.0);
}`;

const FS_BAG = `${COMMON}
uniform sampler2D uTex;
uniform float uAlpha;
uniform float uWet;
varying vec2 vUV;
varying float vShade;
varying float vSpec;
void main() {
  vec4 c = texture2D(uTex, vUV);
  vec3 col = plateLook(c.rgb * vShade + vSpec * (1.0 - uWet * 0.6));
  // Pressed onto wet mud, thin film turns dull and see-through.
  col = mix(col, col * vec3(0.7, 0.66, 0.6), uWet);
  gl_FragColor = vec4(aged(col), c.a * uAlpha * (1.0 - 0.22 * uWet));
}`;

async function compile(vsSrc, fsSrc) {
  const parallel = gl.getExtension('KHR_parallel_shader_compile');
  const make = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const p = gl.createProgram();
  gl.attachShader(p, make(gl.VERTEX_SHADER, vsSrc));
  gl.attachShader(p, make(gl.FRAGMENT_SHADER, fsSrc));
  gl.linkProgram(p);
  // Let the GPU compile without synchronously stalling the reader's first paint.
  if (parallel) {
    while (!gl.getProgramParameter(p, parallel.COMPLETION_STATUS_KHR)) {
      await new Promise(resolve => setTimeout(resolve, 16));
    }
  } else {
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    u[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, info.name);
  }
  return { p, u, a: gl.getAttribLocation(p, vsSrc.includes('aUV') ? 'aUV' : 'aPos') };
}

// ------------------------------------------------------------------ assets
const state = {
  set: null, cfg: null, tex: {}, ready: false, gridCount: 0,
  s: 0, target: 0, lastYear: null, raf: 0, lastTime: 0, view: [0, 0, DW, DH], dpr: 1,
  cw: 1, ch: 1, card3H: 0, heroTop: 0, heroEnd: 1, card3T: '', gen: 0, redraw: 0,
};

// Sizes are read once per resize and never while scrolling, so no frame waits for a layout.
function measure() {
  const cw = stage.clientWidth;
  const ch = stage.clientHeight;
  const changed = cw !== state.cw || ch !== state.ch;
  state.cw = cw;
  state.ch = ch;
  state.card3H = card3.offsetHeight;
  state.heroTop = hero.getBoundingClientRect().top + window.pageYOffset;
  // Scroll position at which the pinned stage has left the top of the screen.
  state.heroEnd = hero.offsetHeight / ch;
  return changed;
}
measure();

// ------------------------------------------------------------------ quality
// The picture is drawn at up to 2 device pixels per CSS pixel and 4.2 million pixels in all.
// A device that says it is low-end starts with a smaller budget, and any device that cannot
// keep up while the reader scrolls steps down: first the sharpening pass goes, then the
// resolution drops a little at a time.  It never steps back up, so it cannot flicker.  Only
// the sharpness changes; the picture and its timing stay exactly the same.
const quality = { budget: 4.2e6, scale: 1, sharpen: true, steps: 0, samples: [] };
const SLOW_FRAME_MS = 40;             // slower than 25 frames a second
function judgeFrame(ms) {
  if (quality.steps >= 4 || !(ms > 0) || ms > 500) return;   // > 500: the tab was in the background
  const s = quality.samples;
  s.push(ms);
  if (s.length < 30) return;
  s.sort((a, b) => a - b);
  const typical = s[15];
  s.length = 0;
  if (typical < SLOW_FRAME_MS) return;
  quality.steps += 1;
  if (quality.sharpen) quality.sharpen = false;
  else quality.scale = Math.max(0.5, quality.scale * 0.8);
  layout();
}

function chooseSet() {
  const a = state.cw / state.ch;
  return DH * a <= 700 ? 'tall' : 'wide';
}

function texRect() {
  return state.set === 'tall' ? [state.cfg.tall[0], 0, state.cfg.tall[1] - state.cfg.tall[0], DH] : [0, 0, DW, DH];
}

// The pictures are downloaded from the start, straight after the opening picture the reader is
// looking at, three at a time and in the order the scroll needs them.  Decoding them and putting
// them on the GPU still waits until the renderer is prepared, so the first paint stays light;
// by then most of the bytes are already here.
const downloads = {};
const queue = [];
let fetching = 0;
// A phone's connection can drop a request now and then: try once more before giving up (and
// falling back to the plain crossfade).
function get(url, priority, tries) {
  return fetch(url, { priority })
    .then((res) => {
      if (!res.ok) throw new Error(`${url}: ${res.status}`);
      return res.blob();
    })
    .catch((e) => {
      if (tries <= 1) throw e;
      return new Promise((resolve) => setTimeout(resolve, 800)).then(() => get(url, priority, tries - 1));
    });
}
function pump() {
  while (fetching < 3 && queue.length) {
    const job = queue.shift();
    fetching += 1;
    get(job.url, job.priority, 2)
      .then(job.resolve, job.reject)
      .then(() => { fetching -= 1; pump(); });
  }
}
function download(file, priority, urgent) {
  if (!downloads[file]) {
    downloads[file] = new Promise((resolve, reject) => {
      const job = { url: `assets/hero/${file}.webp`, priority, resolve, reject };
      if (urgent) queue.unshift(job);   // wanted this moment: ahead of the prefetches
      else queue.push(job);
      pump();
    });
    downloads[file].catch(() => {});   // a prefetch nobody uses may fail quietly
  }
  return downloads[file];
}
// Each download is used once, so its bytes are not kept; asking again (after the GPU was lost,
// say) fetches from the browser's cache.
const taken = {};
function take(file) {
  const p = download(file, 'high', true);
  delete downloads[file];
  taken[file] = true;
  return p;
}
function prefetch(file, priority) {
  return taken[file] ? null : download(file, priority);
}

async function loadImage(blob) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
    } catch (e) { /* fall through */ }
  }
  const img = new Image();
  const src = URL.createObjectURL(blob);
  img.src = src;
  if (img.decode) await img.decode();
  else await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });
  img.revoke = () => URL.revokeObjectURL(src);
  return img;
}

// Once a picture is on the GPU, its decoded copy is released straight away: on a phone with
// little memory, holding a dozen of them is what gets the page's GPU context taken away.
function release(img) {
  if (img.close) img.close();
  if (img.revoke) img.revoke();
}

function upload(img, { mip = true } = {}) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  if (isGL2 && mip) {
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  } else {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  }
  return { t, w: img.width, h: img.height };
}

function placeholder() {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
  return { t, w: 1, h: 1 };
}

// ------------------------------------------------------------------ drawing
let progBase, progBerth, progFlat, progBag, progPaper, quadBuf, gridBuf, gridIdx;

async function setupGL() {
  [progBase, progBerth, progFlat, progBag, progPaper] = await Promise.all([
    compile(VS_QUAD, FS_BASE), compile(VS_QUAD, FS_BERTH), compile(VS_QUAD, FS_FLAT),
    compile(VS_BAG, FS_BAG), compile(VS_QUAD, FS_PAPER),
  ]);
  quadBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.bufferData(gl.ARRAY_BUFFER, 8 * 4, gl.DYNAMIC_DRAW);
  const N = 18, M = 14;
  const uv = [];
  for (let j = 0; j <= M; j++) for (let i = 0; i <= N; i++) uv.push(i / N, j / M);
  const idx = [];
  for (let j = 0; j < M; j++) {
    for (let i = 0; i < N; i++) {
      const a = j * (N + 1) + i;
      idx.push(a, a + 1, a + N + 1, a + 1, a + N + 2, a + N + 1);
    }
  }
  gridBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, gridBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uv), gl.STATIC_DRAW);
  gridIdx = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gridIdx);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
  state.gridCount = idx.length;
  gl.enable(gl.BLEND);
  gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
}

const quadData = new Float32Array(8);   // reused every draw: no garbage while scrolling
function quad(prog, pts) {
  quadData.set(pts);
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, quadData);
  gl.enableVertexAttribArray(prog.a);
  gl.vertexAttribPointer(prog.a, 2, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

function bind(prog, unit, name, tex) {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, (tex || state.tex.blank).t);
  gl.uniform1i(prog.u[name], unit);
}

function common(prog, look) {
  const u = prog.u;
  gl.uniform4fv(u.uView, state.view);
  if (u.uTexRect) gl.uniform4fv(u.uTexRect, texRect());
  if (u.uGain) gl.uniform3fv(u.uGain, look.gain);
  if (u.uBias) gl.uniform3fv(u.uBias, look.bias);
  if (u.uLook) gl.uniform1f(u.uLook, look.G);
  if (u.uTau) gl.uniform1f(u.uTau, look.tauP);
  if (u.uGrain) gl.uniform1f(u.uGrain, 0.045);
  if (u.uAge) gl.uniform1f(u.uAge, look.age);
}

function viewQuad() {
  const [x, y, w, h] = state.view;
  return [x, y, x + w, y, x, y + h, x + w, y + h];
}

// A line on the water parallel to the berth.  Seen from further away (r > 1) it lies
// closer to the horizon, and lengths and heights along it shrink by 1 / r.
function waterLine(r = 1, xStern = null) {
  const b = state.cfg.berth;
  return { wRef: xStern === null ? b.wRef : 1 / (xStern - b.xv), bayW: b.bayW / r, tWater: b.tWater / r, metreT: b.metreT / r };
}

function berthToScreen(U, t, L) {
  const b = state.cfg.berth;
  const w = L.wRef - U * L.bayW;
  return [b.xv + 1 / w, b.yh + t / w];
}

function drawBerthSprite(look, tex, atlas, spr, shift, alpha, opts) {
  if (alpha <= 0.001) return;
  const b = { ...state.cfg.berth, ...(opts.line || waterLine()) };
  const L = b;
  const P = progBerth;
  gl.useProgram(P.p);
  common(P, look);
  bind(P, 0, 'uTex', tex);
  bind(P, 1, 'uOcc', state.tex.occ);
  bind(P, 2, 'uStage', state.tex.stage);
  gl.uniform4f(P.u.uBerth, b.xv, b.yh, b.wRef, b.bayW);
  gl.uniform1f(P.u.uTWater, b.tWater);
  gl.uniform4fv(P.u.uSpr, spr);
  gl.uniform4fv(P.u.uAtlas, atlas);
  gl.uniform1f(P.u.uShift, shift);
  gl.uniform1f(P.u.uAlpha, alpha);
  gl.uniform1f(P.u.uClip, opts.clip ? 1 : 0);
  gl.uniform1f(P.u.uPhoto, opts.photo ? 1 : 0);
  gl.uniform1f(P.u.uHaze, opts.haze || 0);
  gl.uniform1f(P.u.uRipple, state.s * 3.0);
  gl.uniform1f(P.u.uFleet, opts.fleet ? 1 : 0);
  if (opts.fleet) {
    const light = state.cfg.fleetLight || { haze: [0.62, 0.63, 0.62], water: [0.59, 0.62, 0.63] };
    gl.uniform1f(P.u.uDepth, opts.depth);
    gl.uniform1f(P.u.uMetreT, L.metreT);
    gl.uniform3fv(P.u.uHazeCol, light.haze);
    gl.uniform3fv(P.u.uWaterCol, light.water);
  }
  // Screen-space bounds of the sprite on the berth, clipped to the right of the vanishing point.
  const u0 = Math.max(spr[0] - shift, -30);
  const u1 = Math.min(spr[0] + spr[1] - shift, (b.wRef - 1e-5) / b.bayW);
  if (u1 <= u0) return;
  const pts = [berthToScreen(u0, spr[2], L), berthToScreen(u1, spr[2], L), berthToScreen(u0, spr[3], L), berthToScreen(u1, spr[3], L)];
  if (opts.refl) {
    gl.uniform1f(P.u.uRefl, opts.refl);
    const tw = b.tWater;
    const r0 = berthToScreen(u0, tw, L), r1 = berthToScreen(u1, tw, L);
    const d0 = berthToScreen(u0, 2 * tw - spr[2], L), d1 = berthToScreen(u1, 2 * tw - spr[2], L);
    quad(P, [r0[0] - 20, r0[1], r1[0] + 20, r1[1], d0[0] - 20, d0[1], d1[0] + 20, d1[1]]);
  } else {
    gl.uniform1f(P.u.uRefl, 0);
    quad(P, pts.flat());
  }
}

function boatSprite(name, list = state.cfg.boats, L = waterLine()) {
  const b = list.find((x) => x.name === name);
  const lenBays = b.length * state.cfg.berth.metreU;
  const hT = b.height * L.metreT;
  const tTop = L.tWater - hT * b.waterline;
  return { atlas: b.rect, len: lenBays, tTop, tBot: tTop + hT };
}

function lookAt(tau, tauP) {
  const w = plateWeights(tau);
  const g = state.cfg.grades;
  const gain = [0, 1, 2].map((i) => clamp(w[0] * g['1610'].gain[i] + w[1] * g['1850'].gain[i] + w[2] * g['1980'].gain[i], 0.6, 1.6));
  const bias = [0, 1, 2].map((i) => w[0] * g['1610'].bias[i] + w[1] * g['1850'].bias[i] + w[2] * g['1980'].bias[i]);
  let G = 0.14 * range(tau, 0.37, 0.52);
  G = lerp(G, 1, smooth(range(tauP, 0.12, 0.96)));
  return { w, gain, bias, G, tauP, age: ageAt(yearAt(tau)) };
}

function render() {
  const s = state.s;
  const reduced = reduceMotion.matches;
  const fall = reduced ? 1 : range(s, TIMES.fall[0], TIMES.fall[1]);
  const tau = range(s, TIMES.lapse[0], TIMES.lapse[1]);
  const tauP = range(tau, PRESENT, 1);
  const look = lookAt(tau, tauP);

  gl.viewport(0, 0, canvas.width, canvas.height);

  // Base: plates and the photograph.
  const B = progBase;
  gl.useProgram(B.p);
  common(B, look);
  bind(B, 0, 'uP0', state.tex.p1610);
  bind(B, 1, 'uP1', state.tex.p1850);
  bind(B, 2, 'uP2', state.tex.p1980);
  bind(B, 3, 'uNow', state.tex.now);
  bind(B, 4, 'uStage', state.tex.stage);
  gl.uniform3fv(B.u.uW, look.w);
  const pt = state.tex.p1610;
  gl.uniform2f(B.u.uPlateTexel, 1 / pt.w, 1 / pt.h);
  gl.uniform1f(B.u.uSharpen, state.sharpen);
  gl.uniform1f(B.u.uSkyGrey, smooth(range(tauP, 0.14, 0.6)) * 0.85);
  gl.disable(gl.BLEND);
  quad(B, viewQuad());
  gl.enable(gl.BLEND);

  // Boats along the berth: reflections first, then hulls.
  const clean = 1 - range(tauP, 0.55, 0.8) * 0.75;
  const draws = [];
  const fleet = state.tex.fleet && state.cfg.fleet && state.cfg.fleet.length;
  if (fleet) {
    const fleetDraws = [];
    for (const v of FLEET) {
      const st = voyageState({ ...v, from: -1, arrive: [-1, -1] }, tau, reduced);
      if (!st) continue;
      const line = waterLine(v.r, v.x);
      const sp = boatSprite(v.boat, state.cfg.fleet, line);
      // A boat still in view when its voyage ends thins away with the time-lapse, never pops.
      const alpha = st.alpha * (1 - smooth(range(tau, lerp(v.leave[0], v.leave[1], 0.7), v.leave[1])));
      const shift = st.shift + bob(v.x) / v.r;
      const depth = v.r / state.cfg.berth.wRef;
      const far = depth * (line.wRef - (sp.len / 2 - shift) * line.bayW);   // true distance, mid-hull
      fleetDraws.push({ tex: state.tex.fleet, atlas: sp.atlas, spr: [0, sp.len, sp.tTop, sp.tBot], line,
        shift, alpha, fleet: true, depth, far });
    }
    draws.push(...fleetDraws.sort((a, b) => b.far - a.far));
  }
  if (state.tex.boats) {
    for (const v of VOYAGES) {
      if (fleet && v.boat === 'dinghy') continue;   // the fleet's own escort boat takes its place
      const st = voyageState(v, tau, reduced);
      if (!st) continue;
      const sp = boatSprite(v.boat);
      draws.push({ tex: state.tex.boats, atlas: sp.atlas, spr: [v.stern, sp.len, sp.tTop, sp.tBot], shift: st.shift + bob(v.stern), alpha: st.alpha, clip: true, haze: 0.22 });
    }
  }
  if (state.tex.launch && tau >= PRESENT) {
    const L = state.cfg.launch;
    const k = range(tauP, LAUNCH_ARRIVE[0], LAUNCH_ARRIVE[1]);
    const shift = reduced ? 0 : LAUNCH_DIST * (1 - easeOut(k));
    const alpha = (reduced ? k : 1) * (1 - range(tauP, 0.54, 0.6));
    if (k > 0) draws.push({ tex: state.tex.launch, atlas: [0, 0, 1, 1], spr: [L.u0, L.u1 - L.u0, L.t0, L.t1], shift, alpha, photo: true, haze: 0.05 });
  }
  for (const d of draws) drawBerthSprite(look, d.tex, d.atlas, d.spr, d.shift, d.alpha, { ...d, refl: (d.fleet ? 0.8 : 0.5) * clean });
  for (const d of draws) drawBerthSprite(look, d.tex, d.atlas, d.spr, d.shift, d.alpha, d);

  drawBag(look, fall);
  if (state.glow > 0.001) drawGlow(look, state.glow);

  if (look.age > 0.001) {
    const P = progPaper;
    gl.useProgram(P.p);
    common(P, look);
    const [, , vw, vh] = state.view;
    gl.uniform2f(P.u.uAspect, vw / Math.max(vw, vh) * 1.25, vh / Math.max(vw, vh) * 1.25);
    gl.blendFunc(gl.DST_COLOR, gl.ZERO);
    quad(P, viewQuad());
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
  }
}

function bob(seed) {
  return 0.02 * Math.sin(state.s * 9 + seed);
}

function drawBag(look, f) {
  if (f <= 0) return;
  const [cx, cy] = state.cfg.bag.center;
  const rect = state.cfg.bag.rect;
  const landed = smooth(range(f, 0.88, 0.97));
  if (landed < 1 && state.tex.poly) {
    const pose = bagPose(f);
    // Contact shadow on the mud as the sheet comes down.
    const near = Math.exp(-pose.h / 0.9);
    const F = progFlat;
    gl.useProgram(F.p);
    common(F, look);
    gl.uniform1f(F.u.uMode, 1);
    const sx = cx + (pose.x + pose.h * 0.22) * BAG_K;
    const sy = cy + (pose.z * 0.64 + pose.h * 0.05) * BAG_K;
    const rx = 30 * (1 + pose.h * 0.6), ry = rx * 0.45;
    gl.uniform4f(F.u.uShadow, sx, sy, rx, ry);
    gl.uniform1f(F.u.uAlpha, 0.42 * near * (1 - landed) * (1 - look.G));
    quad(F, [sx - rx * 2, sy - ry * 2, sx + rx * 2, sy - ry * 2, sx - rx * 2, sy + ry * 2, sx + rx * 2, sy + ry * 2]);

    const P = progBag;
    gl.useProgram(P.p);
    common(P, look);
    bind(P, 0, 'uTex', state.tex.poly);
    const eps = Math.atan2(3.0 - pose.h, 3.5);
    const scale = 1 + 0.06 * pose.h;
    const centerY = cy - pose.h * 131 + pose.z * Math.sin(eps) * BAG_K;
    gl.uniform2f(P.u.uCenter, cx + pose.x * BAG_K, centerY);
    gl.uniformMatrix3fv(P.u.uRot, false, rotation(pose.yaw, pose.pitch, pose.roll));
    gl.uniform2f(P.u.uSize, BAG_SIZE[0], BAG_SIZE[1]);
    gl.uniform4f(P.u.uWave, pose.amp, pose.T, pose.cup, 0);
    gl.uniform1f(P.u.uK, BAG_K * scale);
    gl.uniform1f(P.u.uEps, eps);
    const L = [-0.45, 0.8, 0.4];
    const n = Math.hypot(...L);
    gl.uniform3f(P.u.uLight, L[0] / n, L[1] / n, L[2] / n);
    gl.uniform1f(P.u.uAlpha, (1 - landed) * 0.94);
    gl.uniform1f(P.u.uWet, smooth(range(f, 0.84, 0.95)));
    gl.bindBuffer(gl.ARRAY_BUFFER, gridBuf);
    gl.enableVertexAttribArray(P.a);
    gl.vertexAttribPointer(P.a, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gridIdx);
    gl.drawElements(gl.TRIANGLES, state.gridCount, gl.UNSIGNED_SHORT, 0);
  }
  if (landed > 0 && state.tex.bag) {
    const F = progFlat;
    gl.useProgram(F.p);
    common(F, look);
    gl.uniform1f(F.u.uMode, 0);
    bind(F, 0, 'uTex', state.tex.bag);
    gl.uniform4f(F.u.uRect, rect[0], rect[1], rect[2] - rect[0], rect[3] - rect[1]);
    gl.uniform1f(F.u.uAlpha, landed);
    quad(F, [rect[0], rect[1], rect[2], rect[1], rect[0], rect[3], rect[2], rect[3]]);
  }
}

// It survived: once the last card has gone, the bag gives off a brief, soft light.
function drawGlow(look, g) {
  const [cx, cy] = state.cfg.bag.center;
  const rect = state.cfg.bag.rect;
  const F = progFlat;
  gl.useProgram(F.p);
  common(F, look);
  gl.blendFunc(gl.ONE, gl.ONE);
  gl.uniform1f(F.u.uMode, 2);
  const rx = 96, ry = 58;
  gl.uniform4f(F.u.uShadow, cx, cy, rx, ry);
  gl.uniform1f(F.u.uAlpha, 0.36 * g);
  quad(F, [cx - rx * 2.2, cy - ry * 2.2, cx + rx * 2.2, cy - ry * 2.2, cx - rx * 2.2, cy + ry * 2.2, cx + rx * 2.2, cy + ry * 2.2]);
  gl.uniform1f(F.u.uMode, 3);
  bind(F, 0, 'uTex', state.tex.bag);
  gl.uniform4f(F.u.uRect, rect[0], rect[1], rect[2] - rect[0], rect[3] - rect[1]);
  gl.uniform1f(F.u.uAlpha, 0.5 * g);
  quad(F, [rect[0], rect[1], rect[2], rect[1], rect[0], rect[3], rect[2], rect[3]]);
  gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
}

function glowAt(now) {
  const gone = card3Gone();
  if (reduceMotion.matches) {
    return smooth(range(state.s, gone, gone + 0.12)) * 0.7;
  }
  if (state.s < gone - 0.02) { state.glowStart = 0; return 0; }   // re-arms when scrolling back
  if (!state.glowStart) state.glowStart = now;
  const t = (now - state.glowStart) / 1000;
  if (t >= GLOW_SECONDS) return 0;
  return t < 0.7 ? easeOut(t / 0.7) : 1 - smooth((t - 0.7) / (GLOW_SECONDS - 0.7));
}

// ------------------------------------------------------------------ layout, scroll, loop
function layout() {
  const cw = state.cw;
  const ch = state.ch;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const scale = Math.min(dpr, Math.sqrt(quality.budget / (cw * ch))) * quality.scale;
  const w = Math.max(1, Math.round(cw * scale));
  const h = Math.max(1, Math.round(ch * scale));
  // Resizing a canvas throws its picture and GPU buffers away, so only do it for a real change
  // (a phone's address bar showing or hiding fires resize without one).
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    // Safari does not show the first frame drawn into a resized canvas: draw a few more.
    state.redraw = 3;
    if (state.ready && !state.raf) state.raf = requestAnimationFrame(frame);
  }
  state.dpr = scale;
  const a = cw / ch;
  let vw, vh;
  if (a > DW / DH) { vw = DW; vh = DW / a; } else { vh = DH; vw = DH * a; }
  const [lo, hi] = state.set === 'tall' ? state.cfg.tall : [0, DW];
  const x0 = clamp(FOCUS[0] - vw / 2, lo, hi - vw);
  const y0 = clamp(FOCUS[1] - vh / 2, 0, DH - vh);
  state.view = [x0, y0, vw, vh];
  // The poster sits exactly where the first frame will be.
  const k = cw / vw;
  const tr = texRect();
  poster.style.backgroundImage = `url(assets/hero/opening${state.set === 'tall' ? '-tall' : ''}.webp)`;
  poster.style.backgroundSize = `${tr[2] * k}px ${DH * k}px`;
  poster.style.backgroundPosition = `${(tr[0] - x0) * k}px ${-y0 * k}px`;
  state.sharpen = !quality.sharpen ? 0 : cw * scale > 1400 ? 0.35 : 0.2;
}

function scrollPos() {
  return Math.max(0, (window.pageYOffset - state.heroTop) / state.ch);
}

function frame(now) {
  state.raf = 0;
  if (state.frozen) return;       // a check or recording is drawing exact frames itself
  if (!state.ready) { state.lastTime = 0; return; }
  const target = params.has('s') ? parseFloat(params.get('s')) : state.target;
  // Below the opening the stage has scrolled away.  Settle on its last frame, drawn once, and
  // stop: drawing frames nobody can see only takes the GPU from the page being read.  The
  // bag glows again if the reader comes back up.
  if (target >= state.heroEnd) {
    state.lastTime = 0;
    state.glowStart = 0;
    hero.classList.remove('is-waiting');
    if (state.full && state.s !== state.heroEnd) {
      state.s = state.heroEnd;
      state.glow = 0;
      render();
      updateYear();
      placeCard3(state.s);
      placeYear(state.s);
      placeRing(state.s);
    }
    return;
  }
  if (state.lastTime && state.full) judgeFrame(now - state.lastTime);
  const dt = Math.min(0.05, (now - (state.lastTime || now)) / 1000);
  state.lastTime = now;
  const needLapse = !state.full && target > TIMES.lapse[0] - 0.05;
  const goal = needLapse ? Math.min(target, TIMES.lapse[0] - 0.05) : target;
  hero.classList.toggle('is-waiting', needLapse);
  const k = reduceMotion.matches ? 1 : 1 - Math.exp(-dt / 0.085);
  state.s += (goal - state.s) * k;
  if (Math.abs(goal - state.s) < 0.0004) state.s = goal;
  state.glow = glowAt(now);
  render();
  updateYear();
  placeCard3(state.s);
  placeYear(state.s);
  placeRing(state.s);
  const glowing = state.glowStart && (now - state.glowStart) / 1000 < GLOW_SECONDS;
  if (state.redraw > 0) state.redraw -= 1;
  if (state.s !== goal || glowing || state.redraw > 0) state.raf = requestAnimationFrame(frame);
  else state.lastTime = 0;
}

function kick() {
  if (!state.ready) return;
  state.target = scrollPos();
  if (!state.raf) state.raf = requestAnimationFrame(frame);
}

function updateYear() {
  const tau = range(state.s, TIMES.lapse[0], TIMES.lapse[1]);
  const y = Math.round(yearAt(tau));
  if (y !== state.lastYear) {
    yearEl.textContent = y;
    state.lastYear = y;
  }
}

const CROPPED = ['p1610', 'occ', 'stage', 'p1850', 'p1980', 'now'];   // exist in -tall versions
const hasFleet = (cfg) => !!(cfg && cfg.fleet && cfg.fleet.length);
// The first screen.  With Islam Khan's fleet at anchor, the boats sheet is not needed until the
// years start (its dinghy gives way to the fleet's escort boat), so it waits its turn.
const criticalKeys = (cfg) => ['p1610', 'occ', hasFleet(cfg) ? 'fleet' : 'boats', 'poly', 'bag'];
// The time-lapse, in the order it needs them.
const restKeys = (cfg) => ['stage', 'p1850'].concat(hasFleet(cfg) ? ['boats'] : [], ['p1980', 'launch', 'now']);
const fileFor = (key, set = state.set) => (CROPPED.indexOf(key) >= 0 && set === 'tall' ? `${key}-tall` : key);
const loadTex = async (key) => {
  const img = await loadImage(await take(fileFor(key)));
  if (gl.isContextLost()) { release(img); return; }
  if (state.tex[key]) gl.deleteTexture(state.tex[key].t);
  state.tex[key] = upload(img);
  release(img);
};

// Programs, buffers and pictures on the GPU.  Runs at the start, and again if the phone takes
// the GPU context away (low memory, app switch) and later gives it back.
async function prepare() {
  const gen = ++state.gen;
  state.ready = false;
  state.full = false;
  state.tex = {};
  await setupGL();
  state.tex.blank = placeholder();
  layout();
  await Promise.all(criticalKeys(state.cfg).map(loadTex));
  if (gen !== state.gen) return;              // lost again in the meantime
  state.ready = true;
  hero.classList.add('is-live');
  kick();

  // Everything the time-lapse needs, in the order it is needed.
  const rest = restKeys(state.cfg);
  let done = 0;
  for (const k of rest) {
    await loadTex(k);
    if (gen !== state.gen) return;
    done += 1;
    loadingBar.style.transform = `scaleX(${done / rest.length})`;
    kick();
  }
  state.full = true;
  kick();
}

// A phone turned sideways needs the full-width pictures.
async function widen() {
  state.set = 'wide';
  state.ready = false;
  hero.classList.remove('is-live');
  layout();
  await loadTex('p1610');
  state.ready = true;
  hero.classList.add('is-live');
  kick();
  for (const k of CROPPED.slice(1)) if (state.tex[k]) await loadTex(k);
  kick();
}

// Without WebGL, the reader still sees 1610 give way to today, and the years still count.
// Browsers that cannot show WebP (Safari before 14) get JPEG copies of the two pictures.
let fellBack = false;
function fallback(jpeg) {
  if (fellBack) return;
  fellBack = true;
  queue.length = 0;                   // the animation's pictures are not needed after all
  state.ready = false;
  hero.classList.remove('is-live');
  const now = document.createElement('div');
  now.className = 'hero-poster hero-poster--now';
  poster.parentNode.insertBefore(now, poster.nextSibling);
  if (jpeg === true) {
    const tall = chooseSet() === 'tall' ? '-tall' : '';
    poster.style.backgroundImage = `url(assets/hero/opening${tall}.jpg)`;
    now.style.backgroundImage = `url(assets/hero/now${tall}.jpg)`;
  }
  let queued = 0;
  const lapse = () => {
    queued = 0;
    const s = scrollPos();
    now.style.opacity = String(smooth(range(s, TIMES.lapse[0] + 0.3, TIMES.lapse[1])));
    placeCard3(s);
    placeYear(s);
    state.s = s;
    updateYear();
  };
  addEventListener('scroll', () => { if (!queued) queued = requestAnimationFrame(lapse); }, { passive: true });
  lapse();
}

const heroConfig = fetch('assets/hero/hero.json').then((r) => r.json());
heroConfig.catch(() => {});   // handled where it is awaited; this only silences the no-WebGL path
// The photographic opening, which is the first frame.  Nothing else is fetched before it.
const opening = new Image();
const openingLoaded = new Promise((resolve) => { opening.onload = resolve; opening.onerror = resolve; });
opening.src = `assets/hero/opening${chooseSet() === 'tall' ? '-tall' : ''}.webp`;

async function main() {
  const cfg = heroConfig;
  // Paint the complete photographic opening before preparing the animation renderer.
  await openingLoaded;
  if (opening.decode) await opening.decode().catch(() => {});
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  // No multisampling or depth buffer: the scene is flat pictures with soft edges, and both
  // cost old GPUs a lot.  A software renderer (a GPU the browser does not trust) still gets
  // the animation, but small enough to keep up.
  const attrs = { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, failIfMajorPerformanceCaveat: true };
  gl = canvas.getContext('webgl2', attrs) || canvas.getContext('webgl', attrs);
  if (!gl) {
    attrs.failIfMajorPerformanceCaveat = false;
    gl = canvas.getContext('webgl2', attrs) || canvas.getContext('webgl', attrs);
    if (gl) { quality.budget = 0.5e6; quality.sharpen = false; }
  }
  if (!gl) { fallback(); return; }
  isGL2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
  // Old GPUs: a smaller picture from the start.  deviceMemory is only reported by Chromium.
  if ((navigator.deviceMemory && navigator.deviceMemory <= 2) || gl.getParameter(gl.MAX_TEXTURE_SIZE) < 4096) {
    quality.budget = Math.min(quality.budget, 1.2e6);
    quality.sharpen = false;
  }
  state.cfg = await cfg;
  state.set = chooseSet();
  await prepare();
}

function fail(e) {
  console.error(e);
  fallback();
}

addEventListener('scroll', kick, { passive: true });
// Resize fires constantly on phones while the address bar slides; only a real change of size
// (or a phone turned sideways) redoes the layout, at most once a frame.
let resizeQueued = 0;
addEventListener('resize', () => {
  if (resizeQueued) return;
  resizeQueued = requestAnimationFrame(() => {
    resizeQueued = 0;
    const changed = measure();
    if (!state.cfg || fellBack) return;
    if (state.set === 'tall' && chooseSet() === 'wide') { widen().catch(fail); return; }
    if (changed) layout();
    kick();
  });
});
// Web fonts can change the third card's height, which sets when the bag glows.
if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();                 // ask for the context back
  state.gen += 1;                     // abandon any loading in progress
  state.ready = false;
  hero.classList.remove('is-live');   // the poster shows through meanwhile
});
canvas.addEventListener('webglcontextrestored', () => {
  if (state.cfg && !fellBack) prepare().catch(fail);
});
if (reduceMotion.addEventListener) reduceMotion.addEventListener('change', kick);
else if (reduceMotion.addListener) reduceMotion.addListener(kick);
document.querySelectorAll('a[href="#story"]').forEach((a) => a.addEventListener('click', (e) => {
  e.preventDefault();
  const story = document.getElementById('story');
  story.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth' });
  story.focus({ preventScroll: true });
}));

window.__hero = {
  state, quality, TIMES, FLEET, card3Gone, placeCard3, start: startRenderer,
  render: () => { render(); updateYear(); },
  // Draw scroll position s exactly, with the glow at `glow` (0..1), for checks and recordings.
  show: (s, glow = 0) => {
    state.frozen = true;
    state.s = s;
    state.target = s;
    state.glow = glow;
    placeCard3(s);
    placeYear(s);
    placeRing(s);
    render();
    updateYear();
  },
  // Where the bag is on screen (CSS px), for visual checks.
  bagScreen: () => {
    const f = range(state.s, TIMES.fall[0], TIMES.fall[1]);
    const pose = bagPose(f);
    const [cx, cy] = state.cfg.bag.center;
    const d = [cx + pose.x * BAG_K, cy - pose.h * 131];
    const [x0, y0, vw] = state.view;
    const k = state.cw / vw;
    return [(d[0] - x0) * k, (d[1] - y0) * k, f];
  },
};
// Can this browser show WebP?  (A 1 x 1 WebP; Safari before 14 cannot.)
const webp = new Promise((resolve) => {
  const img = new Image();
  img.onload = () => resolve(img.width > 0);
  img.onerror = () => resolve(false);
  img.src = 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA';
});
let startup;
function startRenderer() {
  if (!startup) startup = webp.then((ok) => (ok ? main() : fallback(true))).catch(fail);
  return startup;
}
webp.then((ok) => { if (!ok) startRenderer(); });   // show the JPEG opening straight away
// Once the opening picture is in, fetch the animation's pictures in the order they are needed:
// the first screen's alone, so they share the connection with nothing, then the time-lapse's.
if (window.WebGLRenderingContext) {
  Promise.all([webp, heroConfig, openingLoaded]).then(([ok, cfg]) => {
    if (!ok || fellBack) return null;
    const set = state.set || chooseSet();
    const first = criticalKeys(cfg).map((k) => prefetch(fileFor(k, set), 'high'));
    return Promise.all(first).catch(() => {}).then(() => {
      for (const k of restKeys(cfg)) prefetch(fileFor(k, set), 'low');
    });
  }).catch(() => {});
}
// The static opening already shows the first frame, so the renderer is prepared a moment after
// the page has loaded, while the reader takes in the first card, or at once if they start
// scrolling.  On a slow phone it is then ready before the bag falls.
for (const event of ['wheel', 'touchstart', 'pointerdown', 'keydown', 'scroll']) {
  addEventListener(event, startRenderer, { once: true, passive: true });
}
if (window.pageYOffset > 0 || location.hash || params.has('s')) startRenderer();
else {
  const whenIdle = () => {
    if (window.requestIdleCallback) requestIdleCallback(startRenderer, { timeout: 2500 });
    else setTimeout(startRenderer, 1200);
  };
  if (document.readyState === 'complete') whenIdle();
  else addEventListener('load', whenIdle, { once: true });
}
