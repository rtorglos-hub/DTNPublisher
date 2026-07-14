import type { DriveEntry } from "../../../src/drive.ts";

interface Env {
  DB: D1Database;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const method = context.request.method;
  const db = context.env.DB;
  if (!db) {
    return new Response(JSON.stringify({ error: "DB binding not found" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (method === "GET") {
    try {
      const { results } = await db
        .prepare("SELECT * FROM scheduled_posts ORDER BY created_at ASC")
        .all();
      return new Response(JSON.stringify({ entries: results || [] }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (e) {
      return new Response(
        JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  if (method === "POST") {
    try {
      const { entries, template } = (await context.request.json()) as {
        entries?: DriveEntry[];
        template?: string;
        targetChannel?: "primary" | "secondary";
      };

      if (!entries || !Array.isArray(entries) || entries.length === 0) {
        return new Response(JSON.stringify({ error: "No entries to schedule" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const defaultTemplate = "{texto_telegram}\n\n[button:👉 Leer más]";
      const chosenTemplate = template || defaultTemplate;
      const configRes = await db
        .prepare("SELECT channel_id, channel_id_2, selected_channel FROM config WHERE id = 1")
        .all<{ channel_id: string; channel_id_2: string | null; selected_channel: string | null }>();
      const config = configRes.results?.[0];
      const selectedChannel = targetChannel || (config?.selected_channel === "secondary" ? "secondary" : "primary");
      const channelId = selectedChannel === "secondary" ? config?.channel_id_2 : config?.channel_id;
      const channelLabel = selectedChannel === "secondary" ? "Canal 2" : "Canal 1";

      if (!channelId) {
        return new Response(JSON.stringify({ error: `${channelLabel} no está configurado` }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const statements = entries.map((entry) => {
        return db.prepare(
          `INSERT INTO scheduled_posts (title, summary, link, category, template, channel_id, channel_label, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))`
        ).bind(
          entry.title || entry.fuente_nombre || "",
          entry.summary || entry.texto_telegram || "",
          entry.link || entry.fuente_url || "",
          entry.category || entry.categoria || "",
          chosenTemplate,
          channelId,
          channelLabel
        );
      });

      await db.batch(statements);

      return new Response(JSON.stringify({ success: entries.length }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (e) {
      return new Response(
        JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  if (method === "DELETE") {
    try {
      const url = new URL(context.request.url);
      const id = url.searchParams.get("id");
      if (!id) {
        return new Response(JSON.stringify({ error: "ID is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      await db.prepare("DELETE FROM scheduled_posts WHERE id = ?").bind(id).run();

      return new Response(JSON.stringify({ status: "ok" }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (e) {
      return new Response(
        JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  return new Response("Method not allowed", { status: 405 });
};
