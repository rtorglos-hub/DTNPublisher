import { sendBatchToTelegram } from "../../../src/telegram.ts";
import type { DriveEntry } from "../../../src/drive.ts";

interface Env {
  DB: D1Database;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const db = context.env.DB;
  if (!db) {
    return new Response(JSON.stringify({ error: "DB binding not found" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { entries, template } = (await context.request.json()) as {
      entries?: DriveEntry[];
      template?: string;
    };

    const { results } = await db
      .prepare("SELECT bot_token, channel_id FROM config WHERE id = 1")
      .all<{ bot_token: string; channel_id: string }>();

    if (!results || results.length === 0 || !results[0].bot_token || !results[0].channel_id) {
      return new Response(
        JSON.stringify({ error: "Bot token and channel ID not configured in database" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { bot_token: botToken, channel_id: channelId } = results[0];

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return new Response(JSON.stringify({ error: "No entries to send" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const defaultTemplate = "{texto_telegram}\n\n[button:👉 Leer más]";

    const result = await sendBatchToTelegram(
      botToken,
      channelId,
      entries,
      template || defaultTemplate
    );

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
