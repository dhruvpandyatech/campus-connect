-- Migration: 0005_calendar_and_google_integration (final revised)
-- Additive only.

-- ============================================================
-- 1. Official college calendar events
-- ============================================================
CREATE TABLE public.calendar_events (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(trim(title)) > 0),
  description text,
  category text NOT NULL DEFAULT 'academic' CHECK (category IN ('academic','examination','placement_training','accounts_fees','college_events','holidays','workshops_seminars','other')),
  target_audience text NOT NULL DEFAULT 'all' CHECK (target_audience IN ('all','1','2','3','4')),
  visibility text NOT NULL DEFAULT 'campus' CHECK (visibility IN ('public','campus','faculty')),
  start_at timestamptz NOT NULL,
  end_at timestamptz,
  all_day boolean NOT NULL DEFAULT false,
  location text,
  attachment_url text,
  is_pinned boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled')),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1,
  CONSTRAINT calendar_events_time_order CHECK (end_at IS NULL OR end_at >= start_at),
  CONSTRAINT calendar_events_timestamps CHECK (updated_at >= created_at)
);

CREATE INDEX calendar_events_start_at_idx ON public.calendar_events (start_at);
CREATE INDEX calendar_events_created_by_idx ON public.calendar_events (created_by);
CREATE INDEX calendar_events_status_idx ON public.calendar_events (status);
CREATE INDEX calendar_events_target_audience_idx ON public.calendar_events (target_audience);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Calendar events select" ON public.calendar_events
  FOR SELECT TO anon, authenticated
  USING (
    status = 'active' AND (
      (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('faculty','admin')))
      OR (visibility = 'public' AND target_audience = 'all' AND auth.uid() IS NULL)
      OR (visibility = 'campus' AND auth.uid() IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
        AND (p.role IN ('faculty','admin') OR (p.student_year IS NOT NULL AND p.student_year::text = target_audience))
      ))
      OR (visibility = 'faculty' AND auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('faculty','admin')))
    )
  );

CREATE POLICY "Faculty create events" ON public.calendar_events
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('faculty','admin')));

CREATE POLICY "Owners update events" ON public.calendar_events
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('faculty','admin')))
  WITH CHECK (created_by = auth.uid() AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('faculty','admin')));

CREATE POLICY "Owners delete events" ON public.calendar_events
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('faculty','admin')));

CREATE OR REPLACE FUNCTION public.touch_calendar_event()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'UPDATE' THEN
    NEW.version := OLD.version + 1;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER calendar_events_touch
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.touch_calendar_event();

-- ============================================================
-- 2. Bookmarks
-- ============================================================
CREATE TABLE public.calendar_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.calendar_events(event_id) ON DELETE CASCADE,
  important_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT calendar_bookmarks_one_source CHECK (
    (event_id IS NOT NULL AND important_date IS NULL) OR
    (event_id IS NULL AND important_date IS NOT NULL)
  ),
  UNIQUE (user_id, event_id),
  UNIQUE (user_id, important_date)
);

CREATE INDEX calendar_bookmarks_user_idx ON public.calendar_bookmarks (user_id);
CREATE INDEX calendar_bookmarks_event_idx ON public.calendar_bookmarks (event_id);

ALTER TABLE public.calendar_bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bookmarks owner select" ON public.calendar_bookmarks FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Bookmarks owner insert" ON public.calendar_bookmarks FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Bookmarks owner delete" ON public.calendar_bookmarks FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============================================================
-- 3. Personal reminders
-- ============================================================
CREATE TABLE public.personal_reminders (
  reminder_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.calendar_events(event_id) ON DELETE SET NULL,
  title text NOT NULL CHECK (length(trim(title)) > 0),
  notes text,
  remind_at timestamptz NOT NULL,
  channel text NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app','email')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX personal_reminders_user_idx ON public.personal_reminders (user_id);
CREATE INDEX personal_reminders_remind_at_idx ON public.personal_reminders (remind_at);
CREATE INDEX personal_reminders_event_idx ON public.personal_reminders (event_id);

ALTER TABLE public.personal_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reminders owner select" ON public.personal_reminders FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Reminders owner insert" ON public.personal_reminders FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Reminders owner update" ON public.personal_reminders FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Reminders owner delete" ON public.personal_reminders FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============================================================
-- 4. Google connections (server-only)
-- ============================================================
CREATE TABLE public.google_calendar_connections (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  google_account_email text,
  access_token_enc text,
  refresh_token_enc text,
  token_expiry timestamptz,
  scope text,
  sync_token text,
  connected_at timestamptz NOT NULL DEFAULT now(),
  last_synced_at timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked','error'))
);

ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. Google mappings (preserve tombstones)
-- ============================================================
CREATE TABLE public.google_calendar_event_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.calendar_events(event_id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  google_event_id text,
  google_calendar_id text,
  sync_status text NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending','synced','failed','deleted')),
  retry_count integer NOT NULL DEFAULT 0 CHECK (retry_count >= 0 AND retry_count <= 10),
  last_error text,
  last_error_at timestamptz,
  deleted_at timestamptz,
  purge_after timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id),
  UNIQUE (user_id, google_event_id)
);

