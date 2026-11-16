CREATE POLICY "Anyone can read notice attachments" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'notice-attachments');
