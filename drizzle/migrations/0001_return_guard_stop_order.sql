CREATE OR REPLACE FUNCTION public.return_needs_attempt_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status IN ('return_initiated','returned') AND OLD.status IS DISTINCT FROM NEW.status
     AND OLD.status NOT IN ('out_for_delivery','failed','reattempt','return_initiated','delivered','in_transit','hub_received')
     AND NOT EXISTS (SELECT 1 FROM public.shipment_events e WHERE e.shipment_id = NEW.id AND e.status = 'out_for_delivery') THEN
    RAISE EXCEPTION 'A parcel can only be returned after a delivery attempt';
  END IF;
  IF NEW.status IN ('return_initiated','returned') AND OLD.status IS DISTINCT FROM NEW.status
     AND NOT EXISTS (SELECT 1 FROM public.shipment_events e WHERE e.shipment_id = NEW.id AND e.status = 'out_for_delivery')
     AND OLD.status <> 'out_for_delivery' THEN
    RAISE EXCEPTION 'A parcel can only be returned after it went out for delivery';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_return_needs_attempt ON public.shipments;
CREATE TRIGGER trg_return_needs_attempt BEFORE UPDATE ON public.shipments
FOR EACH ROW EXECUTE FUNCTION public.return_needs_attempt_guard();

CREATE OR REPLACE FUNCTION public.apply_stop_order(_ids uuid[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE i integer; s public.shipments; n integer := 0;
BEGIN
  IF auth.uid() IS NULL OR public.get_user_role(auth.uid()) = 'rider' THEN RAISE EXCEPTION 'Only team leads can set stop order'; END IF;
  FOR i IN 1 .. coalesce(array_length(_ids,1),0) LOOP
    SELECT * INTO s FROM public.shipments WHERE id = _ids[i];
    IF FOUND AND public.can_see_shipment(s) THEN
      UPDATE public.shipments SET route_seq = i WHERE id = s.id;
      n := n + 1;
    END IF;
  END LOOP;
  RETURN n;
END $$;
GRANT EXECUTE ON FUNCTION public.apply_stop_order(uuid[]) TO authenticated;