import { createFileRoute } from "@tanstack/react-router";
import { handleOAuthCallback } from "./-callback.server";

export const Route = createFileRoute("/api/google/oauth/callback")({
  loader: async () => {
    await handleOAuthCallback();
  },
  component: () => null,
});
