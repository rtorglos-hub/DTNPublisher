export const onRequestPost: PagesFunction = async () => {
  return new Response(
    JSON.stringify({ status: "ok" }),
    {
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": "session_token=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
      },
    }
  );
};
