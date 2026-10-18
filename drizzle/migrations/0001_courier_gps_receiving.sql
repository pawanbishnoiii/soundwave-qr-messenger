CREATE TABLE public.staff_locations (
 user_id uuid PRIMARY KEY, lat double precision NOT NULL, lng double precision NOT NULL,
 accuracy double precision NOT NULL, captured_at timestamptz NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
 on_duty boolean NOT NULL DEFAULT false
);
GRANT SELECT,INSERT,UPDATE ON public.staff_locations TO authenticated;
GRANT ALL ON public.staff_locations TO service_role;
ALTER TABLE public.staff_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff save own location" ON public.staff_locations FOR ALL TO authenticated USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid());
CREATE POLICY "Leads read team location" ON public.staff_locations FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.is_ancestor(auth.uid(),user_id));
CREATE FUNCTION public.validate_staff_location() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.lat NOT BETWEEN -90 AND 90 OR NEW.lng NOT BETWEEN -180 AND 180 OR NEW.accuracy<0 OR NEW.lat::text IN ('NaN','Infinity','-Infinity') OR NEW.lng::text IN ('NaN','Infinity','-Infinity') OR NEW.accuracy::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Invalid GPS coordinates'; END IF;
 IF NEW.captured_at < now()-interval '60 seconds' OR NEW.captured_at>now()+interval '5 seconds' THEN RAISE EXCEPTION 'A fresh location is required'; END IF;
 NEW.updated_at:=now(); RETURN NEW;
END $$;
CREATE TRIGGER staff_location_validation BEFORE INSERT OR UPDATE ON public.staff_locations FOR EACH ROW EXECUTE FUNCTION public.validate_staff_location();
CREATE TABLE public.parcel_scan_logs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid NOT NULL, shipment_id uuid REFERENCES public.shipments(id),
 bag_id uuid REFERENCES public.wh_bags(id), code text NOT NULL, kind text NOT NULL,
 lat double precision NOT NULL, lng double precision NOT NULL, accuracy double precision NOT NULL,
 captured_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.parcel_scan_logs TO authenticated;
GRANT ALL ON public.parcel_scan_logs TO service_role;
ALTER TABLE public.parcel_scan_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read authorized scans" ON public.parcel_scan_logs FOR SELECT TO authenticated USING (actor_id=auth.uid() OR public.has_role(auth.uid(),'admin') OR public.is_ancestor(auth.uid(),actor_id));
CREATE FUNCTION public.require_scan_location() RETURNS public.staff_locations LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE fix public.staff_locations;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 SELECT * INTO fix FROM public.staff_locations WHERE user_id=auth.uid();
 IF NOT FOUND OR fix.captured_at<now()-interval '60 seconds' THEN RAISE EXCEPTION 'Enable location and obtain a fresh GPS fix before scanning'; END IF;
 RETURN fix;