CREATE INDEX gcal_mappings_event_idx ON public.google_calendar_event_mappings (event_id);
CREATE INDEX gcal_mappings_user_idx ON public.google_calendar_event_mappings (user_id);
CREATE INDEX gcal_mappings_status_idx ON public.google_calendar_event_mappings (sync_status);

ALTER TABLE public.google_calendar_event_mappings ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. Background sync queue (safe retention)
-- ============================================================
CREATE TABLE public.google_sync_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mapping_id uuid REFERENCES public.google_calendar_event_mappings(id) ON DELETE SET NULL,
  operation text NOT NULL CHECK (operation IN ('create','update','delete')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','done','failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0 AND attempts <= 10),
  next_retry_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX gsync_queue_status_retry_idx ON public.google_sync_queue (status, next_retry_at);
ALTER TABLE public.google_sync_queue ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 7. Notification deliveries
-- ============================================================
CREATE TABLE public.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.calendar_events(event_id) ON DELETE SET NULL,
  reminder_id uuid REFERENCES public.personal_reminders(reminder_id) ON DELETE CASCADE,
  offset_minutes integer NOT NULL DEFAULT 0 CHECK (offset_minutes >= -1440 AND offset_minutes <= 10080),
  scheduled_for timestamptz NOT NULL,
  channel text NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app','email')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed','cancelled')),
  delivered_at timestamptz,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_deliveries_source_check CHECK (
    (event_id IS NOT NULL AND reminder_id IS NULL) OR
    (event_id IS NULL AND reminder_id IS NOT NULL) OR
    (event_id IS NULL AND reminder_id IS NULL AND status IN ('cancelled','failed'))
  )
);

CREATE INDEX notif_deliveries_user_idx ON public.notification_deliveries (user_id);
CREATE INDEX notif_deliveries_scheduled_idx ON public.notification_deliveries (scheduled_for);
CREATE INDEX notif_deliveries_status_idx ON public.notification_deliveries (status);

ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

-- Ownership validation trigger
CREATE OR REPLACE FUNCTION public.validate_notification_delivery()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.reminder_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.personal_reminders r WHERE r.reminder_id = NEW.reminder_id AND r.user_id = NEW.user_id) THEN
      RAISE EXCEPTION 'Notification user must own the reminder';
    END IF;
  END IF;
  IF NEW.event_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.calendar_events e
      WHERE e.event_id = NEW.event_id AND (
        e.visibility IN ('public','campus') OR
        (e.visibility = 'faculty' AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = NEW.user_id AND p.role IN ('faculty','admin')))
      )
    ) THEN
      RAISE EXCEPTION 'Notification recipient not eligible for event';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER notification_deliveries_validate
  BEFORE INSERT OR UPDATE ON public.notification_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.validate_notification_delivery();

-- ============================================================
-- 8. Storage policies (private, no client SELECT)
-- ============================================================
CREATE POLICY "Faculty upload calendar attachments" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'calendar-attachments' AND (storage.foldername(name))[1] = auth.uid()::text AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('faculty','admin')));
CREATE POLICY "Faculty delete calendar attachments" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'calendar-attachments' AND (storage.foldername(name))[1] = auth.uid()::text AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('faculty','admin')));

-- ============================================================
-- 9. Grants / revoke
-- ============================================================
REVOKE ALL ON public.google_calendar_connections FROM anon, authenticated;
REVOKE ALL ON public.google_calendar_event_mappings FROM anon, authenticated;
REVOKE ALL ON public.google_sync_queue FROM anon, authenticated;
REVOKE ALL ON public.notification_deliveries FROM anon, authenticated;

GRANT ALL ON public.google_calendar_connections TO service_role;
GRANT ALL ON public.google_calendar_event_mappings TO service_role;
GRANT ALL ON public.google_sync_queue TO service_role;
GRANT ALL ON public.notification_deliveries TO service_role;

GRANT SELECT ON public.calendar_events TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_events TO authenticated;
GRANT ALL ON public.calendar_events TO service_role;

GRANT SELECT, INSERT, DELETE ON public.calendar_bookmarks TO authenticated;
GRANT ALL ON public.calendar_bookmarks TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.personal_reminders TO authenticated;
GRANT ALL ON public.personal_reminders TO service_role;
