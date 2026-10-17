ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS district text,
  ADD COLUMN IF NOT EXISTS pincode text;

ALTER TABLE public.cod_handovers ADD COLUMN IF NOT EXISTS settled_at timestamptz;
COMMENT ON COLUMN public.cod_handovers.settled_at IS 'Set when admin confirms the cash reached the company account';

CREATE TABLE public.wh_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sku text NOT NULL UNIQUE,
  weight_kg numeric NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 0,
  location_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wh_products TO authenticated;
GRANT ALL ON public.wh_products TO service_role;
ALTER TABLE public.wh_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY wh_products_staff ON public.wh_products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'warehouse'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'warehouse'));

CREATE TABLE public.wh_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  pincode text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wh_locations TO authenticated;
GRANT ALL ON public.wh_locations TO service_role;
ALTER TABLE public.wh_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY wh_locations_staff ON public.wh_locations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'warehouse'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'warehouse'));

ALTER TABLE public.wh_products
  ADD CONSTRAINT wh_products_location_fk FOREIGN KEY (location_id) REFERENCES public.wh_locations(id) ON DELETE SET NULL;

CREATE TABLE public.wh_bags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  kind text NOT NULL DEFAULT 'bag' CHECK (kind IN ('bag','box')),
  destination text NOT NULL,
  pincode text,
  hub_id uuid REFERENCES public.hubs(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','sealed','dispatched')),
  sealed_at timestamptz,
  dispatched_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wh_bags TO authenticated;
GRANT ALL ON public.wh_bags TO service_role;
ALTER TABLE public.wh_bags ENABLE ROW LEVEL SECURITY;
CREATE POLICY wh_bags_staff ON public.wh_bags FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'warehouse'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'warehouse'));

CREATE TABLE public.wh_bag_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bag_id uuid NOT NULL REFERENCES public.wh_bags(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.wh_products(id) ON DELETE SET NULL,
  shipment_id uuid REFERENCES public.shipments(id) ON DELETE SET NULL,
  qty integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wh_bag_items TO authenticated;
GRANT ALL ON public.wh_bag_items TO service_role;
ALTER TABLE public.wh_bag_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY wh_bag_items_staff ON public.wh_bag_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'warehouse'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'warehouse'));