END $$;
CREATE FUNCTION public.record_parcel_scan(_code text,_kind text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.shipments; fix public.staff_locations; result uuid;
BEGIN
 fix:=public.require_scan_location();
 SELECT * INTO s FROM public.shipments WHERE upper(tracking_code)=upper(trim(_code));
 IF NOT FOUND OR NOT public.can_see_shipment(s) THEN RAISE EXCEPTION 'Parcel not found in your network'; END IF;
 INSERT INTO public.parcel_scan_logs(actor_id,shipment_id,code,kind,lat,lng,accuracy,captured_at)
 VALUES(auth.uid(),s.id,s.tracking_code,left(_kind,40),fix.lat,fix.lng,fix.accuracy,fix.captured_at) RETURNING id INTO result;
 RETURN result;
END $$;
GRANT EXECUTE ON FUNCTION public.record_parcel_scan(text,text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.record_parcel_scan(text,text) FROM PUBLIC,anon;
CREATE FUNCTION public.shipment_gps_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE fix public.staff_locations;
BEGIN
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 IF NEW.status IS DISTINCT FROM OLD.status OR NEW.lot_id IS DISTINCT FROM OLD.lot_id OR NEW.rider_id IS DISTINCT FROM OLD.rider_id THEN
  fix:=public.require_scan_location();
  PERFORM set_config('bnoy.lat',fix.lat::text,true); PERFORM set_config('bnoy.lng',fix.lng::text,true);
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER shipment_required_gps BEFORE UPDATE ON public.shipments FOR EACH ROW EXECUTE FUNCTION public.shipment_gps_guard();
ALTER TABLE public.wh_bag_items ADD COLUMN IF NOT EXISTS actor_id uuid, ADD COLUMN IF NOT EXISTS accuracy double precision, ADD COLUMN IF NOT EXISTS captured_at timestamptz;
CREATE FUNCTION public.bag_item_scan_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b public.wh_bags; s public.shipments; fix public.staff_locations; sku text;
BEGIN
 IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'warehouse')) THEN RAISE EXCEPTION 'Warehouse staff only'; END IF;
 SELECT * INTO b FROM public.wh_bags WHERE id=coalesce(NEW.bag_id,OLD.bag_id) FOR UPDATE;
 IF b.status<>'open' THEN RAISE EXCEPTION 'Sealed or dispatched bags cannot be changed'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 fix:=public.require_scan_location();
 IF (NEW.shipment_id IS NULL)=(NEW.product_id IS NULL) THEN RAISE EXCEPTION 'Choose exactly one parcel or product'; END IF;
 IF NEW.shipment_id IS NOT NULL THEN
  SELECT * INTO s FROM public.shipments WHERE id=NEW.shipment_id;
  IF NOT public.can_see_shipment(s) THEN RAISE EXCEPTION 'Parcel not in your network'; END IF;
  IF s.status IN ('delivered','returned','cancelled','return_initiated') THEN RAISE EXCEPTION 'Closed parcels cannot be packed'; END IF;
  IF (b.pincode IS NOT NULL AND b.pincode<>coalesce(s.pincode,'')) OR (b.pincode IS NULL AND lower(trim(b.destination))<>lower(trim(s.city))) THEN RAISE EXCEPTION 'Parcel destination does not match this bag'; END IF;
  IF EXISTS(SELECT 1 FROM public.wh_bag_items i JOIN public.wh_bags x ON x.id=i.bag_id WHERE i.shipment_id=NEW.shipment_id AND i.id<>NEW.id AND x.status IN ('open','sealed')) THEN RAISE EXCEPTION 'Parcel already packed in an active bag'; END IF;
  sku:=s.tracking_code;
 ELSE SELECT p.sku INTO sku FROM public.wh_products p WHERE p.id=NEW.product_id; END IF;
 NEW.lat:=fix.lat; NEW.lng:=fix.lng; NEW.accuracy:=fix.accuracy; NEW.captured_at:=fix.captured_at; NEW.actor_id:=auth.uid();
 INSERT INTO public.parcel_scan_logs(actor_id,shipment_id,bag_id,code,kind,lat,lng,accuracy,captured_at) VALUES(auth.uid(),NEW.shipment_id,NEW.bag_id,sku,'bag_in',fix.lat,fix.lng,fix.accuracy,fix.captured_at);
 RETURN NEW;
