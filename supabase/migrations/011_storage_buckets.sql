-- Create the required storage buckets for People
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('event-covers', 'event-covers', true),
  ('payment-qr', 'payment-qr', true),
  ('people-photos', 'people-photos', true),
  ('payment-proofs', 'payment-proofs', true)
ON CONFLICT (id) DO NOTHING;

-- Enable public read access for all these buckets
-- (Uploads are handled securely by Next.js Route Handlers using the Service Role key, so they bypass RLS)
CREATE POLICY "Public View Access for Event Covers" 
  ON storage.objects FOR SELECT 
  USING ( bucket_id = 'event-covers' );

CREATE POLICY "Public View Access for Payment QR" 
  ON storage.objects FOR SELECT 
  USING ( bucket_id = 'payment-qr' );

CREATE POLICY "Public View Access for People Photos" 
  ON storage.objects FOR SELECT 
  USING ( bucket_id = 'people-photos' );

CREATE POLICY "Public View Access for Payment Proofs" 
  ON storage.objects FOR SELECT 
  USING ( bucket_id = 'payment-proofs' );
