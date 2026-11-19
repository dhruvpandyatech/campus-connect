// Server-only encryption utilities for Google OAuth tokens.
// AES-256-GCM. Never import from client components.
// GOOGLE_TOKEN_ENCRYPTION_KEY must be set server-side (not VITE_ prefixed).

const ALGORITHM = "AES-GCM";
const IV_LEN = 12; // 96 bits
const TAG_LEN = 16; // 128 bits

async function getKeyMaterial(): Promise<ArrayBuffer> {
  const raw = process.env["GOOGLE_TOKEN_ENCRYPTION_KEY"];
  if (!raw) throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY is not configured");
  const keyBytes = new TextEncoder().encode(raw);
  return crypto.subtle.digest("SHA-256", keyBytes);
}

let _key: CryptoKey | null = null;

async function key(): Promise<CryptoKey> {
  if (!_key) {
    const material = await getKeyMaterial();
    _key = await crypto.subtle.importKey(
      "raw",
      material,
      { name: ALGORITHM },
      false,
      ["encrypt", "decrypt"],
    );
  }
  return _key;
}

function toArrayBuffer(bytes: Uint8Array<any>): ArrayBuffer {
  const ab = new ArrayBuffer(bytes.byteLength);
  const view = new Uint8Array(ab);
  view.set(bytes);
  return ab;
}

function base64UrlEncode(data: ArrayBuffer): string {
  const bytes = new Uint8Array(data);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    const byte = bytes[i];
    if (byte === undefined) continue;
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(input: string): Uint8Array {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export interface EncryptedToken {
  iv: string;
  ciphertext: string;
  tag: string;
}

export async function encryptToken(plaintext: string): Promise<EncryptedToken> {
  const k = await key();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const encoded = new TextEncoder().encode(plaintext);
  const result = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    k,
    encoded,
  );
  const combined = new Uint8Array(result as ArrayBuffer);
  const ciphertext = combined.slice(0, combined.length - TAG_LEN);
  const tag = combined.slice(combined.length - TAG_LEN);
  return {
    iv: base64UrlEncode(toArrayBuffer(iv)),
    ciphertext: base64UrlEncode(toArrayBuffer(ciphertext)),
    tag: base64UrlEncode(toArrayBuffer(tag)),
  };
}

export async function decryptToken(encrypted: EncryptedToken): Promise<string> {
  const k = await key();
  const iv = base64UrlDecode(encrypted.iv);
  const ciphertext = base64UrlDecode(encrypted.ciphertext);
  const tag = base64UrlDecode(encrypted.tag);
  const combined = new Uint8Array(ciphertext.length + tag.length);
  combined.set(ciphertext);
  combined.set(tag, ciphertext.length);
  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: toArrayBuffer(iv) },
    k,
    toArrayBuffer(combined),
  );
  return new TextDecoder().decode(decrypted as ArrayBuffer);
}

export function isConfigured(): boolean {
  return Boolean(process.env["GOOGLE_TOKEN_ENCRYPTION_KEY"]);
}
