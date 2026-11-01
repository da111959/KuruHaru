# CI mirrors the checks required by the CI workflow; documentation changes do not bypass them.
npm run test
npm run lint
npm run verify:protocol
npm run docs:config
npm run build
