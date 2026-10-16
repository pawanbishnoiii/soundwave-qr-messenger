
CREATE TYPE public.app_role AS ENUM ('admin','distributor','manager','rider');
CREATE TYPE public.shipment_status AS ENUM ('created','pickup_scheduled','assigned','picked_up','hub_received','sorted','in_transit','out_for_delivery','delivered','failed','reattempt','return_initiated','returned','cancelled');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text,
  phone text,
  parent_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.profiles, public.user_roles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid) RETURNS public.app_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id
  ORDER BY CASE role WHEN 'admin' THEN 4 WHEN 'distributor' THEN 3 WHEN 'manager' THEN 2 ELSE 1 END DESC LIMIT 1 $$;

CREATE OR REPLACE FUNCTION public.is_ancestor(_anc uuid, _desc uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH RECURSIVE up AS (
    SELECT parent_id, 1 AS depth FROM public.profiles WHERE id = _desc
    UNION ALL
    SELECT p.parent_id, up.depth + 1 FROM public.profiles p JOIN up ON p.id = up.parent_id WHERE up.depth < 20
  ) SELECT _anc IS NOT NULL AND _desc IS NOT NULL AND EXISTS (SELECT 1 FROM up WHERE parent_id = _anc) $$;

CREATE OR REPLACE FUNCTION public.chain_role_id(_user uuid, _role public.app_role) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH RECURSIVE up AS (
    SELECT id, parent_id, 0 AS depth FROM public.profiles WHERE id = _user
    UNION ALL
    SELECT p.id, p.parent_id, up.depth + 1 FROM public.profiles p JOIN up ON p.id = up.parent_id WHERE up.depth < 20
  ) SELECT up.id FROM up JOIN public.user_roles r ON r.user_id = up.id AND r.role = _role ORDER BY depth LIMIT 1 $$;

CREATE POLICY "profiles visible to self, team ancestors and admins" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.is_ancestor(auth.uid(), id) OR public.is_ancestor(id, auth.uid()));
CREATE POLICY "users update own name" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "roles visible in team" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.is_ancestor(auth.uid(), user_id) OR public.is_ancestor(user_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.profiles_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(),'admin') THEN
    NEW.parent_id := OLD.parent_id; NEW.email := OLD.email; NEW.id := OLD.id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER profiles_guard BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.profiles_guard();

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1), ''), NEW.email, NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role='admin') THEN 'admin'::public.app_role ELSE 'rider'::public.app_role END)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.hubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'hub' CHECK (kind IN ('hub','branch','sort_center','dark_store')),
  address text NOT NULL DEFAULT '',
  city text NOT NULL,
  pincode text,
  lat double precision,
  lng double precision,
  opens_at time DEFAULT '08:00',
  closes_at time DEFAULT '21:00',
  manager_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  capacity_per_day integer NOT NULL DEFAULT 500,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','closed')),
  contact_phone text,
  serviceable_pincodes text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.merchants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  legal_name text,
  gstin text,
  contact_name text,
  contact_phone text,
  contact_email text,
  pickup_address text NOT NULL DEFAULT '',
  pickup_city text,
  pickup_pincode text,
  default_hub_id uuid REFERENCES public.hubs(id) ON DELETE SET NULL,
  rate_per_kg numeric NOT NULL DEFAULT 40,
  base_rate numeric NOT NULL DEFAULT 35,
  cod_fee_pct numeric NOT NULL DEFAULT 1.5,
  cod_limit numeric NOT NULL DEFAULT 50000,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('onboarding','active','suspended')),
  integration text NOT NULL DEFAULT 'manual' CHECK (integration IN ('manual','api','csv','webhook')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reg_number text NOT NULL UNIQUE,
  kind text NOT NULL DEFAULT 'bike' CHECK (kind IN ('bike','scooter','ev_scooter','three_wheeler','van','truck')),
  capacity_kg numeric NOT NULL DEFAULT 20,
  ownership text NOT NULL DEFAULT 'owned' CHECK (ownership IN ('owned','leased','rider_owned')),
  hub_id uuid REFERENCES public.hubs(id) ON DELETE SET NULL,
  rider_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','on_route','maintenance','retired')),
  insurance_expiry date,
  puc_expiry date,
  fitness_expiry date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hubs, public.merchants, public.vehicles TO authenticated;
GRANT ALL ON public.hubs, public.merchants, public.vehicles TO service_role;
ALTER TABLE public.hubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read hubs" ON public.hubs FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage hubs" ON public.hubs FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "hub manager updates own hub" ON public.hubs FOR UPDATE TO authenticated USING (manager_id = auth.uid()) WITH CHECK (manager_id = auth.uid());
CREATE POLICY "leads read merchants" ON public.merchants FOR SELECT TO authenticated USING (NOT public.has_role(auth.uid(),'rider') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins manage merchants" ON public.merchants FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "fleet visible to leads and assigned rider" ON public.vehicles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR rider_id = auth.uid() OR public.is_ancestor(auth.uid(), rider_id)
    OR EXISTS (SELECT 1 FROM public.hubs h WHERE h.id = hub_id AND h.manager_id = auth.uid()));
CREATE POLICY "admins manage fleet" ON public.vehicles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "hub managers update fleet" ON public.vehicles FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.hubs h WHERE h.id = hub_id AND h.manager_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.hubs h WHERE h.id = hub_id AND h.manager_id = auth.uid()));

CREATE TABLE public.courier_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  adapter text NOT NULL,
  account_reference text NOT NULL DEFAULT '',
  connection_status text NOT NULL DEFAULT 'disconnected',
  enabled boolean NOT NULL DEFAULT true,
  last_error text,
  last_sync_at timestamptz,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.courier_partners TO authenticated;
GRANT ALL ON public.courier_partners TO service_role;
ALTER TABLE public.courier_partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage partners" ON public.courier_partners FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE DEFAULT ('LOT-' || upper(substr(md5(random()::text),1,6))),
  name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open',
  manager_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  hub_id uuid REFERENCES public.hubs(id) ON DELETE SET NULL,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lots TO authenticated;
