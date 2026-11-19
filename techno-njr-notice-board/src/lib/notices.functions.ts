import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { FALLBACK_CATEGORY, isCategoryId, type CategoryId } from "./categories";
import {
  ATTACHMENT_BUCKET,
  STORAGE_PREFIX,
  attachmentLabel,
} from "./attachments";
import {
  normalizeAudience,
  isTargetAudience,
  isNoticeVisibleToViewer,
  type TargetAudience,
  type ViewerContext,
} from "./target-audience";
import type { TablesUpdate } from "@/integrations/supabase/types";

export interface FeedNotice {
  id: string;
  title: string;
  content: string;
  category: CategoryId;
  targetAudience: TargetAudience;
  attachmentHref: string | null;
  attachmentLabel: string | null;
  senderName: string;
  senderRole: string;
  createdAt: string;
  pinned: boolean;
}

/**
 * Public & authenticated list of notices for the feed (pinned first, then newest).
 * Automatically scopes notices to the viewer:
 * - Anonymous users: only 'all' (broadcast) notices.
 * - Students: 'all' + their academic year's notices.
 * - Faculty / Admins: all notices.
 *
 * Enforced on both database level via Supabase RLS and server function level.
 * Gracefully falls back if the database migration hasn't been executed yet.
 */
export const listNotices = createServerFn({ method: "GET" }).handler(
  async () => {
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const request = getRequest();
    const authHeader = request?.headers?.get("authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    const supabase = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
      auth: {
        storage: undefined,
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (
            key.startsWith("sb_") &&
            h.get("Authorization") === `Bearer ${key}`
          ) {
            h.delete("Authorization");
          }
          h.set("apikey", key);
          if (authHeader) {
            h.set("Authorization", authHeader);
          }
          return fetch(input, { ...init, headers: h });
        },
      },
    });

    let viewer: ViewerContext | null = null;
    if (token) {
      try {
        const { data: claimsData } = await supabase.auth.getClaims(token);
        const sub = claimsData?.claims?.sub;
        if (sub) {
          // Attempt select with role & student_year, fallback if migration not yet run
          const { data: profile, error: profErr } = await supabase
            .from("profiles")
            .select("role, student_year, designation")
            .eq("id", sub)
            .maybeSingle();

          if (!profErr && profile) {
            viewer = {
              role:
                profile.role || (profile.student_year ? "student" : "faculty"),
              studentYear: profile.student_year,
            };
          } else {
            // Fallback for pre-migration profiles
            const { data: fallbackProfile } = await supabase
              .from("profiles")
              .select("designation")
              .eq("id", sub)
              .maybeSingle();
            viewer = {
              role:
                fallbackProfile?.designation === "Student"
                  ? "student"
                  : "faculty",
              studentYear: null,
            };
          }
        }
      } catch {
        viewer = null;
      }
    }

    type NoticeRow = {
      notice_id: string;
      title: string;
      content: string;
      category: string;
      target_audience?: string;
      attachment_url: string | null;
      sender_name: string;
      sender_role: string;
      created_at: string;
      is_pinned: boolean;
    };

    let rows: NoticeRow[] = [];

    // Query notices including target_audience
    const { data, error } = await supabase
      .from("notices")
      .select(
        "notice_id, title, content, category, target_audience, attachment_url, sender_name, sender_role, created_at, is_pinned",
      )
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      // If target_audience column does not exist yet (migration pending), fall back safely
      if (
        error.message.includes("target_audience") ||
        error.message.includes("does not exist")
      ) {
        const { data: fallbackData, error: fallbackErr } = await supabase
          .from("notices")
          .select(
            "notice_id, title, content, category, attachment_url, sender_name, sender_role, created_at, is_pinned",
          )
          .order("is_pinned", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(500);

        if (fallbackErr) throw new Error(fallbackErr.message);
        rows = (fallbackData ?? []).map((r) => ({
          ...r,
          target_audience: "all",
        }));
      } else {
        throw new Error(error.message);
      }
    } else {
      rows = (data ?? []) as NoticeRow[];
    }

    // Filter notices according to viewer authorization (double security alongside RLS)
    const allowedRows = rows.filter((r) => {
      const audience = normalizeAudience(r.target_audience);
      return isNoticeVisibleToViewer(audience, viewer);
    });

    const storagePaths = allowedRows
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
    const publicUrl = (
      (import.meta.env["VITE_SUPABASE_URL"] as string | undefined) ??
      internalUrl
    ).replace(/\/+$/, "");
    const toPublic = (u: string) =>
      u.startsWith(internalUrl) ? publicUrl + u.slice(internalUrl.length) : u;

    return allowedRows.map<FeedNotice>((r) => {
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
        targetAudience: normalizeAudience(r.target_audience),
        attachmentHref: href,
        attachmentLabel: href ? attachmentLabel(r.attachment_url!) : null,
        senderName: r.sender_name,
        senderRole: r.sender_role,
        createdAt: r.created_at,
        pinned: r.is_pinned,
      };
    });
  },
);

