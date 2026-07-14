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
    const { entries, template, targetChannel } = (await context.request.json()) as {
      entries?: DriveEntry[];
      template?: string;
      targetChannel?: "primary" | "secondary";
    };

    const { results } = await db
      .prepare("SELECT bot_token, channel_id, channel_id_2, selected_channel FROM config WHERE id = 1")
      .all<{ bot_token: string; channel_id: string; channel_id_2: string | null; selected_channel: string | null }>();

    if (!results || results.length === 0 || !results[0].bot_token) {
      return new Response(
        JSON.stringify({ error: "Bot token not configured in database" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const selectedChannel = targetChannel || (results[0].selected_channel === "secondary" ? "secondary" : "primary");
    const botToken = results[0].bot_token;
    const channelId = selectedChannel === "secondary" ? results[0].channel_id_2 : results[0].channel_id;

    if (!channelId) {
      return new Response(
        JSON.stringify({ error: selectedChannel === "secondary" ? "Canal 2 no está configurado" : "Canal 1 no está configurado" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

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
