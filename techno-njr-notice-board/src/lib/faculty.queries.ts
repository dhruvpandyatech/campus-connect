import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ATTACHMENT_BUCKET, STORAGE_PREFIX, attachmentLabel } from "./attachments";
import { FALLBACK_CATEGORY, isCategoryId } from "./categories";
import type { NoticeCardData } from "@/components/campus/NoticeCard";

export interface FacultyProfile {
  id: string;
  full_name: string;
  designation: string;
}

export const profileQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: ["profile", userId],
    queryFn: async (): Promise<FacultyProfile> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, designation")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return data ?? { id: userId, full_name: "", designation: "Faculty" };
    },
  });

export interface MyNotice extends NoticeCardData {
  id: string;
  rawAttachment: string | null;
}

export const myNoticesQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: ["my-notices", userId],
    queryFn: async (): Promise<MyNotice[]> => {
      const { data, error } = await supabase
        .from("notices")
        .select("notice_id, title, content, category, attachment_url, sender_name, sender_role, created_at, is_pinned")
        .eq("created_by", userId)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = data ?? [];

      const paths = rows
        .map((r) => r.attachment_url)
        .filter((u): u is string => !!u && u.startsWith(STORAGE_PREFIX))
        .map((u) => u.slice(STORAGE_PREFIX.length));
      const signed = new Map<string, string>();
      if (paths.length) {
        const { data: urls } = await supabase.storage.from(ATTACHMENT_BUCKET).createSignedUrls(paths, 3600);
        for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
      }

      return rows.map((r) => {
        const raw = r.attachment_url;
        const href = raw
          ? raw.startsWith(STORAGE_PREFIX)
            ? (signed.get(raw.slice(STORAGE_PREFIX.length)) ?? null)
            : raw
          : null;
        return {
          id: r.notice_id,
          title: r.title,
          content: r.content,
          category: isCategoryId(r.category) ? r.category : FALLBACK_CATEGORY,
          attachmentHref: href,
          attachmentLabel: raw ? attachmentLabel(raw) : null,
          rawAttachment: raw,
          senderName: r.sender_name,
          senderRole: r.sender_role,
          createdAt: r.created_at,
          pinned: r.is_pinned,
        };
      });
    },
  });
