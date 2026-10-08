// Example scene: three numbered cards that build on, then highlight in turn.
// Copy this folder, change the words, render. Every word should come from your post.
const K = Kit({
  eyebrow: "Example scene",
  title: "One post, three formats",
  handle: "@yourhandle",
  corner: "yourdomain.com",
  T: 14,
});
const { M } = K;

const steps = [
  { n: "1", t: "The X post", s: "The idea in its shortest form. It already proved itself.", chips: ["your words", "your numbers"] },
  { n: "2", t: "The LinkedIn rewrite", s: "Same proof, more context up top, link in the first comment.", chips: ["x-to-linkedin.md", "no-ai-slop"], acc: [0] },
  { n: "3", t: "The animated graphic", s: "Fourteen seconds that explain the idea without sound.", chips: ["scene.js", "render.py"], acc: [1] },
];
const X0 = M, BADGE = 44, CX = X0 + 60, CW = 700, Y = [150, 300, 450], CH = 124;
const cards = [];
steps.forEach((s, i) => {
  const t0 = 0.3 + i * 0.55;
  K.el("badge abs", s.n, { left: X0, top: Y[i] + CH / 2 - BADGE / 2, width: BADGE, height: BADGE, fontSize: "20px", zIndex: 2 }, t0, { dy: 0, pop: true, dur: 0.45 });
  const c = K.card({ left: CX, top: Y[i], width: CW, height: CH, padding: "16px 20px" },
    `<div class="ttl lg2">${s.t}</div><div class="sub" style="margin-top:4px">${s.s}</div>` +
    `<div class="chips">${s.chips.map((c, j) => `<span class="cmd ${(s.acc || []).includes(j) ? "acc" : ""}">${c}</span>`).join("")}</div>`,
    t0 + 0.1, { dx: -18, dy: 0 });
  cards.push(c);
});
// a summary card on the right
const sum = K.card({ left: 900, top: 230, width: 316, height: 220, padding: "22px 24px" },
  `<div class="k">Output</div><div class="big" style="margin-top:14px">3 posts</div><div class="sub" style="margin-top:10px">from one idea you already know works</div>`, 2.2, { dx: 18, dy: 0 });
K.onLayout(() => {
  cards.forEach((c) => K.wire(() => { const a = K.anchor(c, "right"); const b = K.anchor(sum, "left"); const mx = (a[0] + b[0]) / 2; return [a, [mx, a[1]], [mx, b[1]], b]; }, { t0: 2.4, group: "out" }));
});
K.states([
  { t: 4.0, hi: [cards[0]] },
  { t: 6.0, hi: [cards[1]] },
  { t: 8.0, hi: [cards[2]] },
  { t: 10.0, hi: [sum] },
]);
K.start();
