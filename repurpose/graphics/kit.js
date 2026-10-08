// Animated diagram kit: 1280x720 scenes with a deterministic render(t), so a
// headless browser can capture exact frames, plus a live loop when you just
// open index.html in a browser.
//
// A scene (scene.js) calls Kit({...}) once, adds cards / chips / wires, and
// finishes with K.start(). Persistent pieces: header (eyebrow + title +
// optional pill), footer (handle bottom-left, corner text bottom-right) and a
// progress bar. Motion: staggered build-on, wires draw then flow, optional
// state cycles (.on / .hi classes), pills pop, pulse dots, fade-out to loop.
window.Kit = function (cfg) {
  const W = 1280, H = 720;
  const T = cfg.T || 14, M = 64, OUT = cfg.out || [T - 0.7, T - 0.15];
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const easeOut = (p) => 1 - Math.pow(1 - clamp(p), 3);
  const backOut = (p) => { const c = 1.9; p = clamp(p); return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); };
  const stage = document.getElementById("stage"), wires = document.getElementById("wires");
  const tokens = getComputedStyle(document.documentElement);
  const tok = (name, fallback) => (tokens.getPropertyValue(name).trim() || fallback);
  const WIRE = tok("--wire", "#7a8a99"), WIRE_HI = tok("--wire-hi", "#c9d3dc"), PULSE = tok("--pulse-rgb", "120 130 140");

  const $ = (tag, cls, parent, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; if (parent) parent.appendChild(e); return e; };
  const css = (e, o) => { for (const k in o) e.style[k] = (typeof o[k] === "number" && !/opacity|zIndex|flex/.test(k)) ? o[k] + "px" : o[k]; return e; };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const head = css($("div", "abs", stage), { left: 0, top: 0, width: W, height: H });
  stage.appendChild(wires);
  const layer = css($("div", "abs", stage), { left: 0, top: 0, width: W, height: H });
  const anims = [], wireList = [], frames = [], layouts = [], states = [];
  const K = { M, T, W, H, $, css, esc, clamp, easeOut, backOut, layer, stage };

  // header (title and eyebrow accept trusted HTML from your own scene file)
  K.eyebrow = css($("div", "eyebrow abs", head, `<i class="pulse"></i>${cfg.eyebrow || ""}`), { left: M, top: 24 });
  K.h1 = css($("h1", "abs", head, cfg.title || ""), { left: M, top: 70 });
  if (cfg.pill) K.pill = css($("div", "cmd datepill abs", head, cfg.pill), { right: M, top: 26 });

  // footer + progress bar
  const prog = $("div", "prog", stage, "<i></i>");
  $("div", "footer", stage, `<div class="mark"><span class="dot pulse"></span>${esc(cfg.handle || "@yourhandle")}</div><div class="corner">${esc(cfg.corner || "yourdomain.com")}</div>`);

  // building blocks
  K.appear = (el, t0, o = {}) => { anims.push(Object.assign({ el, t0, dur: 0.55, dy: 16, dx: 0, pop: false }, o)); return el; };
  K.el = (cls, html, style, t0, o) => { const e = css($("div", cls, layer, html), style || {}); if (t0 != null) K.appear(e, t0, o); return e; };
  K.card = (style, html, t0, o) => K.el("card", html, style, t0, o);
  K.k = (text, x, y, t0) => K.el("k abs", text, { left: x, top: y }, t0, { dy: 8 });
  K.pillAt = (text, t0, cls = "") => K.el("apill " + cls, text, {}, t0, { dy: 0, pop: true, dur: 0.45 });
  K.place = (el, cx, cy) => css(el, { left: cx - el.offsetWidth / 2, top: cy - el.offsetHeight / 2 });
  // your own image (put it next to scene.js); only use images you have the right to use
  K.img = (src, cls = "") => `<span class="tile ${cls}"><img src="${esc(src)}" alt=""></span>`;

  // geometry in stage coordinates
  K.box = (el) => { const s = stage.getBoundingClientRect(), r = el.getBoundingClientRect(); return { x: r.left - s.left, y: r.top - s.top, w: r.width, h: r.height, r: r.right - s.left, b: r.bottom - s.top, cx: r.left - s.left + r.width / 2, cy: r.top - s.top + r.height / 2 }; };
  K.anchor = (el, side, gap = 4) => { const b = K.box(el); return { top: [b.cx, b.y - gap], bottom: [b.cx, b.b + gap], left: [b.x - gap, b.cy], right: [b.r + gap, b.cy] }[side]; };
  K.rounded = (pts, R = 12) => {
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
      const r = Math.min(R, Math.hypot(x1 - x0, y1 - y0) / 2, Math.hypot(x2 - x1, y2 - y1) / 2);
      d += ` L${x1 - Math.sign(x1 - x0) * r},${y1 - Math.sign(y1 - y0) * r} Q${x1},${y1} ${x1 + Math.sign(x2 - x1) * r},${y1 + Math.sign(y2 - y1) * r}`;
    }
    const e = pts[pts.length - 1];
    return d + ` L${e[0]},${e[1]}`;
  };

  // wires: pts is a function evaluated after layout -> array of [x, y]
  const NS = "http://www.w3.org/2000/svg";
  wires.innerHTML = `<defs><marker id="ah" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${WIRE}"/></marker></defs>`;
  K.wire = (pts, o = {}) => { const w = Object.assign({ pts, t0: 0, dur: 0.6, speed: 44, arrow: true, dashed: false, group: null }, o); wireList.push(w); return w; };
  function buildWire(w) {
    const d = K.rounded(w.pts());
    const mk = () => { const p = document.createElementNS(NS, "path"); p.setAttribute("d", d); p.setAttribute("fill", "none"); p.setAttribute("stroke-linecap", "round"); p.setAttribute("stroke-linejoin", "round"); wires.appendChild(p); return p; };
    w.base = mk(); w.ant = mk();
    w.base.setAttribute("stroke", WIRE); w.base.setAttribute("stroke-width", 2); w.base.setAttribute("pathLength", "1");
    w.ant.setAttribute("stroke", w.dashed ? WIRE : WIRE_HI); w.ant.setAttribute("stroke-width", w.dashed ? 2.2 : 2.6);
    w.ant.setAttribute("stroke-dasharray", w.dashed ? "7 7" : "6 20");
    w.len = w.ant.getTotalLength();
  }

  // state cycle: [{t, on:[els], hi:[els], wires:[groups]}]; before the first t, everything is active
  K.states = (list) => { states.push(...list); };
  K.state = (t) => { let s = -1; states.forEach((st, i) => { if (t >= st.t) s = i; }); return s; };
  K.onFrame = (fn) => frames.push(fn);
  K.onLayout = (fn) => layouts.push(fn);

  const touched = new Set();
  window.render = function (t) {
    t = ((t % T) + T) % T;
    const ph = t / T, TAU = Math.PI * 2, keep = 1 - easeOut((t - OUT[0]) / (OUT[1] - OUT[0]));
    layer.style.opacity = keep; wires.style.opacity = keep;
    for (const a of anims) {
      const p = clamp((t - a.t0) / a.dur), e = easeOut(p);
      a.el.style.opacity = e;
      const s = a.pop ? (p >= 1 ? 1 : 0.55 + 0.45 * backOut(p)) : 1;
      a.el.style.transform = `translate(${(1 - e) * a.dx}px,${(1 - e) * a.dy}px) scale(${s})`;
    }
    const si = K.state(t), st = si >= 0 ? states[si] : null;
    states.forEach((s) => [...(s.on || []), ...(s.hi || [])].forEach((el) => touched.add(el)));
    touched.forEach((el) => el.classList.remove("on", "hi"));
    if (st) { (st.on || []).forEach((el) => el.classList.add("on")); (st.hi || []).forEach((el) => el.classList.add("hi")); }
    for (const w of wireList) {
      const p = easeOut((t - w.t0) / w.dur), flow = clamp((t - w.t0 - w.dur) / 0.4);
      const active = !st || !st.wires || !w.group || st.wires.includes(w.group);
      if (w.dashed) {
        w.base.style.opacity = 0; w.ant.style.opacity = p > 0 ? 1 : 0;
        if (p < 1) { w.ant.setAttribute("stroke-dasharray", `${w.len * p} ${w.len}`); w.ant.setAttribute("stroke-dashoffset", "0"); }
        else { w.ant.setAttribute("stroke-dasharray", "7 7"); w.ant.setAttribute("stroke-dashoffset", String(-(t * w.speed))); }
      } else {
        w.base.setAttribute("stroke-dasharray", "1 1"); w.base.setAttribute("stroke-dashoffset", String(1 - p));
        w.base.style.opacity = p > 0 ? (active ? 0.85 : 0.28) : 0;
        w.base.setAttribute("marker-end", (w.arrow && p >= 0.98) ? "url(#ah)" : "");
        w.ant.style.opacity = flow * (active ? 1 : 0.12); w.ant.setAttribute("stroke-dashoffset", String(-(t * w.speed)));
      }
    }
    frames.forEach((fn) => fn(t, si, st));
    document.querySelectorAll(".sweep").forEach((el, i) => el.style.setProperty("--a", ((ph * 720 + i * 120) % 360) + "deg"));
    document.querySelectorAll(".pulse").forEach((el) => { const s = Math.max(0, Math.sin(TAU * ph * 3)); el.style.transform = `scale(${1 + 0.35 * s})`; el.style.boxShadow = `0 0 0 ${6 * s}px rgb(${PULSE} / ${0.25 * s})`; });
    prog.firstChild.style.width = (Math.min(1, t / T) * 100) + "%";
  };
  window.maxT = () => T;
  window.holdT = () => Math.max(0, OUT[0] - 0.05); // last fully built frame, before the loop fades out

  // layout lint: text spilling out of its card or off the canvas, overlapping cards
  window.checkOverflow = function () {
    const out = [], R = (e) => e.getBoundingClientRect(), sr = R(stage);
    const hosts = [...document.querySelectorAll(".card,.cmd,.eyebrow,.apill")];
    document.querySelectorAll(".card *, .cmd, .k, h1, .eyebrow, .apill, .footer *").forEach((el) => {
      if (!el.textContent.trim() || el.querySelector("div")) return;
      const r = R(el), label = el.textContent.trim().slice(0, 40);
      if (r.right > sr.right - 8 || r.left < sr.left + 8 || r.bottom > sr.bottom - 4 || r.top < sr.top + 4) out.push("off-canvas: " + label);
      const host = hosts.filter((h) => h !== el && h.contains(el)).sort((a, b) => R(a).width - R(b).width)[0];
      if (host) {
        const hr = R(host);
        if (r.right > hr.right - 3 || r.left < hr.left + 2) out.push(`spill-x(${Math.round(hr.right - r.right)}): ` + label);
        if (r.bottom > hr.bottom - 3) out.push(`spill-y(${Math.round(hr.bottom - r.bottom)}): ` + label);
      }
    });
    if (K.pill && R(K.h1).right > R(K.pill).left - 16) out.push("title collides with pill");
    const cs = [...document.querySelectorAll(".card")].map((c) => [c, R(c)]);
    const hit = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
    for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
      if (cs[i][0].contains(cs[j][0]) || cs[j][0].contains(cs[i][0])) continue;
      if (hit(cs[i][1], cs[j][1])) out.push("cards overlap: " + cs[i][0].textContent.trim().slice(0, 20) + " / " + cs[j][0].textContent.trim().slice(0, 20));
    }
    document.querySelectorAll(".apill").forEach((p) => { const a = R(p); cs.forEach(([c, b]) => { if (!c.contains(p) && hit(a, b)) out.push("pill overlaps card: " + p.textContent.slice(0, 20)); }); });
    return [...new Set(out)];
  };

  K.start = () => Promise.all([document.fonts.ready, ...[...document.images].map((i) => i.complete ? 1 : new Promise((r) => { i.onload = i.onerror = r; }))]).then(() => {
    layouts.forEach((fn) => fn()); wireList.forEach(buildWire); render(0); window.READY = true;
    if (!/capture/.test(location.search)) { const t0 = performance.now(); const loop = (now) => { render((now - t0) / 1000); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
  });
  return K;
};
