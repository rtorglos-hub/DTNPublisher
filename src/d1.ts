const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4";

function getD1Config() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_D1_TOKEN;
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;

  if (!accountId || !apiToken || !databaseId) {
    throw new Error(
      "Missing Cloudflare D1 configuration. Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_TOKEN, and CLOUDFLARE_D1_DATABASE_ID environment variables."
    );
  }

  return { accountId, apiToken, databaseId };
}

async function query(sql: string, params: unknown[] = []): Promise<{ results: Record<string, unknown>[]; success: boolean }> {
  const { accountId, apiToken, databaseId } = getD1Config();

  const response = await fetch(
    `${CLOUDFLARE_API_BASE}/accounts/${accountId}/d1/database/${databaseId}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql, params }),
    }
  );

  if (!response.ok) {
    throw new Error(`D1 API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as {
    result: { results: Record<string, unknown>[]; success: boolean }[];
    success: boolean;
    errors: unknown[];
  };

  if (!data.success) {
    throw new Error(`D1 query failed: ${JSON.stringify(data.errors)}`);
  }

  return data.result[0];
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

export async function getConfig(): Promise<AppConfig> {
  const result = await query(
    "SELECT bot_token, channel_id, channel_id_2, selected_channel, drive_url, schedule_days, schedule_start, schedule_end, schedule_timezone, auto_delete_days FROM config WHERE id = 1"
  );

  if (result.results.length === 0) {
    return { botToken: "", channelId: "", channelId2: "", selectedChannel: "primary", driveUrl: "", scheduleDays: "", scheduleStart: "", scheduleEnd: "", scheduleTimezone: "Europe/Madrid", autoDeleteDays: 10 };
  }

  const row = result.results[0];
  return {
    botToken: (row.bot_token as string) || "",
    channelId: (row.channel_id as string) || "",
    channelId2: (row.channel_id_2 as string) || "",
    selectedChannel: row.selected_channel === "secondary" ? "secondary" : "primary",
    driveUrl: (row.drive_url as string) || "",
    scheduleDays: (row.schedule_days as string) || "",
    scheduleStart: (row.schedule_start as string) || "",
    scheduleEnd: (row.schedule_end as string) || "",
    scheduleTimezone: (row.schedule_timezone as string) || "Europe/Madrid",
    autoDeleteDays: row.auto_delete_days !== null && row.auto_delete_days !== undefined ? Number(row.auto_delete_days) : 10,
  };
}

export async function saveConfig(config: AppConfig): Promise<void> {
  await query(
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
       updated_at = datetime('now')`,
    [
      config.botToken || "",
      config.channelId || "",
      config.channelId2 || "",
      config.selectedChannel === "secondary" ? "secondary" : "primary",
      config.driveUrl || "",
      config.scheduleDays || "",
      config.scheduleStart || "",
      config.scheduleEnd || "",
      config.scheduleTimezone || "Europe/Madrid",
      config.autoDeleteDays !== undefined ? Number(config.autoDeleteDays) : 10,
    ]
  );
}

export async function getScheduledPosts(): Promise<Record<string, unknown>[]> {
  const result = await query("SELECT * FROM scheduled_posts ORDER BY created_at ASC");
  return result.results;
}

export async function schedulePosts(entries: any[], template: string, channelId: string, channelLabel: string): Promise<void> {
  const defaultTemplate = "{texto_telegram}\n\n[button:👉 Leer más]";
  const chosenTemplate = template || defaultTemplate;

  await Promise.all(
    entries.map((entry) =>
      query(
        `INSERT INTO scheduled_posts (title, summary, link, category, template, channel_id, channel_label, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))`,
        [
          entry.title || entry.fuente_nombre || "",
          entry.summary || entry.texto_telegram || "",
          entry.link || entry.fuente_url || "",
          entry.category || entry.categoria || "",
          chosenTemplate,
          channelId,
          channelLabel,
        ]
      )
    )
  );
}

export async function deleteScheduledPost(id: string): Promise<void> {
  await query("DELETE FROM scheduled_posts WHERE id = ?", [id]);
}

export async function getPendingPosts(limit = 50): Promise<Record<string, unknown>[]> {
  const result = await query(
    "SELECT * FROM scheduled_posts WHERE status = 'pending' ORDER BY created_at ASC LIMIT ?",
    [limit]
  );
  return result.results;
}

export async function claimScheduledPost(id: number): Promise<void> {
  await query(
    "UPDATE scheduled_posts SET status = 'sending', error_message = NULL WHERE id = ? AND status = 'pending'",
    [id]
  );
}

export async function updatePostStatus(
  id: number,
  status: string,
  errorMessage?: string
): Promise<void> {
  if (status === "sent") {
    await query(
      "UPDATE scheduled_posts SET status = 'sent', sent_at = datetime('now'), error_message = NULL WHERE id = ?",
      [id]
    );
  } else {
    await query(
      "UPDATE scheduled_posts SET status = ?, sent_at = datetime('now'), error_message = ? WHERE id = ?",
      [status, errorMessage || null, id]
    );
  }
}

export async function getRecentSentPosts(): Promise<Record<string, unknown>[]> {
  const result = await query(
    "SELECT sent_at, channel_id FROM scheduled_posts WHERE status = 'sent' AND sent_at IS NOT NULL ORDER BY sent_at DESC LIMIT 100"
  );
  return result.results;
}
