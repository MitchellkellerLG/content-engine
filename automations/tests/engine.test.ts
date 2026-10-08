import { test } from "node:test";
import assert from "node:assert/strict";
import { planSlots, runChecks, runPoll, runSlots } from "../src/core/engine.ts";
import { XApiError, XQuotaError } from "../src/lib/x-client.ts";
import { cfg, deps, fakeX, post, PLUGS } from "./helpers.ts";
import { PlugConfigError } from "../src/lib/plugs.ts";

const T0 = "2026-03-02T12:00:00.000Z";
const at = (iso: string) => ({ t: new Date(iso) });
const plus = (h: number) => new Date(new Date(T0).getTime() + h * 3600_000);

test("disabled by default: no X calls at all", async () => {
  const { x, calls } = fakeX([post("10", T0)]);
  const { d } = deps(cfg(), x, at(T0));
  assert.equal((await runPoll(d)).skipped, "disabled");
  await runChecks(d);
  await runSlots(d);
  assert.deepEqual(calls, []);
});

test("notify mode: passes bar, sends suggested reply, never posts", async () => {
  const { x, calls } = fakeX([post("10", T0)], { "10": 5000 });
  const clock = at(T0);
  const { d, mem, notes } = deps(cfg({ PLUG_ENABLED: "true" }), x, clock);
  await runPoll(d);
  clock.t = plus(1);
  assert.equal((await runChecks(d)).checked, 0, "not due before 2h");
  clock.t = plus(2.1);
  await runChecks(d);
  const row = mem.posts.get("10")!;
  assert.equal(row.status, "passed");
  assert.equal(row.plugStatus, "notified");
  assert.match(notes[0], /utm_content=10/);
  assert.ok(!calls.some((c) => c.startsWith("reply")));
  assert.equal(mem.slots.size, 0, "no reposts unless AUTO_RT_ENABLED");
});

test("below the bar: no plug, never re-checked", async () => {
  const { x, calls } = fakeX([post("10", T0)], { "10": 50 });
  const clock = at(T0);
  const { d, mem } = deps(cfg({ PLUG_ENABLED: "true", PLUG_MODE: "reply" }), x, clock);
  await runPoll(d);
  clock.t = plus(2.1);
  await runChecks(d);
  clock.t = plus(3);
  await runChecks(d);
  assert.equal(mem.posts.get("10")!.status, "below_bar");
  assert.equal(calls.filter((c) => c.startsWith("imp")).length, 1);
});

test("reply mode posts once and rotates plugs", async () => {
  const { x, calls } = fakeX([post("10", T0), post("11", T0)], { "10": 5000, "11": 5000 });
  const clock = at(T0);
  const { d, mem } = deps(cfg({ PLUG_ENABLED: "true", PLUG_MODE: "reply" }), x, clock);
  await runPoll(d);
  clock.t = plus(2.1);
  await runChecks(d);
  await runChecks(d);
  const replies = calls.filter((c) => c.startsWith("reply"));
  assert.equal(replies.length, 2);
  assert.ok(replies.some((r) => r.includes("utm_campaign=letter")));
  assert.ok(replies.some((r) => r.includes("utm_campaign=video")));
  assert.equal(mem.posts.get("10")!.plugStatus, "replied");
});

test("failed reply is recorded, reported and not retried", async () => {
  const fx = fakeX([post("10", T0)], { "10": 5000 });
  fx.fail.reply = new XApiError(403, "reply not allowed");
  const clock = at(T0);
  const { d, mem, notes } = deps(cfg({ PLUG_ENABLED: "true", PLUG_MODE: "reply" }), fx.x, clock);
  await runPoll(d);
  clock.t = plus(2.1);
  await runChecks(d);
  await runChecks(d);
  assert.equal(mem.posts.get("10")!.plugStatus, "failed");
  assert.equal(fx.calls.filter((c) => c.startsWith("reply")).length, 1);
  assert.match(notes[0], /not retried/);
});

test("quota error releases the row and propagates", async () => {
  const fx = fakeX([post("10", T0)], { "10": 5000 });
  fx.fail.reply = new XQuotaError(429, "slow down");
  const clock = at(T0);
  const { d, mem } = deps(cfg({ PLUG_ENABLED: "true", PLUG_MODE: "reply" }), fx.x, clock);
  await runPoll(d);
  clock.t = plus(2.1);
  await assert.rejects(runChecks(d), XQuotaError);
  assert.equal(mem.posts.get("10")!.status, "pending");
});

