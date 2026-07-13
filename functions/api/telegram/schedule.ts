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
      };

      if (!entries || !Array.isArray(entries) || entries.length === 0) {
        return new Response(JSON.stringify({ error: "No entries to schedule" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const defaultTemplate = "{texto_telegram}\n\n[button:👉 Leer más]";
      const chosenTemplate = template || defaultTemplate;

      const statements = entries.map((entry) => {
        return db.prepare(
          `INSERT INTO scheduled_posts (title, summary, link, category, template, status, created_at)
           VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'))`
        ).bind(
          entry.title || entry.fuente_nombre || "",
          entry.summary || entry.texto_telegram || "",
          entry.link || entry.fuente_url || "",
          entry.category || entry.categoria || "",
          chosenTemplate
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
