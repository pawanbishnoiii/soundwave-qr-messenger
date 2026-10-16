import { createFileRoute } from '@tanstack/react-router';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { webhookSchema } from '@/lib/courier-schema';
export const Route=createFileRoute('/api/public/couriers/$partnerId/webhook')({server:{handlers:{POST:async({request,params})=>{
 const id=z.string().uuid().safeParse(params.partnerId);if(!id.success)return Response.json({error:'Invalid partner'},{status:400});
 const expected=process.env['COURIER_EXCHANGE_WEBHOOK_TOKEN'];if(!expected)return Response.json({error:'Webhook exchange is not configured'},{status:503});
 const provided=request.headers.get('x-bnoy-token')??'';const a=new TextEncoder().encode(provided);const b=new TextEncoder().encode(expected);if(a.byteLength!==b.byteLength||!timingSafeEqual(a,b))return Response.json({error:'Unauthorized'},{status:401});
 if(Number(request.headers.get('content-length')??0)>65536)return Response.json({error:'Payload too large'},{status:413});
 const reader=request.body?.getReader();if(!reader)return Response.json({error:'Missing payload'},{status:400});let text='';let size=0;const decoder=new TextDecoder();while(true){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>65536){await reader.cancel();return Response.json({error:'Payload too large'},{status:413});}text+=decoder.decode(next.value,{stream:true});}text+=decoder.decode();
 let body:unknown;try{body=JSON.parse(text);}catch{return Response.json({error:'Invalid JSON'},{status:400});}const parsed=webhookSchema.safeParse(body);if(!parsed.success)return Response.json({error:'Invalid order exchange payload'},{status:400});
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');const {data:partner}=await supabaseAdmin.from('courier_partners').select('id,adapter,enabled').eq('id',id.data).single();if(!partner?.enabled||!['custom','demo'].includes(partner.adapter))return Response.json({error:'Partner does not accept this exchange contract'},{status:403});
 const {data:recent}=await supabaseAdmin.from('integration_events').select('id').eq('partner_id',partner.id).gte('created_at',new Date(Date.now()-60000).toISOString()).limit(31);if((recent?.length??0)>=30)return Response.json({error:'Rate limit reached'},{status:429});
 const eventKey=`webhook:${parsed.data.event_id}`;const {data:existing}=await supabaseAdmin.from('integration_events').select('outcome').eq('partner_id',partner.id).eq('event_key',eventKey).maybeSingle();if(existing?.outcome==='success')return Response.json({ok:true,duplicate:true});
 const {error}=await supabaseAdmin.from('partner_orders').upsert(parsed.data.orders.map(({external_order_id,...order_data})=>({partner_id:partner.id,external_order_id,order_data,source:'webhook'})),{onConflict:'partner_id,external_order_id',ignoreDuplicates:true});if(error)return Response.json({error:'Exchange could not be stored; retry this event'},{status:503});
 const {error:logError}=await supabaseAdmin.from('integration_events').upsert({partner_id:partner.id,event_key:eventKey,event_type:'webhook',outcome:'success',message:`${parsed.data.orders.length} order references received`},{onConflict:'partner_id,event_key'});if(logError)return Response.json({error:'Event receipt could not be recorded; retry'},{status:503});
 return Response.json({ok:true,received:parsed.data.orders.length});
}}}});
