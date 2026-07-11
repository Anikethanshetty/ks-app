/**
 * SMS delivery, wrapped so the OTP path never knows or cares who sends the text.
 * Swap MSG91 for anything else without touching the service layer (TRD §2.1).
 */
export interface SmsProvider {
  readonly id: "msg91" | "console";
  /** Sends the OTP text. Must never throw for a merely-undeliverable number in dev. */
  sendOtp(phone: string, code: string): Promise<void>;
}
