
INSERT INTO public.hubs (code, name, kind, address, city, pincode, lat, lng, capacity_per_day, contact_phone, serviceable_pincodes, status) VALUES
 ('SGNR-01','Sri Ganganagar Main Hub','hub','Plot 14, RIICO Industrial Area','Sri Ganganagar','335001',29.9038,73.8772,1200,'+919829000101',ARRAY['335001','335002','335003'],'active'),
 ('SRT-02','Suratgarh Branch','branch','Near Bus Stand, NH-62','Suratgarh','335804',29.3215,73.8998,450,'+919829000102',ARRAY['335804','335805'],'active'),
 ('ANP-03','Anupgarh Branch','branch','Mandi Road, Ward 9','Anupgarh','335701',29.1910,73.2086,300,'+919829000103',ARRAY['335701'],'active'),
 ('GHR-04','Gharsana Dark Store','dark_store','Main Bazaar, Gharsana','Gharsana','335707',29.3360,73.1290,200,'+919829000104',ARRAY['335707','335708'],'active'),
 ('JP-SC','Jaipur Sort Center','sort_center','Sitapura Industrial Area','Jaipur','302022',26.7775,75.8434,5000,'+919829000105',ARRAY['302022','302017','302020'],'active'),
 ('RSN-05','Raisinghnagar Branch','branch','Station Road','Raisinghnagar','335051',29.5360,73.4460,250,'+919829000106',ARRAY['335051'],'paused');

INSERT INTO public.merchants (name, legal_name, gstin, contact_name, contact_phone, contact_email, pickup_address, pickup_city, pickup_pincode, default_hub_id, base_rate, rate_per_kg, cod_fee_pct, integration, status) VALUES
 ('Thar Handloom Co.','Thar Handloom Pvt Ltd','08AABCT1234F1Z5','Meena Kanwar','+919414000201','ops@tharhandloom.example','12 Gole Bazaar','Sri Ganganagar','335001',(SELECT id FROM public.hubs WHERE code='SGNR-01'),35,40,1.5,'api','active'),
 ('Kisan Agro Supplies','Kisan Agro LLP','08AAJFK5678K1Z2','Harpreet Singh','+919414000202','dispatch@kisanagro.example','Mandi Yard, Shed 4','Suratgarh','335804',(SELECT id FROM public.hubs WHERE code='SRT-02'),30,32,1.2,'csv','active'),
 ('Rajputana Mobiles','Rajputana Retail','08AAKPR9012L1Z9','Vikas Jain','+919414000203','store@rajputana.example','Shop 7, Mobile Market','Jaipur','302017',(SELECT id FROM public.hubs WHERE code='JP-SC'),40,45,2.0,'webhook','active'),
 ('Desert Bloom Organics',NULL,NULL,'Sana Qureshi','+919414000204','hello@desertbloom.example','House 33, Ward 5','Anupgarh','335701',(SELECT id FROM public.hubs WHERE code='ANP-03'),35,40,1.5,'manual','onboarding');

INSERT INTO public.vehicles (reg_number, kind, capacity_kg, ownership, hub_id, status, insurance_expiry, puc_expiry) VALUES
 ('RJ13 SM 4021','bike',25,'rider_owned',(SELECT id FROM public.hubs WHERE code='SGNR-01'),'available', current_date + 210, current_date + 60),
 ('RJ13 EV 1180','ev_scooter',30,'leased',(SELECT id FROM public.hubs WHERE code='SGNR-01'),'available', current_date + 300, current_date + 150),
 ('RJ13 GA 7755','three_wheeler',350,'owned',(SELECT id FROM public.hubs WHERE code='SRT-02'),'maintenance', current_date + 20, current_date - 5),
 ('RJ13 GB 2290','van',900,'owned',(SELECT id FROM public.hubs WHERE code='SGNR-01'),'available', current_date + 400, current_date + 90),
 ('RJ14 TC 6612','truck',4000,'leased',(SELECT id FROM public.hubs WHERE code='JP-SC'),'on_route', current_date + 12, current_date + 40),
 ('RJ13 SN 9034','bike',25,'rider_owned',(SELECT id FROM public.hubs WHERE code='ANP-03'),'available', current_date + 150, current_date + 25);

INSERT INTO public.courier_partners (name, adapter, account_reference, connection_status, enabled) VALUES
 ('Demo exchange (sandbox)','demo','sandbox','demo',true),
 ('Shiprocket','shiprocket','','disconnected',false),
 ('Delhivery','delhivery','','disconnected',false);

INSERT INTO public.providers (name, category, description, mode, enabled) VALUES
 ('SMS OTP gateway','sms','Sends delivery and login OTPs. Needs an SMS provider account (e.g. MSG91, Twilio).','setup_required',false),
 ('WhatsApp notifications','whatsapp','Shipment updates on WhatsApp Business. Needs a WhatsApp Business API account.','setup_required',false),
 ('Email notifications','email','Booking, delivery and settlement emails.','setup_required',false),
 ('Maps & geocoding','maps','Map tiles use OpenStreetMap (no key). Geocoding/route optimisation needs a provider key.','partial',true);

