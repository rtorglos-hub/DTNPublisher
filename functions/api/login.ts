import { AuthEnv, generateSignature } from "./auth_helper";

export const onRequestPost: PagesFunction<AuthEnv> = async (context) => {
  const emailVal = context.env.AUTH_EMAIL;
  const passwordVal = context.env.AUTH_PASSWORD;

  if (!emailVal || !passwordVal) {
    return new Response(
      JSON.stringify({
        error: "Las variables de entorno de autenticación (AUTH_EMAIL, AUTH_PASSWORD) no están configuradas en el servidor.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    const { email, password } = (await context.request.json()) as { email?: string; password?: string };

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Faltan las credenciales de email o contraseña." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (email !== emailVal || password !== passwordVal) {
      return new Response(
        JSON.stringify({ error: "Email o contraseña incorrectos." }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // 7 días de validez
    const expires = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const emailBase64 = btoa(email);
    const message = `${emailBase64}:${expires}`;
    const signature = await generateSignature(message, passwordVal);
    const token = `${emailBase64}:${expires}:${signature}`;

    return new Response(
      JSON.stringify({ status: "ok", token }),
      {
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": `session_token=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}`,
        },
      }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
