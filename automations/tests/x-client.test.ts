import { test } from "node:test";
import assert from "node:assert/strict";
import { createXClient, oauthHeader, pct, XApiError, XQuotaError } from "../src/lib/x-client.ts";

// Worked example from X's "Creating a signature" docs (OAuth 1.0a).
// These are the public, made-up credentials printed in those docs, not real keys.
test("OAuth 1.0a signature matches the documented example", () => {
  const h = oauthHeader(
    "POST",
    "https://api.twitter.com/1.1/statuses/update.json",
    { include_entities: "true", status: "Hello Ladies + Gentlemen, a signed OAuth request!" },
    {
      apiKey: "xvz1evFS4wEEPTGEFPHBog", // gitleaks:allow
      apiSecret: "kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw", // gitleaks:allow
      accessToken: "370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb", // gitleaks:allow
      accessTokenSecret: "LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE", // gitleaks:allow
    },
    "kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg",
    "1318622958",
  );
  assert.match(h, /oauth_signature="hCtSmYh%2BiHYCEqBWrE7C7hYmtUk%3D"/); // gitleaks:allow
});

test("pct encodes the characters encodeURIComponent misses", () => {
  assert.equal(pct("a!b*c'(d)"), "a%21b%2Ac%27%28d%29");
});

const creds = { apiKey: "k", apiSecret: "s", accessToken: "t", accessTokenSecret: "ts" };
const res = (status: number, body: unknown) => async () => ({ ok: status < 300, status, text: async () => JSON.stringify(body) });

test("parses posts, kinds and impressions", async () => {
  const x = createXClient(creds, res(200, {
    data: [
      { id: "2", text: "hi", created_at: "2026-01-01T00:00:00.000Z", public_metrics: { impression_count: 7 },
        referenced_tweets: [{ type: "quoted", id: "1" }], entities: { urls: [{ expanded_url: "https://a.test/x" }] } },
    ],
  }));
  const [p] = await x.recentPosts("42", null);
  assert.deepEqual(p, { id: "2", text: "hi", createdAt: "2026-01-01T00:00:00.000Z", kind: "quote", urls: ["https://a.test/x"], impressions: 7 });
});

test("429 and billing 403 are quota errors; others are API errors", async () => {
  await assert.rejects(createXClient(creds, res(429, {})).repost("42", "1"), XQuotaError);
  await assert.rejects(createXClient(creds, res(403, { title: "CreditsDepleted" })).repost("42", "1"), XQuotaError);
  await assert.rejects(createXClient(creds, res(403, { title: "Forbidden" })).repost("42", "1"), XApiError);
});

test("catching up pages through everything since the last seen post", async () => {
  const urls: string[] = [];
  const pages = [
    { data: [{ id: "30", text: "a", created_at: "2026-01-01T00:00:00Z" }], meta: { next_token: "p2" } },
    { data: [{ id: "29", text: "b", created_at: "2026-01-01T00:00:00Z" }], meta: {} },
  ];
  const fetchImpl = async (url: string) => {
    urls.push(url);
    const body = pages[urls.length - 1];
    return { ok: true, status: 200, text: async () => JSON.stringify(body) };
  };
  const posts = await createXClient(creds, fetchImpl).recentPosts("42", "10");
  assert.deepEqual(posts.map((p) => p.id), ["30", "29"]);
  assert.match(urls[1], /pagination_token=p2/);
  assert.match(urls[0], /since_id=10/);
});