GRANT ALL ON public.lots TO service_role;
ALTER TABLE public.lots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lots visible in chain" ON public.lots FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR manager_id = auth.uid() OR public.is_ancestor(auth.uid(), manager_id) OR public.is_ancestor(manager_id, auth.uid()));
CREATE POLICY "managers create lots" ON public.lots FOR INSERT TO authenticated
  WITH CHECK (NOT public.has_role(auth.uid(),'rider') AND (manager_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.is_ancestor(auth.uid(), manager_id)));
CREATE POLICY "managers edit lots" ON public.lots FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR manager_id = auth.uid() OR public.is_ancestor(auth.uid(), manager_id));
CREATE POLICY "managers delete lots" ON public.lots FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR manager_id = auth.uid() OR public.is_ancestor(auth.uid(), manager_id));

CREATE TABLE public.delivery_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE DEFAULT ('RT-' || upper(substr(md5(random()::text),1,6))),
  route_date date NOT NULL DEFAULT current_date,
  hub_id uuid REFERENCES public.hubs(id) ON DELETE SET NULL,
  rider_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','active','completed','cancelled')),
  planned_start timestamptz,
  actual_start timestamptz,
  actual_end timestamptz,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_routes TO authenticated;
GRANT ALL ON public.delivery_routes TO service_role;
ALTER TABLE public.delivery_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "routes visible in chain" ON public.delivery_routes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR rider_id = auth.uid() OR created_by = auth.uid() OR public.is_ancestor(auth.uid(), rider_id)
    OR EXISTS (SELECT 1 FROM public.hubs h WHERE h.id = hub_id AND h.manager_id = auth.uid()));
CREATE POLICY "leads plan routes" ON public.delivery_routes FOR INSERT TO authenticated
  WITH CHECK (NOT public.has_role(auth.uid(),'rider') AND (rider_id IS NULL OR public.has_role(auth.uid(),'admin') OR public.is_ancestor(auth.uid(), rider_id)));
CREATE POLICY "leads and rider update routes" ON public.delivery_routes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR rider_id = auth.uid() OR created_by = auth.uid() OR public.is_ancestor(auth.uid(), rider_id));
CREATE POLICY "leads delete routes" ON public.delivery_routes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR created_by = auth.uid());

CREATE TABLE public.shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_code text NOT NULL UNIQUE DEFAULT ('BN' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
  status public.shipment_status NOT NULL DEFAULT 'created',
  sender_name text NOT NULL,
  sender_phone text,
  receiver_name text NOT NULL,
  receiver_phone text NOT NULL,
  receiver_address text NOT NULL,
  city text NOT NULL,
  pincode text,
  weight_kg numeric NOT NULL DEFAULT 0.5,
  length_cm numeric, width_cm numeric, height_cm numeric,
  package_type text NOT NULL DEFAULT 'parcel',
  fragile boolean NOT NULL DEFAULT false,
  service_level text NOT NULL DEFAULT 'standard' CHECK (service_level IN ('standard','express','same_day')),
  pickup_slot text,
  payment_mode text NOT NULL DEFAULT 'prepaid' CHECK (payment_mode IN ('prepaid','cod')),
  cod_amount numeric NOT NULL DEFAULT 0,
  cod_collected boolean NOT NULL DEFAULT false,
  cod_handover_id uuid,
  notes text,
  delivery_notes text,
  failure_reason text,
  attempt_count integer NOT NULL DEFAULT 0,
  promised_by timestamptz,
  external_order_id text,
  partner_awb text,
  courier_partner_id uuid REFERENCES public.courier_partners(id) ON DELETE SET NULL,
  merchant_id uuid REFERENCES public.merchants(id) ON DELETE SET NULL,
  hub_id uuid REFERENCES public.hubs(id) ON DELETE SET NULL,
  route_id uuid REFERENCES public.delivery_routes(id) ON DELETE SET NULL,
  route_seq integer,
  lot_id uuid REFERENCES public.lots(id) ON DELETE SET NULL,
  rider_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  manager_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  distributor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  delivery_otp text NOT NULL DEFAULT lpad((floor(random()*10000))::int::text, 4, '0'),
  otp_sent_at timestamptz,
  otp_verified_at timestamptz,
  otp_attempts integer NOT NULL DEFAULT 0,
  delivered_at timestamptz,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX shipments_external_order_uq ON public.shipments (created_by, external_order_id) WHERE external_order_id IS NOT NULL;
CREATE INDEX shipments_status_idx ON public.shipments (status);
CREATE INDEX shipments_rider_idx ON public.shipments (rider_id);
CREATE INDEX shipments_created_idx ON public.shipments (created_at DESC);
CREATE INDEX shipments_receiver_phone_idx ON public.shipments (receiver_phone);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipments TO authenticated;
GRANT ALL ON public.shipments TO service_role;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_see_shipment(_s public.shipments) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.has_role(auth.uid(),'admin')
    OR _s.created_by = auth.uid() OR _s.rider_id = auth.uid() OR _s.manager_id = auth.uid() OR _s.distributor_id = auth.uid()
    OR public.is_ancestor(auth.uid(), _s.rider_id) OR public.is_ancestor(auth.uid(), _s.created_by)
    OR EXISTS (SELECT 1 FROM public.hubs h WHERE h.id = _s.hub_id AND h.manager_id = auth.uid())
  ) $$;

CREATE POLICY "see shipments in scope" ON public.shipments FOR SELECT TO authenticated USING (public.can_see_shipment(shipments));
CREATE POLICY "leads book shipments" ON public.shipments FOR INSERT TO authenticated
  WITH CHECK (NOT public.has_role(auth.uid(),'rider') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "update shipments in scope" ON public.shipments FOR UPDATE TO authenticated USING (public.can_see_shipment(shipments));
CREATE POLICY "leads delete shipments" ON public.shipments FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR (created_by = auth.uid() AND status IN ('created','cancelled')));

CREATE TABLE public.shipment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  status public.shipment_status NOT NULL,
  from_status public.shipment_status,
  actor_id uuid,
  scan_source text NOT NULL DEFAULT 'system',
  hub_id uuid REFERENCES public.hubs(id) ON DELETE SET NULL,
  route_id uuid,
  lat double precision,
  lng double precision,
  failure_reason text,
  proof_ref text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX shipment_events_ship_idx ON public.shipment_events (shipment_id, created_at);