test("skips posts that already link a plug, old posts, and bad dates", async () => {
  const { x } = fakeX([
    post("10", T0, { urls: ["https://news.test/letter"] }),
    post("11", "2026-03-01T00:00:00.000Z"),
    post("12", "2026-03-02 12:00"),
  ]);
  const { d, mem, } = deps(cfg({ PLUG_ENABLED: "true" }), x, at(T0));
  await runPoll(d);
  assert.equal(mem.posts.get("10")!.skipReason, "already_links_plug");
  assert.equal(mem.posts.get("11")!.skipReason, "too_old");
  assert.equal(mem.posts.has("12"), false);
  assert.equal(mem.state.sinceId, "12");
});

test("plan: one repost by default; bumps only with the second flag; no missed bumps", () => {
  const c1 = cfg({ AUTO_RT_ENABLED: "true" });
  assert.deepEqual(planSlots("1", new Date(T0), c1, new Date(T0)).map((s) => s.action), ["repost"]);
  const c2 = cfg({ AUTO_RT_ENABLED: "true", AUTO_RT_BUMPS_ENABLED: "true", AUTO_RT_BUMPS: "2" });
  assert.deepEqual(planSlots("1", new Date(T0), c2, new Date(T0)).map((s) => s.action), ["repost", "bump", "bump"]);
  const late = planSlots("1", new Date(T0), c2, plus(9));
  assert.deepEqual(late.map((s) => s.action), ["repost", "bump"]);
  assert.deepEqual(planSlots("1", new Date(T0), cfg(), new Date(T0)), []);
});

test("auto-repost runs on schedule and respects the daily write cap", async () => {
  const { x, calls } = fakeX([post("10", T0), post("11", T0), post("12", T0)], { "10": 5000, "11": 5000, "12": 5000 });
  const clock = at(T0);
  const { d, mem } = deps(cfg({ AUTO_RT_ENABLED: "true", AUTO_RT_DAILY_WRITE_CAP: "2" }), x, clock);
  await runPoll(d);
  clock.t = plus(2.1);
  await runChecks(d);
  assert.equal(mem.slots.size, 3);
  clock.t = plus(3);
  await runSlots(d);
  assert.equal(calls.filter((c) => c.startsWith("repost")).length, 0, "not due yet");
  clock.t = plus(4.1);
  await runSlots(d);
  assert.equal(calls.filter((c) => c.startsWith("repost")).length, 2, "cap of 2 writes");
  assert.equal([...mem.slots.values()].filter((s) => s.status === "pending").length, 1);
});

test("bump: un-repost then repost; half-done bump is reported", async () => {
  const fx = fakeX([post("10", T0)], { "10": 5000 });
  const clock = at(T0);
  const { d, mem, notes } = deps(cfg({ AUTO_RT_ENABLED: "true", AUTO_RT_BUMPS_ENABLED: "true" }), fx.x, clock);
  await runPoll(d);
  clock.t = plus(2.1);
  await runChecks(d);
  clock.t = plus(4.1);
  await runSlots(d);
  fx.fail.repost = new XApiError(500, "boom");
  clock.t = plus(8.1);
  await runSlots(d);
  assert.deepEqual(fx.calls.filter((c) => /repost/.test(c)), ["repost:10", "unrepost:10", "repost:10"]);
  assert.equal(mem.slots.get("10#1")!.status, "failed");
  assert.match(notes.at(-1)!, /no longer reposted/);
});

test("turning bumps off later skips planned bumps", async () => {
  const fx = fakeX([post("10", T0)], { "10": 5000 });
  const clock = at(T0);
  const { d, mem } = deps(cfg({ AUTO_RT_ENABLED: "true", AUTO_RT_BUMPS_ENABLED: "true" }), fx.x, clock);
  await runPoll(d);
  clock.t = plus(2.1);
  await runChecks(d);
  d.cfg = cfg({ AUTO_RT_ENABLED: "true" });
  clock.t = plus(9);
  await runSlots(d);
  assert.equal(mem.slots.get("10#1")!.status, "skipped");
  assert.ok(!fx.calls.includes("unrepost:10"));
});

