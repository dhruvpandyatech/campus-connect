-- Migration: 0003_expand_categories
-- Purpose:   Expand the notices.category CHECK constraint to include three new
--            classifications: 'accounts', 'fees', 'examination'.
--            Existing notices keep their original categories untouched.

-- Drop the existing constraint (from 0002) so we can replace it.
ALTER TABLE public.notices DROP CONSTRAINT IF EXISTS notices_category_check;

-- Re-add the constraint with all seven valid categories.
ALTER TABLE public.notices ADD CONSTRAINT notices_category_check
  CHECK (
    category IN (
      'placements',
      'academic',
      'student',
      'administration',
      'accounts',
      'fees',
      'examination'
    )
  );

-- No data migration needed: all pre-existing rows already have one of the
-- four original categories, which remain valid under the new constraint.
