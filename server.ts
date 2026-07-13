import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { fileURLToPath } from 'url';
import { 
  getConfig, 
  saveConfig, 
  getScheduledPosts, 
  schedulePosts, 
  deleteScheduledPost,
  getOldestPendingPost,
  updatePostStatus,
  getRecentSentPosts
} from "./src/d1.js";
import { extractFolderId, fetchDriveEntries, fetchSingleDriveFile, fetchGenericJsonUrl } from "./src/drive.js";
import { sendToTelegram, sendBatchToTelegram } from "./src/telegram.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.get("/api/config", async (req, res) => {
    try {
      const config = await getConfig();
      res.json(config);
    } catch (e) {
      console.error("Error reading config from D1:", e);
      res.status(500).json({ error: "Failed to read config" });
    }
  });

  app.post("/api/config", async (req, res) => {
    try {
      await saveConfig(req.body);
      res.json({ status: "ok" });
    } catch (e) {
      console.error("Error saving config to D1:", e);
      res.status(500).json({ error: "Failed to save config" });
    }
  });

  app.get("/api/health", async (req, res) => {
    try {
      await getConfig();
      res.json({ status: "ok", db: "connected" });
    } catch {
      res.json({ status: "ok", db: "disconnected" });
    }
  });

  const DRIVE_API_KEY = process.env.GDRIVE_API_KEY || "";

  function isDriveUrl(url: string): boolean {
    return /drive\.google\.com|docs\.google\.com\//.test(url);
  }

  app.post("/api/drive/fetch", async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) {
        res.status(400).json({ error: "URL is required" });
        return;
      }

      let entries;

      if (isDriveUrl(url)) {
        if (!DRIVE_API_KEY) {
          res.status(400).json({ error: "GDRIVE_API_KEY not configured on server" });
          return;
        }

        const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        const folderId = extractFolderId(url);

        if (!folderId) {
          res.status(400).json({ error: "Could not extract folder/file ID from URL" });
          return;
        }

        if (fileMatch) {
          entries = await fetchSingleDriveFile(folderId, DRIVE_API_KEY);
        } else {
          entries = await fetchDriveEntries(folderId, DRIVE_API_KEY);
        }
      } else {
        entries = await fetchGenericJsonUrl(url);
      }

      res.json({ entries, count: entries.length });
    } catch (e) {
      console.error("Error fetching entries:", e);
      res.status(500).json({ error: e instanceof Error ? e.message : "Failed to fetch entries" });
    }
  });

  app.post("/api/telegram/send", async (req, res) => {
    try {
      const { entries, template } = req.body;
      const config = await getConfig();

      if (!config.botToken || !config.channelId) {
        res.status(400).json({ error: "Bot token and channel ID not configured" });
        return;
      }

      if (!entries || !Array.isArray(entries) || entries.length === 0) {
        res.status(400).json({ error: "No entries to send" });
        return;
      }

      const result = await sendBatchToTelegram(
        config.botToken,
        config.channelId,
        entries,
        template || "📢 *{title}*\n\n📝 {summary}\n\n------------------------\n🔗 Read full article: {link}\n\n#{category} #GlobalNews"
      );

      res.json(result);
    } catch (e) {
      console.error("Error sending to Telegram:", e);
      res.status(500).json({ error: e instanceof Error ? e.message : "Failed to send to Telegram" });
    }
  });

  app.get("/api/telegram/schedule", async (req, res) => {
    try {
      const results = await getScheduledPosts();
      res.json({ entries: results });
    } catch (e) {
      console.error("Error fetching scheduled posts:", e);
      res.status(500).json({ error: "Failed to fetch scheduled posts" });
    }
  });

  app.post("/api/telegram/schedule", async (req, res) => {
    try {
      const { entries, template } = req.body;
      if (!entries || !Array.isArray(entries) || entries.length === 0) {
        res.status(400).json({ error: "No entries to schedule" });
        return;
      }

      await schedulePosts(entries, template);
      res.json({ success: entries.length });
    } catch (e) {
      console.error("Error scheduling posts:", e);
      res.status(500).json({ error: "Failed to schedule posts" });
    }
  });

  app.delete("/api/telegram/schedule", async (req, res) => {
    try {
      const id = req.query.id as string;
      if (!id) {
        res.status(400).json({ error: "ID is required" });
        return;
      }

      await deleteScheduledPost(id);
      res.json({ status: "ok" });
    } catch (e) {
      console.error("Error deleting scheduled post:", e);
      res.status(500).json({ error: "Failed to delete scheduled post" });
    }
  });

  // Local schedule simulator: check every minute
  setInterval(async () => {
    try {
      const config = await getConfig();
      if (!config.botToken || !config.channelId || !config.scheduleDays) {
        return;
      }

      const timezone = config.scheduleTimezone || "Europe/Madrid";
      const days = config.scheduleDays.split(",").map(Number);
      const start = config.scheduleStart;
      const end = config.scheduleEnd;

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
        weekday: "long",
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
        "Saturday": 6,
      };

      const currentDay = dayMap[weekdayStr];
      const currentTimeStr = `${hourStr}:${minuteStr}`;

      if (!days.includes(currentDay)) {
        return;
      }

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

      const recentSent = await getRecentSentPosts();
      let alreadySentToday = false;

      for (const sentPost of recentSent) {
        if (sentPost.sent_at) {
          const sentDate = new Date(sentPost.sent_at as string);
          const sentParts = formatter.formatToParts(sentDate);
          const sentPartsMap = Object.fromEntries(sentParts.map((p) => [p.type, p.value]));
          const sentDateTzStr = `${sentPartsMap.year}-${sentPartsMap.month}-${sentPartsMap.day}`;

          if (sentDateTzStr === currentDateTzStr) {
            alreadySentToday = true;
            break;
          }
        }
      }

      if (alreadySentToday) {
        return;
      }

      // Fetch oldest pending post
      const oldestPending = await getOldestPendingPost();
      if (!oldestPending) {
        return;
      }

      const id = oldestPending.id as number;
      console.log(`[Local Scheduler] Processing post ${id}: "${oldestPending.title}"`);

      try {
        // Send to Telegram
        await sendToTelegram(
          config.botToken,
          config.channelId,
          {
            title: oldestPending.title as string,
            summary: oldestPending.summary as string,
            link: oldestPending.link as string,
            category: oldestPending.category as string,
          },
          oldestPending.template as string
        );

        // Update status to 'sent'
        await updatePostStatus(id, "sent");
        console.log(`[Local Scheduler] Post ${id} successfully sent.`);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`[Local Scheduler] Failed to send post ${id}:`, errMsg);
        await updatePostStatus(id, "failed", errMsg);
      }
    } catch (e) {
      console.error("[Local Scheduler] Error in schedule check:", e);
    }
  }, 60000); // Check every minute

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
