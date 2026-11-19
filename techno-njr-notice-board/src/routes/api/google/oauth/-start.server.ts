import { createServerOnlyFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { createOAuthState, buildGoogleAuthUrl } from "@/lib/google-oauth";

const getAuthUserId = createServerOnlyFn(async (): Promise<string | null> => {
  const request = getRequest();
  const authHeader = request?.headers?.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;

  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const supabase = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) return null;
  return data.claims.sub as string;
});

export const buildOAuthStartResponse = createServerOnlyFn(
  async (): Promise<Response> => {
    const userId = await getAuthUserId();
    if (!userId) {
      throw new Response(null, { status: 302, headers: { Location: "/auth" } });
    }

    const redirectUri =
      process.env["GOOGLE_REDIRECT_URI"] ||
      `${process.env["VITE_SUPABASE_URL"]?.replace(/\/+$/, "")}/api/google/oauth/callback`;

    const state = createOAuthState(userId);
    const authUrl = buildGoogleAuthUrl(state, redirectUri);

    const headers = new Headers();
    headers.set("Location", authUrl);
    return new Response(null, { status: 302, headers });
  },
);
