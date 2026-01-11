import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

// ============================================
// OTP ERROR CODES
// ============================================
// Export these codes for client-side handling
// Usage: switch(result.code) { case OTP_ERROR_CODES.EXPIRED: ... }

export const OTP_ERROR_CODES = {
  /** No OTP exists for this phone number (never requested or already consumed) */
  NOT_FOUND: "OTP_NOT_FOUND",
  /** OTP has expired (5 minute lifetime) */
  EXPIRED: "OTP_EXPIRED",
  /** User has exceeded maximum verification attempts (3 attempts) */
  TOO_MANY_ATTEMPTS: "OTP_TOO_MANY_ATTEMPTS",
  /** The code entered doesn't match the stored OTP */
  INVALID_CODE: "OTP_INVALID_CODE",
} as const;

// Type for error codes
export type OTPErrorCode = typeof OTP_ERROR_CODES[keyof typeof OTP_ERROR_CODES];

// ============================================
// RESPONSE TYPE
// ============================================

/**
 * Response type for OTP verification
 * 
 * Success: { success: true, message: "..." }
 * Error:   { success: false, code: "OTP_...", error: "...", attemptsLeft?: number }
 */
export interface OTPVerificationResult {
  success: boolean;
  /** Human-readable message (for success) */
  message?: string;
  /** Error code for programmatic handling (for errors) */
  code?: OTPErrorCode;
  /** Human-readable error message (for errors) */
  error?: string;
  /** Remaining attempts before lockout (only for INVALID_CODE) */
  attemptsLeft?: number;
}

// ============================================
// INTERNAL VERIFICATION LOGIC
// ============================================

/**
 * Internal OTP verification logic
 * 
 * Shared between:
 * - verifyOTPWhatsApp (public API for standalone verification)
 * - createPendingRequest (verifies OTP before creating booking)
 * 
 * @param db - Firestore database instance
 * @param phone - Phone number to verify
 * @param code - OTP code entered by user
 * @returns OTPVerificationResult with success/error details
 * 
 */
export async function verifyOTPCode(
  db: admin.firestore.Firestore,
  phone: string,
  code: string
): Promise<OTPVerificationResult> {
  // Get stored OTP document
  const otpDoc = await db.collection("otpCodes").doc(phone).get();

  // Check if OTP exists
  if (!otpDoc.exists) {
    console.log("❌ No OTP found for:", phone);
    return {
      success: false,
      code: OTP_ERROR_CODES.NOT_FOUND,
      error: "No verification code found. Please request a new code.",
    };
  }

  const otpData = otpDoc.data();

  // Check if OTP has expired (5 minute lifetime)
  if (Date.now() > (otpData?.expiresAt as number)) {
    console.log("⏰ OTP expired for:", phone);
    // Clean up expired OTP
    await db.collection("otpCodes").doc(phone).delete();
    return {
      success: false,
      code: OTP_ERROR_CODES.EXPIRED,
      error: "Code expired. Please request a new one.",
    };
  }

  // Check if max attempts exceeded (3 attempts allowed)
  const currentAttempts = (otpData?.attempts as number) || 0;
  if (currentAttempts >= 3) {
    console.log("🚫 Too many attempts for:", phone);
    // Clean up locked OTP
    await db.collection("otpCodes").doc(phone).delete();
    return {
      success: false,
      code: OTP_ERROR_CODES.TOO_MANY_ATTEMPTS,
      error: "Too many failed attempts. Please request a new code.",
    };
  }

  // Verify the code matches
  if (otpData?.code !== code) {
    // Increment failed attempt counter
    await db.collection("otpCodes").doc(phone).update({
      attempts: FieldValue.increment(1),
    });

    const attemptsLeft = 3 - (currentAttempts + 1);
    console.log(`❌ Invalid OTP for ${phone}. Attempts left: ${attemptsLeft}`);

    return {
      success: false,
      code: OTP_ERROR_CODES.INVALID_CODE,
      error: "Invalid code. Please try again.",
      attemptsLeft,
    };
  }

  // ✅ Success - delete OTP (one-time use)
  await db.collection("otpCodes").doc(phone).delete();
  console.log(`✅ OTP verified successfully for ${phone}`);

  return {
    success: true,
    message: "Verification successful",
  };
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Verify OTP code (public callable function)
 * 
 * @param phone - Phone number that received the OTP
 * @param code - 4-digit OTP code entered by user
 * 
 * @returns OTPVerificationResult
 * 
 * Success response:
 * { success: true, message: "Verification successful" }
 * 
 * Error responses:
 * { success: false, code: "OTP_NOT_FOUND", error: "No verification code found..." }
 * { success: false, code: "OTP_EXPIRED", error: "Code expired..." }
 * { success: false, code: "OTP_TOO_MANY_ATTEMPTS", error: "Too many failed attempts..." }
 * { success: false, code: "OTP_INVALID_CODE", error: "Invalid code...", attemptsLeft: 2 }
 * 
 * @throws HttpsError("invalid-argument") - Missing phone or code
 * @throws HttpsError("internal") - Unexpected server error
 */
export const verifyOTPWhatsApp = onCall(async (request) => {
  const { phone, code } = request.data as { phone: string; code: string };

  // Validate required fields
  if (!phone || !code) {
    throw new HttpsError(
      "invalid-argument",
      "Phone number and code are required"
    );
  }

  console.log("🔍 Verifying OTP for:", phone);

  const db = admin.firestore();

  try {
    const result = await verifyOTPCode(db, phone, code);
    return result;
  } catch (error: any) {
    console.error("❌ OTP verification failed:", error.message);
    throw new HttpsError("internal", "Failed to verify OTP");
  }
});
