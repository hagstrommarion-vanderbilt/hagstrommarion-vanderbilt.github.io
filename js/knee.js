// Home page figure: a microprocessor-controlled knee through one gait cycle.
//
// The leg is a sagittal chain (thigh, shank, foot) driven by approximate
// able-bodied thigh, knee and ankle angles. The controller is a generic
// stance/swing resistance scheme: high flexion resistance in stance, release
// at pre-swing, low resistance in swing, extension damping before heel strike.
// It is an illustration, not lab data and not the AMPK controller.

const rad = (d) => (d * Math.PI) / 180;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const wrap100 = (p) => ((p % 100) + 100) % 100;

// Periodic cubic through [percent, value] keys (keys in 0..<100), tabulated.
function periodic(keys, samples = 500) {
  const n = keys.length;
  const key = (m) => {
    const i = ((m % n) + n) % n;
    return [keys[i][0] + Math.floor(m / n) * 100, keys[i][1]];
  };
  const table = new Float32Array(samples + 1);
  for (let s = 0; s <= samples; s++) {
    const x = (s / samples) * 100;
    let i = n - 1;
    for (let j = 0; j < n; j++) {
      if (x >= key(j)[0] && x < key(j + 1)[0]) { i = j; break; }
    }
    const [x0, y0] = key(i - 1);
    const [x1, y1] = key(i);
    const [x2, y2] = key(i + 1);
    const [x3, y3] = key(i + 2);
    const h = x2 - x1;
    const m1 = ((y2 - y0) / (x2 - x0)) * h;
    const m2 = ((y3 - y1) / (x3 - x1)) * h;
    const t = (x - x1) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    table[s] = (2 * t3 - 3 * t2 + 1) * y1 + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * y2 + (t3 - t2) * m2;
  }
  return (p) => {
    const f = (wrap100(p) / 100) * samples;
    const i = Math.floor(f);
    const r = f - i;
    return table[i] * (1 - r) + table[Math.min(samples, i + 1)] * r;
  };
}

