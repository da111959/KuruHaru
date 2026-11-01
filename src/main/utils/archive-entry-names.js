import yauzl from "yauzl";

export const extractArchiveEntryNames = (archivePath) =>
  new Promise((resolve, reject) => {
    yauzl.open(
      archivePath,
      { lazyEntries: true, autoClose: true, decodeStrings: true },
      (openError, zipFile) => {
        if (openError) {
          reject(openError);
          return;
        }

        const entries = new Set();
        zipFile.on("error", reject);
        zipFile.on("entry", (entry) => {
          const normalizedName = entry.fileName.replace(/\\/g, "/").replace(/\/$/, "");
          if (normalizedName) entries.add(normalizedName);
          zipFile.readEntry();
        });
        zipFile.on("end", () => resolve([...entries].sort()));
        zipFile.readEntry();
      },
    );
  });
