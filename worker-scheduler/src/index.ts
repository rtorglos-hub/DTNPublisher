export interface Env {
  DB: D1Database;
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    try {
      // 1. Fetch configuration from DB
      const { results } = await env.DB.prepare(
        "SELECT bot_token, channel_id, schedule_days, schedule_start, schedule_end, schedule_timezone, auto_delete_days FROM config WHERE id = 1"
      ).all<{
        bot_token: string;
        channel_id: string;
        schedule_days: string | null;
        schedule_start: string | null;
        schedule_end: string | null;
        schedule_timezone: string | null;
        auto_delete_days: number | null;
      }>();

      if (!results || results.length === 0) {
        return;
      }

      const config = results[0];

      // Perform auto-delete of sent posts if configured
      const autoDeleteDays = config.auto_delete_days;
      if (autoDeleteDays !== null && autoDeleteDays !== undefined && autoDeleteDays > 0) {
        try {
          const deleteResult = await env.DB.prepare(
            "DELETE FROM scheduled_posts WHERE status = 'sent' AND sent_at < datetime('now', ?)"
          ).bind(`-${autoDeleteDays} days`).run();
          console.log(`[Scheduler] Auto-cleanup of sent posts older than ${autoDeleteDays} days completed. Rows affected: ${deleteResult.meta.changes}`);
        } catch (cleanupErr) {
          console.error("[Scheduler] Error during auto-cleanup of sent posts:", cleanupErr);
        }
      }

      if (!config.bot_token || !config.schedule_days) {
        return;
      }

      // 2. Parse time window parameters
      const timezone = config.schedule_timezone || "Europe/Madrid";
      const days = config.schedule_days.split(",").map(Number);
      const start = config.schedule_start;
      const end = config.schedule_end;

      const now = new Date();
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        weekday: "long"
      });

      const parts = formatter.formatToParts(now);
      const partsMap = Object.fromEntries(parts.map((p) => [p.type, p.value]));

      const weekdayStr = partsMap.weekday;
      const hourStr = partsMap.hour;
      const minuteStr = partsMap.minute;

      const dayMap: Record<string, number> = {
        "Sunday": 0,
        "Monday": 1,
        "Tuesday": 2,
        "Wednesday": 3,
        "Thursday": 4,
        "Friday": 5,
        "Saturday": 6
      };

      const currentDay = dayMap[weekdayStr];
      const currentTimeStr = `${hourStr}:${minuteStr}`;

      // Check weekday
      if (!days.includes(currentDay)) {
        return;
      }

      // Check hour range
      if (start && end) {
        if (currentTimeStr < start || currentTimeStr > end) {
          return;
        }
      }

      // LÍMITE: "Solo quiero que se envie un post por dia."
      // Check if we've already sent a post on this calendar day in target timezone
      const yearStr = partsMap.year;
      const monthStr = partsMap.month;
      const dayStr = partsMap.day;
      const currentDateTzStr = `${yearStr}-${monthStr}-${dayStr}`;

      const recentSentRes = await env.DB.prepare(
        "SELECT sent_at FROM scheduled_posts WHERE status = 'sent' AND sent_at IS NOT NULL ORDER BY sent_at DESC LIMIT 50"
      ).all<{ sent_at: string }>();

      let alreadySentToday = false;
      if (recentSentRes.results) {
        for (const sentPost of recentSentRes.results) {
          if (sentPost.sent_at) {
            const sentDate = new Date(sentPost.sent_at);
            const sentParts = formatter.formatToParts(sentDate);
            const sentPartsMap = Object.fromEntries(sentParts.map((p) => [p.type, p.value]));
            const sentDateTzStr = `${sentPartsMap.year}-${sentPartsMap.month}-${sentPartsMap.day}`;

            if (sentDateTzStr === currentDateTzStr) {
              alreadySentToday = true;
              break;
            }
          }
        }
      }

      if (alreadySentToday) {
        console.log(`[Scheduler] A post has already been sent today (${currentDateTzStr}). Skipping.`);
        return;
      }

      // 3. Fetch the oldest pending post
      const pendingRes = await env.DB.prepare(
        "SELECT * FROM scheduled_posts WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1"
      ).all<{
        id: number;
        title: string;
        summary: string;
        link: string;
        category: string;
        template: string;
        channel_id: string | null;
        channel_label: string | null;
      }>();

      if (!pendingRes.results || pendingRes.results.length === 0) {
        return;
      }

      const post = pendingRes.results[0];
      const id = post.id;
      const targetChannelId = post.channel_id || config.channel_id;
      if (!targetChannelId) {
        await env.DB.prepare(
          "UPDATE scheduled_posts SET status = 'failed', sent_at = datetime('now'), error_message = ? WHERE id = ?"
        ).bind("No Telegram channel configured for this scheduled post", id).run();
        return;
      }

      console.log(`[Scheduler] Processing post ${id}: "${post.title}"`);

      try {
        // Send to Telegram
        await sendToTelegram(
          config.bot_token,
          targetChannelId,
          {
            title: post.title,
            summary: post.summary,
            link: post.link,
            category: post.category
          },
          post.template
        );

        // Update DB on success
        await env.DB.prepare(
          "UPDATE scheduled_posts SET status = 'sent', sent_at = datetime('now'), error_message = NULL WHERE id = ?"
        ).bind(id).run();
        console.log(`[Scheduler] Post ${id} successfully sent.`);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`[Scheduler] Failed to send scheduled post ${id}:`, errMsg);
        await env.DB.prepare(
          "UPDATE scheduled_posts SET status = 'failed', sent_at = datetime('now'), error_message = ? WHERE id = ?"
        ).bind(errMsg, id).run();
      }
    } catch (e) {
      console.error("[Scheduler] Error in schedule check:", e);
    }
  }
};

async function sendToTelegram(
  botToken: string,
  channelId: string,
  post: { title: string; summary: string; link: string; category: string },
  template: string
): Promise<void> {
  // Format message using the template
  let message = template
    .replace(/\{texto_telegram\}/g, String(post.summary || ""))
    .replace(/\{fuente_nombre\}/g, String(post.title || ""))
    .replace(/\{fuente_url\}/g, String(post.link || ""))
    .replace(/\{categoria\}/g, String(post.category || ""))
    .replace(/\{title\}/g, String(post.title || ""))
    .replace(/\{summary\}/g, String(post.summary || ""))
    .replace(/\{link\}/g, String(post.link || ""))
    .replace(/\{category\}/g, String(post.category || ""));

  let replyMarkup: any = undefined;
  const buttonRegex = /\[button:(.*?)\]/;
  const match = message.match(buttonRegex);
  if (match) {
    const buttonText = match[1].trim();
    message = message.replace(buttonRegex, "").trim();

    const url = post.link;
    if (url) {
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
