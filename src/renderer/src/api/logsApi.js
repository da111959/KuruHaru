import { getApiNamespace } from "./bridge";

export const readAppLogs = (cursor) =>
  getApiNamespace("system").readAppLogs(cursor || {});
