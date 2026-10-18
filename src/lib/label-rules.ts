export function extractLabelDetails(text: string) {
  const normalized = text.replace(/\r/g, "");
  const labelled = [...normalized.matchAll(/(?:tracking(?:\s*(?:id|number|no))?|awb|waybill)\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{5,39})/gi)].map((match) => match[1]?.toUpperCase()).filter((value): value is string => !!value);
  const bnoy = [...normalized.matchAll(/\bBN[A-Z0-9]{8,30}\b/gi)].map((match) => match[0].toUpperCase());
  const trackingCandidates = [...new Set([...labelled, ...bnoy])];
  const pincodes = [...new Set([...normalized.matchAll(/\b[1-9]\d{5}\b/g)].map((match) => match[0]))];
  return { trackingCandidates, pincodes, tracking: trackingCandidates.length === 1 ? trackingCandidates[0] : undefined, text: normalized };
}

export function destinationMatches(bag: { pincode?: string | null; destination?: string | null }, shipment: { pincode?: string | null; city: string }) {
  if (bag.pincode) return bag.pincode === shipment.pincode;
  const destination = bag.destination?.trim().toLowerCase();
  return !!destination && destination !== "unassigned" && destination === shipment.city.trim().toLowerCase();
}

export function reconcileManifest(expected: string[], scanned: string[]) {
  const e = new Set(expected); const r = new Set(scanned);
  return { matched: [...r].filter((id) => e.has(id)), missing: [...e].filter((id) => !r.has(id)), unexpected: [...r].filter((id) => !e.has(id)), duplicates: scanned.length - r.size };
}