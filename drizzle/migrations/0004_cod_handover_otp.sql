CREATE TABLE IF NOT EXISTS public.cod_handover_otps (
  handover_id uuid PRIMARY KEY REFERENCES public.cod_handovers(id) ON DELETE CASCADE,
  code text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.cod_handover_otps TO service_role;
ALTER TABLE public.cod_handover_otps ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.list_handover_receivers()
RETURNS TABLE(id uuid, full_name text, phone text, role public.app_role)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT p.id, p.full_name, p.phone, public.get_user_role(p.id)
  FROM public.profiles p
  WHERE p.id <> auth.uid() AND (
    public.is_ancestor(p.id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.hubs h WHERE h.manager_id = p.id)
    OR (public.has_role(p.id,'warehouse') AND p.parent_id IS NOT NULL AND public.is_ancestor(p.parent_id, auth.uid()))
  ) AND public.get_user_role(p.id) IN ('manager','distributor','warehouse','admin')
  ORDER BY 4 DESC, 2 $$;

CREATE OR REPLACE FUNCTION public.rider_start_handover(_to uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE h public.cod_handovers; total numeric; cnt integer; c text;
BEGIN
  IF public.get_user_role(auth.uid()) IS DISTINCT FROM 'rider' THEN RAISE EXCEPTION 'Only riders hand over cash here'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.list_handover_receivers() r WHERE r.id = _to) THEN RAISE EXCEPTION 'Pick a staff member from your franchise'; END IF;
  SELECT coalesce(sum(cod_amount),0), count(*) INTO total, cnt FROM public.shipments
    WHERE rider_id = auth.uid() AND status = 'delivered' AND cod_collected AND cod_amount > 0 AND cod_handover_id IS NULL;
  IF cnt = 0 THEN RAISE EXCEPTION 'No cash to hand over'; END IF;
  INSERT INTO public.cod_handovers (stage, from_user, to_user, expected_amount, shipment_count)
  VALUES ('rider_to_manager', auth.uid(), _to, total, cnt) RETURNING * INTO h;
  PERFORM set_config('bnoy.cod_ok','1', true);
  UPDATE public.shipments SET cod_handover_id = h.id
    WHERE rider_id = auth.uid() AND status = 'delivered' AND cod_collected AND cod_amount > 0 AND cod_handover_id IS NULL;
  c := lpad(floor(random()*1000000)::int::text, 6, '0');
  INSERT INTO public.cod_handover_otps (handover_id, code) VALUES (h.id, c);
  INSERT INTO public.finance_ledger (entry_type, amount, user_id, handover_id, note) VALUES ('handover_submitted', total, auth.uid(), h.id, 'rider_to_staff_otp');
  RETURN jsonb_build_object('id', h.id, 'code', h.code, 'amount', total, 'count', cnt);
END $$;

CREATE OR REPLACE FUNCTION public.get_handover_otp(_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE h public.cod_handovers; c text;
BEGIN
  SELECT * INTO h FROM public.cod_handovers WHERE id = _id;
  IF NOT FOUND OR h.status <> 'submitted' THEN RETURN NULL; END IF;
  IF NOT (h.to_user = auth.uid() OR public.has_role(auth.uid(),'admin')) THEN RAISE EXCEPTION 'Only the receiving staff can see this code'; END IF;
  SELECT code INTO c FROM public.cod_handover_otps WHERE handover_id = _id;
  RETURN c;
END $$;

CREATE OR REPLACE FUNCTION public.verify_handover_otp(_id uuid, _otp text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE h public.cod_handovers; o public.cod_handover_otps;
BEGIN
  SELECT * INTO h FROM public.cod_handovers WHERE id = _id FOR UPDATE;
  IF NOT FOUND OR h.from_user <> auth.uid() THEN RAISE EXCEPTION 'Handover not found'; END IF;
  IF h.status <> 'submitted' THEN RAISE EXCEPTION 'Already confirmed'; END IF;
  SELECT * INTO o FROM public.cod_handover_otps WHERE handover_id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No code for this handover'; END IF;
  IF o.attempts >= 5 THEN RAISE EXCEPTION 'Too many wrong attempts — ask staff to confirm from their screen'; END IF;
  IF trim(_otp) <> o.code THEN UPDATE public.cod_handover_otps SET attempts = attempts + 1 WHERE handover_id = _id; RETURN false; END IF;
  UPDATE public.cod_handovers SET received_amount = expected_amount, status = 'accepted', resolved_at = now() WHERE id = _id RETURNING * INTO h;
  INSERT INTO public.finance_ledger (entry_type, amount, user_id, handover_id, note) VALUES ('handover_accepted', h.expected_amount, h.from_user, h.id, 'OTP confirmed');
  DELETE FROM public.cod_handover_otps WHERE handover_id = _id;
  RETURN true;
END $$;

GRANT EXECUTE ON FUNCTION public.list_handover_receivers(), public.rider_start_handover(uuid), public.get_handover_otp(uuid), public.verify_handover_otp(uuid, text) TO authenticated;