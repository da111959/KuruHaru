import fs from "node:fs";
import { createUserConfigTemplate } from "../src/shared/config-contract.mjs";

const targetPath = new URL("../config/config-template.json", import.meta.url);
fs.writeFileSync(targetPath, `${JSON.stringify(createUserConfigTemplate(), null, 2)}\n`);
