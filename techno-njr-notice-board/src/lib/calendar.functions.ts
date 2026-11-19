import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const EVENT_CATEGORIES = [
  "academic",
  "examination",
  "placement_training",
  "accounts_fees",
  "college_events",
  "holidays",
  "workshops_seminars",
  "other",
] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  category: EventCategory;
  targetAudience: string;
  visibility: string;
  startAt: string;
  endAt: string | null;
  allDay: boolean;
  location: string | null;
  attachmentUrl: string | null;
  isPinned: boolean;
  status: string;
  createdBy: string | null;
  createdAt: string;
}

function getToken(): string | null {
  const request = getRequest();
  const authHeader = request?.headers?.get("authorization");
  return authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
}

function anonClient(token?: string | null) {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const opts: Record<string, unknown> = {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  };
  if (token) {
    (opts as any).global = { headers: { Authorization: `Bearer ${token}` } };
  }
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, opts as any);
}

function serviceClient() {
  const key =
    process.env["SUPABASE_SERVICE_KEY"] ??
    process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function getAuthenticatedUserId(): Promise<string | null> {
  const token = getToken();
  if (!token) return null;
  const supabase = anonClient(token);
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) return null;
  return data.claims.sub as string;
}

async function requireFacultyOrAdmin(userId: string): Promise<void> {
  const supabase = serviceClient();
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  const role = (data as any)?.["role"];
  if (!data || (role !== "faculty" && role !== "admin")) {
    throw new Error("Not authorized: faculty or admin required");
  }
}

export const listCalendarEvents = createServerFn({ method: "GET" }).handler(
  async () => {
    const supabase = anonClient(getToken());
    const { data, error } = await supabase
      .from("calendar_events" as any)
      .select(
        "event_id,title,description,category,target_audience,visibility,start_at,end_at,all_day,location,attachment_url,is_pinned,status,created_by,created_at",
      )
      .order("start_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      id: r["event_id"],
      title: r["title"],
      description: r["description"],
      category: r["category"],
      targetAudience: r["target_audience"],
      visibility: r["visibility"],
      startAt: r["start_at"],
      endAt: r["end_at"],
      allDay: r["all_day"],
      location: r["location"],
      attachmentUrl: r["attachment_url"],
      isPinned: r["is_pinned"],
      status: r["status"],
      createdBy: r["created_by"],
      createdAt: r["created_at"],
    })) as CalendarEvent[];
  },
);

