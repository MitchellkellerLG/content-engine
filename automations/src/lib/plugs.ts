/**
 * Plug ("CTA") replies. Copy is fixed text you write once in plugs.config.ts;
 * nothing here is AI-generated. Every link gets UTM tags so you can see which
 * post drove the click. Any problem throws, so a bad config never posts.
 */

export interface Plug {
  /** Short id, e.g. "newsletter". Used for rotation. */
  id: string;
  /** Exact reply text. The tracked link is appended after a space. */
  copy: string;
  /** Absolute https URL. */
  url: string;
  /** utm_campaign value, lowercase letters, digits and dashes. */
  campaign: string;
}

/** X counts every link as 23 characters, whatever its real length. */
const X_LINK_LENGTH = 23;
const X_MAX_LENGTH = 280;

/** Thrown for any problem in plugs.config.ts. The jobs stop instead of posting. */
export class PlugConfigError extends Error {
  override name = "PlugConfigError";
}

export function validatePlugs(plugs: readonly Plug[]): void {
  if (plugs.length === 0) throw new PlugConfigError("plugs.config.ts has no plugs");
  const ids = new Set<string>();
  for (const p of plugs) {
    if (!/^[a-z0-9-]{1,40}$/.test(p.id)) throw new PlugConfigError(`plug id "${p.id}" must be lowercase letters, digits, dashes`);
    if (ids.has(p.id)) throw new PlugConfigError(`duplicate plug id "${p.id}"`);
    ids.add(p.id);
    if (!/^[a-z0-9-]{1,60}$/.test(p.campaign)) throw new PlugConfigError(`plug "${p.id}": campaign must be lowercase letters, digits, dashes`);
    let u: URL;
    try {
      u = new URL(p.url);
    } catch {
      throw new PlugConfigError(`plug "${p.id}": url is not a valid URL`);
    }
    if (u.protocol !== "https:") throw new PlugConfigError(`plug "${p.id}": url must be https`);
    if (/example\.com$/i.test(u.hostname)) throw new PlugConfigError(`plug "${p.id}": replace the example.com placeholder URL`);
    const copy = p.copy.trim();
    if (!copy) throw new PlugConfigError(`plug "${p.id}": copy is empty`);
    if (/https?:\/\//i.test(copy)) throw new PlugConfigError(`plug "${p.id}": put the link in url, not in copy`);
    if (copy.length + 1 + X_LINK_LENGTH > X_MAX_LENGTH) throw new PlugConfigError(`plug "${p.id}": copy is too long for one post`);
  }
}

export function trackedUrl(plug: Plug, postId: string): string {
  if (!/^\d+$/.test(postId)) throw new Error("postId must be numeric");
  const u = new URL(plug.url);
  u.searchParams.set("utm_source", "x");
  u.searchParams.set("utm_medium", "social");
  u.searchParams.set("utm_campaign", plug.campaign);
  u.searchParams.set("utm_content", postId);
  return u.toString();
}

export function plugText(plug: Plug, postId: string): string {
  return `${plug.copy.trim()} ${trackedUrl(plug, postId)}`;
}

/** Rotate through plugs in config order, starting after the last one used. */
export function nextPlug(plugs: readonly Plug[], lastId: string | null): Plug {
  validatePlugs(plugs);
  const i = lastId ? plugs.findIndex((p) => p.id === lastId) : -1;
  return plugs[(i + 1) % plugs.length];
}

/** Hosts of every plug destination. A post already linking to one is skipped. */
export function plugHosts(plugs: readonly Plug[]): string[] {
  return plugs.map((p) => new URL(p.url).hostname.replace(/^www\./, "").toLowerCase());
}
