GRANT SELECT ON public.app_settings TO anon;
CREATE POLICY "Anyone reads public auth and map settings" ON public.app_settings FOR SELECT TO anon, authenticated USING (key IN ('auth_policy','maps'));
ALTER TABLE public.wh_bag_items ADD COLUMN IF NOT EXISTS lat double precision, ADD COLUMN IF NOT EXISTS lng double precision;