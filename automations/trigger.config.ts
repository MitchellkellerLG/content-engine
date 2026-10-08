import { defineConfig } from "@trigger.dev/sdk";

// Your Trigger.dev project ref (dashboard -> Project settings), e.g. proj_xxxxxxxx.
// Read from the environment so nothing account-specific lives in git.
const project = process.env.TRIGGER_PROJECT_REF;
if (!project) throw new Error("Set TRIGGER_PROJECT_REF before running trigger dev/deploy");

export default defineConfig({
  project,
  dirs: ["./src/trigger"],
  runtime: "node",
  maxDuration: 300,
  retries: { enabledInDev: false, default: { maxAttempts: 1 } },
});
