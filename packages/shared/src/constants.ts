/** Money is integer paise on the wire. 26600 = ₹266.00. Never float. */
export const PAISE_PER_RUPEE = 100;

export function paiseToRupeeString(paise: number): string {
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / PAISE_PER_RUPEE);
  const rem = abs % PAISE_PER_RUPEE;
  return `${sign}₹${rupees}.${rem.toString().padStart(2, "0")}`;
}

/** Rate limits (documented in TRD §9.3). Enforced in the API. */
export const RATE_LIMITS = {
  otpPerPhonePerHour: 5,
  otpPerIpPerHour: 20,
  voicePerUserPerHour: 30,
  globalPerIpPerMinute: 100,
  authPerIpPerHour: 20,
} as const;