// Piecewise-linear lookup over [percent, value] keys covering 0..100.
function linear(keys) {
  return (p) => {
    const x = wrap100(p);
    for (let i = 0; i < keys.length - 1; i++) {
      const [x0, y0] = keys[i];
      const [x1, y1] = keys[i + 1];
      if (x >= x0 && x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
    }
    return keys[0][1];
  };
}

// Approximate sagittal angles over one cycle, % from heel strike, degrees.
// Thigh is measured from vertical (+ forward), knee is flexion, ankle is dorsiflexion.
const THIGH = periodic([[0, 22], [10, 20], [30, 6], [50, -10], [56, -11], [62, -6], [72, 10], [85, 24], [93, 24]]);
const KNEE = periodic([[0, 4], [12, 17], [22, 14], [38, 5], [48, 7], [56, 20], [62, 38], [70, 58], [75, 60], [83, 45], [92, 15], [97, 4]]);
const ANKLE = periodic([[0, 0], [7, -6], [15, 0], [30, 6], [45, 10], [52, 6], [58, -8], [63, -16], [70, -8], [80, 0], [92, 1]]);
// Valve opening, 0 = closed (high resistance), 1 = open. Drives the cylinder color only.
const VALVE = linear([[0, 0.12], [48, 0.12], [60, 0.88], [85, 0.88], [97, 0.3], [100, 0.12]]);

const STANCE_END = 62;
const PHASES = [
  { to: 12, name: "Loading response", mode: "Stance", text: "High flexion resistance." },
  { to: 31, name: "Mid stance", mode: "Stance", text: "High flexion resistance." },
  { to: 50, name: "Terminal stance", mode: "Stance", text: "The controller prepares to release." },
  { to: 62, name: "Pre-swing", mode: "Release", text: "Resistance drops, knee can flex for toe-off." },
  { to: 75, name: "Initial swing", mode: "Swing", text: "Low resistance. Shank swings back freely." },
  { to: 87, name: "Mid swing", mode: "Swing", text: "Low resistance, shank swings forward." },
  { to: 100, name: "Terminal swing", mode: "Swing", text: "Prepare for heel strike." },
];
const phaseAt = (p) => PHASES.find((ph) => wrap100(p) < ph.to) || PHASES[PHASES.length - 1];

// Segments in meters.
const L_THIGH = 0.43;
const L_SHANK = 0.43;
const ANKLE_H = 0.075;

function leg(p, hx, hy) {
  const th = rad(THIGH(p));
  const knee = KNEE(p);
  const sh = th - rad(knee);
  const phi = sh - rad(ANKLE(p));
  const H = { x: hx, y: hy };
  const K = { x: hx + L_THIGH * Math.sin(th), y: hy - L_THIGH * Math.cos(th) };
  const A = { x: K.x + L_SHANK * Math.sin(sh), y: K.y - L_SHANK * Math.cos(sh) };
  const c = Math.cos(phi);
  const s = Math.sin(phi);
  const foot = (fx, fy) => ({ x: A.x + fx * c - fy * s, y: A.y + fx * s + fy * c });
  return { H, K, A, th, sh, phi, knee, foot, heel: foot(-0.06, -ANKLE_H), toe: foot(0.2, -ANKLE_H) };
}

// Hip height that keeps the lower foot on the ground.
function hipHeight(p) {
  const a = leg(p, 0, 0);
  const b = leg(p + 50, 0, 0);
  return -Math.min(a.heel.y, a.toe.y, b.heel.y, b.toe.y);
}

// Ground speed from the stance ankle in mid stance, as meters per cycle.
const STRIDE = ((leg(10, 0, 0).A.x - leg(40, 0, 0).A.x) / 30) * 100;

function start(root) {
  const stage = root.querySelector(".knee-stage canvas");
  const trace = root.querySelector(".knee-trace canvas");
  const traceBox = root.querySelector(".knee-trace");
  const ui = {
    play: root.querySelector("[data-k-play]"),
    speed: root.querySelector("[data-k-speed]"),
    speedOut: root.querySelector("[data-k-speed-out]"),
    scrub: root.querySelector("[data-k-scrub]"),
    sound: root.querySelector("[data-k-sound]"),
    cyl: root.querySelector("[data-k-cyl]"),
    pct: root.querySelector("[data-k-pct]"),
    knee: root.querySelector("[data-k-knee]"),
    mode: root.querySelector("[data-k-mode]"),
    phase: root.querySelector("[data-k-phase]"),
    text: root.querySelector("[data-k-text]"),
  };

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const state = { p: reduce ? 20 : 0, playing: !reduce, visible: true, freq: parseFloat(ui.speed.value) / 120, dragging: false };
  let colors = readColors();
  let last = 0;
  let raf = 0;

  function readColors() {
    const cs = getComputedStyle(root);
    const v = (n) => cs.getPropertyValue(n).trim();
    return { ink: v("--ink"), ink2: v("--ink-2"), muted: v("--muted"), line: v("--line"), lineStrong: v("--line-strong"), accent: v("--accent"), steel: v("--steel"), surface: v("--surface"), bg2: v("--bg-2") };
  }

  function fit(canvas) {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width * dpr));
    const h = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w: r.width, h: r.height };
  }

  // ---- Leg drawing ---------------------------------------------------------
  function drawStage() {
    const { ctx, w, h } = fit(stage);
    ctx.clearRect(0, 0, w, h);
    const s = Math.min(h / 1.24, w / 1.5);
    const ox = w * 0.34;
    const gy = h - Math.max(18, h * 0.08);
    const X = (pt) => ox + pt.x * s;
    const Y = (pt) => gy - pt.y * s;
    const line = (a, b) => { ctx.beginPath(); ctx.moveTo(X(a), Y(a)); ctx.lineTo(X(b), Y(b)); ctx.stroke(); };
    const poly = (pts) => { ctx.beginPath(); pts.forEach((pt, i) => (i ? ctx.lineTo(X(pt), Y(pt)) : ctx.moveTo(X(pt), Y(pt)))); ctx.closePath(); };
    const along = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

    // Ground and scrolling ticks.
    ctx.strokeStyle = colors.lineStrong;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
    const tick = 0.2 * s;
    const shift = (((state.p / 100) * STRIDE * s) % tick + tick) % tick;
    ctx.strokeStyle = colors.line;
    ctx.lineWidth = 1;
    for (let x = -shift; x < w + tick; x += tick) {
      ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x - 8, gy + 10); ctx.stroke();
    }

    const hy = hipHeight(state.p);
    const P = leg(state.p, 0, hy);
    const S = leg(state.p + 50, 0, hy);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Trunk stub and sound-side leg, behind.
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = colors.muted;
    ctx.lineWidth = 0.13 * s;
    line(P.H, { x: 0.03, y: hy + 0.16 });
    if (ui.sound.checked) {
      ctx.lineWidth = 0.11 * s; line(S.H, S.K);
      ctx.lineWidth = 0.08 * s; line(S.K, S.A);
      ctx.lineWidth = 0.05 * s; line(S.heel, S.toe);
    }
    ctx.globalAlpha = 1;

    // Residual limb and socket.
    const tDir = { x: Math.sin(P.th), y: -Math.cos(P.th) };
    const tN = { x: Math.cos(P.th), y: Math.sin(P.th) }; // anterior normal
    const onThigh = (d, n) => ({ x: P.H.x + tDir.x * d + tN.x * n, y: P.H.y + tDir.y * d + tN.y * n });
    ctx.strokeStyle = colors.muted;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 0.13 * s;
    line(P.H, onThigh(0.16, 0));
    ctx.globalAlpha = 1;
    poly([onThigh(0.1, 0.078), onThigh(0.26, 0.066), onThigh(0.3, 0.03), onThigh(0.3, -0.03), onThigh(0.26, -0.066), onThigh(0.1, -0.078)]);
    ctx.fillStyle = colors.bg2;
    ctx.fill();
    ctx.strokeStyle = colors.ink;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Pyramid adapter down to the knee unit.
    ctx.strokeStyle = colors.ink;
    ctx.lineCap = "butt";
    ctx.lineWidth = 0.045 * s;
    line(onThigh(0.3, 0), onThigh(L_THIGH - 0.04, 0));

    // Shank frame.
    const sDir = { x: Math.sin(P.sh), y: -Math.cos(P.sh) };
    const sN = { x: Math.cos(P.sh), y: Math.sin(P.sh) };
    const onShank = (d, n) => ({ x: P.K.x + sDir.x * d + sN.x * n, y: P.K.y + sDir.y * d + sN.y * n });

    // Knee housing on the shank side, then the pylon.
    poly([onShank(-0.02, 0.04), onShank(0.12, 0.034), onShank(0.12, -0.05), onShank(-0.02, -0.05)]);
    ctx.fillStyle = colors.surface;
    ctx.fill();
    ctx.strokeStyle = colors.ink;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.strokeStyle = colors.steel;
    ctx.lineWidth = 0.026 * s;
    line(onShank(0.12, 0), along(P.K, P.A, 0.93));

    // Hydraulic cylinder: body on the shank, rod to a pivot behind the thigh.
    const valve = VALVE(state.p);
    if (ui.cyl.checked) {
      const base = onShank(0.3, -0.035);
      const pivot = onThigh(L_THIGH - 0.07, -0.05);
      const len = Math.hypot(pivot.x - base.x, pivot.y - base.y);
      const u = { x: (pivot.x - base.x) / len, y: (pivot.y - base.y) / len };
      const bodyEnd = { x: base.x + u.x * 0.15, y: base.y + u.y * 0.15 };
      ctx.lineCap = "round";
      ctx.strokeStyle = colors.ink2;
      ctx.lineWidth = 0.012 * s;
      line(bodyEnd, pivot);
      ctx.strokeStyle = colors.ink;
      ctx.lineWidth = 0.05 * s;
      line(base, bodyEnd);
      ctx.globalAlpha = 0.3 + 0.65 * (1 - valve);
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = 0.032 * s;
      line(along(base, bodyEnd, 0.12), along(base, bodyEnd, 0.88));
      ctx.globalAlpha = 1;
      ctx.fillStyle = colors.ink;
      for (const pt of [base, pivot]) { ctx.beginPath(); ctx.arc(X(pt), Y(pt), 0.012 * s, 0, Math.PI * 2); ctx.fill(); }
    }

    // Foot keel.
    poly([P.foot(-0.04, 0), P.foot(0.035, 0), P.foot(0.2, -0.058), P.foot(0.2, -ANKLE_H), P.foot(-0.06, -ANKLE_H), P.foot(-0.066, -0.045)]);
    ctx.fillStyle = colors.ink;
    ctx.fill();

    // Knee joint.
    ctx.beginPath(); ctx.arc(X(P.K), Y(P.K), 0.034 * s, 0, Math.PI * 2);
    ctx.fillStyle = colors.surface; ctx.fill();
    ctx.strokeStyle = colors.ink; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.arc(X(P.K), Y(P.K), 0.011 * s, 0, Math.PI * 2);
    ctx.fillStyle = colors.accent; ctx.fill();

    // Knee angle arc and label.
    const r = 0.11;
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const a = P.th + (P.sh - P.th) * (i / 24);
      const pt = { x: P.K.x + r * Math.sin(a), y: P.K.y - r * Math.cos(a) };
      i ? ctx.lineTo(X(pt), Y(pt)) : ctx.moveTo(X(pt), Y(pt));
    }
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = colors.muted;
    ctx.lineWidth = 1;
    line(P.K, { x: P.K.x + (r + 0.05) * tDir.x, y: P.K.y + (r + 0.05) * tDir.y });
    ctx.setLineDash([]);
    const lab = { x: P.K.x + 0.12, y: P.K.y + 0.06 };
    ctx.font = `500 ${Math.round(clamp(s * 0.034, 11, 14))}px "JetBrains Mono", monospace`;
    ctx.fillStyle = colors.accent;
    ctx.fillText(`${P.knee.toFixed(1)}°`, X(lab), Y(lab));
  }

  // ---- Trace: knee angle over the gait cycle ------------------------------
  function drawTrace() {
    const { ctx, w, h } = fit(trace);
    ctx.clearRect(0, 0, w, h);
    const padL = 12, padR = 12, padT = 22, padB = 18;
    const pw = w - padL - padR;
    const ph = h - padT - padB;
    const xAt = (p) => padL + (p / 100) * pw;
    const yKnee = (d) => padT + ph - (d / 70) * ph;
    ctx.font = '500 10px "JetBrains Mono", monospace';

    // Stance / swing bands.
    ctx.fillStyle = colors.bg2;
    ctx.fillRect(xAt(STANCE_END), padT, xAt(100) - xAt(STANCE_END), ph);
    ctx.fillStyle = colors.muted;
    ctx.fillText("STANCE", xAt(0) + 4, padT + 12);
    ctx.fillText("SWING", xAt(STANCE_END) + 4, padT + 12);
    ctx.strokeStyle = colors.line;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, padT + ph + 0.5); ctx.lineTo(padL + pw, padT + ph + 0.5); ctx.stroke();
    for (const p of [0, 25, 50, 75, 100]) {
      ctx.fillText(`${p}%`, clamp(xAt(p) - 10, padL, w - padR - 26), h - 4);
    }

    // Knee angle.
    ctx.beginPath();
    for (let p = 0; p <= 100; p += 0.5) { const x = xAt(p), y = yKnee(KNEE(p)); p ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Cursor.
    const p = wrap100(state.p);
    ctx.strokeStyle = colors.ink;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(xAt(p), padT); ctx.lineTo(xAt(p), padT + ph); ctx.stroke();
    ctx.fillStyle = colors.accent;
    ctx.beginPath(); ctx.arc(xAt(p), yKnee(KNEE(p)), 4, 0, Math.PI * 2); ctx.fill();

    // Legend.
    ctx.textAlign = "right";
    ctx.fillStyle = colors.accent;
    ctx.fillText("KNEE ANGLE", w - padR, padT - 8);
    ctx.textAlign = "left";
  }

  // ---- Readouts ------------------------------------------------------------
  // Every phase name and description sits in the same grid cell, so the box
  // is always as tall as the longest one and the trace below never shifts.
  const layer = (box, tag, key) => {
    box.replaceChildren(...PHASES.map((ph) => {
      const el = document.createElement(tag);
      el.textContent = ph[key];
      return el;
    }));
    return [...box.children];
  };
  const nameLayers = layer(ui.phase, "b", "name");
  const textLayers = layer(ui.text, "span", "text");
  let lastPhase = -1;
  function updateUI() {
    const p = wrap100(state.p);
    const ph = phaseAt(p);
    ui.pct.textContent = `${p.toFixed(0)}%`;
    ui.knee.textContent = `${KNEE(p).toFixed(1)}°`;
    const idx = PHASES.indexOf(ph);
    if (idx !== lastPhase) {
      lastPhase = idx;
      ui.mode.textContent = ph.mode;
      nameLayers.forEach((el, i) => el.classList.toggle("is-active", i === idx));
      textLayers.forEach((el, i) => el.classList.toggle("is-active", i === idx));
    }
    if (!state.dragging && document.activeElement !== ui.scrub) ui.scrub.value = p.toFixed(1);
  }

  function render() {
    drawStage();
    drawTrace();
    updateUI();
  }

  function frame(t) {
    raf = 0;
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
    last = t;
    if (state.playing && !state.dragging) state.p = wrap100(state.p + dt * state.freq * 100);
    render();
    if (state.playing && state.visible && !document.hidden) raf = requestAnimationFrame(frame);
  }

  // Paused: draw now. Playing: make sure the loop is running.
  function kick() {
    if (!state.playing) { render(); return; }
    if (!raf) { last = 0; raf = requestAnimationFrame(frame); }
  }

  function setPlaying(on) {
    state.playing = on;
    root.classList.toggle("is-paused", !on);
    ui.play.textContent = on ? "Pause" : "Play";
    ui.play.setAttribute("aria-pressed", String(!on));
    kick();
  }

  // ---- Controls ------------------------------------------------------------
  ui.play.addEventListener("click", () => setPlaying(!state.playing));
  // The slider is in steps per minute; two steps make one gait cycle.
  const showSpeed = () => (ui.speedOut.textContent = `${ui.speed.value} steps/min`);
  ui.speed.addEventListener("input", () => { state.freq = parseFloat(ui.speed.value) / 120; showSpeed(); });
  ui.scrub.addEventListener("input", () => { state.p = parseFloat(ui.scrub.value); setPlaying(false); });
  ui.sound.addEventListener("change", kick);
  ui.cyl.addEventListener("change", kick);

  const scrubTo = (e) => {
    const r = traceBox.getBoundingClientRect();
    state.p = clamp(((e.clientX - r.left - 12) / (r.width - 24)) * 100, 0, 99.9);
    kick();
  };
  traceBox.addEventListener("pointerdown", (e) => {
    state.dragging = true;
    traceBox.setPointerCapture(e.pointerId);
    scrubTo(e);
  });
  traceBox.addEventListener("pointermove", (e) => { if (state.dragging) scrubTo(e); });
  const endDrag = () => { if (state.dragging) { state.dragging = false; kick(); } };
  traceBox.addEventListener("pointerup", endDrag);
  traceBox.addEventListener("pointercancel", endDrag);

  // Pause work when the figure is off screen or the tab is hidden.
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([e]) => { state.visible = e.isIntersecting; if (state.visible) kick(); }).observe(root);
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden) kick(); });
  new ResizeObserver(() => kick()).observe(root);
  const refreshColors = () => { colors = readColors(); kick(); };
  document.addEventListener("themechange", refreshColors);
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", refreshColors);
  if (document.fonts) document.fonts.ready.then(kick);

  showSpeed();
  setPlaying(state.playing);
}

const kneeRoot = document.querySelector("[data-knee]");
if (kneeRoot) start(kneeRoot);
