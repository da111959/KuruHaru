import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./tg-recent-activity", () => ({
  loadRecentActivity: vi.fn(),
}));

import {
  buildRecentUploadCleanupIndex,
  buildRecentUploadLocalCleanupPlan,
  collectWorkCodes,
  cleanupRecentUploadedSubtitles,
} from "./recent-upload-local-cleaner";

const temporaryRoots = [];

async function createCleanupFixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "kh-cleanup-test-"));
  temporaryRoots.push(root);
  const archiveDir = path.join(root, "archives");
  const subtitleDir = path.join(root, "subtitles");
  const recentActivityDir = path.join(root, "recent");
  const snapshotDirectory = path.join(root, "snapshots");
  await fs.mkdir(archiveDir);
  await fs.mkdir(subtitleDir);
  await fs.mkdir(path.join(subtitleDir, "RJ123456 subtitles"));
  await fs.writeFile(path.join(archiveDir, "RJ123456.zip"), "archive");
  vi.mocked((await import("./tg-recent-activity")).loadRecentActivity).mockReturnValue({
    success: true,
    data: { files: [{ rjCode: "RJ123456", name: "RJ123456.zip" }] },
  });
  return {
    root,
    archiveDir,
    subtitleDir,
    recentActivityDir,
    snapshotDirectory,
  };
}

afterEach(async () => {
  vi.clearAllMocks();
  await Promise.all(
    temporaryRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

describe("recent-upload-local-cleaner", () => {
  it("提取并去重 RJ/VJ/BJ 编号", () => {
    expect(
      collectWorkCodes("RJ123456 和 rj123456, 再来一个 VJ7654321"),
    ).toEqual(["RJ123456", "VJ7654321"]);
  });

  it("从最近上传缓存构建匹配索引", () => {
    const index = buildRecentUploadCleanupIndex({
      files: [
        { name: "RJ123456.zip", rjCode: "RJ123456" },
        { fileName: "VJ7654321 字幕包.zip", rjCode: "VJ7654321" },
      ],
    });

    expect([...index.codes]).toEqual(["RJ123456", "VJ7654321"]);
    expect([...index.archiveNames]).toContain("rj123456.zip");
    expect([...index.folderHints]).toContain("rj123456");
    expect([...index.folderHints]).toContain("vj7654321 字幕包");
  });

  it("同时匹配最近上传的压缩包和对应文件夹", () => {
    const result = buildRecentUploadLocalCleanupPlan({
      recentActivityData: {
        files: [
          { name: "RJ123456.zip", rjCode: "RJ123456" },
          { fileName: "VJ7654321.zip", rjCode: "VJ7654321" },
        ],
      },
      archiveFiles: [
        { name: "RJ123456.zip", path: "C:/zip/RJ123456.zip" },
        { name: "VJ7654321 修正版.zip", path: "C:/zip/VJ7654321 修正版.zip" },
        { name: "OTHER000001.zip", path: "C:/zip/OTHER000001.zip" },
      ],
      subtitleFolders: [
        { name: "RJ123456 文本", path: "C:/subs/RJ123456 文本" },
        { name: "VJ7654321", path: "C:/subs/VJ7654321" },
        { name: "无关目录", path: "C:/subs/无关目录" },
      ],
    });

    expect(result.matchedArchiveCount).toBe(2);
    expect(result.matchedFolderCount).toBe(2);
    expect(result.matchedCodes).toEqual(["RJ123456", "VJ7654321"]);
    expect(result.archiveMatches.map((item) => item.path)).toEqual([
      "C:/zip/RJ123456.zip",
      "C:/zip/VJ7654321 修正版.zip",
    ]);
    expect(result.folderMatches.map((item) => item.path)).toEqual([
      "C:/subs/RJ123456 文本",
      "C:/subs/VJ7654321",
    ]);
  });

  it("预览创建不可变快照，执行只删除快照内对象", async () => {
    const fixture = await createCleanupFixture();
    const preview = await cleanupRecentUploadedSubtitles(fixture);
    expect(preview.success).toBe(true);
    expect(preview.snapshotId).toBeTruthy();

    await fs.writeFile(path.join(fixture.archiveDir, "RJ654321.zip"), "new file");
    const result = await cleanupRecentUploadedSubtitles({
      ...fixture,
      snapshotId: preview.snapshotId,
      deleteFiles: true,
    });

    expect(result.success).toBe(true);
    expect(result.deletedArchiveCount).toBe(1);
    await expect(fs.access(path.join(fixture.archiveDir, "RJ123456.zip"))).rejects.toThrow();
    await expect(fs.access(path.join(fixture.archiveDir, "RJ654321.zip"))).resolves.toBeUndefined();
    await expect(fs.access(path.join(fixture.subtitleDir, "RJ123456 subtitles"))).rejects.toThrow();
  });

  it("拒绝目录不一致、快照外目标和预览后变化的对象", async () => {
    const fixture = await createCleanupFixture();
    const preview = await cleanupRecentUploadedSubtitles(fixture);
    const wrongDir = await cleanupRecentUploadedSubtitles({
      ...fixture,
      archiveDir: path.join(fixture.root, "elsewhere"),
      snapshotId: preview.snapshotId,
      deleteFiles: true,
    });
    expect(wrongDir.success).toBe(false);

    await fs.writeFile(path.join(fixture.archiveDir, "RJ123456.zip"), "changed archive content");
    const changed = await cleanupRecentUploadedSubtitles({
      ...fixture,
      snapshotId: preview.snapshotId,
      deleteFiles: true,
    });
    expect(changed.success).toBe(false);
    expect(changed.failedEntries.length).toBeGreaterThan(0);
    await expect(fs.access(path.join(fixture.archiveDir, "RJ123456.zip"))).resolves.toBeUndefined();
  });

  it("执行部分成功后只允许重试失败项", async () => {
    const fixture = await createCleanupFixture();
    const preview = await cleanupRecentUploadedSubtitles(fixture);
    const originalRm = fs.rm;
    const rmSpy = vi.spyOn(fs, "rm").mockImplementationOnce(async () => {
      throw new Error("temporary folder lock");
    });

    const firstRun = await cleanupRecentUploadedSubtitles({
      ...fixture,
      snapshotId: preview.snapshotId,
      deleteFiles: true,
    });
    expect(firstRun.success).toBe(false);
    expect(firstRun.deletedArchiveCount).toBe(1);
    expect(firstRun.failedEntries.map((entry) => entry.type)).toContain("folder");

    rmSpy.mockRestore();
    const retry = await cleanupRecentUploadedSubtitles({
      ...fixture,
      snapshotId: preview.snapshotId,
      retryFailures: true,
      deleteFiles: true,
    });
    expect(retry.retryFailures).toBe(true);
    expect(retry.deletedArchiveCount).toBe(0);
    expect(retry.deletedFolderCount).toBe(1);
    expect(retry.failedEntries.length).toBe(0);
    expect(originalRm).toBeTypeOf("function");
  });
});
