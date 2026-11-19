// Server-only Google Calendar synchronization.
// One-way: Campus Connect -> Google Calendar only.
// Never imports Google Calendar events into Campus Connect.

import { getValidAccessToken, getConnection } from "@/lib/google-oauth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const MAX_RETRIES = 5;

interface GoogleEventStartEnd {
  dateTime?: string;
  date?: string;
  timeZone?: string;
}

interface GoogleEventPayload {
  summary: string;
  description?: string;
  location?: string;
  start: GoogleEventStartEnd;
  end: GoogleEventStartEnd;
}

function toGoogleEvent(event: {
  title: string;
  description: string | null;
  location: string | null;
  startAt: string;
  endAt: string | null;
  allDay: boolean;
}): GoogleEventPayload {
  const allDay = event.allDay;
  const start: GoogleEventStartEnd = allDay
    ? {
        date: new Date(event.startAt).toISOString().slice(0, 10),
        timeZone: "Asia/Kolkata",
      }
    : { dateTime: event.startAt, timeZone: "Asia/Kolkata" };

  let endDate: string;
  if (allDay) {
    endDate = event.endAt
      ? new Date(event.endAt).toISOString().slice(0, 10)
      : new Date(new Date(event.startAt).getTime() + 86400000)
          .toISOString()
          .slice(0, 10);
  } else {
    endDate =
      event.endAt ??
      new Date(new Date(event.startAt).getTime() + 3600000).toISOString();
  }

  return {
    summary: event.title,
    ...(event.description ? { description: event.description } : {}),
    ...(event.location ? { location: event.location } : {}),
    start,
    end: allDay
      ? { date: endDate, timeZone: "Asia/Kolkata" }
      : { dateTime: endDate, timeZone: "Asia/Kolkata" },
  };
}

async function googleApiRequest(
  accessToken: string,
  method: string,
  path: string,
  body?: string | null,
): Promise<Response> {
  const res = await fetch(`${GOOGLE_CALENDAR_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : null,
  });
  return res;
}

async function handleGoogleResponse(res: Response): Promise<any> {
  if (res.status === 401) throw new Error("Google token expired or revoked");
  if (res.status === 403) throw new Error("Google Calendar access forbidden");
  if (res.status === 429) throw new Error("Google API rate limit exceeded");
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google API error: ${res.status} ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export async function createGoogleEvent(
  accessToken: string,
  event: {
    title: string;
    description: string | null;
    location: string | null;
    startAt: string;
    endAt: string | null;
    allDay: boolean;
  },
  calendarId: string = "primary",
): Promise<string> {
  const res = await googleApiRequest(
    accessToken,
    "POST",
    `/calendars/${encodeURIComponent(calendarId)}/events`,
    JSON.stringify(toGoogleEvent(event)),
  );
  const data = await handleGoogleResponse(res);
  return data.id as string;
}

export async function updateGoogleEvent(
  accessToken: string,
  googleEventId: string,
  event: {
    title: string;
    description: string | null;
    location: string | null;
    startAt: string;
    endAt: string | null;
    allDay: boolean;
  },
  calendarId: string = "primary",
): Promise<void> {
  const res = await googleApiRequest(
    accessToken,
    "PUT",
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleEventId)}`,
    JSON.stringify(toGoogleEvent(event)),
  );
  await handleGoogleResponse(res);
}

