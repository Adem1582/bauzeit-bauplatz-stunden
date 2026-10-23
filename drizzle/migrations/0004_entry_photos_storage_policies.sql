CREATE POLICY "entry_photos storage read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'entry-photos' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
  ));
CREATE POLICY "entry_photos storage insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'entry-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "entry_photos storage delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'entry-photos' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
  ));