GRANT SELECT ON public.shipment_events TO authenticated;
GRANT ALL ON public.shipment_events TO service_role;
ALTER TABLE public.shipment_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events visible with shipment" ON public.shipment_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shipments s WHERE s.id = shipment_id AND public.can_see_shipment(s)));

CREATE OR REPLACE FUNCTION public.ctx(_k text) RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('bnoy.' || _k, true), '') $$;

CREATE OR REPLACE FUNCTION public.shipment_transition_ok(_from public.shipment_status, _to public.shipment_status) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT _from = _to OR CASE _from
    WHEN 'created' THEN _to IN ('pickup_scheduled','assigned','picked_up','hub_received','cancelled')
    WHEN 'pickup_scheduled' THEN _to IN ('assigned','picked_up','cancelled')
    WHEN 'assigned' THEN _to IN ('picked_up','pickup_scheduled','out_for_delivery','cancelled')
    WHEN 'picked_up' THEN _to IN ('hub_received','in_transit','out_for_delivery','cancelled','return_initiated')
    WHEN 'hub_received' THEN _to IN ('sorted','in_transit','out_for_delivery','return_initiated','cancelled')
    WHEN 'sorted' THEN _to IN ('in_transit','out_for_delivery','return_initiated')
    WHEN 'in_transit' THEN _to IN ('hub_received','out_for_delivery','return_initiated')
    WHEN 'out_for_delivery' THEN _to IN ('delivered','failed','return_initiated')
    WHEN 'failed' THEN _to IN ('reattempt','return_initiated','out_for_delivery')
    WHEN 'reattempt' THEN _to IN ('out_for_delivery','return_initiated','hub_received')
    WHEN 'return_initiated' THEN _to IN ('in_transit','hub_received','returned')
    ELSE false END $$;

CREATE OR REPLACE FUNCTION public.shipments_before() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE anchor uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL THEN NEW.created_by := auth.uid(); END IF;
    IF NEW.rider_id IS NOT NULL AND NEW.status = 'created' THEN NEW.status := 'assigned'; END IF;
    IF NEW.cod_amount > 0 THEN NEW.payment_mode := 'cod'; END IF;
    IF NEW.promised_by IS NULL THEN
      NEW.promised_by := NEW.created_at + CASE NEW.service_level WHEN 'same_day' THEN interval '12 hours' WHEN 'express' THEN interval '2 days' ELSE interval '4 days' END;
    END IF;
  ELSE
    IF auth.uid() IS NOT NULL THEN
      NEW.created_by := OLD.created_by; NEW.delivery_otp := OLD.delivery_otp; NEW.tracking_code := OLD.tracking_code;
      IF public.ctx('otp_ok') IS DISTINCT FROM '1' THEN NEW.otp_verified_at := OLD.otp_verified_at; END IF;
      IF NEW.status <> OLD.status AND NOT public.shipment_transition_ok(OLD.status, NEW.status) AND NOT public.has_role(auth.uid(),'admin') THEN
        RAISE EXCEPTION 'Invalid status change: % → %', OLD.status, NEW.status USING ERRCODE = 'check_violation';
      END IF;
      IF NEW.status = 'delivered' AND OLD.status <> 'delivered' AND public.ctx('otp_ok') IS DISTINCT FROM '1' AND NOT public.has_role(auth.uid(),'admin') THEN
        RAISE EXCEPTION 'Delivery needs the customer OTP';
      END IF;
      IF public.get_user_role(auth.uid()) = 'rider' THEN
        NEW.rider_id := OLD.rider_id; NEW.cod_amount := OLD.cod_amount; NEW.hub_id := OLD.hub_id; NEW.merchant_id := OLD.merchant_id;
        IF public.ctx('cod_ok') IS DISTINCT FROM '1' THEN NEW.cod_handover_id := OLD.cod_handover_id; END IF;
      END IF;
    END IF;
    IF NEW.rider_id IS NOT NULL AND OLD.rider_id IS NULL AND NEW.status = 'created' THEN NEW.status := 'assigned'; END IF;
    IF NEW.status = 'delivered' AND OLD.status <> 'delivered' THEN NEW.delivered_at := now(); END IF;
    IF NEW.status = 'failed' AND OLD.status <> 'failed' THEN NEW.attempt_count := OLD.attempt_count + 1; END IF;
    NEW.updated_at := now();
  END IF;
  anchor := COALESCE(NEW.rider_id, NEW.created_by);
  IF anchor IS NOT NULL THEN
    NEW.manager_id := COALESCE(public.chain_role_id(anchor,'manager'), NEW.manager_id);
    NEW.distributor_id := COALESCE(public.chain_role_id(anchor,'distributor'), NEW.distributor_id);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER shipments_before BEFORE INSERT OR UPDATE ON public.shipments FOR EACH ROW EXECUTE FUNCTION public.shipments_before();

CREATE TABLE public.payout_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  rider_delivery numeric NOT NULL DEFAULT 15,
  rider_return numeric NOT NULL DEFAULT 15,
  manager_delivery numeric NOT NULL DEFAULT 3,
  distributor_delivery numeric NOT NULL DEFAULT 2,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.payout_settings (id) VALUES (1);
CREATE TABLE public.payout_bonuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'delivery',
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  rider_bonus numeric NOT NULL DEFAULT 0,
  manager_bonus numeric NOT NULL DEFAULT 0,
  distributor_bonus numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.rider_wallet_txns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  shipment_id uuid REFERENCES public.shipments(id) ON DELETE SET NULL,
  amount numeric NOT NULL,
  kind text NOT NULL DEFAULT 'delivery',
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX wallet_idem ON public.rider_wallet_txns (rider_id, shipment_id, kind) WHERE shipment_id IS NOT NULL;
CREATE TABLE public.rider_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  shipment_id uuid UNIQUE REFERENCES public.shipments(id) ON DELETE SET NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  rated_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.payout_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payout_bonuses TO authenticated;
GRANT SELECT ON public.rider_wallet_txns TO authenticated;
GRANT SELECT, INSERT ON public.rider_ratings TO authenticated;
GRANT ALL ON public.payout_settings, public.payout_bonuses, public.rider_wallet_txns, public.rider_ratings TO service_role;
ALTER TABLE public.payout_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_bonuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rider_wallet_txns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rider_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read pay" ON public.payout_settings FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins edit pay" ON public.payout_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins manage bonuses" ON public.payout_bonuses FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "wallet in scope" ON public.rider_wallet_txns FOR SELECT TO authenticated
  USING (rider_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.is_ancestor(auth.uid(), rider_id));
