export const COOKIE_NAME = "auth";

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const buffer = new ArrayBuffer(hex.length / 2);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

async function getHmacKey(): Promise<CryptoKey> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function createSignedCookie(value: string): Promise<string> {
  const key = await getHmacKey();
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value)
  );
  return `${value}.${toHex(sig)}`;
}

export async function verifySignedCookie(cookie: string): Promise<boolean> {
  try {
    const lastDot = cookie.lastIndexOf(".");
    if (lastDot === -1) return false;
    const value = cookie.substring(0, lastDot);
    const sigHex = cookie.substring(lastDot + 1);
    const key = await getHmacKey();
    return crypto.subtle.verify(
      "HMAC",
      key,
      fromHex(sigHex),
      new TextEncoder().encode(value)
    );
  } catch {
    return false;
  }
}
