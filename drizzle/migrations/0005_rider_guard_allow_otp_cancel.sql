CREATE OR REPLACE FUNCTION public.rider_bucket_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'rider') THEN RETURN NEW; END IF;
  IF NEW.status = 'delivered' AND OLD.status IS DISTINCT FROM 'out_for_delivery' THEN
    RAISE EXCEPTION 'Scan this parcel into your delivery bucket first';
  END IF;
  IF NEW.status IN ('returned','return_initiated') AND OLD.status IS DISTINCT FROM NEW.status
     AND coalesce(current_setting('bnoy.scan_source', true), '') <> 'otp_cancel' THEN
    RAISE EXCEPTION 'Riders can cancel undelivered parcels with the customer OTP but cannot mark returns';
  END IF;
  RETURN NEW;
END $$;