CREATE POLICY "ratings in scope" ON public.rider_ratings FOR SELECT TO authenticated
  USING (rider_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.is_ancestor(auth.uid(), rider_id));
CREATE POLICY "leads rate riders" ON public.rider_ratings FOR INSERT TO authenticated
  WITH CHECK (rider_id <> auth.uid() AND (public.has_role(auth.uid(),'admin') OR public.is_ancestor(auth.uid(), rider_id)));

CREATE TABLE public.cod_handovers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE DEFAULT ('COD-' || upper(substr(md5(random()::text),1,6))),
  stage text NOT NULL CHECK (stage IN ('rider_to_manager','manager_to_admin')),
  from_user uuid NOT NULL REFERENCES public.profiles(id),
  to_user uuid REFERENCES public.profiles(id),
  expected_amount numeric NOT NULL DEFAULT 0,
  received_amount numeric,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','accepted','mismatch')),
  mismatch_note text,
  shipment_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
ALTER TABLE public.shipments ADD CONSTRAINT shipments_cod_handover_fk FOREIGN KEY (cod_handover_id) REFERENCES public.cod_handovers(id) ON DELETE SET NULL;
CREATE TABLE public.finance_ledger (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entry_type text NOT NULL,
  amount numeric NOT NULL,
  user_id uuid,
  shipment_id uuid,
  handover_id uuid,
  note text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cod_handovers, public.finance_ledger TO authenticated;
GRANT ALL ON public.cod_handovers, public.finance_ledger TO service_role;
ALTER TABLE public.cod_handovers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "handovers in scope" ON public.cod_handovers FOR SELECT TO authenticated
  USING (from_user = auth.uid() OR to_user = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.is_ancestor(auth.uid(), from_user));
CREATE POLICY "ledger in scope" ON public.finance_ledger FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR user_id = auth.uid() OR public.is_ancestor(auth.uid(), user_id));

CREATE TABLE public.audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid DEFAULT auth.uid(),
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  detail jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read audit" ON public.audit_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.return_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('return','cancellation')),
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'requested',
  pickup_address text,
  rider_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid DEFAULT auth.uid(),
  last_lat double precision, last_lng double precision, last_location_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.return_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES public.return_requests(id) ON DELETE CASCADE,
  status text NOT NULL,
  actor_id uuid DEFAULT auth.uid(),
  note text,
  lat double precision, lng double precision,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.return_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES public.return_requests(id) ON DELETE CASCADE,
  path text NOT NULL,
  captured_by uuid DEFAULT auth.uid(),
  lat double precision, lng double precision, accuracy_m double precision,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.return_requests TO authenticated;
GRANT SELECT, INSERT ON public.return_events, public.return_photos TO authenticated;
GRANT ALL ON public.return_requests, public.return_events, public.return_photos TO service_role;
ALTER TABLE public.return_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_photos ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_see_return(_return_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.return_requests r JOIN public.shipments s ON s.id = r.shipment_id
    WHERE r.id = _return_id AND (r.rider_id = auth.uid() OR r.created_by = auth.uid() OR public.can_see_shipment(s))) $$;

CREATE POLICY "returns in scope" ON public.return_requests FOR SELECT TO authenticated USING (public.can_see_return(id));
CREATE POLICY "request returns for visible shipments" ON public.return_requests FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.shipments s WHERE s.id = shipment_id AND public.can_see_shipment(s)));
CREATE POLICY "update returns in scope" ON public.return_requests FOR UPDATE TO authenticated USING (public.can_see_return(id));
CREATE POLICY "return events in scope" ON public.return_events FOR SELECT TO authenticated USING (public.can_see_return(return_id));
CREATE POLICY "return photos in scope" ON public.return_photos FOR SELECT TO authenticated USING (public.can_see_return(return_id));
CREATE POLICY "add return photos" ON public.return_photos FOR INSERT TO authenticated WITH CHECK (public.can_see_return(return_id));

CREATE OR REPLACE FUNCTION public.return_after() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.return_events (return_id, status, actor_id, lat, lng)
    VALUES (NEW.id, NEW.status, auth.uid(), NEW.last_lat, NEW.last_lng);
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.kind = 'return' AND NEW.status = 'picked_up' THEN
      PERFORM set_config('bnoy.scan_source','return_pickup', true);
      UPDATE public.shipments SET status = 'return_initiated' WHERE id = NEW.shipment_id AND status IN ('picked_up','hub_received','sorted','in_transit','out_for_delivery','failed','reattempt');
    ELSIF NEW.kind = 'return' AND NEW.status = 'received' THEN
      PERFORM set_config('bnoy.scan_source','return_desk', true);
      UPDATE public.shipments SET status = 'return_initiated' WHERE id = NEW.shipment_id AND status IN ('picked_up','hub_received','sorted','in_transit','out_for_delivery','failed','reattempt','delivered');
      UPDATE public.shipments SET status = 'returned' WHERE id = NEW.shipment_id AND status = 'return_initiated';
    ELSIF NEW.kind = 'cancellation' AND NEW.status IN ('approved','received') THEN
      UPDATE public.shipments SET status = 'cancelled' WHERE id = NEW.shipment_id AND status IN ('created','pickup_scheduled','assigned','picked_up','hub_received');
    END IF;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER return_after AFTER INSERT OR UPDATE ON public.return_requests FOR EACH ROW EXECUTE FUNCTION public.return_after();

CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  scopes text[] NOT NULL DEFAULT ARRAY['shipments:read','shipments:write'],
  merchant_id uuid REFERENCES public.merchants(id) ON DELETE SET NULL,
  created_by uuid NOT NULL,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.webhook_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL,
  secret text NOT NULL,
  events text[] NOT NULL DEFAULT ARRAY['shipment.created','shipment.status_changed'],
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  last_status integer,
  last_delivery_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.webhook_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id uuid NOT NULL REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
  event text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 6,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX webhook_outbox_due ON public.webhook_outbox (status, next_attempt_at);
