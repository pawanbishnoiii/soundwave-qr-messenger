import { describe, it, expect } from 'vitest';
import { partnerSchema, webhookSchema } from '@/lib/courier-schema';
describe('Courier exchange validation',()=>{
 const order={external_order_id:'ORDER-101',receiver_name:'Sample recipient',receiver_phone:'9999999999',receiver_address:'Sample address',city:'Jaipur',pincode:'302001'};
 it('accepts a valid normalized order',()=>expect(webhookSchema.safeParse({event_id:'event-1',orders:[order]}).success).toBe(true));
 it('rejects malformed phones and PIN codes',()=>{expect(webhookSchema.safeParse({event_id:'event-2',orders:[{...order,pincode:'000000'}]}).success).toBe(false);expect(webhookSchema.safeParse({event_id:'event-3',orders:[{...order,receiver_phone:'not-a-phone'}]}).success).toBe(false)});
 it('bounds webhook batches and amounts',()=>{expect(webhookSchema.safeParse({event_id:'event-4',orders:Array(101).fill(order)}).success).toBe(false);expect(webhookSchema.safeParse({event_id:'event-5',orders:[{...order,cod_amount:-1}]}).success).toBe(false)});
 it('rejects unknown adapters and blank names',()=>{expect(partnerSchema.safeParse({name:'',adapter:'demo'}).success).toBe(false);expect(partnerSchema.safeParse({name:'Courier',adapter:'unsupported'}).success).toBe(false)});
});
