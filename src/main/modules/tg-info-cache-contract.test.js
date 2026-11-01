import { describe, expect, it } from "vitest";
import {
  compareInfoCacheEvictionCandidates,
  getInfoCacheFreshness,
  normalizeInfoCacheMetadata,
  withInfoCacheMetadata,
} from "./tg-info-cache-contract";

describe("tg-info-cache-contract", () => {
  it("classifies fresh, stale and missing entries", () => {
    expect(
      getInfoCacheFreshness({ __khCacheUpdatedAt: 900 }, { now: 1000, staleAfterMs: 200 }),
    ).toBe("hit");
    expect(
      getInfoCacheFreshness({ __khCacheUpdatedAt: 100 }, { now: 1000, staleAfterMs: 200 }),
    ).toBe("stale_hit");
    expect(getInfoCacheFreshness(null, { now: 1000 })).toBe("not_found");
  });

  it("preserves field provenance and refresh failure metadata", () => {
    const entry = withInfoCacheMetadata(
      { RJ: "RJ123456", "来源": "DLSite" },
      {
        fetchedAt: 123,
        source: "DLSite/Announce",
        fieldSources: { 标题: "DLSite", 声优: "Announce" },
        lastRefreshFailure: { at: 456, message: "timeout" },
      },
    );
    expect(normalizeInfoCacheMetadata(entry)).toMatchObject({
      fetchedAt: 123,
      source: "DLSite/Announce",
      fieldSources: { 标题: "DLSite", 声优: "Announce" },
      lastRefreshFailure: { at: 456, message: "timeout" },
    });
  });

  it("evicts least recently accessed entries first, then oldest", () => {
    const entries = [
      ["RJ000003", { __khCacheMeta: { accessedAt: 300, fetchedAt: 100 } }],
      ["RJ000002", { __khCacheMeta: { accessedAt: 200, fetchedAt: 200 } }],
      ["RJ000001", { __khCacheMeta: { accessedAt: 200, fetchedAt: 100 } }],
    ];
    expect(entries.sort(compareInfoCacheEvictionCandidates).map(([code]) => code)).toEqual([
      "RJ000001",
      "RJ000002",
      "RJ000003",
    ]);
  });
});
