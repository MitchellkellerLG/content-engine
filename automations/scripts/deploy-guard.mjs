// Pre-deploy checks. Blocks a deploy with no project ref; warns about placeholders.
import { readFileSync } from "node:fs";

if (!process.env.TRIGGER_PROJECT_REF) {
  console.error("deploy-guard: TRIGGER_PROJECT_REF is not set");
  process.exit(1);
}
const plugs = readFileSync(new URL("../src/plugs.config.ts", import.meta.url), "utf8");
if (/example\.com/.test(plugs)) {
  console.warn("deploy-guard: src/plugs.config.ts still has example.com URLs. Plugs will refuse to run until you edit them.");
}
