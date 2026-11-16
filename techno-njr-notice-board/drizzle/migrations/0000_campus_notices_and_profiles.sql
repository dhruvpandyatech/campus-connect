-- Profiles for faculty / HODs / Deans
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  designation text NOT NULL DEFAULT 'Faculty',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, designation)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), split_part(COALESCE(NEW.email, ''), '@', 1)),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'designation', ''), 'Faculty')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_touch_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Notices
CREATE TABLE public.notices (
  notice_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  category text NOT NULL CHECK (category IN ('academic', 'exams', 'placements', 'events')),
  attachment_url text,
  sender_name text NOT NULL DEFAULT '',
  sender_role text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX notices_created_at_idx ON public.notices (created_at DESC);
CREATE INDEX notices_created_by_idx ON public.notices (created_by);

GRANT SELECT ON public.notices TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notices TO authenticated;
GRANT ALL ON public.notices TO service_role;

ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read notices" ON public.notices
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Faculty can publish notices" ON public.notices
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Faculty can update their own notices" ON public.notices
  FOR UPDATE TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE POLICY "Faculty can delete their own notices" ON public.notices
  FOR DELETE TO authenticated USING (created_by = auth.uid());

-- Stamp sender name/role from the author's profile so they can't be spoofed
CREATE OR REPLACE FUNCTION public.stamp_notice_sender()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p record;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
    NEW.sender_name := OLD.sender_name;
    NEW.sender_role := OLD.sender_role;
    RETURN NEW;
  END IF;

  IF NEW.created_by IS NOT NULL THEN
    SELECT full_name, designation INTO p FROM public.profiles WHERE id = NEW.created_by;
    IF FOUND THEN
      NEW.sender_name := p.full_name;
      NEW.sender_role := p.designation;
    END IF;
    NEW.created_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER notices_stamp_sender
  BEFORE INSERT OR UPDATE ON public.notices
  FOR EACH ROW EXECUTE FUNCTION public.stamp_notice_sender();

-- Storage policies for notice attachments (bucket created separately)
CREATE POLICY "Faculty can upload notice attachments" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'notice-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Faculty can delete their notice attachments" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'notice-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Sample notices so the feed isn't empty on first open
INSERT INTO public.notices (title, content, category, attachment_url, sender_name, sender_role, created_at) VALUES
('Mid-Semester Exam Hall Tickets Released', 'Hall tickets for the mid-semester examinations are now available on the student portal. Carry a printed copy and your college ID card to every exam. Students with pending fee dues must clear them before downloading.', 'exams', NULL, 'Dr. Meera Iyer', 'Controller of Examinations', now() - interval '2 hours'),
('Revised Timetable: B.Tech Semester 5', 'Thursday afternoon slots for Computer Networks and DBMS have been swapped from next week. The updated class schedule is attached. Lab sessions remain unchanged.', 'academic', NULL, 'Prof. Rahul Deshmukh', 'HOD, Computer Engineering', now() - interval '9 hours'),
('Campus Placement Drive — Infosys', 'Infosys will conduct an on-campus recruitment drive for 2027 graduates. Package: 6.5 LPA CTC. Eligible branches: CSE, IT, ECE. Register by Friday via the placement cell. Online aptitude test followed by technical interview.', 'placements', NULL, 'Ms. Kavya Nair', 'Training & Placement Officer', now() - interval '1 day'),
('Annual Tech Fest "Innovate 2026" — Volunteers Needed', 'The annual tech fest will be held from 4th to 6th December. Student volunteers for event management, hospitality and technical support can sign up with their class representatives.', 'events', NULL, 'Dr. Anil Kapoor', 'Dean, Student Affairs', now() - interval '2 days'),
('End-Semester Results Declared', 'Results for the odd-semester examinations have been published. Students may apply for revaluation within 7 days of declaration through the examination section.', 'exams', NULL, 'Dr. Meera Iyer', 'Controller of Examinations', now() - interval '3 days'),
('Circular: Holiday on account of Guru Nanak Jayanti', 'The college will remain closed on Friday on account of Guru Nanak Jayanti. All classes and lab sessions scheduled for the day stand postponed to Saturday.', 'events', NULL, 'Office of the Principal', 'Principal', now() - interval '4 days'),
('Academic Calendar for Even Semester Published', 'The academic calendar for the upcoming even semester, including teaching days, internal assessment windows and vacation dates, is now available.', 'academic', NULL, 'Dr. Sunita Rao', 'Dean, Academics', now() - interval '6 days');
