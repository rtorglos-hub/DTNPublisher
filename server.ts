import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { fileURLToPath } from 'url';
import { getConfig, saveConfig } from "./src/d1.js";
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
