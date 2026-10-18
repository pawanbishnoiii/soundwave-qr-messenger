import { supabase } from "@/integrations/supabase/client";
export type ScanLocation = { lat: number; lng: number; accuracy: number; captured_at: string };

export function validLocation(location: ScanLocation, now = Date.now()) {
  const age = now - Date.parse(location.captured_at);
  return Number.isFinite(location.lat) && location.lat >= -90 && location.lat <= 90
    && Number.isFinite(location.lng) && location.lng >= -180 && location.lng <= 180
    && Number.isFinite(location.accuracy) && location.accuracy >= 0
    && Number.isFinite(age) && age >= -5000 && age <= 60000;
}

export async function requireLocation(): Promise<ScanLocation> {
  if (!navigator.geolocation) throw new Error("Location is unavailable on this device. Use a device with location enabled.");
  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, (error) => reject(new Error(error.code === 1
      ? "Location permission is blocked. Allow location in your browser settings and try again."
      : "Could not obtain your location. Enable device location and try again.")),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
  });
  const location = { lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy, captured_at: new Date(position.timestamp).toISOString() };
  if (!validLocation(location)) throw new Error("Your location is outdated. Please try again.");
  return location;
}

export async function captureScanLocation() {
  const fix = await requireLocation();
  const { data, error: authError } = await supabase.auth.getUser();
  if (authError || !data.user) throw new Error("Sign in required");
  const { error } = await supabase.from("staff_locations").upsert({ user_id: data.user.id, ...fix });
  if (error) throw new Error(error.message);
  return fix;
}