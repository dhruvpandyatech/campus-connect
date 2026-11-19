// Server-only Google OAuth 2.0 helpers.
// Never import from client components.
// Scopes: minimum required to create/update/delete Google Calendar events owned by this app.

import {
  encryptToken,
  decryptToken,
  isConfigured,
  type EncryptedToken,
} from "./crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

// Minimum scope: manage only events created by this application (one-way sync).
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
].join(" ");

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_CLOCK_SKEW_MS = 60 * 1000; // 1 minute

// In-memory OAuth state store (MVP). For multi-instance deploys, replace with Redis/DB.
const oauthStateStore = new Map<
  string,
  { userId: string; createdAt: number }
>();

function nowMs(): number {
  return Date.now();
}

function generateState(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function createOAuthState(userId: string): string {
  const state = generateState();
  oauthStateStore.set(state, { userId, createdAt: nowMs() });
  return state;
}

export function consumeOAuthState(state: string): { userId: string } | null {
  const entry = oauthStateStore.get(state);
  if (!entry) return null;
  if (nowMs() - entry.createdAt > STATE_TTL_MS) {
    oauthStateStore.delete(state);
    return null;
  }
  oauthStateStore.delete(state);
  return { userId: entry.userId };
}

// Cleanup stale states periodically (best effort).
setInterval(() => {
  const cutoff = nowMs() - STATE_TTL_MS;
  for (const [state, entry] of oauthStateStore.entries()) {
    if (entry.createdAt < cutoff) oauthStateStore.delete(state);
  }
}, STATE_TTL_MS);

export function buildGoogleAuthUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: process.env["GOOGLE_CLIENT_ID"]!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
  error?: string;
  error_description?: string;
}

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    code,
    client_id: process.env["GOOGLE_CLIENT_ID"]!,
    client_secret: process.env["GOOGLE_CLIENT_SECRET"]!,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data: GoogleTokenResponse = await res.json();
  if (!res.ok || data.error) {
    throw new Error(
      data.error_description || data.error || "Token exchange failed",
    );
  }
  return data;
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    client_id: process.env["GOOGLE_CLIENT_ID"]!,
    client_secret: process.env["GOOGLE_CLIENT_SECRET"]!,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data: GoogleTokenResponse = await res.json();
  if (!res.ok || data.error) {
    throw new Error(
      data.error_description || data.error || "Token refresh failed",
    );
  }
  return data;
}

export async function getGoogleUserInfo(
  accessToken: string,
): Promise<{ email: string }> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Failed to fetch Google user info");
  return res.json();
}

export async function storeGoogleConnection({
  userId,
  email,
  accessToken,
  refreshToken,
  expiresIn,
  scope,
}: {
  userId: string;
  email: string;
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  scope: string;
}) {
  if (!isConfigured())
    throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY not configured");

  const [accessEnc, refreshEnc] = await Promise.all([
    encryptToken(accessToken),
    refreshToken ? encryptToken(refreshToken) : null,
  ]);

  const tokenExpiry = new Date(
    nowMs() + expiresIn * 1000 - MAX_CLOCK_SKEW_MS,
  ).toISOString();

  const { error } = await (supabaseAdmin as any)
    .from("google_calendar_connections")
    .upsert({
      user_id: userId,
      google_account_email: email,
      access_token_enc: JSON.stringify(accessEnc),
      refresh_token_enc: refreshEnc ? JSON.stringify(refreshEnc) : null,
      token_expiry: tokenExpiry,
      scope,
      status: "active",
      updated_at: new Date().toISOString(),
    });

  if (error) throw new Error(error.message);
}

export async function getConnection(userId: string) {
  const { data, error } = await (supabaseAdmin as any)
    .from("google_calendar_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function disconnectGoogle(userId: string) {
  const { error } = await (supabaseAdmin as any)
    .from("google_calendar_connections")
    .update({ status: "revoked", updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function getValidAccessToken(userId: string): Promise<string> {
  const connection = await getConnection(userId);
  if (!connection || connection.status !== "active") {
    throw new Error("No active Google Calendar connection");
  }

  const now = nowMs();
  const expiryMs = connection.token_expiry
    ? new Date(connection.token_expiry).getTime()
    : 0;

  // If token is still valid (with 1-minute skew), return it.
  if (expiryMs > now + MAX_CLOCK_SKEW_MS && connection.access_token_enc) {
    const enc: EncryptedToken = JSON.parse(
      connection.access_token_enc as string,
    );
    return await decryptToken(enc);
  }

  // Otherwise refresh.
  if (!connection.refresh_token_enc) {
    throw new Error("No refresh token available; reconnect required");
  }

  const refreshEnc: EncryptedToken = JSON.parse(
    connection.refresh_token_enc as string,
  );
  const refreshToken = await decryptToken(refreshEnc);

  const refreshed = await refreshAccessToken(refreshToken);

  const newAccessEnc = await encryptToken(refreshed.access_token);
  const newRefreshEnc: string | null = refreshed.refresh_token
    ? JSON.stringify(await encryptToken(refreshed.refresh_token))
    : (connection.refresh_token_enc as string);

  const tokenExpiry = new Date(
    now + refreshed.expires_in * 1000 - MAX_CLOCK_SKEW_MS,
  ).toISOString();

  const { error } = await (supabaseAdmin as any)
    .from("google_calendar_connections")
    .update({
      access_token_enc: JSON.stringify(newAccessEnc),
      refresh_token_enc: newRefreshEnc,
      token_expiry: tokenExpiry,
      scope: refreshed.scope ?? (connection.scope as string),
      status: "active",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error) throw new Error(error.message);

  return refreshed.access_token;
}
