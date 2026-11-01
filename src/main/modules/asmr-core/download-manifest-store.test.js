import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createDownloadManifestTaskId,
  mergeDownloadManifestTasks,
  mergeDownloadManifestWork,
  readDownloadManifest,
  resolveDownloadTaskAction,
  writeDownloadManifest,
} from "./download-manifest-store";

const tempDirectories = [];

function makeTempDirectory() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asmr-manifest-"));
  tempDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("ASMR download manifest store", () => {
  it("atomically persists a versioned plan and merges task state by stable identity", () => {
    const filePath = path.join(makeTempDirectory(), "manifest.json");
    const taskId = createDownloadManifestTaskId(
      "RJ123456",
      "track-01",
      "RJ123456/Main/01.mp3",
    );
    const task = {
      taskId,
      workCode: "RJ123456",
      fingerprint: "track-01",
      outPath: "RJ123456/Main/01.mp3",
      downloadUrl: "https://example.com/01.mp3",
      state: "planned",
    };

    let manifest = mergeDownloadManifestTasks(readDownloadManifest(filePath), [
      task,
    ]);
    manifest = mergeDownloadManifestWork(manifest, {
      runId: "run-1",
      workCode: "RJ123456",
      state: "planned",
    });
    writeDownloadManifest(filePath, manifest);

    manifest = mergeDownloadManifestTasks(readDownloadManifest(filePath), [
      { taskId, state: "submitted", aria2Gid: "gid-123" },
    ]);
    const persisted = writeDownloadManifest(filePath, manifest);

    expect(persisted.version).toBe(1);
    expect(persisted.tasks).toHaveLength(1);
    expect(persisted.tasks[0]).toMatchObject({
      taskId,
      state: "submitted",
      aria2Gid: "gid-123",
    });
    expect(persisted.tasks[0]).not.toHaveProperty("downloadUrl");
    expect(persisted.works[0]).toMatchObject({
      workCode: "RJ123456",
      state: "planned",
    });
    expect(fs.readdirSync(path.dirname(filePath))).toEqual(["manifest.json"]);
  });

  it("rejects unsupported manifest versions instead of silently overwriting them", () => {
    const filePath = path.join(makeTempDirectory(), "manifest.json");
    fs.writeFileSync(
      filePath,
      JSON.stringify({ version: 99, tasks: [], works: [] }),
    );

    expect(() => readDownloadManifest(filePath)).toThrow(/版本不受支持/);
  });

  it("increments revision and rejects stale writers", () => {
    const filePath = path.join(makeTempDirectory(), "manifest.json");
    const initial = readDownloadManifest(filePath);
    const first = writeDownloadManifest(filePath, initial);
    expect(first.revision).toBe(1);

    expect(() => writeDownloadManifest(filePath, initial)).toThrow(
      /revision 冲突/,
    );

    const second = writeDownloadManifest(filePath, readDownloadManifest(filePath));
    expect(second.revision).toBe(2);
  });

  it("reuses active aria2 work and only submits missing or incomplete files", () => {
    expect(resolveDownloadTaskAction({ existingStatus: "active" })).toBe(
      "reuse",
    );
    expect(
      resolveDownloadTaskAction({ outputExists: true, tempExists: false }),
    ).toBe("completed");
    expect(
      resolveDownloadTaskAction({ outputExists: true, tempExists: true }),
    ).toBe("submit");
    expect(resolveDownloadTaskAction()).toBe("submit");
  });
});
