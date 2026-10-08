import type { Plug } from "./lib/plugs.ts";

/**
 * Edit these before you set PLUG_ENABLED=true. The validator refuses to run
 * while any URL still points at example.com.
 *
 * Keep the copy short, human and specific. Write it yourself.
 */
export const PLUGS: Plug[] = [
  {
    id: "newsletter",
    copy: "If this was useful, I write one of these every week:",
    url: "https://example.com/newsletter",
    campaign: "newsletter",
  },
  {
    id: "youtube",
    copy: "Longer walkthroughs live on my channel:",
    url: "https://example.com/youtube",
    campaign: "youtube",
  },
];
