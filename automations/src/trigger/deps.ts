import { logger } from "@trigger.dev/sdk";
import { loadConfig } from "../lib/config.ts";
import { createNotify } from "../lib/notify.ts";
import { createPgStore } from "../lib/store.ts";
import { createXClient, credentialsFromEnv } from "../lib/x-client.ts";
import { PLUGS } from "../plugs.config.ts";
import type { Deps } from "../core/engine.ts";

/**
 * Build the job dependencies, or return null (task logs and succeeds) when
 * the X keys or database URL are missing. A half-configured project never
 * writes anything.
 */
export function buildDeps(): (Deps & { close(): Promise<void> }) | null {
  const creds = credentialsFromEnv();
  const databaseUrl = process.env.DATABASE_URL;
  if (!creds || !databaseUrl) {
    logger.warn("X API keys or DATABASE_URL not set; skipping. See automations/README.md.");
    return null;
  }
  const cfg = loadConfig();
  const store = createPgStore(databaseUrl);
  return {
    cfg,
    store,
    x: createXClient(creds),
    plugs: PLUGS,
    notify: createNotify(cfg.notifyWebhookUrl, (m) => logger.info(m)),
    now: () => new Date(),
    log: (msg, data) => logger.info(msg, data),
    close: () => store.end(),
  };
}