-- Demo shipments spread across hubs/merchants and lifecycle stages
WITH src AS (
  SELECT g,
    (ARRAY['Aarav Sharma','Priya Verma','Rohit Singh','Neha Gupta','Vikram Rathore','Pooja Meena','Arjun Jat','Kavita Kaur','Sandeep Sethi','Anjali Agarwal'])[1 + (g % 10)] AS rname,
    (ARRAY['SGNR-01','SRT-02','ANP-03','GHR-04','JP-SC'])[1 + (g % 5)] AS hub,
    (ARRAY['Thar Handloom Co.','Kisan Agro Supplies','Rajputana Mobiles','Desert Bloom Organics'])[1 + (g % 4)] AS merch,
    (ARRAY['standard','standard','express','same_day'])[1 + (g % 4)] AS svc
  FROM generate_series(1, 36) g
)
INSERT INTO public.shipments (sender_name, sender_phone, receiver_name, receiver_phone, receiver_address, city, pincode, weight_kg, cod_amount, merchant_id, hub_id, service_level, package_type, fragile, is_demo, notes, external_order_id, created_at)
SELECT s.merch, '+9194140002' || lpad((g % 4 + 1)::text, 2, '0'), s.rname, '98' || lpad((10000000 + g * 7919)::text, 8, '0'),
  (10 + g) || ', Ward ' || (1 + g % 30) || ', Near Gurudwara', h.city, h.pincode,
  round((0.3 + (g % 9) * 0.55)::numeric, 2), CASE WHEN g % 3 = 0 THEN 0 ELSE 299 + (g % 7) * 150 END,
  m.id, h.id, s.svc, (ARRAY['parcel','document','fragile_box','apparel'])[1 + (g % 4)], g % 4 = 2, true, 'DEMO ORDER', 'DEMO-' || lpad(g::text, 4, '0'),
  now() - ((36 - g) * interval '3 hours')
FROM src s JOIN public.hubs h ON h.code = s.hub JOIN public.merchants m ON m.name = s.merch;

-- Walk demo parcels through realistic lifecycles (service context: no auth, events recorded)
DO $$
DECLARE r record; path public.shipment_status[]; st public.shipment_status; i int := 0;
BEGIN
  FOR r IN SELECT id FROM public.shipments WHERE is_demo ORDER BY created_at LOOP
    i := i + 1;
    path := CASE i % 9
      WHEN 0 THEN ARRAY['picked_up','hub_received','sorted','out_for_delivery','delivered']::public.shipment_status[]
      WHEN 1 THEN ARRAY['picked_up','hub_received','sorted','out_for_delivery','delivered']::public.shipment_status[]
      WHEN 2 THEN ARRAY['picked_up','hub_received','sorted','out_for_delivery']::public.shipment_status[]
      WHEN 3 THEN ARRAY['picked_up','hub_received']::public.shipment_status[]
      WHEN 4 THEN ARRAY['pickup_scheduled']::public.shipment_status[]
      WHEN 5 THEN ARRAY['picked_up','hub_received','sorted','out_for_delivery','failed']::public.shipment_status[]
      WHEN 6 THEN ARRAY['picked_up','hub_received','sorted','in_transit']::public.shipment_status[]
      WHEN 7 THEN ARRAY['picked_up','hub_received','sorted','out_for_delivery','failed','return_initiated','returned']::public.shipment_status[]
      ELSE ARRAY[]::public.shipment_status[] END;
    FOREACH st IN ARRAY path LOOP
      PERFORM set_config('bnoy.scan_source', CASE st WHEN 'hub_received' THEN 'hub_scan' WHEN 'sorted' THEN 'sort_scan' WHEN 'delivered' THEN 'otp' ELSE 'camera' END, true);
      UPDATE public.shipments SET status = st,
        failure_reason = CASE WHEN st = 'failed' THEN (ARRAY['Customer not reachable','Address incomplete','Customer asked to reschedule'])[1 + i % 3] ELSE failure_reason END,
        cod_collected = CASE WHEN st = 'delivered' AND cod_amount > 0 THEN true ELSE cod_collected END,
        otp_verified_at = CASE WHEN st = 'delivered' THEN now() ELSE otp_verified_at END
      WHERE id = r.id;
    END LOOP;
  END LOOP;
  PERFORM set_config('bnoy.scan_source', '', true);
END $$;

-- spread event timestamps so timelines look like real elapsed time
UPDATE public.shipment_events e SET created_at = s.created_at + (sub.rn - 1) * interval '95 minutes'
FROM public.shipments s, (SELECT id, row_number() OVER (PARTITION BY shipment_id ORDER BY created_at, id) rn FROM public.shipment_events) sub
WHERE e.shipment_id = s.id AND sub.id = e.id AND s.is_demo;
UPDATE public.shipments s SET delivered_at = (SELECT max(created_at) FROM public.shipment_events e WHERE e.shipment_id = s.id AND e.status = 'delivered')
WHERE s.is_demo AND s.status = 'delivered';

INSERT INTO public.return_requests (shipment_id, kind, reason, status, pickup_address)
SELECT id, 'return', 'Size does not fit — customer wants refund', 'requested', receiver_address FROM public.shipments WHERE is_demo AND status = 'delivered' ORDER BY created_at LIMIT 2;

INSERT INTO public.payout_bonuses (name, kind, starts_on, ends_on, rider_bonus, manager_bonus, distributor_bonus, active)
VALUES ('Festive week boost','delivery', current_date - 2, current_date + 5, 5, 1, 1, true);
