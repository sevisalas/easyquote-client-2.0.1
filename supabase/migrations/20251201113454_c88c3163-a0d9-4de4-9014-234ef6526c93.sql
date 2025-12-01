-- Add production_board_view preference to profiles table
ALTER TABLE public.profiles
ADD COLUMN production_board_view text DEFAULT 'kanban' CHECK (production_board_view IN ('list', 'compact', 'kanban'));