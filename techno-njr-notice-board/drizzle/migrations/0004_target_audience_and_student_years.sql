-- Migration: 0004_target_audience_and_student_years
-- Purpose:   Implement Year-wise Notice Targeting and Student Role Integration.
--            1. Add target_audience to notices (default 'all' to preserve existing visibility).
--            2. Add role and student_year to profiles.
--            3. Update handle_new_user() trigger for student metadata.
--            4. Enforce Row-Level Security (RLS) so students cannot read other years' notices via direct API calls.
--            5. Restrict notice publication/updates to faculty and administrators.

-- 1. Notice target_audience column and constraints
ALTER TABLE public.notices 
  ADD COLUMN IF NOT EXISTS target_audience text NOT NULL DEFAULT 'all';

ALTER TABLE public.notices DROP CONSTRAINT IF EXISTS notices_target_audience_check;
ALTER TABLE public.notices ADD CONSTRAINT notices_target_audience_check
  CHECK (target_audience IN ('all', '1', '2', '3', '4', '1st_year', '2nd_year', '3rd_year', '4th_year'));

CREATE INDEX IF NOT EXISTS notices_target_audience_idx ON public.notices (target_audience);

-- 2. User profile role and academic year columns
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'faculty';

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('faculty', 'student', 'admin'));

ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS student_year integer;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_student_year_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_student_year_check
  CHECK (student_year IS NULL OR student_year IN (1, 2, 3, 4));

-- 3. Trigger to populate role & student_year from auth.users metadata on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
  user_year integer;
BEGIN
  -- Determine role
  IF LOWER(COALESCE(NEW.raw_user_meta_data->>'role', '')) = 'student' OR (NEW.raw_user_meta_data->>'student_year') IS NOT NULL THEN
    user_role := 'student';
  ELSIF LOWER(COALESCE(NEW.raw_user_meta_data->>'role', '')) = 'admin' THEN
    user_role := 'admin';
  ELSE
    user_role := 'faculty';
  END IF;

  -- Determine student_year
  IF user_role = 'student' THEN
    user_year := NULLIF(NEW.raw_user_meta_data->>'student_year', '')::integer;
    IF user_year NOT IN (1, 2, 3, 4) THEN
      user_year := 1;
    END IF;
  ELSE
    user_year := NULL;
  END IF;

  INSERT INTO public.profiles (id, full_name, designation, role, student_year)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), split_part(COALESCE(NEW.email, ''), '@', 1)),
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'designation', ''),
      CASE WHEN user_role = 'student' THEN CONCAT(user_year, CASE user_year WHEN 1 THEN 'st' WHEN 2 THEN 'nd' WHEN 3 THEN 'rd' ELSE 'th' END, ' Year Student')
           ELSE 'Faculty' END
    ),
    user_role,
    user_year
  )
  ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    student_year = EXCLUDED.student_year,
    full_name = CASE WHEN EXCLUDED.full_name <> '' THEN EXCLUDED.full_name ELSE public.profiles.full_name END;
  RETURN NEW;
END;
$$;

-- 4. Row Level Security: Enforce Year-wise Targeting for SELECT
DROP POLICY IF EXISTS "Anyone can read notices" ON public.notices;
DROP POLICY IF EXISTS "Notice read access policy" ON public.notices;

CREATE POLICY "Notice read access policy" ON public.notices
  FOR SELECT TO anon, authenticated
  USING (
    -- Broadcast notices ('all') are readable by everyone
    target_audience = 'all'
    OR (
      auth.uid() IS NOT NULL AND (
        -- Faculty and administrators can read ALL notices
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
          AND (p.role IN ('faculty', 'admin') OR p.student_year IS NULL)
        )
        -- Students can ONLY read notices matching their academic year
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
          AND p.student_year IS NOT NULL
          AND (
            p.student_year::text = target_audience
            OR CONCAT(p.student_year, CASE p.student_year WHEN 1 THEN 'st_year' WHEN 2 THEN 'nd_year' WHEN 3 THEN 'rd_year' ELSE 'th_year' END) = target_audience
          )
        )
      )
    )
  );

-- 5. Row Level Security: Restrict publication, modification, and deletion to Faculty/Admins
DROP POLICY IF EXISTS "Faculty can publish notices" ON public.notices;
CREATE POLICY "Faculty can publish notices" ON public.notices
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (p.role IN ('faculty', 'admin') OR p.student_year IS NULL)
    )
  );

DROP POLICY IF EXISTS "Faculty can update their own notices" ON public.notices;
CREATE POLICY "Faculty can update their own notices" ON public.notices
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (p.role IN ('faculty', 'admin') OR p.student_year IS NULL)
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (p.role IN ('faculty', 'admin') OR p.student_year IS NULL)
    )
  );

DROP POLICY IF EXISTS "Faculty can delete their own notices" ON public.notices;
CREATE POLICY "Faculty can delete their own notices" ON public.notices
  FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (p.role IN ('faculty', 'admin') OR p.student_year IS NULL)
    )
  );
