CREATE TABLE public.entry_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES public.time_entries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  storage_path TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entry_photos TO authenticated;
GRANT ALL ON public.entry_photos TO service_role;
ALTER TABLE public.entry_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "entry_photos read" ON public.entry_photos FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "entry_photos insert own" ON public.entry_photos FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "entry_photos delete" ON public.entry_photos FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));