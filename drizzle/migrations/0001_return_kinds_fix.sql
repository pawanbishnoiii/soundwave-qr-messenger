UPDATE public.return_requests SET kind = 'customer_return' WHERE kind = 'return';
ALTER TABLE public.return_requests DROP CONSTRAINT return_requests_kind_check;
ALTER TABLE public.return_requests ADD CONSTRAINT return_requests_kind_check CHECK (kind IN ('customer_return','rto','cancellation','return'));
CREATE OR REPLACE FUNCTION public.return_after()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.return_events (return_id, status, actor_id, lat, lng)
    VALUES (NEW.id, NEW.status, auth.uid(), NEW.last_lat, NEW.last_lng);
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.kind <> 'cancellation' AND NEW.status = 'picked_up' THEN
      PERFORM set_config('bnoy.scan_source','return_pickup', true);
      UPDATE public.shipments SET status = 'return_initiated' WHERE id = NEW.shipment_id AND status IN ('picked_up','hub_received','sorted','in_transit','out_for_delivery','failed','reattempt');
    ELSIF NEW.kind <> 'cancellation' AND NEW.status = 'received' THEN
      PERFORM set_config('bnoy.scan_source','return_desk', true);
      UPDATE public.shipments SET status = 'return_initiated' WHERE id = NEW.shipment_id AND status IN ('picked_up','hub_received','sorted','in_transit','out_for_delivery','failed','reattempt','delivered');
      UPDATE public.shipments SET status = 'returned' WHERE id = NEW.shipment_id AND status = 'return_initiated';
    ELSIF NEW.kind = 'cancellation' AND NEW.status IN ('approved','received') THEN
      UPDATE public.shipments SET status = 'cancelled' WHERE id = NEW.shipment_id AND status IN ('created','pickup_scheduled','assigned','picked_up','hub_received');
    END IF;
  END IF;
  RETURN NULL;
END $function$;