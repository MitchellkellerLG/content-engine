import { AbortTaskRunError, schedules } from "@trigger.dev/sdk";
import { runChecks, runPoll, runSlots } from "../core/engine.ts";
import { PlugConfigError } from "../lib/plugs.ts";
import { XQuotaError } from "../lib/x-client.ts";
import { buildDeps } from "./deps.ts";

/**
 * Quota / billing errors and a broken plugs.config.ts abort the run (shown as FAILED, no retries) so a
 * spend cap never hides behind a green "completed" run and never burns more
 * billed requests on retries.
 */
async function guarded<T>(fn: (d: NonNullable<ReturnType<typeof buildDeps>>) => Promise<T>) {
  const d = buildDeps();
  if (!d) return { skipped: "not_configured" };
  try {
    return await fn(d);
  } catch (e) {
    if (e instanceof XQuotaError || e instanceof PlugConfigError) throw new AbortTaskRunError(e.message);
    throw e;
  } finally {
    await d.close();
  }
}

// Every 30 minutes: record new posts (originals and quotes only).
export const pollPosts = schedules.task({
  id: "ce-poll-posts",
  cron: "*/30 * * * *",
  maxDuration: 120,
  retry: { maxAttempts: 1 },
  concurrency: { total: 1 }, // never two runs of the same job at once
  run: () => guarded((d) => runPoll(d)),
});

// Every 15 minutes: the one-time impressions check, plug, repost plan.
export const checkPosts = schedules.task({
  id: "ce-check-posts",
  cron: "*/15 * * * *",
  maxDuration: 120,
  retry: { maxAttempts: 1 },
  concurrency: { total: 1 }, // never two runs of the same job at once
  run: () => guarded((d) => runChecks(d)),
});

// Every 15 minutes: due reposts and bumps (no-op unless AUTO_RT_ENABLED).
export const repostSlots = schedules.task({
  id: "ce-repost-slots",
  cron: "7,22,37,52 * * * *",
  maxDuration: 120,
  retry: { maxAttempts: 1 },
  concurrency: { total: 1 }, // never two runs of the same job at once
  run: () => guarded((d) => runSlots(d)),
});