CREATE TABLE public.webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id uuid NOT NULL REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
  outbox_id uuid REFERENCES public.webhook_outbox(id) ON DELETE SET NULL,
  event text NOT NULL,
  attempt integer NOT NULL DEFAULT 1,
  ok boolean NOT NULL DEFAULT false,
  status_code integer,
  error text,
  duration_ms integer,
  request_body jsonb,
  response_body text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.api_keys TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhook_endpoints TO authenticated;
GRANT SELECT ON public.webhook_outbox, public.webhook_deliveries TO authenticated;
GRANT ALL ON public.api_keys, public.webhook_endpoints, public.webhook_outbox, public.webhook_deliveries TO service_role;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins api keys" ON public.api_keys FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins revoke keys" ON public.api_keys FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins webhooks" ON public.webhook_endpoints FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins outbox" ON public.webhook_outbox FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins deliveries" ON public.webhook_deliveries FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.partner_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.courier_partners(id) ON DELETE CASCADE,
  external_order_id text NOT NULL,
  order_data jsonb NOT NULL DEFAULT '{}',
  source text NOT NULL DEFAULT 'webhook',
  shipment_id uuid REFERENCES public.shipments(id) ON DELETE SET NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (partner_id, external_order_id)
);
CREATE TABLE public.integration_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.courier_partners(id) ON DELETE CASCADE,
  event_key text NOT NULL,
  event_type text NOT NULL,
  outcome text NOT NULL,
  message text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (partner_id, event_key)
);
CREATE TABLE public.providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  description text NOT NULL DEFAULT '',
  mode text NOT NULL DEFAULT 'setup_required',
  enabled boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_orders, public.integration_events, public.providers TO authenticated;
GRANT ALL ON public.partner_orders, public.integration_events, public.providers TO service_role;
ALTER TABLE public.partner_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins partner orders" ON public.partner_orders FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins integration events" ON public.integration_events FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "staff read providers" ON public.providers FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage providers" ON public.providers FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.enqueue_webhook(_event text, _data jsonb) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.webhook_outbox (endpoint_id, event, payload)
  SELECT e.id, _event, jsonb_build_object('event', _event, 'created_at', now(), 'data', _data)
  FROM public.webhook_endpoints e WHERE e.active AND _event = ANY (e.events) $$;

