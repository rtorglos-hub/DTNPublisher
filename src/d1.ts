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
  driveUrl: string;
  scheduleDays?: string;
  scheduleStart?: string;
  scheduleEnd?: string;
  scheduleTimezone?: string;
}

export async function getConfig(): Promise<AppConfig> {
  const result = await query(
    "SELECT bot_token, channel_id, drive_url, schedule_days, schedule_start, schedule_end, schedule_timezone FROM config WHERE id = 1"
  );

  if (result.results.length === 0) {
    return { botToken: "", channelId: "", driveUrl: "", scheduleDays: "", scheduleStart: "", scheduleEnd: "", scheduleTimezone: "Europe/Madrid" };
  }

  const row = result.results[0];
  return {
    botToken: (row.bot_token as string) || "",
    channelId: (row.channel_id as string) || "",
    driveUrl: (row.drive_url as string) || "",
    scheduleDays: (row.schedule_days as string) || "",
    scheduleStart: (row.schedule_start as string) || "",
    scheduleEnd: (row.schedule_end as string) || "",
    scheduleTimezone: (row.schedule_timezone as string) || "Europe/Madrid",
  };
}

export async function saveConfig(config: AppConfig): Promise<void> {
  await query(
    `INSERT INTO config (id, bot_token, channel_id, drive_url, schedule_days, schedule_start, schedule_end, schedule_timezone, updated_at)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       bot_token = excluded.bot_token,
       channel_id = excluded.channel_id,
       drive_url = excluded.drive_url,
       schedule_days = excluded.schedule_days,
       schedule_start = excluded.schedule_start,
       schedule_end = excluded.schedule_end,
       schedule_timezone = excluded.schedule_timezone,
       updated_at = datetime('now')`,
    [
      config.botToken || "",
      config.channelId || "",
      config.driveUrl || "",
      config.scheduleDays || "",
      config.scheduleStart || "",
      config.scheduleEnd || "",
      config.scheduleTimezone || "Europe/Madrid",
    ]
  );
}

export async function getScheduledPosts(): Promise<Record<string, unknown>[]> {
  const result = await query("SELECT * FROM scheduled_posts ORDER BY created_at ASC");
  return result.results;
}

export async function schedulePosts(entries: any[], template: string): Promise<void> {
  const defaultTemplate = "{texto_telegram}\n\n[button:👉 Leer más]";
  const chosenTemplate = template || defaultTemplate;

  await Promise.all(
    entries.map((entry) =>
      query(
        `INSERT INTO scheduled_posts (title, summary, link, category, template, status, created_at)
         VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'))`,
        [
          entry.title || entry.fuente_nombre || "",
          entry.summary || entry.texto_telegram || "",
          entry.link || entry.fuente_url || "",
          entry.category || entry.categoria || "",
          chosenTemplate,
        ]
      )
    )
  );
}

export async function deleteScheduledPost(id: string): Promise<void> {
  await query("DELETE FROM scheduled_posts WHERE id = ?", [id]);
}

export async function getOldestPendingPost(): Promise<Record<string, unknown> | null> {
  const result = await query(
    "SELECT * FROM scheduled_posts WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1"
  );
  return result.results.length > 0 ? result.results[0] : null;
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
    "SELECT sent_at FROM scheduled_posts WHERE status = 'sent' AND sent_at IS NOT NULL ORDER BY sent_at DESC LIMIT 50"
  );
  return result.results;
}
