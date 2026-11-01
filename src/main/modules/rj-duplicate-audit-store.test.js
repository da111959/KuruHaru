import { mkdtemp, readFile, rm } from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { createRjDuplicateAuditStore } from "./rj-duplicate-audit-store";

const directories = [];

async function createStore() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "rj-audit-"));
  directories.push(directory);
  let nextId = 0;
  const store = createRjDuplicateAuditStore({
    filePath: path.join(directory, "audit.json"),
    clock: () => new Date("2026-10-31T00:00:00.000Z"),
    createId: () => `id-${++nextId}`,
  });
  return { store, filePath: path.join(directory, "audit.json") };
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

const rows = [
  {
    rjCode: "RJ123456",
    isDuplicate: true,
    keepStatus: "keep",
    associationMethod: "reply_to",
    userMessage: {
      id: 101,
      date: new Date("2026-10-30T23:00:00.000Z"),
      peerId: "-1001",
      senderInfo: { type: "user", senderId: "7" },
    },
    botMessage: {
      id: 102,
      date: new Date("2026-10-30T23:00:03.000Z"),
      peerId: "-1001",
      senderInfo: { type: "bot", senderId: "9" },
    },
  },
  {
    rjCode: "RJ123456",
    isDuplicate: true,
    keepStatus: "delete",
    associationMethod: "rj_match",
    userMessage: {
      id: 201,
      date: new Date("2026-10-30T20:00:00.000Z"),
      peerId: "-1001",
      senderInfo: { type: "user", senderId: "8" },
    },
    botMessage: {
      id: 202,
      date: new Date("2026-10-30T20:00:05.000Z"),
      peerId: "-1001",
      senderInfo: { type: "bot", senderId: "9" },
    },
  },
];

describe("RJ duplicate audit store", () => {
  it("stores immutable scan and delete previews with explanation and source metadata", async () => {
    const { store, filePath } = await createStore();
    const sourceRows = structuredClone(rows);
    const snapshot = await store.createScanSnapshot({
      rows: sourceRows,
      channelId: "-1001",
      statistics: { duplicateRJs: 1 },
    });
    sourceRows[1].keepStatus = "keep";

    expect(snapshot.rows[1]).toMatchObject({
      keepStatus: "delete",
      associationMethod: "rj_match",
      timeDifferenceMs: 5000,
      keepReason: expect.stringContaining("保留最新"),
      source: { userChatId: "-1001", botChatId: "-1001" },
    });
    const preview = await store.createDeletePreview({
      snapshotId: snapshot.id,
      messageIds: [201, "201", 101, 999],
    });
    expect(preview.targets.map((target) => target.messageId)).toEqual([201, 202]);
    expect(JSON.parse(await readFile(filePath, "utf8")).scanSnapshots[0].rows[1].keepStatus).toBe("delete");
  });

  it("rejects IDs outside delete candidates, missing snapshots and repeated execution", async () => {
    const { store } = await createStore();
    await expect(
      store.createDeletePreview({ snapshotId: "missing", messageIds: [201] }),
    ).rejects.toThrow("扫描快照不存在");
    const snapshot = await store.createScanSnapshot({ rows, channelId: "c" });
    await expect(
      store.createDeletePreview({ snapshotId: snapshot.id, messageIds: [101] }),
    ).rejects.toThrow("没有属于该快照");
    const preview = await store.createDeletePreview({
      snapshotId: snapshot.id,
      messageIds: [201],
    });
    await store.claimExecution(preview.id);
    await store.recordExecution(preview.id, {
      success: false,
      partial: true,
      deletedMessageIds: [201],
      errors: [{ messageId: 202, error: "permission denied" }],
    });
    await expect(store.recordExecution(preview.id, {})).rejects.toThrow("已执行");
    const exported = await store.exportAudit();
    expect(exported.auditEvents[0]).toMatchObject({
      success: false,
      partial: true,
      deletedMessageIds: [201],
      errors: [{ messageId: 202, error: "permission denied" }],
    });
  });

  it("reloads audit evidence from durable storage", async () => {
    const { store, filePath } = await createStore();
    const snapshot = await store.createScanSnapshot({ rows, channelId: "c" });
    const preview = await store.createDeletePreview({
      snapshotId: snapshot.id,
      messageIds: [201],
    });
    const reopened = createRjDuplicateAuditStore({ filePath });
    expect(await reopened.getDeletePreview(preview.id)).toMatchObject({
      id: preview.id,
      snapshotId: snapshot.id,
      status: "pending",
    });
  });

  it("retains snapshots referenced by pending previews beyond the scan retention limit", async () => {
    const { store } = await createStore();
    const firstSnapshot = await store.createScanSnapshot({ rows, channelId: "c" });
    const preview = await store.createDeletePreview({
      snapshotId: firstSnapshot.id,
      messageIds: [201],
    });
    for (let index = 0; index < 55; index += 1) {
      await store.createScanSnapshot({ rows, channelId: `c-${index}` });
    }
    expect(await store.getDeletePreview(preview.id)).toMatchObject({
      snapshotId: firstSnapshot.id,
      status: "pending",
    });
    await expect(
      store.createDeletePreview({ snapshotId: firstSnapshot.id, messageIds: [201] }),
    ).resolves.toMatchObject({ snapshotId: firstSnapshot.id });
  });
});
