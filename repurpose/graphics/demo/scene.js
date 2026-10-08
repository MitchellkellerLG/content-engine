// The README demo: the content-engine loop, in Legion brand colours.
// Render: python repurpose/graphics/render.py repurpose/graphics/demo --theme legion --video --name demo
const K = Kit({
  eyebrow: "content-engine",
  title: "Your whole content loop, in one repo",
  handle: "@MitchellKeller_",
  corner: "joinlegion.io",
  T: 14,
});
const { M } = K;

const W = 340, H = 168, GAP = (1280 - 2 * M - 3 * W) / 2;
const X = [M, M + W + GAP, M + 2 * (W + GAP)];
const Y1 = 160, Y2 = 392;
const steps = [
  { n: "1", t: "Gather", s: "Bookmarks, what you shipped, your call notes.", chips: ["bookmarks.py", "github_activity.sh"], x: X[0], y: Y1 },
  { n: "2", t: "Ideas", s: "3 to 7 ranked ideas, scored against your past winners.", chips: ["daily-brief.md", "score_ideas.py"], x: X[1], y: Y1 },
  { n: "3", t: "Your voice", s: "Every draft reads your voice.md first, then a slop pass.", chips: ["VOICE.md", "no-ai-slop"], x: X[2], y: Y1 },
  { n: "4", t: "Repurpose", s: "X post to LinkedIn post, plus a graphic like this one.", chips: ["x-to-linkedin.md", "render.py"], x: X[2], y: Y2 },
  { n: "5", t: "Schedule", s: "Drafts land in Typefully. You approve every post.", chips: ["typefully"], x: X[1], y: Y2 },
  { n: "6", t: "Measure", s: "Plug and repost only the posts that cleared your bar.", chips: ["Trigger.dev", "opt-in"], x: X[0], y: Y2 },
];
const cards = steps.map((s, i) => {
  const t0 = 0.25 + i * 0.4;
  return K.card({ left: s.x, top: s.y, width: W, height: H, padding: "18px 20px" },
    `<div style="display:flex;align-items:center;gap:12px"><span class="badge" style="width:34px;height:34px;font-size:17px">${s.n}</span><div class="ttl lg2">${s.t}</div></div>` +
    `<div class="sub" style="margin-top:10px">${s.s}</div>` +
    `<div class="chips">${s.chips.map((c) => `<span class="cmd acc">${c}</span>`).join("")}</div>`,
    t0, { dy: 14 });
});
K.onLayout(() => {
  const right = (a, b, t0) => K.wire(() => [K.anchor(cards[a], "right"), K.anchor(cards[b], "left")], { t0 });
  const left = (a, b, t0) => K.wire(() => [K.anchor(cards[a], "left"), K.anchor(cards[b], "right")], { t0 });
  right(0, 1, 0.9);
  right(1, 2, 1.3);
  K.wire(() => [K.anchor(cards[2], "bottom"), K.anchor(cards[3], "top")], { t0: 1.7 });
  left(3, 4, 2.1);
  left(4, 5, 2.5);
  K.wire(() => [K.anchor(cards[5], "top"), K.anchor(cards[0], "bottom")], { t0: 2.9, dashed: true });
});
const loop = K.pillAt("loops back into tomorrow's ideas", 3.3, "solid");
K.onLayout(() => { const a = K.box(cards[0]), b = K.box(cards[5]); K.place(loop, a.cx, (a.b + b.y) / 2); });
K.states(steps.map((_, i) => ({ t: 4.0 + i * 1.4, hi: [cards[i]] })));
K.start();
