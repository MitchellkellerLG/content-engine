import { loadConfig, type Config } from "../src/lib/config.ts";
import { createMemoryStore } from "../src/lib/store.ts";
import type { Deps } from "../src/core/engine.ts";
import type { Plug } from "../src/lib/plugs.ts";
import { XApiError, type XClient, type XPost } from "../src/lib/x-client.ts";

export const PLUGS: Plug[] = [
  { id: "letter", copy: "More like this every week:", url: "https://news.test/letter", campaign: "letter" },
  { id: "video", copy: "Full walkthrough:", url: "https://video.test/c", campaign: "video" },
];

export function cfg(over: Record<string, string> = {}): Config {
  return loadConfig({ X_USER_ID: "42", X_HANDLE: "someone", ...over });
}

export function fakeX(posts: XPost[] = [], imp: Record<string, number | null> = {}) {
  const calls: string[] = [];
  const fail: Record<string, Error> = {};
  const x: XClient = {
    async recentPosts(_u, since) {
      calls.push(`read:${since ?? "-"}`);
      return posts.filter((p) => !since || BigInt(p.id) > BigInt(since));
    },
    async impressions(ids) {
      calls.push(`imp:${ids.join(",")}`);
      return new Map(ids.filter((i) => i in imp).map((i) => [i, imp[i]]));
    },
    async reply(to, text) {
      calls.push(`reply:${to}:${text}`);
      if (fail.reply) throw fail.reply;
      return "900";
    },
    async repost(_u, id) {
      calls.push(`repost:${id}`);
      if (fail.repost) throw fail.repost;
    },
    async unrepost(_u, id) {
      calls.push(`unrepost:${id}`);
      if (fail.unrepost) throw fail.unrepost;
    },
  };
  return { x, calls, fail, XApiError };
}

export function deps(c: Config, x: XClient, at: { t: Date }) {
  const mem = createMemoryStore();
  mem.setClock(() => at.t);
  const notes: string[] = [];
  const d: Deps = {
    cfg: c,
    store: mem.store,
    x,
    plugs: PLUGS,
    notify: async (t) => {
      notes.push(t);
      return true;
    },
    now: () => at.t,
  };
  return { d, mem, notes };
}

export const post = (id: string, createdAt: string, extra: Partial<XPost> = {}): XPost => ({
  id, text: "hello", createdAt, kind: "original", urls: [], impressions: null, ...extra,
});