export async function deleteGoogleEvent(
  accessToken: string,
  googleEventId: string,
  calendarId: string = "primary",
): Promise<void> {
  const res = await googleApiRequest(
    accessToken,
    "DELETE",
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleEventId)}`,
  );
  await handleGoogleResponse(res);
}

export interface SyncQueueItem {
  id: string;
  mapping_id: string | null;
  operation: "create" | "update" | "delete";
  status: "queued" | "processing" | "done" | "failed";
  attempts: number;
  next_retry_at: string;
  last_error: string | null;
}

export async function enqueueSync({
  mappingId,
  operation,
}: {
  mappingId: string | null;
  operation: "create" | "update" | "delete";
}): Promise<void> {
  const { error } = await (supabaseAdmin as any)
    .from("google_sync_queue")
    .insert({
      mapping_id: mappingId,
      operation,
      status: "queued",
      attempts: 0,
      next_retry_at: new Date().toISOString(),
    });
  if (error) throw new Error(error.message);
}

export async function processSyncQueue(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  const now = new Date().toISOString();

  const { data: items, error: fetchErr } = await supabaseAdmin
    .from("google_sync_queue")
    .select("*")
    .eq("status", "queued")
    .lte("next_retry_at", now)
    .order("created_at", { ascending: true })
    .limit(50);

  if (fetchErr) throw new Error(fetchErr.message);
  if (!items || items.length === 0)
    return { processed: 0, succeeded: 0, failed: 0 };

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (const item of items) {
    processed++;
    const mappingId = item.mapping_id as string | null;

    await supabaseAdmin
      .from("google_sync_queue")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", item.id);

    try {
      if (!mappingId) {
        throw new Error("Mapping record missing");
      }

      const { data: mapping, error: mapErr } = await supabaseAdmin
        .from("google_calendar_event_mappings")
        .select("*")
        .eq("id", mappingId)
        .maybeSingle();
      if (mapErr || !mapping) {
        throw new Error("Mapping not found");
      }

      const connection = await getConnection(mapping.user_id as string);
      if (!connection || connection.status !== "active") {
        throw new Error("No active Google Calendar connection");
      }

      const accessToken = await getValidAccessToken(mapping.user_id as string);

      if (item.operation === "create" || item.operation === "update") {
        const { data: event, error: evErr } = await supabaseAdmin
          .from("calendar_events")
          .select("title,description,location,start_at,end_at,all_day")
          .eq("event_id", mapping.event_id as string)
          .maybeSingle();
        if (evErr || !event) {
          throw new Error("Calendar event not found");
        }

        if (mapping.sync_status === "deleted") {
          if (mapping.google_event_id) {
            await deleteGoogleEvent(
              accessToken,
              mapping.google_event_id as string,
            );
          }
          await supabaseAdmin
            .from("google_calendar_event_mappings")
            .update({
              sync_status: "deleted",
              deleted_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", mappingId);
        } else if (mapping.google_event_id) {
          await updateGoogleEvent(
            accessToken,
            mapping.google_event_id as string,
            {
              title: event.title as string,
              description: event.description as string | null,
              location: event.location as string | null,
              startAt: event.start_at as string,
              endAt: event.end_at as string | null,
              allDay: event.all_day as boolean,
            },
          );
          await supabaseAdmin
            .from("google_calendar_event_mappings")
            .update({
              sync_status: "synced",
              updated_at: new Date().toISOString(),
            })
            .eq("id", mappingId);
        } else {
          const googleEventId = await createGoogleEvent(accessToken, {
            title: event.title as string,
            description: event.description as string | null,
            location: event.location as string | null,
            startAt: event.start_at as string,
            endAt: event.end_at as string | null,
            allDay: event.all_day as boolean,
          });
          await supabaseAdmin
            .from("google_calendar_event_mappings")
            .update({
              google_event_id: googleEventId,
              google_calendar_id: "primary",
              sync_status: "synced",
              updated_at: new Date().toISOString(),
            })
            .eq("id", mappingId);
        }
      } else if (item.operation === "delete") {
        if (mapping.google_event_id) {
          try {
            await deleteGoogleEvent(
              accessToken,
              mapping.google_event_id as string,
            );
          } catch {
            // Ignore 404 (already deleted)
          }
        }
        await supabaseAdmin
          .from("google_calendar_event_mappings")
          .update({
            sync_status: "deleted",
            deleted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", mappingId);
      }

      await supabaseAdmin
        .from("google_sync_queue")
        .update({ status: "done", updated_at: new Date().toISOString() })
        .eq("id", item.id);
      succeeded++;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sync failed";
      const attempts = (item.attempts as number) + 1;

      if (mappingId) {
        await supabaseAdmin
          .from("google_calendar_event_mappings")
          .update({
            sync_status: "failed",
            last_error: message,
            last_error_at: new Date().toISOString(),
            retry_count: attempts,
            updated_at: new Date().toISOString(),
          })
          .eq("id", mappingId);
      }

      if (attempts >= MAX_RETRIES) {
        await supabaseAdmin
          .from("google_sync_queue")
          .update({
            status: "failed",
            last_error: message,
            attempts,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);
        failed++;
      } else {
        const backoffMs = Math.min(Math.pow(2, attempts) * 1000, 3600000);
        const nextRetry = new Date(Date.now() + backoffMs).toISOString();
        await supabaseAdmin
          .from("google_sync_queue")
          .update({
            status: "queued",
            attempts,
            next_retry_at: nextRetry,
            last_error: message,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);
        failed++;
      }
    }
  }

  return { processed, succeeded, failed };
}

export async function enqueueEventSync(
  eventId: string,
  operation: "create" | "update" | "delete",
): Promise<void> {
  const { data: mappings, error } = await supabaseAdmin
    .from("google_calendar_event_mappings")
    .select("id")
    .eq("event_id", eventId);

  if (error) throw new Error(error.message);
  if (!mappings || mappings.length === 0) return;

  for (const m of mappings) {
    await enqueueSync({ mappingId: m.id as string, operation });
  }
}
