/**
 * All runtime settings come from environment variables (set them in your
 * Trigger.dev project, never in git). Everything that writes to X is OFF
 * unless you turn it on explicitly.
 */

export type PlugMode = "notify" | "reply";

export interface Config {
  /** Your numeric X user id (not the @handle). */
  xUserId: string;
  /** Your @handle without the @, used only to build post URLs. */
  xHandle: string;

  plugEnabled: boolean;
  /** notify = send yourself the reply text; reply = post it via the X API. */
  plugMode: PlugMode;
  plugMinImpressions: number;
  /** Minutes after a post goes live before the one-time impressions check. */
  plugCheckAfterMinutes: number;
  /** Give up on a check that is this many minutes late (deploy gaps etc.). */
  plugCheckMaxLateMinutes: number;

  autoRtEnabled: boolean;
  autoRtBumpsEnabled: boolean;
  /** Hours after the post for the first repost. */
  autoRtFirstHours: number;
  /** Extra un-repost + repost "bumps" (only when bumps are enabled). Max 2. */
  autoRtBumps: number;
  autoRtBumpEveryHours: number;
  /** Hard cap on repost/un-repost writes per UTC day across all posts. */
  autoRtDailyWriteCap: number;

  notifyWebhookUrl?: string;
}

const truthy = (v: string | undefined) => /^(1|true|yes|on)$/i.test((v ?? "").trim());

function int(name: string, v: string | undefined, def: number, min: number, max: number): number {
  if (v === undefined || v.trim() === "") return def;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max} (got "${v}")`);
  }
  return n;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const xUserId = (env.X_USER_ID ?? "").trim();
  if (!/^\d{1,25}$/.test(xUserId)) {
    throw new Error("X_USER_ID must be your numeric X user id");
  }
  const xHandle = (env.X_HANDLE ?? "").trim().replace(/^@/, "");
  if (!/^[A-Za-z0-9_]{1,15}$/.test(xHandle)) {
    throw new Error("X_HANDLE must be your X handle, e.g. yourhandle");
  }
  const mode = (env.PLUG_MODE ?? "notify").trim().toLowerCase();
  if (mode !== "notify" && mode !== "reply") {
    throw new Error('PLUG_MODE must be "notify" or "reply"');
  }
  const autoRtEnabled = truthy(env.AUTO_RT_ENABLED);
  const autoRtBumpsEnabled = autoRtEnabled && truthy(env.AUTO_RT_BUMPS_ENABLED);
  return {
    xUserId,
    xHandle,
    plugEnabled: truthy(env.PLUG_ENABLED),
    plugMode: mode,
    plugMinImpressions: int("PLUG_MIN_IMPRESSIONS", env.PLUG_MIN_IMPRESSIONS, 1000, 0, 10_000_000),
    plugCheckAfterMinutes: int("PLUG_CHECK_AFTER_MINUTES", env.PLUG_CHECK_AFTER_MINUTES, 120, 30, 24 * 60),
    plugCheckMaxLateMinutes: int("PLUG_CHECK_MAX_LATE_MINUTES", env.PLUG_CHECK_MAX_LATE_MINUTES, 240, 15, 24 * 60),
    autoRtEnabled,
    autoRtBumpsEnabled,
    autoRtFirstHours: int("AUTO_RT_FIRST_HOURS", env.AUTO_RT_FIRST_HOURS, 4, 1, 48),
    autoRtBumps: autoRtBumpsEnabled ? int("AUTO_RT_BUMPS", env.AUTO_RT_BUMPS, 1, 0, 2) : 0,
    autoRtBumpEveryHours: int("AUTO_RT_BUMP_EVERY_HOURS", env.AUTO_RT_BUMP_EVERY_HOURS, 4, 2, 48),
    autoRtDailyWriteCap: int("AUTO_RT_DAILY_WRITE_CAP", env.AUTO_RT_DAILY_WRITE_CAP, 6, 1, 50),
    notifyWebhookUrl: env.NOTIFY_WEBHOOK_URL?.trim() || undefined,
  };
}