CREATE OR REPLACE FUNCTION public.credit_wallet(_user uuid, _ship uuid, _amount numeric, _kind text, _note text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _user IS NULL OR _amount IS NULL OR _amount <= 0 THEN RETURN; END IF;
  INSERT INTO public.rider_wallet_txns (rider_id, shipment_id, amount, kind, note) VALUES (_user, _ship, _amount, _kind, _note)
  ON CONFLICT DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.shipments_after() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ps public.payout_settings; rb numeric := 0; mb numeric := 0; db numeric := 0; payload jsonb;
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.shipment_events (shipment_id, status, from_status, actor_id, scan_source, hub_id, route_id, lat, lng, failure_reason, proof_ref, note)
    VALUES (NEW.id, NEW.status, CASE WHEN TG_OP = 'UPDATE' THEN OLD.status END, auth.uid(),
      COALESCE(public.ctx('scan_source'), CASE WHEN TG_OP = 'INSERT' THEN 'booking' ELSE 'manual' END),
      COALESCE(public.ctx('hub_id')::uuid, NEW.hub_id), NEW.route_id,
      public.ctx('lat')::double precision, public.ctx('lng')::double precision,
      CASE WHEN NEW.status = 'failed' THEN NEW.failure_reason END, public.ctx('proof'), public.ctx('note'));
    payload := jsonb_build_object('id', NEW.id, 'tracking_code', NEW.tracking_code, 'status', NEW.status,
      'external_order_id', NEW.external_order_id, 'city', NEW.city, 'updated_at', NEW.updated_at);
    PERFORM public.enqueue_webhook(CASE WHEN TG_OP = 'INSERT' THEN 'shipment.created' ELSE 'shipment.status_changed' END, payload);
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('delivered','returned') THEN
    SELECT * INTO ps FROM public.payout_settings WHERE id = 1;
    SELECT COALESCE(sum(rider_bonus),0), COALESCE(sum(manager_bonus),0), COALESCE(sum(distributor_bonus),0) INTO rb, mb, db
      FROM public.payout_bonuses WHERE active AND current_date BETWEEN starts_on AND ends_on
      AND kind = CASE WHEN NEW.status = 'delivered' THEN 'delivery' ELSE 'return' END;
    IF NEW.status = 'delivered' THEN
      PERFORM public.credit_wallet(NEW.rider_id, NEW.id, ps.rider_delivery + rb, 'delivery', 'Delivery ' || NEW.tracking_code);
      PERFORM public.credit_wallet(NEW.manager_id, NEW.id, ps.manager_delivery + mb, 'manager_commission', 'Team delivery ' || NEW.tracking_code);
      PERFORM public.credit_wallet(NEW.distributor_id, NEW.id, ps.distributor_delivery + db, 'distributor_commission', 'Network delivery ' || NEW.tracking_code);
      IF NEW.cod_amount > 0 AND NEW.cod_collected THEN
        INSERT INTO public.finance_ledger (entry_type, amount, user_id, shipment_id, note)
        VALUES ('cod_collected', NEW.cod_amount, NEW.rider_id, NEW.id, 'COD collected at doorstep');
      END IF;
    ELSE
      PERFORM public.credit_wallet(NEW.rider_id, NEW.id, ps.rider_return + rb, 'return', 'Return ' || NEW.tracking_code);
    END IF;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER shipments_after AFTER INSERT OR UPDATE ON public.shipments FOR EACH ROW EXECUTE FUNCTION public.shipments_after();

CREATE OR REPLACE FUNCTION public.track_shipment(_code text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'tracking_code', s.tracking_code, 'status', s.status, 'city', s.city,
    'receiver', split_part(s.receiver_name, ' ', 1),
    'created_at', s.created_at, 'updated_at', s.updated_at, 'delivered_at', s.delivered_at, 'promised_by', s.promised_by,
    'events', COALESCE((SELECT jsonb_agg(jsonb_build_object('status', e.status, 'at', e.created_at, 'hub', h.city) ORDER BY e.created_at)
       FROM public.shipment_events e LEFT JOIN public.hubs h ON h.id = e.hub_id WHERE e.shipment_id = s.id), '[]'::jsonb))
  FROM public.shipments s
  WHERE length(_code) BETWEEN 4 AND 80 AND (upper(s.tracking_code) = upper(trim(_code)) OR s.external_order_id = trim(_code) OR s.partner_awb = trim(_code))
  LIMIT 1 $$;

CREATE OR REPLACE FUNCTION public.claim_shipment(_code text) RETURNS public.shipments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.shipments; me public.app_role := public.get_user_role(auth.uid());
BEGIN
  IF me IS DISTINCT FROM 'rider' THEN RAISE EXCEPTION 'Only riders can claim parcels'; END IF;
  SELECT * INTO s FROM public.shipments WHERE upper(tracking_code) = upper(trim(_code)) OR id::text = lower(trim(_code)) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Parcel not found'; END IF;
  IF s.rider_id = auth.uid() THEN RETURN s; END IF;
  IF s.rider_id IS NOT NULL THEN RAISE EXCEPTION 'Parcel already assigned to another rider'; END IF;
  IF s.status NOT IN ('created','pickup_scheduled','hub_received','sorted','reattempt') THEN RAISE EXCEPTION 'Parcel is % and cannot be claimed', s.status; END IF;
  IF s.created_by IS NOT NULL AND NOT public.is_ancestor(s.created_by, auth.uid()) AND NOT public.has_role(s.created_by, 'admin') THEN
    RAISE EXCEPTION 'Parcel belongs to another network';
  END IF;
  PERFORM set_config('bnoy.scan_source','rider_scan', true);
  UPDATE public.shipments SET rider_id = auth.uid(), status = CASE WHEN status IN ('created','pickup_scheduled') THEN 'assigned'::public.shipment_status ELSE status END
    WHERE id = s.id RETURNING * INTO s;
  RETURN s;
END $$;

CREATE OR REPLACE FUNCTION public.scan_transition(_code text, _to public.shipment_status, _source text DEFAULT 'camera', _hub uuid DEFAULT NULL, _lat double precision DEFAULT NULL, _lng double precision DEFAULT NULL, _note text DEFAULT NULL, _failure text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.shipments;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  SELECT * INTO s FROM public.shipments WHERE upper(tracking_code) = upper(trim(_code)) OR id::text = lower(trim(_code)) FOR UPDATE;
  IF NOT FOUND OR NOT public.can_see_shipment(s) THEN RAISE EXCEPTION 'Parcel not found in your network'; END IF;
  IF _to = 'delivered' THEN RAISE EXCEPTION 'Delivery needs the customer OTP — open the parcel to confirm'; END IF;
  IF s.status = _to THEN
    RETURN jsonb_build_object('duplicate', true, 'shipment', to_jsonb(s));
  END IF;
  IF NOT public.shipment_transition_ok(s.status, _to) THEN
    RAISE EXCEPTION 'Cannot move % from % to %', s.tracking_code, s.status, _to;
  END IF;
  IF _to = 'failed' AND coalesce(trim(_failure),'') = '' THEN RAISE EXCEPTION 'Pick a failure reason'; END IF;
  PERFORM set_config('bnoy.scan_source', left(coalesce(_source,'camera'),30), true);
  PERFORM set_config('bnoy.hub_id', coalesce(_hub::text,''), true);
  PERFORM set_config('bnoy.lat', coalesce(_lat::text,''), true);
  PERFORM set_config('bnoy.lng', coalesce(_lng::text,''), true);
  PERFORM set_config('bnoy.note', left(coalesce(_note,''),300), true);
  UPDATE public.shipments SET status = _to, hub_id = coalesce(_hub, hub_id),
    failure_reason = CASE WHEN _to = 'failed' THEN left(_failure,200) ELSE failure_reason END
    WHERE id = s.id RETURNING * INTO s;
  RETURN jsonb_build_object('duplicate', false, 'shipment', to_jsonb(s));
END $$;

CREATE OR REPLACE FUNCTION public.send_delivery_otp(_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.shipments;
BEGIN
  SELECT * INTO s FROM public.shipments WHERE id = _id;
  IF NOT FOUND OR NOT public.can_see_shipment(s) THEN RAISE EXCEPTION 'Parcel not found'; END IF;
  IF s.otp_sent_at IS NOT NULL AND s.otp_sent_at > now() - interval '30 seconds' THEN RAISE EXCEPTION 'Please wait 30 seconds before resending'; END IF;
  UPDATE public.shipments SET otp_sent_at = now(), otp_attempts = 0 WHERE id = _id;
  RETURN jsonb_build_object('sms_configured', false, 'demo_code', CASE WHEN s.is_demo THEN s.delivery_otp END);
END $$;

CREATE OR REPLACE FUNCTION public.deliver_with_otp(_id uuid, _otp text, _lat double precision DEFAULT NULL, _lng double precision DEFAULT NULL, _collected_cod boolean DEFAULT true)
RETURNS public.shipments LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.shipments;
BEGIN
  SELECT * INTO s FROM public.shipments WHERE id = _id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_see_shipment(s) THEN RAISE EXCEPTION 'Parcel not found'; END IF;
  IF s.status <> 'out_for_delivery' THEN RAISE EXCEPTION 'Parcel must be out for delivery (now %)', s.status; END IF;
  IF s.otp_attempts >= 5 THEN RAISE EXCEPTION 'Too many wrong attempts — resend the OTP'; END IF;
  IF trim(_otp) <> s.delivery_otp THEN
    UPDATE public.shipments SET otp_attempts = otp_attempts + 1 WHERE id = _id;
    RETURN NULL;
  END IF;
  PERFORM set_config('bnoy.otp_ok','1', true);
  PERFORM set_config('bnoy.scan_source','otp', true);
  PERFORM set_config('bnoy.proof','otp', true);
  PERFORM set_config('bnoy.lat', coalesce(_lat::text,''), true);
  PERFORM set_config('bnoy.lng', coalesce(_lng::text,''), true);
  UPDATE public.shipments SET status = 'delivered', otp_verified_at = now(),
    cod_collected = CASE WHEN cod_amount > 0 THEN _collected_cod ELSE cod_collected END
    WHERE id = _id RETURNING * INTO s;
  RETURN s;
END $$;

CREATE OR REPLACE FUNCTION public.cancel_with_otp(_id uuid, _otp text, _reason text)
RETURNS public.shipments LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.shipments;
BEGIN
  SELECT * INTO s FROM public.shipments WHERE id = _id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_see_shipment(s) THEN RAISE EXCEPTION 'Parcel not found'; END IF;
  IF s.status NOT IN ('created','pickup_scheduled','assigned','picked_up','hub_received','out_for_delivery','failed','reattempt') THEN RAISE EXCEPTION 'Parcel is % and cannot be cancelled', s.status; END IF;
  IF coalesce(trim(_reason),'') = '' THEN RAISE EXCEPTION 'Reason required'; END IF;
  IF s.otp_attempts >= 5 THEN RAISE EXCEPTION 'Too many wrong attempts — resend the OTP'; END IF;
  IF trim(_otp) <> s.delivery_otp THEN
    UPDATE public.shipments SET otp_attempts = otp_attempts + 1 WHERE id = _id;
    RETURN NULL;
  END IF;
  PERFORM set_config('bnoy.scan_source','otp_cancel', true);
  PERFORM set_config('bnoy.note', left(_reason,300), true);
  -- out_for_delivery / failed parcels go back as returns; earlier ones cancel
  IF s.status IN ('out_for_delivery','failed','reattempt') THEN
    UPDATE public.shipments SET status = 'return_initiated', notes = coalesce(notes,'') || ' | Refused: ' || left(_reason,300) WHERE id = _id RETURNING * INTO s;
  ELSE
    UPDATE public.shipments SET status = 'cancelled', notes = coalesce(notes,'') || ' | Cancelled: ' || left(_reason,300) WHERE id = _id RETURNING * INTO s;
  END IF;
  RETURN s;
END $$;

CREATE OR REPLACE FUNCTION public.duplicate_shipment(_id uuid, _copies integer) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.shipments; n integer := LEAST(GREATEST(coalesce(_copies,1),1),1000);
BEGIN
  SELECT * INTO s FROM public.shipments WHERE id = _id;
  IF NOT FOUND OR NOT public.can_see_shipment(s) THEN RAISE EXCEPTION 'Parcel not found'; END IF;
  IF public.get_user_role(auth.uid()) = 'rider' THEN RAISE EXCEPTION 'Riders cannot book parcels'; END IF;
  INSERT INTO public.shipments (sender_name, sender_phone, receiver_name, receiver_phone, receiver_address, city, pincode, weight_kg, cod_amount, notes, merchant_id, hub_id, service_level, package_type, is_demo, created_by)
  SELECT s.sender_name, s.sender_phone, s.receiver_name, s.receiver_phone, s.receiver_address, s.city, s.pincode, s.weight_kg, s.cod_amount, s.notes, s.merchant_id, s.hub_id, s.service_level, s.package_type, s.is_demo, auth.uid()
  FROM generate_series(1, n);
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.seed_demo_orders(_count integer, _city text DEFAULT NULL, _lot uuid DEFAULT NULL) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer := LEAST(GREATEST(coalesce(_count,1),1),500);
BEGIN
  IF auth.uid() IS NULL OR public.get_user_role(auth.uid()) = 'rider' THEN RAISE EXCEPTION 'Not allowed'; END IF;
  INSERT INTO public.shipments (sender_name, sender_phone, receiver_name, receiver_phone, receiver_address, city, pincode, weight_kg, cod_amount, lot_id, is_demo, notes, created_by)
  SELECT (ARRAY['Meesho Seller Hub','Flipkart Marketplace','Shopify Store','Local Kirana Mart'])[1 + floor(random()*4)::int],
    '98' || lpad(floor(random()*1e8)::bigint::text, 8, '0'),
    (ARRAY['Aarav Sharma','Priya Verma','Rohit Singh','Neha Gupta','Vikram Rathore','Pooja Meena'])[1 + floor(random()*6)::int],
    '9' || lpad(floor(random()*1e9)::bigint::text, 9, '0'),
    (1 + floor(random()*250)::int) || ', Ward ' || (1 + floor(random()*30)::int) || ', Main Bazaar',
    coalesce(nullif(trim(_city),''), (ARRAY['Gharsana','Anupgarh','Suratgarh','Sri Ganganagar'])[1 + floor(random()*4)::int]),
    '335' || lpad(floor(random()*1000)::int::text, 3, '0'),
    round((0.2 + random()*5)::numeric, 2),
    CASE WHEN random() < 0.6 THEN 100 + floor(random()*30)::int * 50 ELSE 0 END,
    _lot, true, 'DEMO ORDER', auth.uid()
  FROM generate_series(1, n);
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.import_partner_order(_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.partner_orders; d jsonb; sid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin access required'; END IF;
  SELECT * INTO o FROM public.partner_orders WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF o.shipment_id IS NOT NULL THEN RETURN o.shipment_id; END IF;
  d := o.order_data;
  INSERT INTO public.shipments (sender_name, sender_phone, receiver_name, receiver_phone, receiver_address, city, pincode, weight_kg, cod_amount, external_order_id, courier_partner_id, created_by)
  VALUES (coalesce(nullif(d->>'sender_name',''),'Partner order'), d->>'sender_phone', d->>'receiver_name', d->>'receiver_phone', d->>'receiver_address', d->>'city', d->>'pincode',
    coalesce((d->>'weight_kg')::numeric, 0.5), coalesce((d->>'cod_amount')::numeric, 0), o.external_order_id, o.partner_id, auth.uid())
  RETURNING id INTO sid;
  UPDATE public.partner_orders SET shipment_id = sid WHERE id = _id;
  RETURN sid;
END $$;

CREATE OR REPLACE FUNCTION public.submit_cod_handover() RETURNS public.cod_handovers
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me public.app_role := public.get_user_role(auth.uid()); h public.cod_handovers; total numeric; cnt integer; target uuid; stg text;
BEGIN
  IF me = 'rider' THEN
    stg := 'rider_to_manager';
    target := public.chain_role_id((SELECT parent_id FROM public.profiles WHERE id = auth.uid()), 'manager');
    IF target IS NULL THEN target := (SELECT parent_id FROM public.profiles WHERE id = auth.uid()); END IF;
    SELECT coalesce(sum(cod_amount),0), count(*) INTO total, cnt FROM public.shipments
      WHERE rider_id = auth.uid() AND status = 'delivered' AND cod_collected AND cod_amount > 0 AND cod_handover_id IS NULL;
  ELSIF me IN ('manager','distributor') THEN
    stg := 'manager_to_admin'; target := NULL;
    SELECT coalesce(sum(expected_amount),0), coalesce(sum(shipment_count),0)::int INTO total, cnt FROM public.cod_handovers c
      WHERE c.to_user = auth.uid() AND c.status = 'accepted' AND c.stage = 'rider_to_manager'
      AND NOT EXISTS (SELECT 1 FROM public.finance_ledger l WHERE l.handover_id = c.id AND l.entry_type = 'forwarded');
  ELSE RAISE EXCEPTION 'Admins receive settlements, they do not submit them';
  END IF;
  IF cnt = 0 THEN RAISE EXCEPTION 'Nothing to hand over'; END IF;
  INSERT INTO public.cod_handovers (stage, from_user, to_user, expected_amount, shipment_count)
  VALUES (stg, auth.uid(), target, total, cnt) RETURNING * INTO h;
  IF me = 'rider' THEN
    PERFORM set_config('bnoy.cod_ok','1', true);
    UPDATE public.shipments SET cod_handover_id = h.id
      WHERE rider_id = auth.uid() AND status = 'delivered' AND cod_collected AND cod_amount > 0 AND cod_handover_id IS NULL;
  ELSE
    INSERT INTO public.finance_ledger (entry_type, amount, user_id, handover_id, note)
    SELECT 'forwarded', c.expected_amount, auth.uid(), c.id, 'Forwarded in ' || h.code FROM public.cod_handovers c
      WHERE c.to_user = auth.uid() AND c.status = 'accepted' AND c.stage = 'rider_to_manager'
      AND NOT EXISTS (SELECT 1 FROM public.finance_ledger l WHERE l.handover_id = c.id AND l.entry_type = 'forwarded');
  END IF;
  INSERT INTO public.finance_ledger (entry_type, amount, user_id, handover_id, note) VALUES ('handover_submitted', total, auth.uid(), h.id, stg);
  RETURN h;
END $$;

CREATE OR REPLACE FUNCTION public.resolve_cod_handover(_id uuid, _received numeric, _note text DEFAULT NULL) RETURNS public.cod_handovers
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE h public.cod_handovers;
BEGIN
  SELECT * INTO h FROM public.cod_handovers WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Handover not found'; END IF;
  IF h.status <> 'submitted' THEN RAISE EXCEPTION 'Already resolved'; END IF;
  IF h.from_user = auth.uid() THEN RAISE EXCEPTION 'You cannot receive your own handover'; END IF;
  IF NOT (h.to_user = auth.uid() OR public.has_role(auth.uid(),'admin') OR (h.to_user IS NOT NULL AND public.is_ancestor(auth.uid(), h.to_user))) THEN
    RAISE EXCEPTION 'Not your settlement to receive';
  END IF;
  IF h.stage = 'manager_to_admin' AND NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Only admins receive manager settlements'; END IF;
  IF _received IS NULL OR _received < 0 THEN RAISE EXCEPTION 'Enter the cash received'; END IF;
  IF _received <> h.expected_amount AND coalesce(trim(_note),'') = '' THEN RAISE EXCEPTION 'Add a note explaining the mismatch'; END IF;
  UPDATE public.cod_handovers SET received_amount = _received, status = CASE WHEN _received = expected_amount THEN 'accepted' ELSE 'mismatch' END,
    mismatch_note = nullif(trim(_note),''), resolved_at = now(), to_user = coalesce(to_user, auth.uid())
    WHERE id = _id RETURNING * INTO h;
  INSERT INTO public.finance_ledger (entry_type, amount, user_id, handover_id, note)
  VALUES (CASE WHEN h.status = 'accepted' THEN 'handover_accepted' ELSE 'handover_mismatch' END, _received, h.from_user, h.id, h.mismatch_note);
  INSERT INTO public.audit_log (action, entity, entity_id, detail) VALUES ('cod.resolve', 'cod_handovers', h.id::text, jsonb_build_object('expected', h.expected_amount, 'received', _received));
  RETURN h;
END $$;

CREATE OR REPLACE FUNCTION public.audit_row() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.audit_log (action, entity, entity_id, detail)
  VALUES (lower(TG_OP), TG_TABLE_NAME, COALESCE((CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END)->>'id', ''),
    CASE WHEN TG_OP = 'UPDATE' THEN jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW)) WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END - 'key_hash');
  RETURN NULL;
END $$;
CREATE TRIGGER audit_payout_settings AFTER UPDATE ON public.payout_settings FOR EACH ROW EXECUTE FUNCTION public.audit_row();
CREATE TRIGGER audit_payout_bonuses AFTER INSERT OR UPDATE OR DELETE ON public.payout_bonuses FOR EACH ROW EXECUTE FUNCTION public.audit_row();
CREATE TRIGGER audit_hubs AFTER INSERT OR UPDATE OR DELETE ON public.hubs FOR EACH ROW EXECUTE FUNCTION public.audit_row();
CREATE TRIGGER audit_vehicles AFTER INSERT OR UPDATE OR DELETE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.audit_row();
CREATE TRIGGER audit_merchants AFTER INSERT OR UPDATE OR DELETE ON public.merchants FOR EACH ROW EXECUTE FUNCTION public.audit_row();
CREATE TRIGGER audit_user_roles AFTER INSERT OR UPDATE OR DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.audit_row();

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon, public;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.enqueue_webhook(text, jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.credit_wallet(uuid, uuid, numeric, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.track_shipment(text) TO anon;

CREATE POLICY "return photos read in scope" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'return-photos' AND public.can_see_return(((storage.foldername(name))[1])::uuid));
CREATE POLICY "return photos upload in scope" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'return-photos' AND public.can_see_return(((storage.foldername(name))[1])::uuid));
