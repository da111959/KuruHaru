import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CONFIG_SECTIONS,
  createDefaultConfig,
  createUserConfigTemplate,
} from "../src/shared/config-contract.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const warnings = [];

function fail(message) {
  errors.push(message);
}

function readJson(relativePath) {
  const fullPath = path.join(root, relativePath);
  try {
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch (error) {
    fail(`${relativePath}: ${error.message}`);
    return null;
  }
}

function compareShape(expected, actual, label) {
  if (!actual || typeof actual !== "object" || Array.isArray(actual)) {
    fail(`${label} must be an object`);
    return;
  }

  for (const key of Object.keys(expected)) {
    if (!(key in actual)) fail(`${label} is missing ${key}`);
  }

  for (const key of Object.keys(actual)) {
    if (!(key in expected)) warnings.push(`${label} has undocumented field ${key}`);
  }
}

const template = readJson("config/config-template.json");
const checkedInConfig = readJson("config/config.json");
if (template?.configVersion === undefined) {
  fail("config/config-template.json is missing configVersion");
}
compareShape(createUserConfigTemplate(), template, "config/config-template.json");

if (checkedInConfig) {
  for (const key of Object.keys(checkedInConfig)) {
    if (key !== "configVersion" && !CONFIG_SECTIONS.includes(key)) {
      warnings.push(`config/config.json has unknown section ${key}`);
    }
  }

  const secrets = [
    ["tg", "apiHash"],
    ["tg", "session"],
    ["tg", "botToken"],
    ["asmr", "password"],
    ["asmr", "token"],
    ["asmr", "downloadRpcSecret"],
  ];
  for (const [section, key] of secrets) {
    if (checkedInConfig[section]?.[key]) {
      fail(`config/config.json contains a non-empty secret: ${section}.${key}`);
    }
  }
}

const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
for (const required of ["npm run dev", "npm run build:win"]) {
  if (!readme.includes(required)) fail(`README.md is missing ${required}`);
}

const docsRoot = path.join(root, "docs");
function collectMarkdown(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectMarkdown(fullPath);
    return entry.isFile() && entry.name.endsWith(".md") ? [fullPath] : [];
  });
}

for (const filePath of collectMarkdown(docsRoot)) {
  const content = fs.readFileSync(filePath, "utf8");
  const relative = path.relative(root, filePath).replaceAll("\\", "/");
  const links = content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g);
  for (const [, target] of links) {
    if (/^(?:https?:|mailto:|#)/i.test(target)) continue;
    const fileTarget = target.split("#")[0];
    if (!fileTarget) continue;
    const decodedTarget = decodeURIComponent(fileTarget);
    if (/^(?:[a-z0-9_-]+\.md|[a-z0-9_-]+\/)/i.test(decodedTarget)) {
      const nested = path.resolve(docsRoot, decodedTarget);
      const relative = path.resolve(path.dirname(filePath), decodedTarget);
      if (fs.existsSync(nested) || fs.existsSync(relative)) continue;
      warnings.push(`${relative} has a possibly stale docs link ${target}`);
      continue;
    }
    const resolved = path.resolve(path.dirname(filePath), decodedTarget);
    if (!fs.existsSync(resolved)) fail(`${relative} links to missing path ${target}`);
  }

  const references = content.matchAll(/`((?:src|scripts|config|docs)\/[^`]+)`/g);
  for (const [, target] of references) {
    const cleanTarget = target.replace(/[),.;:]$/, "");
    if (cleanTarget.includes("*") || /\{[^}]+\}/.test(cleanTarget)) continue;
    if (cleanTarget === "src/") continue;
    if (!fs.existsSync(path.join(root, cleanTarget))) {
      fail(`${relative} references missing current path ${cleanTarget}`);
    }
  }
}

const runtimeDefaults = createDefaultConfig();
if (
  Object.keys(runtimeDefaults).filter((key) => key !== "configVersion").length !==
  CONFIG_SECTIONS.length
) {
  fail("Static config section list does not match generated defaults");
}

const compatibilityConfig = readJson("config/config.json");
if (compatibilityConfig) {
  for (const [section, values] of Object.entries(compatibilityConfig)) {
    if (!CONFIG_SECTIONS.includes(section)) continue;
    if (!values || typeof values !== "object" || Array.isArray(values)) {
      fail(`config/config.json section ${section} must be an object`);
      continue;
    }
    for (const key of Object.keys(values)) {
      if (!(key in runtimeDefaults[section]) && !(section === "asmr" && key === "rememberMe")) {
        warnings.push(`config/config.json uses legacy/unknown field ${section}.${key}`);
      }
    }
  }
}

if (errors.length) {
  console.error(`Docs/config check failed with ${errors.length} error(s):`);
  for (const error of errors) console.error(`- ${error}`);
  if (warnings.length) {
    console.error(`Warnings (${warnings.length}):`);
    for (const warning of warnings) console.error(`- ${warning}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Docs/config check passed. ${warnings.length} non-blocking config warning(s).`);
  for (const warning of warnings) console.log(`- ${warning}`);
}
