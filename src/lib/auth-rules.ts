export type LoginMode = "both" | "otp" | "password";
export function canLogin(mode: LoginMode, method: "otp" | "password", purpose: "login" | "signup" | "recovery" = "login") {
  return purpose !== "login" || mode === "both" || mode === method;
}
export const DEMO_PARCEL_COUNT = 120;