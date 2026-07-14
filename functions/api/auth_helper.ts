export interface AuthEnv {
  AUTH_EMAIL?: string;
  AUTH_PASSWORD?: string;
}

export async function generateSignature(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function timingSafeEqualString(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [aHash, bHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);

  const aBytes = new Uint8Array(aHash);
  const bBytes = new Uint8Array(bHash);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < Math.max(aBytes.length, bBytes.length); i++) {
    diff |= (aBytes[i] || 0) ^ (bBytes[i] || 0);
  }
  return diff === 0;
}

export async function verifyToken(token: string, secret: string, expectedEmail: string): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(":");
  if (parts.length !== 3) return false;

  const [emailBase64, expiresStr, signature] = parts;

  try {
    const email = atob(emailBase64);
    if (email !== expectedEmail) return false;

    const expires = parseInt(expiresStr, 10);
    if (isNaN(expires) || expires < Date.now()) return false;

    const message = `${emailBase64}:${expiresStr}`;
    const expectedSignature = await generateSignature(message, secret);
    return timingSafeEqualString(signature, expectedSignature);
  } catch (e) {
    return false;
  }
}

export function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  cookieHeader.split(";").forEach((cookie) => {
    const parts = cookie.split("=");
    if (parts.length >= 2) {
      const name = parts[0].trim();
      const value = parts.slice(1).join("=").trim();
      cookies[name] = decodeURIComponent(value);
    }
  });
  return cookies;
}