export const createCalendarEvent = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const d = raw as Record<string, unknown>;
    if (typeof d["title"] !== "string" || !String(d["title"]).trim())
      throw new Error("Title required");
    if (typeof d["startAt"] !== "string") throw new Error("startAt required");
    return {
      title: String(d["title"]).trim().slice(0, 200),
      description:
        typeof d["description"] === "string"
          ? String(d["description"]).trim().slice(0, 5000)
          : null,
      category: EVENT_CATEGORIES.includes(d["category"] as any)
        ? (d["category"] as EventCategory)
        : "other",
      targetAudience:
        typeof d["targetAudience"] === "string"
          ? String(d["targetAudience"])
          : "all",
      visibility:
        typeof d["visibility"] === "string"
          ? String(d["visibility"])
          : "campus",
      startAt: String(d["startAt"]),
      endAt: typeof d["endAt"] === "string" ? String(d["endAt"]) : null,
      allDay: Boolean(d["allDay"]),
      location:
        typeof d["location"] === "string"
          ? String(d["location"]).trim().slice(0, 200)
          : null,
      isPinned: Boolean(d["isPinned"]),
    };
  })
  .handler(async ({ data }) => {
    const userId = await getAuthenticatedUserId();
    if (!userId) throw new Error("Unauthorized: No authenticated user");
    await requireFacultyOrAdmin(userId);
    const supabase = serviceClient();
    const { error } = await supabase.from("calendar_events" as any).insert({
      title: data.title,
      description: data.description,
      category: data.category,
      target_audience: data.targetAudience,
      visibility: data.visibility,
      start_at: data.startAt,
      end_at: data.endAt,
      all_day: data.allDay,
      location: data.location,
      is_pinned: data.isPinned,
      created_by: userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateCalendarEvent = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const d = raw as Record<string, unknown>;
    if (typeof d["eventId"] !== "string") throw new Error("eventId required");
    return {
      eventId: String(d["eventId"]),
      title:
        typeof d["title"] === "string"
          ? String(d["title"]).trim().slice(0, 200)
          : undefined,
      description:
        typeof d["description"] === "string"
          ? String(d["description"]).trim().slice(0, 5000)
          : undefined,
      category: EVENT_CATEGORIES.includes(d["category"] as any)
        ? (d["category"] as EventCategory)
        : undefined,
      targetAudience:
        typeof d["targetAudience"] === "string"
          ? String(d["targetAudience"])
          : undefined,
      visibility:
        typeof d["visibility"] === "string"
          ? String(d["visibility"])
          : undefined,
      startAt:
        typeof d["startAt"] === "string" ? String(d["startAt"]) : undefined,
      endAt: typeof d["endAt"] === "string" ? String(d["endAt"]) : undefined,
      allDay:
        typeof d["allDay"] === "boolean" ? Boolean(d["allDay"]) : undefined,
      location:
        typeof d["location"] === "string"
          ? String(d["location"]).trim().slice(0, 200)
          : undefined,
      isPinned:
        typeof d["isPinned"] === "boolean" ? Boolean(d["isPinned"]) : undefined,
    };
  })
  .handler(async ({ data }) => {
    const userId = await getAuthenticatedUserId();
    if (!userId) throw new Error("Unauthorized: No authenticated user");
    await requireFacultyOrAdmin(userId);
    const supabase = serviceClient();
    const payload: Record<string, unknown> = {};
    if (data.title !== undefined) payload["title"] = data.title;
    if (data.description !== undefined)
      payload["description"] = data.description;
    if (data.category !== undefined) payload["category"] = data.category;
    if (data.targetAudience !== undefined)
      payload["target_audience"] = data.targetAudience;
    if (data.visibility !== undefined) payload["visibility"] = data.visibility;
    if (data.startAt !== undefined) payload["start_at"] = data.startAt;
    if (data.endAt !== undefined) payload["end_at"] = data.endAt;
    if (data.allDay !== undefined) payload["all_day"] = data.allDay;
    if (data.location !== undefined) payload["location"] = data.location;
    if (data.isPinned !== undefined) payload["is_pinned"] = data.isPinned;
    const { error } = await supabase
      .from("calendar_events" as any)
      .update(payload)
      .eq("event_id", data.eventId)
      .eq("created_by", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCalendarEvent = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const d = raw as Record<string, unknown>;
    if (typeof d["eventId"] !== "string") throw new Error("eventId required");
    return { eventId: String(d["eventId"]) };
  })
  .handler(async ({ data }) => {
    const userId = await getAuthenticatedUserId();
    if (!userId) throw new Error("Unauthorized: No authenticated user");
    await requireFacultyOrAdmin(userId);
    const supabase = serviceClient();
    const { error } = await supabase
      .from("calendar_events" as any)
      .update({ status: "cancelled" })
      .eq("event_id", data.eventId)
      .eq("created_by", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getGoogleConnection = createServerFn({ method: "GET" }).handler(
  async () => {
    const userId = await getAuthenticatedUserId();
    if (!userId) throw new Error("Unauthorized: No authenticated user");
    const { data, error } = await (serviceClient() as any)
      .from("google_calendar_connections")
      .select("google_account_email,status,connected_at,last_synced_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      connected: data ? data.status === "active" : false,
      email: data?.google_account_email ?? null,
      status: data?.status ?? null,
      connectedAt: data?.connected_at ?? null,
      lastSyncedAt: data?.last_synced_at ?? null,
    };
  },
);

export interface EventSyncMapping {
  eventId: string;
  syncStatus: string;
  googleEventId: string | null;
  retryCount: number;
  lastError: string | null;
}

export const getEventSyncMappings = createServerFn({ method: "GET" }).handler(
  async () => {
    const userId = await getAuthenticatedUserId();
    if (!userId) throw new Error("Unauthorized: No authenticated user");
    const { data, error } = await (serviceClient() as any)
      .from("google_calendar_event_mappings")
      .select("event_id,sync_status,google_event_id,retry_count,last_error")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      eventId: r["event_id"],
      syncStatus: r["sync_status"],
      googleEventId: r["google_event_id"],
      retryCount: r["retry_count"],
      lastError: r["last_error"],
    })) as EventSyncMapping[];
  },
);

export const processSyncQueueFn = createServerFn({ method: "POST" }).handler(
  async () => {
    const userId = await getAuthenticatedUserId();
    if (!userId) throw new Error("Unauthorized: No authenticated user");
    const { processSyncQueue } = await import("./google-sync");
    const result = await processSyncQueue();
    return result;
  },
);

export const toggleEventSync = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const d = raw as Record<string, unknown>;
    if (typeof d["eventId"] !== "string") throw new Error("eventId required");
    if (typeof d["enabled"] !== "boolean") throw new Error("enabled required");
    return { eventId: String(d["eventId"]), enabled: Boolean(d["enabled"]) };
  })
  .handler(async ({ data }) => {
    const userId = await getAuthenticatedUserId();
    if (!userId) throw new Error("Unauthorized: No authenticated user");
    const supabase = serviceClient();

    if (data.enabled) {
      const { data: existing, error: err1 } = await supabase
        .from("google_calendar_event_mappings")
        .select("id")
        .eq("event_id", data.eventId)
        .eq("user_id", userId)
        .maybeSingle();
      if (err1) throw new Error(err1.message);
      if (!existing) {
        const { data: inserted, error: err2 } = await supabase
          .from("google_calendar_event_mappings")
          .insert({
            event_id: data.eventId,
            user_id: userId,
            sync_status: "pending",
          })
          .select("id")
          .single();
        if (err2) throw new Error(err2.message);
        const { enqueueSync } = await import("./google-sync");
        await enqueueSync({ mappingId: inserted.id, operation: "create" });
      }
    } else {
      const { error } = await supabase
        .from("google_calendar_event_mappings")
        .delete()
        .eq("event_id", data.eventId)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const disconnectGoogleFn = createServerFn({ method: "POST" }).handler(
  async () => {
    const userId = await getAuthenticatedUserId();
    if (!userId) throw new Error("Unauthorized: No authenticated user");
    const { disconnectGoogle } = await import("./google-oauth");
    await disconnectGoogle(userId);
    return { ok: true };
  },
);

export interface CalendarBookmark {
  id: string;
  userId: string;
  eventId: string | null;
  importantDate: string | null;
  createdAt: string;
}

export const listBookmarks = createServerFn({ method: "GET" }).handler(
  async () => {
    const userId = await getAuthenticatedUserId();
    if (!userId) return [];
    const supabase = anonClient(getToken());
    const { data, error } = await supabase
      .from("calendar_bookmarks")
      .select("id,user_id,event_id,important_date,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      id: r["id"],
      userId: r["user_id"],
      eventId: r["event_id"],
      importantDate: r["important_date"],
      createdAt: r["created_at"],
    })) as CalendarBookmark[];
  },
);

export const createBookmark = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const d = raw as Record<string, unknown>;
    if (typeof d["eventId"] !== "string") throw new Error("eventId required");
    return { eventId: String(d["eventId"]) };
  })
  .handler(async ({ data }) => {
    const userId = await getAuthenticatedUserId();
    if (!userId) throw new Error("Unauthorized: No authenticated user");
    const supabase = serviceClient();
    const { error } = await supabase.from("calendar_bookmarks").insert({
      user_id: userId,
      event_id: data.eventId,
    });
    if (error) {
      if (error.code === "23505") {
        return { ok: true, alreadyExists: true };
      }
      throw new Error(error.message);
    }
    return { ok: true, alreadyExists: false };
  });

