import type { DriveEntry } from "./drive.js";

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n");
}

function fillTemplate(template: string, entry: DriveEntry): string {
  return template
    .replace(/\{texto_telegram\}/g, normalizeText(entry.texto_telegram || entry.summary || ""))
    .replace(/\{fuente_nombre\}/g, normalizeText(entry.fuente_nombre || entry.title || ""))
    .replace(/\{fuente_url\}/g, normalizeText(entry.fuente_url || entry.link || ""))
    .replace(/\{categoria\}/g, normalizeText(entry.categoria || entry.category || ""))
    .replace(/\{title\}/g, normalizeText(entry.title || entry.fuente_nombre || ""))
    .replace(/\{summary\}/g, normalizeText(entry.summary || entry.texto_telegram || ""))
    .replace(/\{link\}/g, normalizeText(entry.link || entry.fuente_url || ""))
    .replace(/\{category\}/g, normalizeText(entry.category || entry.categoria || ""));
}

function isValidTelegramButtonUrl(url: unknown): url is string {
  if (typeof url !== "string" || !url.trim()) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export async function sendToTelegram(
  botToken: string,
  channelId: string,
  entry: DriveEntry,
  template: string
): Promise<void> {
  let message = fillTemplate(template, entry);
  let replyMarkup: any = undefined;

  const buttonRegex = /\[button:(.*?)\]/;
  const match = message.match(buttonRegex);
  if (match) {
    const buttonText = match[1].trim();
    message = message.replace(buttonRegex, "").trim();

    const url = entry.link || entry.fuente_url;
    if (isValidTelegramButtonUrl(url)) {
      replyMarkup = {
        inline_keyboard: [
          [
            {
              text: buttonText,
              url: String(url),
            },
          ],
        ],
      };
    }
  }

  if (message.length > 4096) {
    throw new Error(`Telegram message is too long (${message.length}/4096 characters)`);
  }

  const res = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: channelId,
        text: message,
        parse_mode: "HTML",
        reply_markup: replyMarkup,
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
): Promise<{ success: number; failed: number; errors: { title: string; error: string }[] }> {
  let success = 0;
  let failed = 0;
  const errors: { title: string; error: string }[] = [];

  for (const entry of entries) {
    try {
      await sendToTelegram(botToken, channelId, entry, template);
      success++;
    } catch (err) {
      failed++;
      errors.push({
        title: String(entry.title || entry.fuente_nombre || "Sin título"),
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { success, failed, errors };
}
