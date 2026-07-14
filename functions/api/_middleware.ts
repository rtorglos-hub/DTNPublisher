import { AuthEnv, verifyToken, parseCookies } from "./auth_helper";

export const onRequest: PagesFunction<AuthEnv> = async (context) => {
  const url = new URL(context.request.url);
  const path = url.pathname;

  // Evitar interceptar el login, logout y las peticiones OPTIONS
  if (path === "/api/login" || path === "/api/logout" || context.request.method === "OPTIONS") {
    return await context.next();
  }

  const emailVal = context.env.AUTH_EMAIL;
  const passwordVal = context.env.AUTH_PASSWORD;

  // Si las variables no están configuradas, bloquear el backend con un error 500
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

  // Intentar leer la cookie session_token
  const cookieHeader = context.request.headers.get("Cookie") || "";
  const cookies = parseCookies(cookieHeader);
  const token = cookies["session_token"];

  // Validar el token
  if (token) {
    const isValid = await verifyToken(token, passwordVal, emailVal);
    if (isValid) {
      return await context.next();
    }
  }

  // Si no es válido, devolver 401
  return new Response(
    JSON.stringify({ error: "No autorizado. Sesión inválida o expirada." }),
    {
      status: 401,
      headers: { "Content-Type": "application/json" },
    }
  );
};
