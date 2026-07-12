interface Env {
  DB: D1Database;
}

export interface AppConfig {
  botToken: string;
  channelId: string;
  driveUrl: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = context.env.DB;
  if (!db) {
    return new Response(JSON.stringify({ error: "DB binding not found" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { results } = await db
      .prepare("SELECT bot_token, channel_id, drive_url FROM config WHERE id = 1")
      .all<{ bot_token: string; channel_id: string; drive_url: string }>();

    if (!results || results.length === 0) {
      return new Response(
        JSON.stringify({ botToken: "", channelId: "", driveUrl: "" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const row = results[0];
    return new Response(
      JSON.stringify({
        botToken: row.bot_token || "",
        channelId: row.channel_id || "",
        driveUrl: row.drive_url || "",
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const db = context.env.DB;
  if (!db) {
    return new Response(JSON.stringify({ error: "DB binding not found" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const config = (await context.request.json()) as AppConfig;
    
    await db
      .prepare(
        `INSERT INTO config (id, bot_token, channel_id, drive_url, updated_at)
         VALUES (1, ?, ?, ?, datetime('now'))
         ON CONFLICT(id) DO UPDATE SET
           bot_token = excluded.bot_token,
           channel_id = excluded.channel_id,
           drive_url = excluded.drive_url,
           updated_at = datetime('now')`
      )
      .bind(config.botToken || "", config.channelId || "", config.driveUrl || "")
      .run();

    return new Response(JSON.stringify({ status: "ok" }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
