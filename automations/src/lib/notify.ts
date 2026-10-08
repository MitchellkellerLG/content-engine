/**
 * Send yourself a message. Works with Slack and Discord incoming webhooks
 * (the body carries both "text" and "content"). With no webhook set, the
 * message only goes to the Trigger.dev run log and notify mode reports a
 * failure so you can see nothing reached you.
 */
export function createNotify(webhookUrl: string | undefined, log: (m: string) => void = console.log) {
  return async (text: string): Promise<boolean> => {
    log(`[notify] ${text}`);
    if (!webhookUrl) return false;
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, content: text }),
      });
      return res.ok;
    } catch {
      return false;
    }
  };
}
