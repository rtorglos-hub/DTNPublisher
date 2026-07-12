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
}

export async function getConfig(): Promise<AppConfig> {
  const result = await query("SELECT bot_token, channel_id, drive_url FROM config WHERE id = 1");

  if (result.results.length === 0) {
    return { botToken: "", channelId: "", driveUrl: "" };
  }

  const row = result.results[0];
  return {
    botToken: (row.bot_token as string) || "",
    channelId: (row.channel_id as string) || "",
    driveUrl: (row.drive_url as string) || "",
  };
}

export async function saveConfig(config: AppConfig): Promise<void> {
  await query(
    `INSERT INTO config (id, bot_token, channel_id, drive_url, updated_at)
     VALUES (1, ?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       bot_token = excluded.bot_token,
       channel_id = excluded.channel_id,
       drive_url = excluded.drive_url,
       updated_at = datetime('now')`,
    [config.botToken, config.channelId, config.driveUrl]
  );
}