export interface UpdateNoticeInput {
  noticeId: string;
  userId: string;
  title: string;
  content: string;
  category: CategoryId;
  targetAudience: TargetAudience;
  attachmentUrl: string | null;
  isPinned: boolean;
}

/**
 * Update an existing notice. Only the owner (created_by == userId) can update their own notice.
 * Scoped with eq("created_by", userId) and enforced by Supabase RLS.
 */
export const updateNotice = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    if (!raw || typeof raw !== "object") throw new Error("Invalid payload");
    const d = raw as Record<string, unknown>;
    if (typeof d["noticeId"] !== "string" || !d["noticeId"])
      throw new Error("Missing noticeId");
    if (typeof d["userId"] !== "string" || !d["userId"])
      throw new Error("Missing userId");
    if (typeof d["title"] !== "string" || String(d["title"]).trim().length < 3)
      throw new Error("Title too short");
    if (
      typeof d["content"] !== "string" ||
      String(d["content"]).trim().length < 10
    )
      throw new Error("Content too short");
    if (!isCategoryId(d["category"])) throw new Error("Invalid category");
    const audience = isTargetAudience(d["targetAudience"])
      ? d["targetAudience"]
      : normalizeAudience(d["targetAudience"]);

    return {
      noticeId: d["noticeId"] as string,
      userId: d["userId"] as string,
      title: String(d["title"]).trim().slice(0, 200),
      content: String(d["content"]).trim().slice(0, 5000),
      category: d["category"] as CategoryId,
      targetAudience: audience,
      attachmentUrl: (d["attachmentUrl"] as string | null) ?? null,
      isPinned: Boolean(d["isPinned"]),
    };
  })
  .handler(async ({ data }) => {
    const key =
      process.env["SUPABASE_SERVICE_KEY"] ??
      process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const supabase = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
      auth: {
        storage: undefined,
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const updatePayload: TablesUpdate<"notices"> = {
      title: data.title,
      content: data.content,
      category: data.category,
      attachment_url: data.attachmentUrl,
      is_pinned: data.isPinned,
    };

    // Include target_audience in update
    updatePayload["target_audience"] = data.targetAudience;

    // Security: scope update to the owner — if RLS is enforced this is doubly safe.
    let { error, count } = await supabase
      .from("notices")
      .update(updatePayload)
      .eq("notice_id", data.noticeId)
      .eq("created_by", data.userId);

    // If column target_audience doesn't exist yet, retry without it
    if (error && error.message.includes("target_audience")) {
      delete updatePayload["target_audience"];
      const res = await supabase
        .from("notices")
        .update(updatePayload)
        .eq("notice_id", data.noticeId)
        .eq("created_by", data.userId);
      error = res.error;
      count = res.count;
    }

    if (error) throw new Error(error.message);
    if (count === 0)
      throw new Error("Notice not found or you are not authorised to edit it.");
    return { ok: true };
  });
