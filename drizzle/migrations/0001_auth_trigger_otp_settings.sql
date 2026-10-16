ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age integer, ADD COLUMN IF NOT EXISTS gender text;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, age, gender)
  VALUES (NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name',''), NEW.raw_user_meta_data->>'phone', ''),
    CASE WHEN NEW.email ILIKE '%@phone.bnoy.app' THEN NULL ELSE NEW.email END,
    COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone),
    NULLIF(NEW.raw_user_meta_data->>'age','')::integer,
    NULLIF(NEW.raw_user_meta_data->>'gender',''))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role='admin') THEN 'admin'::public.app_role ELSE 'rider'::public.app_role END)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill accounts that were created while the trigger was missing
INSERT INTO public.profiles (id, full_name, email, phone)
SELECT u.id, COALESCE(NULLIF(u.raw_user_meta_data->>'full_name',''), ''),
  CASE WHEN u.email ILIKE '%@phone.bnoy.app' THEN NULL ELSE u.email END,
  COALESCE(u.raw_user_meta_data->>'phone', u.phone)
FROM auth.users u ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, CASE WHEN NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role='admin')
  AND u.id = (SELECT id FROM auth.users ORDER BY created_at LIMIT 1) THEN 'admin'::public.app_role ELSE 'rider'::public.app_role END
FROM auth.users u WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id);

CREATE TABLE IF NOT EXISTS public.phone_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  code text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  used boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '10 minutes',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS phone_otps_phone_idx ON public.phone_otps (phone, created_at DESC);
GRANT ALL ON public.phone_otps TO service_role;
ALTER TABLE public.phone_otps ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage settings" ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));