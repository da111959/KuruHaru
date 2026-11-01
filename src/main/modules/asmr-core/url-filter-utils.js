import { getWorkComparableRjNumber } from "./rj-filter-utils";
import { createHash } from "node:crypto";

// 根据 URL 推断当前请求是搜索接口还是列表/详情接口。
export const detectAsmrApiMode = (url = "") => {
  let isSearchApi = url.includes("/api/search/");
  const isListApi =
    url.includes("/api/playlist/") || url.includes("/api/works/");

  if (!isSearchApi && !isListApi) {
    // 历史站点上的搜索页面与 API 路径也归并到搜索模式。
    isSearchApi =
      url.includes("asmr-200.com/search") ||
      url.includes("asmr-200.com/api/search");
  }

  return {
    isSearchApi,
    isListApi,
  };
};

// 非搜索 API URL 会被包装到统一的搜索代理接口路径中。
export const buildAsmrSearchApiUrl = (url = "") => {
  if (url.includes("/api/search/")) {
    return url;
  }

  return `https://api.asmr-200.com/api/search/${encodeURIComponent(url)}`;
};

// 按发布日期过滤作品，并记录被排除条目用于日志回显。
export const filterWorksByAfterDate = (works = [], afterDateValue) => {
  const after = new Date(afterDateValue);
  const filteredOut = [];

  const filteredWorks = works.filter((work) => {
    if (!work.date) return true;

    const workDate = new Date(work.date);
    // 日期异常时默认保留，避免因为脏数据误删作品。
    if (isNaN(workDate.getTime())) {
      return true;
    }

    const keep = workDate > after;
    if (!keep) {
      filteredOut.push({
        rj: work.rj_code || work.source_id || work.id,
        title: work.title || "未知标题",
        date: work.date,
        reason: `发布日期不晚于 ${afterDateValue}`,
      });
    }

    return keep;
  });

  return {
    filteredWorks,
    filteredOut,
  };
};

// 统一映射到正式筛选结果结构。
export const mapWorksToRjFilterResult = (works = []) => {
  return works.map((work) => ({
    rj_code: work.rj_code || work.source_id || work.id,
    title: work.title,
    date: work.date || work.release,
  }));
};

export function explainWorkFilterResults({
  works = [],
  existingCodes = new Set(),
  dateFilteredOut = [],
  compareEnabled = false,
}) {
  const results = works.map((work) => {
    const comparableCode = getWorkComparableRjNumber(work) || "";
    const exists =
      compareEnabled &&
      (existingCodes.has(comparableCode) ||
        existingCodes.has(String(work.source_id || work.rj_code || work.id || "")));
    const invalid = comparableCode.length === 0;
    return {
      ...mapWorksToRjFilterResult([work])[0],
      comparableCode,
      status: invalid ? "invalid" : exists ? "already_exists" : "included",
      reason: invalid
        ? "未识别到 RJ/VJ/BJ 或纯数字作品编号"
        : exists
          ? "编号已存在于比对文件"
          : "通过筛选条件",
      source: "asmr-search",
    };
  });

  for (const item of dateFilteredOut) {
    results.push({
      rj_code: item.rj || "",
      title: item.title || "未知标题",
      date: item.date || "",
      comparableCode: String(item.rj || ""),
      status: "filtered_out",
      reason: item.reason || "发布日期不符合筛选条件",
      source: "asmr-search",
    });
  }

  return results;
}

export function paginateItems(items = [], { page = 1, pageSize = 100 } = {}) {
  const safePageSize = Math.max(1, Math.min(500, Number.parseInt(pageSize, 10) || 100));
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const safePage = Math.max(1, Math.min(totalPages, Number.parseInt(page, 10) || 1));
  const start = (safePage - 1) * safePageSize;
  return {
    items: items.slice(start, start + safePageSize),
    page: safePage,
    pageSize: safePageSize,
    total,
    totalPages,
  };
}

export function createFilterSnapshotId(input = {}, createdAt = new Date().toISOString()) {
  return createHash("sha256")
    .update(JSON.stringify({ input, createdAt }))
    .digest("hex")
    .slice(0, 24);
}
