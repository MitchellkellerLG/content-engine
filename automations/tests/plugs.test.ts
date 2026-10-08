import { test } from "node:test";
import assert from "node:assert/strict";
import { nextPlug, plugText, trackedUrl, validatePlugs } from "../src/lib/plugs.ts";
import { PLUGS as SHIPPED } from "../src/plugs.config.ts";
import { PLUGS } from "./helpers.ts";

test("tracked link carries all four UTMs with the post id as utm_content", () => {
  const u = new URL(trackedUrl(PLUGS[0], "123"));
  assert.equal(u.searchParams.get("utm_source"), "x");
  assert.equal(u.searchParams.get("utm_medium"), "social");
  assert.equal(u.searchParams.get("utm_campaign"), "letter");
  assert.equal(u.searchParams.get("utm_content"), "123");
  assert.ok(plugText(PLUGS[0], "123").startsWith("More like this every week: https://news.test/letter?"));
});

test("rotation follows config order and wraps", () => {
  assert.equal(nextPlug(PLUGS, null).id, "letter");
  assert.equal(nextPlug(PLUGS, "letter").id, "video");
  assert.equal(nextPlug(PLUGS, "video").id, "letter");
  assert.equal(nextPlug(PLUGS, "gone").id, "letter");
});

test("shipped placeholder config refuses to run", () => {
  assert.throws(() => validatePlugs(SHIPPED), /example\.com/);
});

test("validation fails closed", () => {
  const ok = PLUGS[0];
  assert.throws(() => validatePlugs([]));
  assert.throws(() => validatePlugs([{ ...ok, url: "http://news.test" }]), /https/);
  assert.throws(() => validatePlugs([{ ...ok, copy: "see https://x.test" }]), /link/);
  assert.throws(() => validatePlugs([{ ...ok, copy: "a".repeat(260) }]), /too long/);
  assert.throws(() => validatePlugs([ok, ok]), /duplicate/);
  assert.throws(() => trackedUrl(ok, "12a"));
});
