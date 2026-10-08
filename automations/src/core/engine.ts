/**
 * The three jobs, written as plain async functions so they can be tested
 * without Trigger.dev, Postgres or the X API. The Trigger tasks in
 * src/trigger/ are thin wrappers around these.
 *
 *   runPoll   - record your new posts and when each should be checked
 *   runChecks - one impressions check per post; plug (notify or reply) and
 *               plan reposts for posts that pass the bar
 *   runSlots  - perform due reposts / bumps, under a daily write cap
 */
import type { Config } from "../lib/config.ts";
import { nextPlug, plugHosts, plugText, validatePlugs, type Plug } from "../lib/plugs.ts";
import type { CheckResult, PostRow, SlotRow, Store } from "../lib/store.ts";
import { XQuotaError, type XClient, type XPost } from "../lib/x-client.ts";

export type Notify = (text: string) => Promise<boolean>;

export interface Deps {
  cfg: Config;
  store: Store;
  x: XClient;
  plugs: readonly Plug[];
  notify: Notify;
  now: () => Date;
  log?: (msg: string, data?: Record<string, unknown>) => void;
}

const HOUR = 3600_000;
const MIN = 60_000;

export function postUrl(handle: string, id: string): string {
  return `https://x.com/${handle}/status/${id}`;
}

function parseDate(s: string): Date | null {
  // X returns ISO 8601 with a Z. Anything without an explicit zone is rejected.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(s)) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function maxId(ids: string[]): string | null {
  return ids.reduce<string | null>((m, id) => (m === null || BigInt(id) > BigInt(m) ? id : m), null);
}

export function linksToPlug(post: Pick<XPost, "text" | "urls">, hosts: string[]): boolean {
  const hay = [post.text, ...post.urls].join(" ").toLowerCase();
  return hosts.some((h) => hay.includes(h));
}

export function anythingEnabled(cfg: Config): boolean {
  return cfg.plugEnabled || cfg.autoRtEnabled;
}

export async function runPoll(d: Deps) {
  const log = d.log ?? (() => {});
  if (!anythingEnabled(d.cfg)) {
    log("nothing enabled (PLUG_ENABLED and AUTO_RT_ENABLED are off); skipping without calling X");
    return { skipped: "disabled" as const, seen: 0, queued: 0 };
  }
  // A broken or placeholder plugs.config.ts stops the job before any X call.
  if (d.cfg.plugEnabled) validatePlugs(d.plugs);
  const now = d.now();
  const { sinceId } = await d.store.getState();
  const posts = await d.x.recentPosts(d.cfg.xUserId, sinceId);
  // Only plug posts young enough to still be checked on time. On the very
  // first run this means old posts are recorded as skipped, never plugged.
  const oldest = now.getTime() - (d.cfg.plugCheckAfterMinutes + d.cfg.plugCheckMaxLateMinutes) * MIN;
  const hosts = d.cfg.plugEnabled ? plugHosts(d.plugs) : [];
  let queued = 0;
  for (const p of posts) {
    const createdAt = parseDate(p.createdAt);
    if (!createdAt) {
      log("post has no usable created_at; ignored", { postId: p.id });
      continue;
    }
    const row: PostRow = {
      postId: p.id,
      createdAt,
      kind: p.kind,
      checkDueAt: new Date(createdAt.getTime() + d.cfg.plugCheckAfterMinutes * MIN),
      status: "pending",
    };
    if (p.kind === "reply" || p.kind === "repost") Object.assign(row, { status: "skipped", skipReason: p.kind });
    else if (createdAt.getTime() < oldest) Object.assign(row, { status: "skipped", skipReason: "too_old" });
    else if (hosts.length && linksToPlug(p, hosts)) Object.assign(row, { status: "skipped", skipReason: "already_links_plug" });
    if (await d.store.insertPost(row)) {
      if (row.status === "pending") queued++;
    }
  }
  const newest = maxId(posts.map((p) => p.id));
  if (newest && (!sinceId || BigInt(newest) > BigInt(sinceId))) await d.store.setSinceId(newest);
  log("poll done", { seen: posts.length, queued });
  return { skipped: null, seen: posts.length, queued };
}

