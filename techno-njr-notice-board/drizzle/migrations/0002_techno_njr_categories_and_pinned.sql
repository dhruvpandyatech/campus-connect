ALTER TABLE public.notices DROP CONSTRAINT IF EXISTS notices_category_check;

ALTER TABLE public.notices ADD COLUMN is_pinned boolean NOT NULL DEFAULT false;

UPDATE public.notices SET category = 'administration' WHERE category = 'events' AND (title ILIKE '%holiday%' OR title ILIKE '%circular%' OR title ILIKE '%fee%');
UPDATE public.notices SET category = 'student' WHERE category = 'events';
UPDATE public.notices SET category = 'academic' WHERE category = 'exams';
UPDATE public.notices SET is_pinned = true WHERE title = 'Mid-Semester Exam Hall Tickets Released' AND created_by IS NULL;

ALTER TABLE public.notices ADD CONSTRAINT notices_category_check
  CHECK (category IN ('placements', 'academic', 'student', 'administration'));

CREATE INDEX IF NOT EXISTS notices_pinned_created_idx ON public.notices (is_pinned DESC, created_at DESC);