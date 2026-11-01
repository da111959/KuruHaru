import assert from "node:assert/strict";
import { ESLint } from "eslint";

const eslint = new ESLint({ cache: false });

const cases = [
  {
    name: "renderer rejects Node builtins",
    filePath: "src/renderer/src/guardrail-fixture.js",
    code: 'import fs from "node:fs";\nvoid fs;',
    expectedRule: "no-restricted-imports",
  },
  {
    name: "renderer rejects Node builtin subpaths",
    filePath: "src/renderer/src/guardrail-fixture.js",
    code: 'import { readFile } from "fs/promises";\nvoid readFile;',
    expectedRule: "no-restricted-imports",
  },
  {
    name: "renderer rejects Main implementation imports",
    filePath: "src/renderer/src/guardrail-fixture.js",
    code: 'import "../../../main/modules/config.js";',
    expectedRule: "no-restricted-imports",
  },
  {
    name: "renderer rejects CommonJS host access",
    filePath: "src/renderer/src/guardrail-fixture.js",
    code: 'const fs = require("fs");\nvoid fs;',
    expectedRule: "no-restricted-globals",
  },
  {
    name: "renderer rejects window require access",
    filePath: "src/renderer/src/guardrail-fixture.js",
    code: 'window.require("fs");',
    expectedRule: "no-restricted-properties",
  },
  {
    name: "preload rejects Renderer imports",
    filePath: "src/preload/guardrail-fixture.js",
    code: 'import App from "../renderer/src/App.vue";\nvoid App;',
    expectedRule: "no-restricted-imports",
  },
  {
    name: "Main rejects Renderer imports",
    filePath: "src/main/modules/guardrail-fixture.js",
    code: 'import App from "../../renderer/src/App.vue";\nvoid App;',
    expectedRule: "no-restricted-imports",
  },
  {
    name: "shared rejects Electron runtime imports",
    filePath: "src/shared/guardrail-fixture.js",
    code: 'import { app } from "electron";\nvoid app;',
    expectedRule: "no-restricted-imports",
  },
  {
    name: "shared rejects Main layer imports",
    filePath: "src/shared/guardrail-fixture.js",
    code: 'import config from "../main/modules/config.js";\nvoid config;',
    expectedRule: "no-restricted-imports",
  },
  {
    name: "valid preload bridge is accepted",
    filePath: "src/renderer/src/guardrail-fixture.js",
    code: 'import { callBridge } from "./api/bridge.js";\nvoid callBridge;',
    expectedRule: null,
  },
  {
    name: "preload may import Electron capability primitives",
    filePath: "src/preload/guardrail-fixture.js",
    code: 'import { contextBridge } from "electron";\nvoid contextBridge;',
    expectedRule: null,
  },
];

for (const testCase of cases) {
  const [result] = await eslint.lintText(testCase.code, {
    filePath: testCase.filePath,
  });
  const ruleIds = result.messages.map((message) => message.ruleId);

  if (testCase.expectedRule) {
    assert(
      ruleIds.includes(testCase.expectedRule),
      `${testCase.name}: expected ${testCase.expectedRule}; got ${ruleIds.join(", ") || "no diagnostics"}`,
    );
  } else {
    assert(
      result.errorCount === 0,
      `${testCase.name}: expected a clean result; got ${ruleIds.join(", ")}`,
    );
  }
}

console.log(`ESLint architecture guardrails passed (${cases.length} cases).`);
