import type { DriveEntry } from "./drive.js";

function fillTemplate(template: string, entry: DriveEntry): string {
  return template
    .replace(/\{texto_telegram\}/g, String(entry.texto_telegram || entry.summary || ""))
    .replace(/\{fuente_nombre\}/g, String(entry.fuente_nombre || entry.title || ""))
    .replace(/\{fuente_url\}/g, String(entry.fuente_url || entry.link || ""))
    .replace(/\{categoria\}/g, String(entry.categoria || entry.category || ""))
    .replace(/\{title\}/g, String(entry.title || entry.fuente_nombre || ""))
    .replace(/\{summary\}/g, String(entry.summary || entry.texto_telegram || ""))
    .replace(/\{link\}/g, String(entry.link || entry.fuente_url || ""))
    .replace(/\{category\}/g, String(entry.category || entry.categoria || ""));
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
