import { createServerOnlyFn } from "@tanstack/react-start";
import { redirect } from "@tanstack/react-router";
import {
  consumeOAuthState,
  exchangeCodeForTokens,
  storeGoogleConnection,
  getGoogleUserInfo,
} from "@/lib/google-oauth";

function getQueryParam(url: URL, name: string): string | null {
  return url.searchParams.get(name);
}

export const handleOAuthCallback = createServerOnlyFn(async () => {
  const { getRequest } = await import("@tanstack/react-start/server");
  const request = getRequest();
  const url = new URL(request.url);

  const code = getQueryParam(url, "code");
  const state = getQueryParam(url, "state");
  const error = getQueryParam(url, "error");
  const errorDescription = getQueryParam(url, "error_description");

  // User denied access
  if (error) {
    throw redirect({
      to: "/calendar",
      search: { google_error: errorDescription || error },
    });
  }

  if (!code || !state) {
    throw redirect({
      to: "/calendar",
      search: { google_error: "missing_code_or_state" },
    });
  }

  // Validate CSRF state
  const payload = consumeOAuthState(state);
  if (!payload) {
    throw redirect({
      to: "/calendar",
      search: { google_error: "invalid_or_expired_state" },
    });
  }

  const userId = payload.userId;
  const redirectUri =
    process.env["GOOGLE_REDIRECT_URI"] ||
    `${process.env["VITE_SUPABASE_URL"]?.replace(/\/+$/, "")}/api/google/oauth/callback`;

  // Exchange code for tokens
  const tokens = await exchangeCodeForTokens(code, redirectUri);

  // Get Google account email
  const { email } = await getGoogleUserInfo(tokens.access_token);

  // Store encrypted tokens
  const connectionData: {
    userId: string;
    email: string;
    accessToken: string;
    refreshToken?: string;
    expiresIn: number;
    scope: string;
  } = {
    userId,
    email,
    accessToken: tokens.access_token,
    expiresIn: tokens.expires_in,
    scope: tokens.scope,
  };
  if (tokens.refresh_token) {
    connectionData.refreshToken = tokens.refresh_token;
  }
  await storeGoogleConnection(connectionData);

  throw redirect({
    to: "/calendar",
    search: { google_connected: email },
  });
});
