/**
 * Minimal X API v2 client with OAuth 1.0a user-context signing.
 *
 * One set of credentials: the account whose posts you are automating.
 * Keys live in your Trigger.dev environment variables. Never log them.
 */
import { createHmac, randomBytes } from "node:crypto";

export interface XCredentials {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

export interface XPost {
  id: string;
  text: string;
  createdAt: string;
  /** "original" | "quote" | "reply" | "repost" */
  kind: "original" | "quote" | "reply" | "repost";
  urls: string[];
  impressions: number | null;
}

/** Billing or rate-limit failure. Never retry these blindly: each retry is billed. */
export class XQuotaError extends Error {
  readonly status: number;
  constructor(status: number, detail: string) {
    super(`X API quota/rate error ${status}: ${detail.slice(0, 200)}`);
    this.name = "XQuotaError";
    this.status = status;
  }
}

export class XApiError extends Error {
  readonly status: number;
  constructor(status: number, detail: string) {
    super(`X API error ${status}: ${detail.slice(0, 300)}`);
    this.name = "XApiError";
    this.status = status;
  }
}

export function credentialsFromEnv(env: Record<string, string | undefined> = process.env): XCredentials | null {
  const c = {
    apiKey: env.X_API_KEY ?? "",
    apiSecret: env.X_API_SECRET ?? "",
    accessToken: env.X_ACCESS_TOKEN ?? "",
    accessTokenSecret: env.X_ACCESS_TOKEN_SECRET ?? "",
  };
  return Object.values(c).every((v) => v.trim() !== "") ? c : null;
}

/** RFC 3986 encoding (encodeURIComponent leaves !'()* alone, OAuth does not). */
export function pct(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

/**
 * Build the OAuth 1.0a Authorization header. Query params are signed; a JSON
 * body is not (only form-encoded bodies are part of the signature).
 */
export function oauthHeader(
  method: string,
  baseUrl: string,
  query: Record<string, string>,
  c: XCredentials,
  nonce = randomBytes(16).toString("hex"),
  timestamp = Math.floor(Date.now() / 1000).toString(),
): string {
  const oauth: Record<string, string> = {
    oauth_consumer_key: c.apiKey,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: timestamp,
    oauth_token: c.accessToken,
    oauth_version: "1.0",
  };
  const all = { ...query, ...oauth };
  const paramString = Object.keys(all)
    .map((k) => [pct(k), pct(all[k])] as const)
    .sort(([a, av], [b, bv]) => (a === b ? (av < bv ? -1 : 1) : a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  const base = [method.toUpperCase(), pct(baseUrl), pct(paramString)].join("&");
  const key = `${pct(c.apiSecret)}&${pct(c.accessTokenSecret)}`;
  oauth.oauth_signature = createHmac("sha1", key).update(base).digest("base64");
  return (
    "OAuth " +
    Object.keys(oauth)
      .sort()
      .map((k) => `${pct(k)}="${pct(oauth[k])}"`)
      .join(", ")
  );
}

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
}>;

export interface XClient {
  recentPosts(userId: string, sinceId: string | null): Promise<XPost[]>;
  impressions(ids: string[]): Promise<Map<string, number | null>>;
  reply(toPostId: string, text: string): Promise<string>;
  repost(userId: string, postId: string): Promise<void>;
  unrepost(userId: string, postId: string): Promise<void>;
}

const API = "https://api.x.com/2";

function kindOf(t: any): XPost["kind"] {
  const refs: any[] = t.referenced_tweets ?? [];
  if (refs.some((r) => r.type === "retweeted")) return "repost";
  if (refs.some((r) => r.type === "replied_to")) return "reply";
  if (refs.some((r) => r.type === "quoted")) return "quote";
  return "original";
}

function toPost(t: any): XPost {
  const urls: string[] = [
    ...((t.entities?.urls ?? []) as any[]),
    ...((t.note_tweet?.entities?.urls ?? []) as any[]),
  ]
    .map((u) => u.unwound_url ?? u.expanded_url ?? u.url)
    .filter(Boolean);
  return {
    id: String(t.id),
    text: String(t.note_tweet?.text ?? t.text ?? ""),
    createdAt: String(t.created_at ?? ""),
    kind: kindOf(t),
    urls,
    impressions: typeof t.public_metrics?.impression_count === "number" ? t.public_metrics.impression_count : null,
  };
}

export function createXClient(c: XCredentials, fetchImpl: FetchLike = fetch as unknown as FetchLike): XClient {
  async function call(method: string, path: string, query: Record<string, string> = {}, body?: unknown): Promise<any> {
    const base = API + path;
    const qs = new URLSearchParams(query).toString();
    const res = await fetchImpl(qs ? `${base}?${qs}` : base, {
      method,
      headers: {
        Authorization: oauthHeader(method, base, query, c),
        "Content-Type": "application/json",
        "User-Agent": "content-engine/0.1",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await res.text();
    if (!res.ok) {
      if (res.status === 429 || (res.status === 402) || (res.status === 403 && /cap|credit|billing/i.test(text))) {
        throw new XQuotaError(res.status, text);
      }
      throw new XApiError(res.status, text);
    }
    const json = text ? JSON.parse(text) : {};
    if (Array.isArray(json.errors) && json.errors.length && !json.data) {
      throw new XApiError(res.status, JSON.stringify(json.errors));
    }
    return json;
  }

  return {
    async recentPosts(userId, sinceId) {
      // First run: just the latest 20 (older posts are too old to plug anyway).
      // Later runs: every page since the last seen post (X serves at most the
      // newest 3,200 posts, so 32 pages of 100 is the hard ceiling).
      const q: Record<string, string> = {
        max_results: sinceId ? "100" : "20",
        exclude: "replies,retweets",
        "tweet.fields": "created_at,public_metrics,referenced_tweets,entities,note_tweet",
      };
      if (sinceId) q.since_id = sinceId;
      const out: XPost[] = [];
      for (let page = 0; page < (sinceId ? 32 : 1); page++) {
        const json = await call("GET", `/users/${userId}/tweets`, q);
        out.push(...((json.data ?? []) as any[]).map(toPost));
        const next = json.meta?.next_token;
        if (!next) break;
        q.pagination_token = String(next);
      }
      return out;
    },
    async impressions(ids) {
      const out = new Map<string, number | null>();
      for (let i = 0; i < ids.length; i += 100) {
        const chunk = ids.slice(i, i + 100);
        const json = await call("GET", "/tweets", { ids: chunk.join(","), "tweet.fields": "public_metrics" });
        for (const t of (json.data ?? []) as any[]) out.set(String(t.id), toPost(t).impressions);
      }
      return out;
    },
    async reply(toPostId, text) {
      const json = await call("POST", "/tweets", {}, { text, reply: { in_reply_to_tweet_id: toPostId } });
      const id = json?.data?.id;
      if (!id) throw new XApiError(200, "reply returned no id");
      return String(id);
    },
    async repost(userId, postId) {
      await call("POST", `/users/${userId}/retweets`, {}, { tweet_id: postId });
    },
    async unrepost(userId, postId) {
      await call("DELETE", `/users/${userId}/retweets/${postId}`);
    },
  };
}
