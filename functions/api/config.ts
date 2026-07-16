interface Env {
  DB: D1Database;
}

export interface AppConfig {
  botToken: string;
  channelId: string;
  channelId2?: string;
  selectedChannel?: "primary" | "secondary";
  driveUrl: string;
  scheduleDays?: string;
  scheduleStart?: string;
  scheduleEnd?: string;
  scheduleTimezone?: string;
  autoDeleteDays?: number;
}

async function ignoreExistingColumn(action: Promise<unknown>) {
  try {
    await action;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (!/duplicate column name|already exists/i.test(message)) {
      throw e;
    }
  }
}

async function ensureConfigSchema(db: D1Database) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS config (
        id INTEGER PRIMARY KEY,
        bot_token TEXT,
        channel_id TEXT,
        drive_url TEXT,
        updated_at DATETIME
      )`
    )
    .run();

  const { results } = await db
    .prepare("SELECT name FROM pragma_table_info('config')")
    .all<{ name: string }>();
  const existingColumns = new Set((results || []).map((column) => column.name));

  const columns = [
    { name: "schedule_days", sql: "ALTER TABLE config ADD COLUMN schedule_days TEXT" },
    { name: "schedule_start", sql: "ALTER TABLE config ADD COLUMN schedule_start TEXT" },
    { name: "schedule_end", sql: "ALTER TABLE config ADD COLUMN schedule_end TEXT" },
    { name: "schedule_timezone", sql: "ALTER TABLE config ADD COLUMN schedule_timezone TEXT" },
    { name: "auto_delete_days", sql: "ALTER TABLE config ADD COLUMN auto_delete_days INTEGER" },
    { name: "channel_id_2", sql: "ALTER TABLE config ADD COLUMN channel_id_2 TEXT" },
    { name: "selected_channel", sql: "ALTER TABLE config ADD COLUMN selected_channel TEXT" },
  ];

  for (const column of columns) {
    if (!existingColumns.has(column.name)) {
      await ignoreExistingColumn(db.prepare(column.sql).run());
    }
  }
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
    await ensureConfigSchema(db);

    const { results } = await db
      .prepare("SELECT bot_token, channel_id, channel_id_2, selected_channel, drive_url, schedule_days, schedule_start, schedule_end, schedule_timezone, auto_delete_days FROM config WHERE id = 1")
      .all<{
        bot_token: string;
        channel_id: string;
        channel_id_2?: string | null;
        selected_channel?: string | null;
        drive_url: string;
        schedule_days: string | null;
        schedule_start: string | null;
        schedule_end: string | null;
        schedule_timezone: string | null;
        auto_delete_days: number | null;
      }>();

    if (!results || results.length === 0) {
      return new Response(
        JSON.stringify({
          botToken: "",
          channelId: "",
          channelId2: "",
          selectedChannel: "primary",
          driveUrl: "",
          scheduleDays: "",
          scheduleStart: "",
          scheduleEnd: "",
          scheduleTimezone: "Europe/Madrid",
          autoDeleteDays: 10,
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const row = results[0];
    return new Response(
      JSON.stringify({
        botToken: row.bot_token || "",
        channelId: row.channel_id || "",
        channelId2: row.channel_id_2 || "",
        selectedChannel: row.selected_channel === "secondary" ? "secondary" : "primary",
        driveUrl: row.drive_url || "",
        scheduleDays: row.schedule_days || "",
        scheduleStart: row.schedule_start || "",
        scheduleEnd: row.schedule_end || "",
        scheduleTimezone: row.schedule_timezone || "Europe/Madrid",
        autoDeleteDays: row.auto_delete_days !== null && row.auto_delete_days !== undefined ? Number(row.auto_delete_days) : 10,
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
    await ensureConfigSchema(db);
    
    await db
      .prepare(
        `INSERT INTO config (id, bot_token, channel_id, channel_id_2, selected_channel, drive_url, schedule_days, schedule_start, schedule_end, schedule_timezone, auto_delete_days, updated_at)
         VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(id) DO UPDATE SET
           bot_token = excluded.bot_token,
           channel_id = excluded.channel_id,
           channel_id_2 = excluded.channel_id_2,
           selected_channel = excluded.selected_channel,
           drive_url = excluded.drive_url,
           schedule_days = excluded.schedule_days,
           schedule_start = excluded.schedule_start,
           schedule_end = excluded.schedule_end,
           schedule_timezone = excluded.schedule_timezone,
           auto_delete_days = excluded.auto_delete_days,
           updated_at = datetime('now')`
      )
      .bind(
        config.botToken || "",
        config.channelId || "",
        config.channelId2 || "",
        config.selectedChannel === "secondary" ? "secondary" : "primary",
        config.driveUrl || "",
        config.scheduleDays || "",
        config.scheduleStart || "",
        config.scheduleEnd || "",
        config.scheduleTimezone || "Europe/Madrid",
        config.autoDeleteDays !== undefined ? Number(config.autoDeleteDays) : 10
      )
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
