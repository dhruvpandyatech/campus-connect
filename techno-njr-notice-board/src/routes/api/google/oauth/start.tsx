import { createFileRoute, redirect } from "@tanstack/react-router";
import { buildOAuthStartResponse } from "./-start.server";

export const Route = createFileRoute("/api/google/oauth/start")({
  loader: async () => {
    const response = await buildOAuthStartResponse();
    const location = response.headers.get("Location");
    if (location === "/auth") {
      throw redirect({ to: "/auth" });
    }
    // External redirect to Google OAuth
    throw new Response(null, {
      status: 302,
      headers: { Location: location ?? "/" },
    });
  },
  component: () => null,
});
