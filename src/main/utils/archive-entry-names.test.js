import archiver from "archiver";
import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { extractArchiveEntryNames } from "./archive-entry-names";

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      fs.promises.rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("extractArchiveEntryNames", () => {
  it("returns unique, sorted file and folder names from a ZIP", async () => {
    const directory = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), "kuruharu-archive-names-"),
    );
    temporaryDirectories.push(directory);
    const archivePath = path.join(directory, "names.zip");
    const archive = archiver("zip");
    const output = fs.createWriteStream(archivePath);
    const finished = new Promise((resolve, reject) => {
      output.once("close", resolve);
      output.once("error", reject);
      archive.once("error", reject);
    });

    archive.pipe(output);
    archive.append("first", { name: "Folder/RJ123456.zip" });
    archive.append("second", { name: "Folder/RJ123456.zip" });
    archive.append("", { name: "TopLevel.txt" });
    await archive.finalize();
    await finished;

    await expect(extractArchiveEntryNames(archivePath)).resolves.toEqual([
      "Folder/RJ123456.zip",
      "TopLevel.txt",
    ]);
  });
});
