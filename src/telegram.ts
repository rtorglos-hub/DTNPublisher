import type { DriveEntry } from "./drive.js";

function fillTemplate(template: string, entry: DriveEntry): string {
  return template
    .replace(/\{title\}/g, entry.title || "")
    .replace(/\{summary\}/g, entry.summary || "")
    .replace(/\{link\}/g, entry.link || "")
    .replace(/\{category\}/g, entry.category || "");
}

export async function sendToTelegram(
  botToken: string,
  channelId: string,
  entry: DriveEntry,
  template: string
): Promise<void> {
  const message = fillTemplate(template, entry);

  const res = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: channelId,
        text: message,
        parse_mode: "Markdown",
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Telegram API error: ${res.status} - ${err}`);
  }
}

export async function sendBatchToTelegram(
  botToken: string,
  channelId: string,
  entries: DriveEntry[],
  template: string
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const entry of entries) {
    try {
      await sendToTelegram(botToken, channelId, entry, template);
      success++;
    } catch {
      failed++;
    }
  }

  return { success, failed };
}
