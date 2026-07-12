interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = context.env.DB;
  if (!db) {
    return new Response(
      JSON.stringify({ status: "ok", db: "disconnected", error: "DB binding not found" }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    // Intentar consultar la base de datos
    await db.prepare("SELECT 1").first();
    return new Response(
      JSON.stringify({ status: "ok", db: "connected" }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ status: "ok", db: "disconnected", error: e instanceof Error ? e.message : String(e) }),
      { headers: { "Content-Type": "application/json" } }
    );
  }
};
