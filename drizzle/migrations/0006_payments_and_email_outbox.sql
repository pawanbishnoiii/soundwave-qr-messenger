ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS receiver_email text;

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  gateway text NOT NULL CHECK (gateway IN ('razorpay','stripe','paytm')),
  amount numeric NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed')),
  gateway_order_id text,
  gateway_payment_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);
CREATE INDEX IF NOT EXISTS payments_shipment_idx ON public.payments(shipment_id);
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "see payments of visible shipments" ON public.payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shipments s WHERE s.id = shipment_id AND public.can_see_shipment(s.*)));

CREATE TABLE IF NOT EXISTS public.email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid REFERENCES public.shipments(id) ON DELETE CASCADE,
  kind text NOT NULL,
  to_email text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed','skipped')),
  attempts int NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  UNIQUE (shipment_id, kind)
);
GRANT SELECT ON public.email_outbox TO authenticated;
GRANT ALL ON public.email_outbox TO service_role;
ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read email outbox" ON public.email_outbox FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.queue_milestone_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.receiver_email IS NULL OR NEW.receiver_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RETURN NEW; END IF;
  k := CASE NEW.status WHEN 'in_transit' THEN 'dispatched' WHEN 'out_for_delivery' THEN 'out_for_delivery'
       WHEN 'delivered' THEN 'delivered' WHEN 'failed' THEN 'failed' ELSE NULL END;
  IF k IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.email_outbox(shipment_id, kind, to_email)
  VALUES (NEW.id, CASE WHEN k = 'failed' THEN 'failed_' || NEW.attempt_count ELSE k END, NEW.receiver_email)
  ON CONFLICT (shipment_id, kind) DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_queue_milestone_email ON public.shipments;
CREATE TRIGGER trg_queue_milestone_email AFTER UPDATE OF status ON public.shipments
FOR EACH ROW EXECUTE FUNCTION public.queue_milestone_email();