export function planSlots(postId: string, createdAt: Date, cfg: Config, now: Date): SlotRow[] {
  if (!cfg.autoRtEnabled) return [];
  const first = createdAt.getTime() + cfg.autoRtFirstHours * HOUR;
  const slots: SlotRow[] = [{ postId, seq: 0, action: "repost", dueAt: new Date(Math.max(first, now.getTime())), status: "pending" }];
  for (let i = 1; i <= cfg.autoRtBumps; i++) {
    const due = first + i * cfg.autoRtBumpEveryHours * HOUR;
    if (due <= now.getTime()) continue; // never fire missed bumps back to back
    slots.push({ postId, seq: i, action: "bump", dueAt: new Date(due), status: "pending" });
  }
  return slots;
}

async function plugPost(d: Deps, postId: string, impressions: number, sending: () => void): Promise<CheckResult> {
  const base: CheckResult = { status: "passed", impressions };
  if (!d.cfg.plugEnabled) return base;
  let plug: Plug;
  let text: string;
  try {
    validatePlugs(d.plugs);
    plug = nextPlug(d.plugs, (await d.store.getState()).lastPlugId);
    text = plugText(plug, postId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await d.notify(`Plug skipped for ${postUrl(d.cfg.xHandle, postId)}: ${msg}`);
    return { ...base, plugStatus: "failed", plugError: msg };
  }
  if (d.cfg.plugMode === "notify") {
    const ok = await d.notify(
      `Your post passed ${impressions} impressions: ${postUrl(d.cfg.xHandle, postId)}\nSuggested reply (post it yourself):\n${text}`,
    );
    await d.store.setLastPlugId(plug.id);
    return ok
      ? { ...base, plugId: plug.id, plugStatus: "notified" }
      : { ...base, plugId: plug.id, plugStatus: "failed", plugError: "notify failed" };
  }
  // Record the attempt first. If the run dies after X accepts the reply but
  // before the result is saved, the row stays "passed / failed: outcome
  // unknown" and is never picked up again, so a post can't get two plugs.
  await d.store.finishCheck(postId, { ...base, plugId: plug.id, plugStatus: "failed", plugError: "reply sent; outcome unknown" });
  sending();
  try {
    const replyId = await d.x.reply(postId, text);
    await d.store.setLastPlugId(plug.id);
    return { ...base, plugId: plug.id, plugStatus: "replied", plugReplyId: replyId };
  } catch (e) {
    if (e instanceof XQuotaError) {
      // X refused before posting: put the post back so it is checked again later.
      await d.store.finishCheck(postId, { status: "pending" });
      throw e;
    }
    const msg = e instanceof Error ? e.message : String(e);
    await d.notify(`Plug reply failed for ${postUrl(d.cfg.xHandle, postId)} (not retried): ${msg}`);
    return { ...base, plugId: plug.id, plugStatus: "failed", plugError: msg.slice(0, 300) };
  }
}

export async function runChecks(d: Deps) {
  const log = d.log ?? (() => {});
  if (!anythingEnabled(d.cfg)) return { checked: 0 };
  if (d.cfg.plugEnabled) validatePlugs(d.plugs);
  const now = d.now();
  const claimed = await d.store.claimDueChecks(now, 20);
  if (!claimed.length) return { checked: 0 };
  const done = new Set<string>();
  const release = async () => {
    for (const p of claimed) if (!done.has(p.postId)) await d.store.finishCheck(p.postId, { status: "pending" });
  };
  const live: PostRow[] = [];
  for (const p of claimed) {
    if (now.getTime() - p.checkDueAt.getTime() > d.cfg.plugCheckMaxLateMinutes * MIN) {
      await d.store.finishCheck(p.postId, { status: "expired", skipReason: "check_too_late" });
      done.add(p.postId);
    } else live.push(p);
  }
  if (!live.length) return { checked: claimed.length };
  let metrics: Map<string, number | null>;
  try {
    metrics = await d.x.impressions(live.map((p) => p.postId));
  } catch (e) {
    await release();
    throw e;
  }
  try {
    for (const p of live) {
      const imp = metrics.get(p.postId);
      let result: CheckResult;
      if (imp === undefined) result = { status: "skipped", skipReason: "deleted_or_hidden" };
      else if (imp === null) result = { status: "failed", skipReason: "no_impressions_metric" };
      else if (imp < d.cfg.plugMinImpressions) result = { status: "below_bar", impressions: imp };
      else {
        result = await plugPost(d, p.postId, imp, () => done.add(p.postId));
      }
      await d.store.finishCheck(p.postId, result);
      done.add(p.postId);
      if (result.status === "passed") await d.store.insertSlots(planSlots(p.postId, p.createdAt, d.cfg, now));
      log("checked", { postId: p.postId, status: result.status, plug: result.plugStatus ?? null });
    }
  } catch (e) {
    await release();
    throw e;
  }
  return { checked: claimed.length };
}

function utcDayStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function alreadyReposted(e: unknown): boolean {
  return e instanceof Error && /already (re)?(tweeted|posted|retweeted)/i.test(e.message);
}

export async function runSlots(d: Deps) {
  const log = d.log ?? (() => {});
  if (!d.cfg.autoRtEnabled) return { ran: 0, skipped: "disabled" as const };
  const now = d.now();
  for (const s of await d.store.failStaleSlots(now)) {
    await d.notify(`A ${s.action} for ${postUrl(d.cfg.xHandle, s.postId)} was interrupted and will not be retried. Check the post by hand.`);
  }
  let used = await d.store.writesSince(utcDayStart(now));
  const claimed = await d.store.claimDueSlots(now, 10);
  let ran = 0;
  for (let i = 0; i < claimed.length; i++) {
    const s = claimed[i];
    const releaseRest = async () => {
      for (const r of claimed.slice(i)) await d.store.releaseSlot(r.postId, r.seq);
    };
    if (s.action === "bump" && !d.cfg.autoRtBumpsEnabled) {
      await d.store.finishSlot(s.postId, s.seq, "skipped", 0, "bumps_disabled");
      continue;
    }
    const cost = s.action === "repost" ? 1 : 2;
    if (used + cost > d.cfg.autoRtDailyWriteCap) {
      log("daily write cap reached; slots wait for the next UTC day", { used, cap: d.cfg.autoRtDailyWriteCap });
      await releaseRest();
      break;
    }
    let writes = 0;
    try {
      // Each write is logged before it is sent, so a crash can only make the
      // daily cap count too many writes, never too few.
      if (s.action === "bump") {
        await d.store.recordWrite(s.postId, s.seq, "unrepost");
        await d.x.unrepost(d.cfg.xUserId, s.postId);
        writes++;
      }
      try {
        await d.store.recordWrite(s.postId, s.seq, "repost");
        await d.x.repost(d.cfg.xUserId, s.postId);
        writes++;
      } catch (e) {
        if (e instanceof XQuotaError || !alreadyReposted(e)) throw e;
      }
      await d.store.finishSlot(s.postId, s.seq, "done", writes);
      ran++;
    } catch (e) {
      if (e instanceof XQuotaError) {
        if (writes > 0) {
          // A bump got as far as the un-repost: never redo it automatically.
          await d.store.finishSlot(s.postId, s.seq, "failed", writes, "quota error after un-repost");
          await d.notify(`Repost bump half-done: ${postUrl(d.cfg.xHandle, s.postId)} is no longer reposted. Repost it by hand if you want it back.`);
        } else {
          await d.store.finishSlot(s.postId, s.seq, "pending", writes);
        }
        for (const r of claimed.slice(i + 1)) await d.store.releaseSlot(r.postId, r.seq);
        throw e;
      }
      const msg = e instanceof Error ? e.message : String(e);
      await d.store.finishSlot(s.postId, s.seq, "failed", writes, msg.slice(0, 300));
      if (s.action === "bump" && writes === 1) {
        await d.notify(`Repost bump half-done: ${postUrl(d.cfg.xHandle, s.postId)} is no longer reposted. Repost it by hand if you want it back.`);
      }
    }
    used += cost;
  }
  return { ran, skipped: null };
}
