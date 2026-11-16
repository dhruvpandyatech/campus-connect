import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { FALLBACK_CATEGORY, isCategoryId, type CategoryId } from "./categories";
import { ATTACHMENT_BUCKET, STORAGE_PREFIX, attachmentLabel } from "./attachments";

export interface FeedNotice {
  id: string;
  title: string;
  content: string;
  category: CategoryId;
  attachmentHref: string | null;
  attachmentLabel: string | null;
  senderName: string;
  senderRole: string;
  createdAt: string;
  pinned: boolean;
}

/** Public, read-only list of notices for the student feed (pinned first, then newest). */
export const listNotices = createServerFn({ method: "GET" }).handler(async () => {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const supabase = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });

  const { data, error } = await supabase
    .from("notices")
    .select("notice_id, title, content, category, attachment_url, sender_name, sender_role, created_at, is_pinned")
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const storagePaths = rows
    .map((r) => r.attachment_url)
    .filter((u): u is string => !!u && u.startsWith(STORAGE_PREFIX))
    .map((u) => u.slice(STORAGE_PREFIX.length));

  const signed = new Map<string, string>();
  if (storagePaths.length > 0) {
    const { data: urls } = await supabase.storage
      .from(ATTACHMENT_BUCKET)
      .createSignedUrls(storagePaths, 60 * 60 * 24);
    for (const u of urls ?? []) {
      if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
    }
  }

  // Signed URLs come back on the server-side backend address; rewrite to the browser-facing one.
  const internalUrl = process.env["SUPABASE_URL"]!.replace(/\/+$/, "");
  const publicUrl = ((import.meta.env["VITE_SUPABASE_URL"] as string | undefined) ?? internalUrl).replace(/\/+$/, "");
  const toPublic = (u: string) => (u.startsWith(internalUrl) ? publicUrl + u.slice(internalUrl.length) : u);

  return rows.map<FeedNotice>((r) => {
    let href: string | null = null;
    if (r.attachment_url) {
      if (r.attachment_url.startsWith(STORAGE_PREFIX)) {
        const s = signed.get(r.attachment_url.slice(STORAGE_PREFIX.length));
        href = s ? toPublic(s) : null;
      } else {
        href = r.attachment_url;
      }
    }
    return {
      id: r.notice_id,
      title: r.title,
      content: r.content,
      category: isCategoryId(r.category) ? r.category : FALLBACK_CATEGORY,
      attachmentHref: href,
      attachmentLabel: href ? attachmentLabel(r.attachment_url!) : null,
      senderName: r.sender_name,
      senderRole: r.sender_role,
      createdAt: r.created_at,
      pinned: r.is_pinned,
    };
  });
});
