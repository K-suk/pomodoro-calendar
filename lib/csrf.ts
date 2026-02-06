import { createHmac, randomUUID } from "crypto";

const CSRF_SECRET = process.env.CSRF_SECRET;

if (!CSRF_SECRET) {
  throw new Error("CSRF_SECRET environment variable is missing");
}

async function signWithHmac(payload: string): Promise<string> {
  const hmac = createHmac("sha256", CSRF_SECRET!);
  hmac.update(payload);
  return hmac.digest("hex");
}

export async function generateCsrfToken(userId: string): Promise<string> {
  const timestamp = Date.now();
  const nonce = randomUUID();
  const payload = `${userId}:${timestamp}:${nonce}`;
  const signature = await signWithHmac(payload);
  return `${Buffer.from(payload).toString("base64")}.${signature}`;
}

export async function validateCsrfToken(token: string, userId: string): Promise<boolean> {
  if (!token) return false;
  
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  
  const [payloadBase64, signature] = parts;
  const payload = Buffer.from(payloadBase64, "base64").toString();
  const [tokenUserId, timestampStr] = payload.split(":");

  // Verify signature
  const expectedSignature = await signWithHmac(payload);
  if (signature !== expectedSignature) return false;

  // Verify timestamp (1 hour expiration)
  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp) || Date.now() - timestamp > 3600000) return false;

  // Verify user match
  if (tokenUserId !== userId) return false;

  return true;
}
