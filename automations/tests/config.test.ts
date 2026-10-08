import { test } from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../src/lib/config.ts";

const base = { X_USER_ID: "42", X_HANDLE: "@someone" };

test("everything that writes is off by default", () => {
  const c = loadConfig(base);
  assert.equal(c.plugEnabled, false);
  assert.equal(c.plugMode, "notify");
  assert.equal(c.autoRtEnabled, false);
  assert.equal(c.autoRtBumpsEnabled, false);
  assert.equal(c.autoRtBumps, 0);
  assert.equal(c.xHandle, "someone");
});

test("bumps need both flags", () => {
  assert.equal(loadConfig({ ...base, AUTO_RT_BUMPS_ENABLED: "true" }).autoRtBumpsEnabled, false);
  const c = loadConfig({ ...base, AUTO_RT_ENABLED: "true", AUTO_RT_BUMPS_ENABLED: "true" });
  assert.equal(c.autoRtBumpsEnabled, true);
  assert.equal(c.autoRtBumps, 1);
});

test("rejects bad values instead of guessing", () => {
  assert.throws(() => loadConfig({ ...base, X_USER_ID: "abc" }));
  assert.throws(() => loadConfig({ ...base, PLUG_MODE: "auto" }));
  assert.throws(() => loadConfig({ ...base, AUTO_RT_ENABLED: "1", AUTO_RT_BUMPS_ENABLED: "1", AUTO_RT_BUMPS: "5" }));
  assert.throws(() => loadConfig({ ...base, PLUG_MIN_IMPRESSIONS: "-1" }));
});
