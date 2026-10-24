import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeUrl, hostOf, isAnalyzable, originOf } from "../shared/url.js";
import { riskMeta, safetyCaveat } from "../shared/risk.js";

test("normalizeUrl adds scheme, lowercases host, drops fragment", () => {
  assert.equal(normalizeUrl("example.com"), "http://example.com/");
  assert.equal(normalizeUrl("https://A.Example.com/Path#frag"), "https://a.example.com/Path");
});

test("hostOf extracts lowercase hostname", () => {
  assert.equal(hostOf("https://Sub.Example.com/x?q=1"), "sub.example.com");
  assert.equal(hostOf("not a url"), "");
});

test("isAnalyzable only allows http/https", () => {
  assert.equal(isAnalyzable("https://x.com"), true);
  assert.equal(isAnalyzable("http://x.com"), true);
  assert.equal(isAnalyzable("chrome://extensions"), false);
  assert.equal(isAnalyzable("about:blank"), false);
  assert.equal(isAnalyzable(""), false);
});

test("originOf returns scheme+host", () => {
  assert.equal(originOf("https://a.com/x/y"), "https://a.com");
  assert.equal(originOf("localhost:8000"), "http://localhost:8000");
});

test("riskMeta maps bands and defaults safely", () => {
  assert.equal(riskMeta("HIGH").label, "High Risk");
  assert.equal(riskMeta("low").label, "Low Risk");
  assert.equal(riskMeta("bogus").label, "Not analyzed");
});

test("safetyCaveat never calls LOW a guarantee", () => {
  assert.match(safetyCaveat("LOW"), /does not guarantee/i);
  assert.match(safetyCaveat("UNKNOWN"), /not been analyzed/i);
});
