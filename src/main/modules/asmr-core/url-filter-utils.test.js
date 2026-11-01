import { describe, expect, it } from "vitest";
import {
  createFilterSnapshotId,
  explainWorkFilterResults,
  filterWorksByAfterDate,
  paginateItems,
} from "./url-filter-utils";

describe("ASMR URL filter results", () => {
  it("explains included, existing, invalid and date-excluded results", () => {
    const works = [
      { source_id: "RJ123456", title: "new", date: "2026-10-30" },
      { source_id: "VJ765432", title: "exists", date: "2026-10-30" },
      { source_id: "unknown", title: "invalid", date: "2026-10-30" },
    ];
    const { filteredWorks, filteredOut } = filterWorksByAfterDate(
      [...works, { source_id: "RJ111111", title: "old", date: "2026-01-01" }],
      "2026-10-01",
    );
    const results = explainWorkFilterResults({
      works: filteredWorks,
      existingCodes: new Set(["VJ765432"]),
      dateFilteredOut: filteredOut,
      compareEnabled: true,
    });

    expect(results.map(({ status, reason, source }) => ({ status, reason, source }))).toEqual([
      { status: "included", reason: "通过筛选条件", source: "asmr-search" },
      { status: "already_exists", reason: "编号已存在于比对文件", source: "asmr-search" },
      {
        status: "invalid",
        reason: "未识别到 RJ/VJ/BJ 或纯数字作品编号",
        source: "asmr-search",
      },
      {
        status: "filtered_out",
        reason: "发布日期不晚于 2026-10-01",
        source: "asmr-search",
      },
    ]);
  });

  it("keeps results when a comparison file is not enabled", () => {
    const [result] = explainWorkFilterResults({
      works: [{ source_id: "RJ123456", title: "work" }],
      existingCodes: new Set(["123456"]),
      compareEnabled: false,
    });
    expect(result.status).toBe("included");
  });

  it("paginates a stable ordered result set and clamps out-of-range pages", () => {
    expect(paginateItems([1, 2, 3, 4, 5], { page: 2, pageSize: 2 })).toEqual({
      items: [3, 4],
      page: 2,
      pageSize: 2,
      total: 5,
      totalPages: 3,
    });
    expect(paginateItems([1, 2, 3], { page: 99, pageSize: 2 }).items).toEqual([3]);
  });

  it("creates deterministic snapshot identifiers for the same run input", () => {
    const input = { url: "https://example.test/search", dateMode: "all" };
    expect(createFilterSnapshotId(input, "2026-10-30T00:00:00.000Z")).toBe(
      createFilterSnapshotId(input, "2026-10-30T00:00:00.000Z"),
    );
    expect(createFilterSnapshotId(input, "2026-10-30T00:00:00.000Z")).not.toBe(
      createFilterSnapshotId(input, "2026-10-31T00:00:00.000Z"),
    );
  });
});
