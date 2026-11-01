import { describe, expect, it } from "vitest";
import { ensureHistoryShape } from "./normalizers";

describe("ensureHistoryShape sync cursor", () => {
  it("normalizes cursor and bounds processed message ids", () => {
    const shaped = ensureHistoryShape({
      updatedAt: "2026-10-31T00:00:00.000Z",
      sync: {
        cursorMessageId: "123",
        lastSyncAt: "2026-10-30T00:00:00.000Z",
        processedMessageIds: Array.from({ length: 50010 }, (_, i) => i),
      },
      history: { RJ123456: { url: "https://t.me/example/123" } },
    });
    expect(shaped.sync.cursorMessageId).toBe(123);
    expect(shaped.sync.scanCheckpointOffsetId).toBeNull();
    expect(shaped.sync.initialSyncComplete).toBe(false);
    expect(shaped.sync.processedMessageIds).toHaveLength(50000);
    expect(shaped.sync.processedMessageIds[0]).toBe("10");
    expect(shaped.history.RJ123456).toBeDefined();
  });

  it("gives legacy history safe synchronization defaults", () => {
    expect(ensureHistoryShape({ history: {} }).sync).toEqual({
      cursorMessageId: null,
      scanCheckpointOffsetId: null,
      initialSyncComplete: false,
      processedMessageIds: [],
      lastSyncAt: null,
    });
  });

  it("drops legacy alternate URL fields while loading history", () => {
    const shaped = ensureHistoryShape({
      history: {
        RJ123456: {
          url: "https://t.me/example/1",
          alternateUrls: ["tg://resolve?domain=example&post=1"],
          source: "channel_sync",
        },
      },
    });
    expect(shaped.history.RJ123456).toEqual({
      url: "https://t.me/example/1",
      source: "channel_sync",
    });
  });
});
