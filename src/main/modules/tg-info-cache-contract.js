export const INFO_CACHE_META_FIELD = "__khCacheMeta";

export const DEFAULT_INFO_CACHE_STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export function normalizeInfoCacheMetadata(entry, fallback = {}) {
  const raw = entry?.[INFO_CACHE_META_FIELD];
  const fetchedAt = Number(raw?.fetchedAt || entry?.__khCacheUpdatedAt || fallback.fetchedAt || 0);
  return {
    fetchedAt: Number.isFinite(fetchedAt) && fetchedAt > 0 ? fetchedAt : 0,
    source: String(raw?.source || fallback.source || entry?.["来源"] || "unknown"),
    fieldSources:
      (raw?.fieldSources || fallback.fieldSources) &&
      typeof (raw?.fieldSources || fallback.fieldSources) === "object"
        ? { ...(raw?.fieldSources || fallback.fieldSources) }
        : {},
    lastRefreshFailure:
      raw?.lastRefreshFailure || fallback.lastRefreshFailure || null,
    accessedAt: Number(raw?.accessedAt || fallback.accessedAt || fetchedAt || 0),
  };
}

export function withInfoCacheMetadata(entry, metadata) {
  return {
    ...entry,
    [INFO_CACHE_META_FIELD]: normalizeInfoCacheMetadata({
      ...entry,
      [INFO_CACHE_META_FIELD]: metadata,
    }),
  };
}

export function getInfoCacheFreshness(entry, options = {}) {
  if (!entry) return "not_found";
  const now = Number(options.now || Date.now());
  const staleAfterMs = Number(
    options.staleAfterMs || DEFAULT_INFO_CACHE_STALE_AFTER_MS,
  );
  const metadata = normalizeInfoCacheMetadata(entry);
  if (!metadata.fetchedAt) return "stale_hit";
  return now - metadata.fetchedAt > staleAfterMs ? "stale_hit" : "hit";
}

export function compareInfoCacheEvictionCandidates(left, right) {
  const leftMeta = normalizeInfoCacheMetadata(left?.[1]);
  const rightMeta = normalizeInfoCacheMetadata(right?.[1]);
  const leftAccess = leftMeta.accessedAt || leftMeta.fetchedAt;
  const rightAccess = rightMeta.accessedAt || rightMeta.fetchedAt;
  if (leftAccess !== rightAccess) return leftAccess - rightAccess;
  if (leftMeta.fetchedAt !== rightMeta.fetchedAt) {
    return leftMeta.fetchedAt - rightMeta.fetchedAt;
  }
  return String(left?.[0] || "").localeCompare(String(right?.[0] || ""));
}
