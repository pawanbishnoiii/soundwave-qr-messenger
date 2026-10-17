ALTER TABLE public.payout_settings
  ADD COLUMN IF NOT EXISTS franchise_commission_pct numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS manager_commission_pct numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rider_cod_commission_pct numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.rider_bucket_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'delivered' AND OLD.status IS DISTINCT FROM 'out_for_delivery'
     AND auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'rider') THEN
    RAISE EXCEPTION 'Scan this parcel into your delivery bucket first';
  END IF;
  IF NEW.status IN ('returned','return_initiated') AND OLD.status IS DISTINCT FROM NEW.status
     AND auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'rider') THEN
    RAISE EXCEPTION 'Riders can cancel undelivered parcels but cannot mark returns';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_rider_bucket_guard ON public.shipments;
CREATE TRIGGER trg_rider_bucket_guard BEFORE UPDATE OF status ON public.shipments
FOR EACH ROW EXECUTE FUNCTION public.rider_bucket_guard();