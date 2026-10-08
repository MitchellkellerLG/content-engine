/**
 * Storage interface plus two implementations: Postgres (production) and
 * in-memory (tests). Claims use "update ... where status = pending" so two
 * overlapping runs can never act on the same row.
 */
import postgres from "postgres";

export type PostStatus = "pending" | "checking" | "passed" | "below_bar" | "skipped" | "expired" | "failed";
export type PlugStatus = "notified" | "replied" | "failed";
export type SlotStatus = "pending" | "running" | "done" | "failed" | "skipped";

export interface PostRow {
  postId: string;
  createdAt: Date;
  kind: string;
  checkDueAt: Date;
  status: PostStatus;
  skipReason?: string | null;
}

export interface CheckResult {
  status: PostStatus;
  skipReason?: string | null;
  impressions?: number | null;
  plugId?: string | null;
  plugStatus?: PlugStatus | null;
  plugReplyId?: string | null;
  plugError?: string | null;
}

export interface SlotRow {
  postId: string;
  seq: number;
  action: "repost" | "bump";
  dueAt: Date;
  status: SlotStatus;
}

export interface Store {
  getState(): Promise<{ sinceId: string | null; lastPlugId: string | null }>;
  setSinceId(id: string): Promise<void>;
  setLastPlugId(id: string): Promise<void>;
  /** Returns true when the row is new. */
  insertPost(row: PostRow): Promise<boolean>;
  claimDueChecks(now: Date, limit: number): Promise<PostRow[]>;
  finishCheck(postId: string, r: CheckResult): Promise<void>;
  insertSlots(slots: SlotRow[]): Promise<void>;
  claimDueSlots(now: Date, limit: number): Promise<SlotRow[]>;
  finishSlot(postId: string, seq: number, status: SlotStatus, writes: number, error?: string | null): Promise<void>;
  /** Back to pending (e.g. daily cap reached, try again next run). */
  releaseSlot(postId: string, seq: number): Promise<void>;
  /**
   * Slots left "running" by a run that died are never retried (the write may
   * have happened). They are marked failed and returned so you can be told.
   */
  failStaleSlots(now: Date): Promise<{ postId: string; seq: number; action: string }[]>;
  /** Log one X write just before it is sent (attempts count toward the cap). */
  recordWrite(postId: string, seq: number, kind: "repost" | "unrepost"): Promise<void>;
  /** Writes logged at or after `since`. */
  writesSince(since: Date): Promise<number>;
}

const STATE_ID = "main";
/**
 * A claim older than this belongs to a run that died: Trigger.dev stops every
 * task after its maxDuration (120 s), far shorter than this. Stale "checking"
 * rows are re-checked (that step only reads; a plug reply is recorded before
 * it is sent). Stale "running" repost slots are failed, never retried.
 */
const STALE_MS = 30 * 60 * 1000;

export function createPgStore(databaseUrl: string): Store & { end(): Promise<void> } {
  const sql = postgres(databaseUrl, { max: 2, idle_timeout: 20, prepare: false });
  return {
    async end() {
      await sql.end({ timeout: 5 });
    },
    async getState() {
      const rows = await sql`select since_id, last_plug_id from ce_state where id = ${STATE_ID}`;
      return { sinceId: rows[0]?.since_id ?? null, lastPlugId: rows[0]?.last_plug_id ?? null };
    },
    async setSinceId(id) {
      await sql`insert into ce_state (id, since_id) values (${STATE_ID}, ${id})
        on conflict (id) do update set since_id = excluded.since_id, updated_at = now()`;
    },
    async setLastPlugId(id) {
      await sql`insert into ce_state (id, last_plug_id) values (${STATE_ID}, ${id})
        on conflict (id) do update set last_plug_id = excluded.last_plug_id, updated_at = now()`;
    },
    async insertPost(r) {
      const rows = await sql`insert into ce_posts (post_id, created_at, kind, check_due_at, status, skip_reason)
        values (${r.postId}, ${r.createdAt}, ${r.kind}, ${r.checkDueAt}, ${r.status}, ${r.skipReason ?? null})
        on conflict (post_id) do nothing returning post_id`;
      return rows.length === 1;
    },
    async claimDueChecks(now, limit) {
      const stale = new Date(now.getTime() - STALE_MS);
      const rows = await sql`update ce_posts set status = 'checking', updated_at = now()
        where post_id in (
          select post_id from ce_posts
          where check_due_at <= ${now}
            and (status = 'pending' or (status = 'checking' and updated_at < ${stale}))
          order by check_due_at limit ${limit} for update skip locked)
        returning post_id, created_at, kind, check_due_at, status`;
      return rows.map((x) => ({
        postId: x.post_id, createdAt: new Date(x.created_at), kind: x.kind,
        checkDueAt: new Date(x.check_due_at), status: x.status,
      }));
    },
    async finishCheck(postId, r) {
      await sql`update ce_posts set status = ${r.status}, skip_reason = ${r.skipReason ?? null},
        impressions_at_check = ${r.impressions ?? null}, plug_id = ${r.plugId ?? null},
        plug_status = ${r.plugStatus ?? null}, plug_reply_id = ${r.plugReplyId ?? null},
        plug_error = ${r.plugError ?? null}, updated_at = now()
        where post_id = ${postId}`;
    },
    async insertSlots(slots) {
      for (const s of slots) {
        await sql`insert into ce_rt_slots (post_id, seq, action, due_at, status)
          values (${s.postId}, ${s.seq}, ${s.action}, ${s.dueAt}, ${s.status})
          on conflict (post_id, seq) do nothing`;
      }
    },
    async claimDueSlots(now, limit) {
      const stale = new Date(now.getTime() - STALE_MS);
      const rows = await sql`update ce_rt_slots set status = 'running', updated_at = now()
        where (post_id, seq) in (
          select post_id, seq from ce_rt_slots
          where due_at <= ${now} and status = 'pending'
          order by due_at limit ${limit} for update skip locked)
        returning post_id, seq, action, due_at, status`;
      return rows
        .map((x) => ({ postId: x.post_id, seq: x.seq, action: x.action, dueAt: new Date(x.due_at), status: x.status }))
        .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
    },
    async finishSlot(postId, seq, status, writes, error) {
      await sql`update ce_rt_slots set status = ${status}, writes = writes + ${writes},
        error = ${error ?? null}, updated_at = now() where post_id = ${postId} and seq = ${seq}`;
    },
    async releaseSlot(postId, seq) {
      await sql`update ce_rt_slots set status = 'pending', updated_at = now()
        where post_id = ${postId} and seq = ${seq}`;
    },
    async failStaleSlots(now) {
      const stale = new Date(now.getTime() - STALE_MS);
      const rows = await sql`update ce_rt_slots set status = 'failed', error = 'interrupted', updated_at = now()
        where status = 'running' and updated_at < ${stale}
        returning post_id, seq, action`;
      return rows.map((x) => ({ postId: x.post_id, seq: x.seq, action: x.action }));
    },
    async recordWrite(postId, seq, kind) {
      await sql`insert into ce_writes (post_id, seq, kind) values (${postId}, ${seq}, ${kind})`;
    },
    async writesSince(since) {
      const rows = await sql`select count(*)::int as n from ce_writes where at >= ${since}`;
      return rows[0]?.n ?? 0;
    },
  };
}

