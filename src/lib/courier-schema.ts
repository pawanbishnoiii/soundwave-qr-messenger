import { z } from 'zod';
export const partnerSchema=z.object({name:z.string().trim().min(2).max(100),adapter:z.enum(['shiprocket','delhivery','custom','demo']),account_reference:z.string().trim().max(100).default('')});
export const partnerIdSchema=z.object({id:z.string().uuid()});
export const exchangeOrderSchema=z.object({external_order_id:z.string().min(1).max(120),receiver_name:z.string().min(1).max(120),receiver_phone:z.string().regex(/^\+?[0-9]{10,15}$/),receiver_address:z.string().min(1).max(1000),city:z.string().min(1).max(100),pincode:z.string().regex(/^[1-9][0-9]{5}$/),sender_name:z.string().max(120).default(''),sender_phone:z.string().max(15).default(''),weight_kg:z.number().positive().max(1000).default(1),cod_amount:z.number().min(0).max(1000000).default(0),awb:z.string().max(100).optional()});
export const webhookSchema=z.object({event_id:z.string().min(1).max(120),orders:z.array(exchangeOrderSchema).min(1).max(100)});