export const deleteBookmark = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const d = raw as Record<string, unknown>;
    if (typeof d["eventId"] !== "string") throw new Error("eventId required");
    return { eventId: String(d["eventId"]) };
  })
  .handler(async ({ data }) => {
    const userId = await getAuthenticatedUserId();
    if (!userId) throw new Error("Unauthorized: No authenticated user");
    const supabase = serviceClient();
    const { error } = await supabase
      .from("calendar_bookmarks")
      .delete()
      .eq("user_id", userId)
      .eq("event_id", data.eventId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export interface PersonalReminder {
  reminderId: string;
  userId: string;
  eventId: string | null;
  title: string;
  notes: string | null;
  remindAt: string;
  channel: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  eventTitle?: string;
  eventStartAt?: string | null;
}

const REMINDER_OFFSETS = [
  { label: "10 minutes before", minutes: 10 },
  { label: "30 minutes before", minutes: 30 },
  { label: "1 hour before", minutes: 60 },
  { label: "1 day before", minutes: 1440 },
] as const;

export function getReminderOffsetOptions() {
  return REMINDER_OFFSETS;
}

export function calculateRemindAt(
  eventStartAt: string,
  offsetMinutes: number,
): string {
  const eventStart = new Date(eventStartAt);
  return new Date(eventStart.getTime() - offsetMinutes * 60000).toISOString();
}

export const listReminders = createServerFn({ method: "GET" }).handler(
  async () => {
    const userId = await getAuthenticatedUserId();
    if (!userId) return [];
    const supabase = anonClient(getToken());
    const { data, error } = await supabase
      .from("personal_reminders")
      .select(
        "reminder_id,user_id,event_id,title,notes,remind_at,channel,status,created_at,updated_at",
      )
      .eq("user_id", userId)
      .order("remind_at", { ascending: true });
    if (error) throw new Error(error.message);
    const reminders = (data ?? []).map((r: any) => ({
      reminderId: r["reminder_id"],
      userId: r["user_id"],
      eventId: r["event_id"],
      title: r["title"],
      notes: r["notes"],
      remindAt: r["remind_at"],
      channel: r["channel"],
      status: r["status"],
      createdAt: r["created_at"],
      updatedAt: r["updated_at"],
    })) as PersonalReminder[];

    // Enrich with event info
    const eventIds = [
      ...new Set(reminders.map((r) => r.eventId).filter(Boolean) as string[]),
    ];
    if (eventIds.length > 0) {
      const { data: events } = await supabase
        .from("calendar_events")
        .select("event_id,title,start_at")
        .in("event_id", eventIds);
      const eventMap = new Map((events ?? []).map((e) => [e.event_id, e]));
      for (const reminder of reminders) {
        if (reminder.eventId) {
          const event = eventMap.get(reminder.eventId);
          if (event) {
            reminder.eventTitle = event.title;
            reminder.eventStartAt = event.start_at;
          }
        }
      }
    }
    return reminders;
  },
);

export const createReminder = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const d = raw as Record<string, unknown>;
    if (typeof d["title"] !== "string" || !String(d["title"]).trim())
      throw new Error("Title required");
    if (typeof d["remindAt"] !== "string") throw new Error("remindAt required");
    if (typeof d["eventId"] !== "string" && d["eventId"] !== null)
      throw new Error("eventId must be string or null");
    return {
      title: String(d["title"]).trim().slice(0, 200),
      notes:
        typeof d["notes"] === "string"
          ? String(d["notes"]).trim().slice(0, 5000)
          : null,
      remindAt: String(d["remindAt"]),
      eventId: d["eventId"] as string | null,
      channel: (d["channel"] === "email" ? "email" : "in_app") as
        "in_app" | "email",
    };
  })
  .handler(async ({ data }) => {
    const userId = await getAuthenticatedUserId();
    if (!userId) throw new Error("Unauthorized: No authenticated user");
    const supabase = serviceClient();

    // Validate event exists and user can access it
    if (data.eventId) {
      const { data: event, error: eventError } = await supabase
        .from("calendar_events")
        .select("event_id,start_at,visibility")
        .eq("event_id", data.eventId)
        .maybeSingle();
      if (eventError) throw new Error(eventError.message);
      if (!event) throw new Error("Event not found");
      // Check if user can access this event (same logic as RLS)
      const { data: profile } = await supabase
        .from("profiles")
        .select("role,student_year")
        .eq("id", userId)
        .maybeSingle();
      const role = profile?.role;
      const studentYear = profile?.student_year;
      const canAccess =
        role === "faculty" ||
        role === "admin" ||
        event.visibility === "public" ||
        (event.visibility === "campus" &&
          (role === "faculty" ||
            role === "admin" ||
            (studentYear && String(studentYear) === event.target_audience)));
      if (!canAccess)
        throw new Error("Not authorized to set reminder for this event");

      // Validate remindAt is before event start
      if (new Date(data.remindAt) >= new Date(event.start_at)) {
        throw new Error("Reminder must be before event start time");
      }
    }

    const { error } = await supabase.from("personal_reminders").insert({
      user_id: userId,
      event_id: data.eventId,
      title: data.title,
      notes: data.notes,
      remind_at: data.remindAt,
      channel: data.channel,
      status: "pending",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateReminder = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const d = raw as Record<string, unknown>;
    if (typeof d["reminderId"] !== "string")
      throw new Error("reminderId required");
    return {
      reminderId: String(d["reminderId"]),
      title:
        typeof d["title"] === "string"
          ? String(d["title"]).trim().slice(0, 200)
          : undefined,
      notes:
        typeof d["notes"] === "string"
          ? String(d["notes"]).trim().slice(0, 5000)
          : undefined,
      remindAt:
        typeof d["remindAt"] === "string" ? String(d["remindAt"]) : undefined,
      channel:
        d["channel"] === "email"
          ? "email"
          : d["channel"] === "in_app"
            ? "in_app"
            : undefined,
      status: ["pending", "sent", "cancelled"].includes(d["status"] as string)
        ? (d["status"] as "pending" | "sent" | "cancelled")
        : undefined,
    };
  })
  .handler(async ({ data }) => {
    const userId = await getAuthenticatedUserId();
    if (!userId) throw new Error("Unauthorized: No authenticated user");
    const supabase = serviceClient();

    const payload: Record<string, unknown> = {};
    if (data.title !== undefined) payload["title"] = data.title;
    if (data.notes !== undefined) payload["notes"] = data.notes;
    if (data.remindAt !== undefined) payload["remind_at"] = data.remindAt;
    if (data.channel !== undefined) payload["channel"] = data.channel;
    if (data.status !== undefined) payload["status"] = data.status;

    // If remindAt is being updated and eventId exists, validate
    if (data.remindAt !== undefined) {
      const { data: reminder } = await supabase
        .from("personal_reminders")
        .select("event_id")
        .eq("reminder_id", data.reminderId)
        .eq("user_id", userId)
        .maybeSingle();
      if (reminder?.event_id) {
        const { data: event } = await supabase
          .from("calendar_events")
          .select("start_at")
          .eq("event_id", reminder.event_id)
          .maybeSingle();
        if (event && new Date(data.remindAt) >= new Date(event.start_at)) {
          throw new Error("Reminder must be before event start time");
        }
      }
    }

    const { error } = await supabase
      .from("personal_reminders")
      .update(payload)
      .eq("reminder_id", data.reminderId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteReminder = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const d = raw as Record<string, unknown>;
    if (typeof d["reminderId"] !== "string")
      throw new Error("reminderId required");
    return { reminderId: String(d["reminderId"]) };
  })
  .handler(async ({ data }) => {
    const userId = await getAuthenticatedUserId();
    if (!userId) throw new Error("Unauthorized: No authenticated user");
    const supabase = serviceClient();
    const { error } = await supabase
      .from("personal_reminders")
      .delete()
      .eq("reminder_id", data.reminderId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
