export const MODE_IDS = ["lookup", "lot", "claim", "picked_up", "in_transit", "out_for_delivery", "delivered"] as const;
export type Mode = (typeof MODE_IDS)[number];