END $$;
CREATE TRIGGER bag_item_scan_validation BEFORE INSERT OR UPDATE OR DELETE ON public.wh_bag_items FOR EACH ROW EXECUTE FUNCTION public.bag_item_scan_guard();
CREATE TABLE public.receiving_manifests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE, source text NOT NULL DEFAULT 'manual', partner_id uuid REFERENCES public.courier_partners(id),
 bag_reference text, seal_reference text, seal_condition text NOT NULL DEFAULT 'intact', expected_codes text[] NOT NULL,
 receiver_id uuid NOT NULL, created_by uuid NOT NULL, status text NOT NULL DEFAULT 'open', discrepancy_note text,
 created_at timestamptz NOT NULL DEFAULT now(), confirmed_at timestamptz, confirmation_lat double precision, confirmation_lng double precision
);
GRANT SELECT ON public.receiving_manifests TO authenticated;
GRANT ALL ON public.receiving_manifests TO service_role;
ALTER TABLE public.receiving_manifests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read receiving custody" ON public.receiving_manifests FOR SELECT TO authenticated USING (receiver_id=auth.uid() OR created_by=auth.uid() OR public.has_role(auth.uid(),'admin') OR public.is_ancestor(auth.uid(),receiver_id));
CREATE TABLE public.receiving_pieces (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), manifest_id uuid NOT NULL REFERENCES public.receiving_manifests(id),
 shipment_id uuid REFERENCES public.shipments(id), code text NOT NULL, damaged boolean NOT NULL DEFAULT false,
 actor_id uuid NOT NULL, lat double precision NOT NULL, lng double precision NOT NULL, accuracy double precision NOT NULL,
 captured_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(manifest_id,code)
);
GRANT SELECT ON public.receiving_pieces TO authenticated;
GRANT ALL ON public.receiving_pieces TO service_role;
ALTER TABLE public.receiving_pieces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read receipt pieces" ON public.receiving_pieces FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM public.receiving_manifests m WHERE m.id=manifest_id));
CREATE TABLE public.receiving_challenges (manifest_id uuid PRIMARY KEY REFERENCES public.receiving_manifests(id), code_hash text NOT NULL, attempts integer NOT NULL DEFAULT 0, expires_at timestamptz NOT NULL DEFAULT now()+interval '30 minutes');
GRANT ALL ON public.receiving_challenges TO service_role;
ALTER TABLE public.receiving_challenges ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.create_receiving_manifest(_codes text[],_receiver uuid,_bag text DEFAULT '',_seal text DEFAULT '') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE id uuid; code text; otp text; normalized text[];
BEGIN
 IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'distributor') OR public.has_role(auth.uid(),'warehouse')) THEN RAISE EXCEPTION 'Receiving staff only'; END IF;
 PERFORM public.require_scan_location();
 IF NOT (public.has_role(auth.uid(),'admin') OR _receiver=auth.uid() OR public.is_ancestor(auth.uid(),_receiver)) THEN RAISE EXCEPTION 'Receiver outside your team'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_receiver AND role IN ('admin','warehouse','manager','distributor')) THEN RAISE EXCEPTION 'Choose authorized receiving staff'; END IF;
 SELECT array_agg(DISTINCT upper(trim(x))) INTO normalized FROM unnest(_codes) x WHERE trim(x)<>'';
 IF coalesce(cardinality(normalized),0) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'A manifest requires 1 to 500 unique parcels'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(normalized) x WHERE NOT EXISTS(SELECT 1 FROM public.shipments s WHERE s.tracking_code=x AND public.can_see_shipment(s))) THEN RAISE EXCEPTION 'Manifest includes unknown or unauthorized parcels'; END IF;
 code:='IN-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
 otp:=lpad((('x'||encode(gen_random_bytes(3),'hex'))::bit(24)::integer%1000000)::text,6,'0');
 INSERT INTO public.receiving_manifests(code,expected_codes,receiver_id,created_by,bag_reference,seal_reference) VALUES(code,normalized,_receiver,auth.uid(),left(_bag,100),left(_seal,100)) RETURNING receiving_manifests.id INTO id;
 INSERT INTO public.receiving_challenges(manifest_id,code_hash) VALUES(id,encode(digest(otp,'sha256'),'hex'));
 RETURN jsonb_build_object('id',id,'code',code,'handover_code',otp);
