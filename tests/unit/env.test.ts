import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeSupabaseUrl } from "../../src/lib/env.ts";

describe("normalizeSupabaseUrl", () => {
  it("fixes the exact value from the bug report (leading space + /rest/v1/ suffix)", () => {
    // Pasted into .env.local / Vercel as: NEXT_PUBLIC_SUPABASE_URL= https://mamftoiqxhrnkoqhhwep.supabase.co/rest/v1/
    // which made every request go to /rest/v1//rest/v1/... (404) and autocomplete said
    // "Couldn't load suggestions".
    assert.equal(normalizeSupabaseUrl(" https://mamftoiqxhrnkoqhhwep.supabase.co/rest/v1/"), "https://mamftoiqxhrnkoqhhwep.supabase.co");
  });

  it("keeps a correct URL unchanged", () => {
    assert.equal(normalizeSupabaseUrl("https://abc.supabase.co"), "https://abc.supabase.co");
  });

  it("removes trailing slashes, quotes and other API suffixes", () => {
    assert.equal(normalizeSupabaseUrl("https://abc.supabase.co///"), "https://abc.supabase.co");
    assert.equal(normalizeSupabaseUrl('"https://abc.supabase.co"'), "https://abc.supabase.co");
    assert.equal(normalizeSupabaseUrl("https://abc.supabase.co/auth/v1"), "https://abc.supabase.co");
  });

  it("treats blank values as missing", () => {
    assert.equal(normalizeSupabaseUrl("   "), undefined);
    assert.equal(normalizeSupabaseUrl(undefined), undefined);
  });
});