test("placeholder plug links stop the job before any X call", async () => {
  const { x, calls } = fakeX([post("10", T0)], { "10": 5000 });
  const { d } = deps(cfg({ PLUG_ENABLED: "true", PLUG_MODE: "reply" }), x, at(T0));
  d.plugs = [{ ...PLUGS[0], url: "https://example.com/newsletter" }];
  await assert.rejects(runPoll(d), PlugConfigError);
  await assert.rejects(runChecks(d), PlugConfigError);
  assert.deepEqual(calls, []);
});

test("a run that dies after the reply is sent never plugs the post again", async () => {
  const { x, calls } = fakeX([post("10", T0)], { "10": 5000 });
  const clock = at(T0);
  const { d, mem } = deps(cfg({ PLUG_ENABLED: "true", PLUG_MODE: "reply" }), x, clock);
  await runPoll(d);
  clock.t = plus(2.1);
  const real = d.store.finishCheck;
  d.store.finishCheck = async (id, r) => {
    if (r.plugStatus === "replied") throw new Error("db went away"); // X accepted, save failed
    return real(id, r);
  };
  await assert.rejects(runChecks(d), /db went away/);
  d.store.finishCheck = real;
  assert.equal(mem.posts.get("10")!.status, "passed");
  assert.equal(mem.posts.get("10")!.plugError, "reply sent; outcome unknown");
  clock.t = plus(3);
  await runChecks(d);
  assert.equal(calls.filter((c) => c.startsWith("reply")).length, 1);
});

test("quota error on the reply itself puts the post back", async () => {
  const fx = fakeX([post("10", T0)], { "10": 5000 });
  const clock = at(T0);
  const { d, mem } = deps(cfg({ PLUG_ENABLED: "true", PLUG_MODE: "reply" }), fx.x, clock);
  await runPoll(d);
  fx.fail.reply = new XQuotaError(429, "slow down");
  clock.t = plus(2.1);
  await assert.rejects(runChecks(d), XQuotaError);
  assert.equal(mem.posts.get("10")!.status, "pending");
  assert.equal(mem.posts.get("10")!.plugStatus, null);
});

test("an interrupted repost slot is failed and reported, never retried", async () => {
  const fx = fakeX([post("10", T0)], { "10": 5000 });
  const clock = at(T0);
  const { d, mem, notes } = deps(cfg({ AUTO_RT_ENABLED: "true" }), fx.x, clock);
  await runPoll(d);
  clock.t = plus(2.1);
  await runChecks(d);
  clock.t = plus(4.1);
  const claimed = await d.store.claimDueSlots(clock.t, 10); // a run claims it, then dies
  assert.equal(claimed.length, 1);
  clock.t = plus(5);
  await runSlots(d);
  assert.equal(mem.slots.get("10#0")!.status, "failed");
  assert.match(notes.at(-1)!, /interrupted/);
  assert.ok(!fx.calls.some((c) => c.startsWith("repost")));
});

test("the daily cap counts writes by when they happened", async () => {
  const { d, mem } = deps(cfg({ AUTO_RT_ENABLED: "true", AUTO_RT_DAILY_WRITE_CAP: "1" }), fakeX().x, at("2026-03-02T23:50:00Z"));
  await d.store.recordWrite("10", 0, "repost");
  mem.setClock(() => new Date("2026-03-03T00:10:00Z"));
  assert.equal(await d.store.writesSince(new Date("2026-03-03T00:00:00Z")), 0);
  assert.equal(await d.store.writesSince(new Date("2026-03-02T00:00:00Z")), 1);
});

test("quota error after a bump's un-repost fails the slot instead of redoing it", async () => {
  const fx = fakeX([post("10", T0)], { "10": 5000 });
  const clock = at(T0);
  const { d, mem, notes } = deps(cfg({ AUTO_RT_ENABLED: "true", AUTO_RT_BUMPS_ENABLED: "true" }), fx.x, clock);
  await runPoll(d);
  clock.t = plus(2.1);
  await runChecks(d);
  clock.t = plus(4.1);
  await runSlots(d);
  fx.fail.repost = new XQuotaError(429, "slow down");
  clock.t = plus(8.1);
  await assert.rejects(runSlots(d), XQuotaError);
  assert.equal(mem.slots.get("10#1")!.status, "failed");
  assert.match(notes.at(-1)!, /no longer reposted/);
  delete fx.fail.repost;
  clock.t = plus(9);
  await runSlots(d);
  assert.equal(fx.calls.filter((c) => c === "unrepost:10").length, 1);
});
