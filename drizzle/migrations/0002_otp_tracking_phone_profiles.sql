CREATE TABLE public.tracking_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  code text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '10 minutes',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.tracking_otps TO service_role;
ALTER TABLE public.tracking_otps ENABLE ROW LEVEL SECURITY;
CREATE INDEX tracking_otps_ship_idx ON public.tracking_otps (shipment_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.request_tracking_otp(_code text, _phone_last4 text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s public.shipments; c text; recent int;
BEGIN
  SELECT * INTO s FROM public.shipments
   WHERE length(_code) BETWEEN 4 AND 80 AND (upper(tracking_code) = upper(trim(_code)) OR external_order_id = trim(_code) OR partner_awb = trim(_code)) LIMIT 1;
  IF NOT FOUND OR right(regexp_replace(coalesce(s.receiver_phone,''),'\D','','g'),4) <> right(regexp_replace(coalesce(_phone_last4,''),'\D','','g'),4) THEN
    RAISE EXCEPTION 'Tracking number and phone number do not match';
  END IF;
  SELECT count(*) INTO recent FROM public.tracking_otps WHERE shipment_id = s.id AND created_at > now() - interval '10 minutes';
  IF recent >= 3 THEN RAISE EXCEPTION 'Too many codes requested. Try again in 10 minutes.'; END IF;
  c := lpad(floor(random()*1000000)::int::text, 6, '0');
  INSERT INTO public.tracking_otps (shipment_id, code) VALUES (s.id, c);
  RETURN jsonb_build_object('sent_to', '******' || right(regexp_replace(s.receiver_phone,'\D','','g'),4), 'sms_configured', false,
    'demo_code', CASE WHEN s.is_demo THEN c END);
END $$;

CREATE OR REPLACE FUNCTION public.track_with_otp(_code text, _otp text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s public.shipments; o public.tracking_otps;
BEGIN
  SELECT * INTO s FROM public.shipments
   WHERE length(_code) BETWEEN 4 AND 80 AND (upper(tracking_code) = upper(trim(_code)) OR external_order_id = trim(_code) OR partner_awb = trim(_code)) LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid code'; END IF;
  SELECT * INTO o FROM public.tracking_otps WHERE shipment_id = s.id ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND OR o.expires_at < now() THEN RAISE EXCEPTION 'Code expired — request a new one'; END IF;
  IF o.attempts >= 5 THEN RAISE EXCEPTION 'Too many wrong attempts — request a new code'; END IF;
  IF trim(_otp) <> o.code THEN UPDATE public.tracking_otps SET attempts = attempts + 1 WHERE id = o.id; RAISE EXCEPTION 'Wrong code'; END IF;
  RETURN public.track_shipment(s.tracking_code) || jsonb_build_object('receiver_address', s.receiver_address, 'cod_amount', s.cod_amount);
END $$;

REVOKE EXECUTE ON FUNCTION public.track_shipment(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.track_shipment(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.request_tracking_otp(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_with_otp(text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone)
  VALUES (NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name',''), NEW.raw_user_meta_data->>'phone', ''),
    CASE WHEN NEW.email ILIKE '%@phone.bnoy.app' THEN NULL ELSE NEW.email END,
    COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role='admin') THEN 'admin'::public.app_role ELSE 'rider'::public.app_role END)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $function$;
UPDATE public.profiles SET email = NULL WHERE email ILIKE '%@phone.bnoy.app';