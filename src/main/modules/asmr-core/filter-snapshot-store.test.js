import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  diffFilterSnapshots,
  listFilterSnapshots,
  readFilterSnapshot,
  saveFilterSnapshot,
} from "./filter-snapshot-store";

const tempDirectories = [];

function makeDirectory() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "kuruharu-filter-") );
  tempDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("filter snapshot store", () => {
  it("persists snapshots and returns compact lists", () => {
    const directory = makeDirectory();
    const snapshot = {
      id: "a".repeat(24),
      createdAt: "2026-10-30T00:00:00.000Z",
      input: { url: "https://example.test" },
      summary: { included: 1 },
      results: [{ comparableCode: "123456", rj_code: "RJ123456", status: "included" }],
    };
    expect(saveFilterSnapshot(directory, snapshot).success).toBe(true);
    expect(readFilterSnapshot(directory, snapshot.id)).toMatchObject(snapshot);
    expect(listFilterSnapshots(directory)).toHaveLength(1);
  });

  it("diffs included codes without treating status changes as additions", () => {
    const diff = diffFilterSnapshots(
      { results: [{ comparableCode: "123456", status: "included" }, { comparableCode: "234567", status: "included" }] },
      { results: [{ comparableCode: "123456", status: "included" }, { comparableCode: "345678", status: "included" }] },
    );
    expect(diff).toMatchObject({ unchanged: 1 });
    expect(diff.added.map((item) => item.comparableCode)).toEqual(["345678"]);
    expect(diff.removed.map((item) => item.comparableCode)).toEqual(["234567"]);
  });
});
