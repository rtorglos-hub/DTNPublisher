export const onRequestPost: PagesFunction = async (context) => {
  try {
    const { botToken } = (await context.request.json()) as { botToken?: string };
    if (!botToken) {
      return new Response(JSON.stringify({ ok: false, error: "El token es obligatorio" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const data = (await res.json()) as {
      ok: boolean;
      description?: string;
      result?: { username: string; first_name: string };
    };

    if (res.ok && data.ok) {
      return new Response(
        JSON.stringify({
          ok: true,
          first_name: data.result?.first_name || "",
          username: data.result?.username || "",
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    } else {
      return new Response(
        JSON.stringify({
          ok: false,
          error: data.description || "Token de bot inválido",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
