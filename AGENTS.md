# Agent Guide

## Project
KuruHaru is an Electron desktop application with a Vue 3 renderer. Start with `docs/V1_BASELINE.md`; runtime, module, IPC, configuration, and persistence facts are in `docs/ARCHITECTURE.md`.

## Commands

```bash
npm ci
npm run dev
npm run test
npm run lint
npm run verify:protocol
npm run docs:config
npm run build
npm run build:win
```

`npm run verify` is only lint + build. Run tests, protocol checks, docs/config checks, and packaging separately when relevant.

## Change rules
- Keep Renderer access to host capabilities behind preload's `window.api` allowlist and the Renderer API adapters.
- For IPC changes, update the Main handler, Preload descriptor, Renderer adapter, tests, and `docs/ARCHITECTURE.md` as applicable.
- Static application configuration has one source: `src/shared/config-contract.mjs`. Regenerate the template with `npm run config:template`; don't duplicate defaults.
- Do not commit personal credentials, Telegram sessions, absolute machine paths, or secrets.
- Preserve user data and define an explicit migration before changing persisted formats.
- Use `docs/README.md` as the documentation entry point. Update the relevant canonical v1 document with behavior changes and run `npm run docs:config`.

## Validation boundaries
A successful build verifies bundling only. It does not verify Windows packaging, app startup, online account integration, update recovery, or real downloads. Report those separately.
