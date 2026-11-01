import eslintConfig from "@electron-toolkit/eslint-config";
import eslintPluginVue from "eslint-plugin-vue";
import vueParser from "vue-eslint-parser";

export default [
  {
    ignores: [
      "**/node_modules",
      "**/dist",
      "**/out",
      "**/build",
      "**/.tmp/**",
      "**/.tmp-*",
      "**/.tmp-*/**",
      "**/.codepilot-uploads/**",
      "**/output/**",
    ],
  },
  eslintConfig,
  ...eslintPluginVue.configs["flat/essential"],
  {
    files: ["**/*.vue"],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        extraFileExtensions: [".vue"],
      },
    },
  },

  {
    files: ["**/*.{js,jsx,vue}"],
    rules: {
      "vue/require-default-prop": "off",
      "vue/multi-word-component-names": "off",
      "no-empty": ["error", { allowEmptyCatch: false }],
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      eqeqeq: ["error", "always", { null: "ignore" }],
    },
  },

  {
    files: ["**/*.{test,spec}.{js,jsx}"],
    languageOptions: {
      globals: {
        afterAll: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        beforeEach: "readonly",
        describe: "readonly",
        expect: "readonly",
        it: "readonly",
        test: "readonly",
        vi: "readonly",
      },
    },
  },

  // ========================================
  // Renderer/UI 专用规则
  // ========================================
  {
    files: ["src/renderer/**/*.js", "src/renderer/**/*.vue"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [{ name: "electron", message: "Renderer host access must use window.api." }],
          patterns: [
            {
              group: [
                "node:*",
                "fs",
                "fs/**",
                "path",
                "path/**",
                "http",
                "http/**",
                "https",
                "https/**",
                "os",
                "os/**",
                "child_process",
                "child_process/**",
                "**/main/**",
              ],
              message:
                "Renderer code must use preload capabilities and renderer API adapters.",
            },
          ],
        },
      ],
      "no-restricted-globals": [
        "error",
        { name: "require", message: "Use static imports or an approved preload capability." },
      ],
      "no-restricted-properties": [
        "error",
        {
          object: "window",
          property: "require",
          message: "Renderer host access must use the preload capability API.",
        },
      ],
    },
  },

  {
    files: ["src/preload/**/*.js"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../main/**", "../../main/**", "../../../main/**", "../../../../main/**", "../renderer/**", "../../renderer/**", "../../../renderer/**", "../../../../renderer/**"],
              message: "Preload must not import Main business implementation or Renderer UI modules.",
            },
          ],
        },
      ],
    },
  },

  {
    files: ["src/shared/**/*.js", "src/shared/**/*.mjs"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [{ name: "electron", message: "Shared modules must be runtime-neutral." }],
          patterns: [
            {
              group: ["node:*", "fs", "fs/**", "path", "path/**", "**/main/**", "**/preload/**", "**/renderer/**"],
              message: "Shared modules must not depend on host runtime or application layers.",
            },
          ],
        },
      ],
    },
  },

  // ========================================
  // 主进程专用规则
  // ========================================
  {
    files: ["src/main/**/*.js"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["axios", "**/renderer/**", "**/preload/**"],
              message:
                "Main must use the shared HTTP client and must not import UI layers.",
            },
          ],
        },
      ],
    },
  },

  // ========================================
  // httpClient 模块例外
  // ========================================
  {
    files: ["src/main/modules/httpClient.js"],
    rules: { "no-restricted-imports": "off" },
  },

  // ========================================
  // Config 层规则
  // ========================================
  {
    files: ["src/main/modules/config.js"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.name=/^(asmr|tg|whisper|upload)/]",
          message: "❌ Config 模块不能包含业务逻辑。",
        },
      ],
    },
  },
];
