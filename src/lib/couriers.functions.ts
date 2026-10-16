import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
import { partnerSchema, partnerIdSchema, exchangeOrderSchema } from './courier-schema';

export const addCourierPartner=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(v=>partnerSchema.parse(v)).handler(async({data,context})=>{
 const {data:allowed,error:roleError}=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});if(roleError||!allowed)throw new Error('Admin access required');
 const {data:row,error}=await context.supabase.from('courier_partners').insert({...data,created_by:context.userId,connection_status:data.adapter==='demo'?'demo':'disconnected'}).select().single();if(error)throw new Error('Could not save courier partner');return row;
});
export const runCourierAction=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((v:unknown)=>partnerIdSchema.extend({action: z.enum(['test','sync'])}).parse(v)).handler(async({data,context})=>{
 const {data:allowed,error:roleError}=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});if(roleError||!allowed)throw new Error('Admin access required');
 const {data:partner,error}=await context.supabase.from('courier_partners').select('*').eq('id',data.id).single();if(error||!partner)throw new Error('Partner not found');if(!partner.enabled)throw new Error('Partner is disabled');
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 const {data:recent}=await supabaseAdmin.from('integration_events').select('id').eq('partner_id',partner.id).gte('created_at',new Date(Date.now()-60000).toISOString()).limit(6);if((recent?.length??0)>=5)throw new Error('Please wait a minute before trying again');
 let count=0;
 try {
 if(partner.adapter==='demo'){
  if(data.action==='sync'){
   const orders=Array.from({length:3},(_,i)=>({partner_id:partner.id,external_order_id:`DEMO-${partner.id.slice(0,8)}-${i+1}`,source:'demo',order_data:{receiver_name:['Sample recipient A','Sample recipient B','Sample recipient C'][i],receiver_phone:'9999999999',receiver_address:'Sample address — demo data only',city:'Jaipur',pincode:'302001',sender_name:'Demo merchant',weight_kg:1,cod_amount:i===1?850:0}}));
   const {error:e}=await context.supabase.from('partner_orders').upsert(orders,{onConflict:'partner_id,external_order_id',ignoreDuplicates:true});if(e)throw new Error('Could not store sample orders');count=orders.length;
  }
 }else if(partner.adapter==='shiprocket'){
  const email=process.env['SHIPROCKET_EMAIL'];const password=process.env['SHIPROCKET_PASSWORD'];if(!email||!password)throw new Error('Shiprocket credentials are not configured');
  const auth=await fetch('https://apiv2.shiprocket.in/v1/external/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password}),signal:AbortSignal.timeout(15000)});if(!auth.ok)throw new Error('Courier authentication failed');const result=await auth.json() as {token?:string};if(!result.token)throw new Error('Courier authentication failed');
  if(data.action==='sync'){
   const res=await fetch('https://apiv2.shiprocket.in/v1/external/orders?per_page=50&page=1',{headers:{Authorization:`Bearer ${result.token}`},signal:AbortSignal.timeout(15000)});if(!res.ok)throw new Error('Courier order retrieval failed');const body=await res.json() as {data?:Record<string,unknown>[]};if(!Array.isArray(body.data))throw new Error('Courier returned an unsupported order format');
   const rows=body.data.slice(0,50).flatMap(o=>{const id=String(o['id']??'');if(!id)return [];const normalized=exchangeOrderSchema.safeParse({external_order_id:id,receiver_name:o['customer_name'],receiver_phone:String(o['customer_phone']??''),receiver_address:o['customer_address'],city:o['customer_city'],pincode:String(o['customer_pincode']??''),weight_kg:1,cod_amount:0});return [{partner_id:partner.id,external_order_id:id,source:'api',order_data:normalized.success?{...normalized.data,review_required:true}:{external_order_id:id,receiver_name:String(o['customer_name']??''),receiver_phone:String(o['customer_phone']??''),receiver_address:String(o['customer_address']??''),city:String(o['customer_city']??''),pincode:String(o['customer_pincode']??''),review_required:true}}];});
   if(rows.length){const {error:e}=await context.supabase.from('partner_orders').upsert(rows,{onConflict:'partner_id,external_order_id',ignoreDuplicates:true});if(e)throw new Error('Could not store retrieved orders');}count=rows.length;
  }
 }else if(partner.adapter==='delhivery'){
  const token=process.env['DELHIVERY_API_TOKEN'];if(!token)throw new Error('Delhivery credentials are not configured');
  if(data.action==='sync')throw new Error('Delhivery tracking requires an assigned waybill; bulk order retrieval is unavailable');
  throw new Error('Delhivery account testing requires a valid waybill; configuration is saved but not yet verified');
 }else throw new Error('Custom exchange requires a configured shared webhook token');
 const state=partner.adapter==='demo'?'demo':'connected';await supabaseAdmin.from('courier_partners').update({connection_status:state,last_sync_at:data.action==='sync'?new Date().toISOString():partner.last_sync_at,last_error:null}).eq('id',partner.id);
 const {error:logError}=await supabaseAdmin.from('integration_events').insert({partner_id:partner.id,event_key:crypto.randomUUID(),event_type:data.action==='test'?'test':'sync',outcome:'success',message:data.action==='sync'?`${count} orders received (existing references kept)`:'Connection test successful'});if(logError)throw new Error('Could not record integration outcome');return {count,message:data.action==='sync'?`${count} orders received`:'Connection test successful'};
 } catch(e){const message=e instanceof Error?e.message:'Courier request failed';await supabaseAdmin.from('courier_partners').update({last_error:message,connection_status:partner.connection_status==='connected'?'degraded':partner.connection_status}).eq('id',partner.id);await supabaseAdmin.from('integration_events').insert({partner_id:partner.id,event_key:crypto.randomUUID(),event_type:data.action==='test'?'test':'sync',outcome:'failed',message});throw new Error(message);}
});