END $$;
CREATE FUNCTION public.scan_receiving_piece(_manifest uuid,_code text,_damaged boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.receiving_manifests; s public.shipments; fix public.staff_locations; clean text:=upper(trim(_code));
BEGIN
 SELECT * INTO m FROM public.receiving_manifests WHERE id=_manifest FOR UPDATE;
 IF NOT FOUND OR NOT (m.receiver_id=auth.uid() OR public.has_role(auth.uid(),'admin')) THEN RAISE EXCEPTION 'Only assigned receiving staff can scan this manifest'; END IF;
 IF m.status<>'open' THEN RAISE EXCEPTION 'This receipt is already confirmed'; END IF;
 fix:=public.require_scan_location();
 IF EXISTS(SELECT 1 FROM public.receiving_pieces WHERE manifest_id=m.id AND code=clean) THEN RETURN jsonb_build_object('duplicate',true); END IF;
 SELECT * INTO s FROM public.shipments WHERE tracking_code=clean;
 IF NOT FOUND OR NOT public.can_see_shipment(s) THEN RAISE EXCEPTION 'Unknown or unauthorized parcel'; END IF;
 INSERT INTO public.receiving_pieces(manifest_id,shipment_id,code,damaged,actor_id,lat,lng,accuracy,captured_at) VALUES(m.id,s.id,clean,_damaged,auth.uid(),fix.lat,fix.lng,fix.accuracy,fix.captured_at);
 PERFORM public.record_parcel_scan(clean,'franchise_inward');
 IF clean=ANY(m.expected_codes) AND NOT _damaged AND public.shipment_transition_ok(s.status,'hub_received') THEN
  PERFORM set_config('bnoy.scan_source','franchise_inward',true);
  UPDATE public.shipments SET status='hub_received' WHERE id=s.id;
 END IF;
 RETURN jsonb_build_object('duplicate',false,'expected',clean=ANY(m.expected_codes));
END $$;
CREATE FUNCTION public.confirm_receiving_manifest(_manifest uuid,_otp text,_note text DEFAULT '',_seal_condition text DEFAULT 'intact') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.receiving_manifests; c public.receiving_challenges; fix public.staff_locations; missing integer; extra integer; damaged integer;
BEGIN
 SELECT * INTO m FROM public.receiving_manifests WHERE id=_manifest FOR UPDATE;
 IF NOT FOUND OR m.receiver_id<>auth.uid() THEN RAISE EXCEPTION 'Only assigned receiver can confirm'; END IF;
 IF m.status<>'open' THEN RETURN jsonb_build_object('ok',true,'already_confirmed',true); END IF;
 fix:=public.require_scan_location();
 SELECT * INTO c FROM public.receiving_challenges WHERE manifest_id=m.id FOR UPDATE;
 IF c.expires_at<now() OR c.attempts>=5 THEN RETURN jsonb_build_object('ok',false,'message','Code expired or attempts exhausted'); END IF;
 IF encode(digest(_otp,'sha256'),'hex')<>c.code_hash THEN UPDATE public.receiving_challenges SET attempts=attempts+1 WHERE manifest_id=m.id; RETURN jsonb_build_object('ok',false,'message','Incorrect handover code'); END IF;
 IF _seal_condition NOT IN ('intact','broken','missing') THEN RAISE EXCEPTION 'Invalid seal condition'; END IF;
 SELECT count(*) INTO missing FROM unnest(m.expected_codes) x WHERE NOT EXISTS(SELECT 1 FROM public.receiving_pieces p WHERE p.manifest_id=m.id AND p.code=x);
 SELECT count(*) FILTER(WHERE NOT (p.code=ANY(m.expected_codes))),count(*) FILTER(WHERE p.damaged) INTO extra,damaged FROM public.receiving_pieces p WHERE manifest_id=m.id;
 IF (missing>0 OR extra>0 OR damaged>0 OR _seal_condition<>'intact') AND length(trim(_note))<3 THEN RETURN jsonb_build_object('ok',false,'message','Explain discrepancies before confirming'); END IF;
 UPDATE public.receiving_manifests SET status=CASE WHEN missing+extra+damaged>0 OR _seal_condition<>'intact' THEN 'received_with_exceptions' ELSE 'received' END, discrepancy_note=left(_note,1000),seal_condition=_seal_condition,confirmed_at=now(),confirmation_lat=fix.lat,confirmation_lng=fix.lng WHERE id=m.id;
 RETURN jsonb_build_object('ok',true,'missing',missing,'unexpected',extra,'damaged',damaged);
END $$;
REVOKE EXECUTE ON FUNCTION public.create_receiving_manifest(text[],uuid,text,text),public.scan_receiving_piece(uuid,text,boolean),public.confirm_receiving_manifest(uuid,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_receiving_manifest(text[],uuid,text,text),public.scan_receiving_piece(uuid,text,boolean),public.confirm_receiving_manifest(uuid,text,text,text) TO authenticated;
ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_locations,public.receiving_manifests,public.receiving_pieces,public.parcel_scan_logs;