/** In-memory store with the same claim semantics. For tests and dry runs. */
export function createMemoryStore() {
  const state = { sinceId: null as string | null, lastPlugId: null as string | null };
  const posts = new Map<string, PostRow & CheckResult & { updatedAt: Date }>();
  const slots = new Map<string, SlotRow & { writes: number; error?: string | null; updatedAt: Date }>();
  const writeLog: { postId: string; seq: number; kind: string; at: Date }[] = [];
  const key = (p: string, s: number) => `${p}#${s}`;
  let clock = () => new Date();
  const store: Store = {
    async getState() {
      return { ...state };
    },
    async setSinceId(id) {
      state.sinceId = id;
    },
    async setLastPlugId(id) {
      state.lastPlugId = id;
    },
    async insertPost(r) {
      if (posts.has(r.postId)) return false;
      posts.set(r.postId, { ...r, updatedAt: clock() });
      return true;
    },
    async claimDueChecks(now, limit) {
      const out: PostRow[] = [];
      for (const p of [...posts.values()].sort((a, b) => a.checkDueAt.getTime() - b.checkDueAt.getTime())) {
        if (out.length >= limit) break;
        const stale = p.status === "checking" && now.getTime() - p.updatedAt.getTime() > STALE_MS;
        if (p.checkDueAt <= now && (p.status === "pending" || stale)) {
          p.status = "checking";
          p.updatedAt = now;
          out.push({ ...p });
        }
      }
      return out;
    },
    async finishCheck(postId, r) {
      const p = posts.get(postId);
      // Same as the SQL update: every column is set, missing values become null.
      if (p) Object.assign(p, {
        status: r.status, skipReason: r.skipReason ?? null, impressions: r.impressions ?? null,
        plugId: r.plugId ?? null, plugStatus: r.plugStatus ?? null, plugReplyId: r.plugReplyId ?? null,
        plugError: r.plugError ?? null, updatedAt: clock(),
      });
    },
    async insertSlots(list) {
      for (const s of list) if (!slots.has(key(s.postId, s.seq))) slots.set(key(s.postId, s.seq), { ...s, writes: 0, updatedAt: clock() });
    },
    async claimDueSlots(now, limit) {
      const out: SlotRow[] = [];
      for (const s of [...slots.values()].sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())) {
        if (out.length >= limit) break;
        if (s.dueAt <= now && s.status === "pending") {
          s.status = "running";
          s.updatedAt = now;
          out.push({ ...s });
        }
      }
      return out;
    },
    async finishSlot(postId, seq, status, writes, error) {
      const s = slots.get(key(postId, seq));
      if (s) Object.assign(s, { status, writes: s.writes + writes, error: error ?? null, updatedAt: clock() });
    },
    async releaseSlot(postId, seq) {
      const s = slots.get(key(postId, seq));
      if (s) Object.assign(s, { status: "pending", updatedAt: clock() });
    },
    async failStaleSlots(now) {
      const out: { postId: string; seq: number; action: string }[] = [];
      for (const s of slots.values()) {
        if (s.status === "running" && now.getTime() - s.updatedAt.getTime() > STALE_MS) {
          Object.assign(s, { status: "failed", error: "interrupted", updatedAt: clock() });
          out.push({ postId: s.postId, seq: s.seq, action: s.action });
        }
      }
      return out;
    },
    async recordWrite(postId, seq, kind) {
      writeLog.push({ postId, seq, kind, at: clock() });
    },
    async writesSince(since) {
      return writeLog.filter((w) => w.at >= since).length;
    },
  };
  return { store, state, posts, slots, writeLog, setClock(fn: () => Date) { clock = fn; } };
}
