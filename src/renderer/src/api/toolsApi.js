import { callBridge, resolveBridgeMethod } from "./bridge";

const callTools = (method, payload) =>
  resolveBridgeMethod({ namespace: "tools", method })(payload);

export const extractFileNames = (payload) =>
  callTools("extractFileNames", payload);

export const cleanData = (payload) =>
  callTools("cleanData", payload);

export const cleanRecentUploadedSubtitles = (payload) =>
  callTools("cleanRecentUploadedSubtitles", payload);

export const convertSubtitleFormat = (payload) =>
  callTools("convertSubtitleFormat", payload);

export const zipSubtitles = (payload) =>
  callBridge({ namespace: "tools", method: "zipSubtitles", args: [payload] });
