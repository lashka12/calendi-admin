import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { sendWhatsAppMessage } from "../messaging/whatsAppService";
import { getMessage } from "../messaging/messageTemplates";

/**
 * Send OTP via WhatsApp
 * Includes rate limiting (IP-based and phone-based)
 */
export const sendOTPWhatsApp = onCall(
  {
    secrets: [
      "ULTRAMSG_INSTANCE_ID",
      "ULTRAMSG_TOKEN",
    ],
  },
  async (request) => {
    const { phone } = request.data as { phone: string };

    if (!phone) {
      throw new HttpsError(
        "invalid-argument",
        "Phone number is required"
      );
    }

    // Get client IP address (multiple fallbacks for different environments)
    let clientIP = "unknown"; // Default fallback

    try {
      // Debug: Log request structure in emulator
      console.log("🔍 Request debug:", {
        hasRawRequest: !!request.rawRequest,
        rawRequestKeys: request.rawRequest
          ? Object.keys(request.rawRequest)
          : [],
        ip: (request.rawRequest as any)?.ip,
        forwardedFor: (request.rawRequest as any)?.headers?.["x-forwarded-for"],
      });

      // Try different ways to get IP based on environment
      if (request.rawRequest) {
        const rawReq = request.rawRequest as any;
        // Express-style request object
        const detectedIP =
          rawReq.ip ||
          rawReq.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ||
          rawReq.headers?.["x-real-ip"] ||
          rawReq.connection?.remoteAddress ||
          rawReq.socket?.remoteAddress;

        if (detectedIP) {
          clientIP = detectedIP;
        }
      }

      // If still unknown, try auth context
      if (clientIP === "unknown" && request.auth?.token?.ip) {
        clientIP = request.auth.token.ip as string;
      }

      // Clean up IPv6 localhost to IPv4
      if (clientIP === "::1" || clientIP === "::ffff:127.0.0.1") {
        clientIP = "127.0.0.1";
      }

      // Remove IPv6 prefix if present
      if (clientIP && clientIP.startsWith("::ffff:")) {
        clientIP = clientIP.substring(7);
      }

      // Final safety check - ensure it's never undefined or empty
      if (!clientIP || clientIP === "") {
        clientIP = "unknown";
      }
    } catch (error: any) {
      console.log("⚠️ Could not extract IP:", error.message);
      clientIP = "unknown";
    }

    console.log("📱 OTP Request for:", phone, "from IP:", clientIP);

    // Check if running in emulator
    const isEmulator = process.env.FUNCTIONS_EMULATOR === "true";

    // 🚫 SECURITY: Block all requests with unknown IP (except in emulator)
    if (clientIP === "unknown" && !isEmulator) {
      console.log("🚫 Blocked request - IP could not be determined");
      throw new HttpsError(
        "failed-precondition",
        "Unable to verify request origin. " +
        "Please disable VPN or proxy and try again."
      );
    }

    // 🧪 Log emulator bypass
    if (clientIP === "unknown" && isEmulator) {
      console.log("🧪 Emulator mode: Allowing unknown IP for local testing");
    }

    const db = admin.firestore();

    try {
      // 🛡️ RATE LIMITING (1): Check IP-based rate limit
      const ipDoc = await db.collection("otpIPLimits").doc(clientIP).get();

      if (ipDoc.exists) {
        const ipData = ipDoc.data();
        const ipSendHistory = (ipData?.sendHistory as number[]) || [];
        const oneHourAgo = Date.now() - 3600000; // 1 hour
        const recentIPSends = ipSendHistory.filter(
          (time) => time > oneHourAgo
        );

        // Max 10 OTP requests per hour from same IP (any phone numbers)
        if (recentIPSends.length >= 10) {
          console.log("🚫 IP rate limit exceeded for:", clientIP);
          throw new HttpsError(
            "resource-exhausted",
            "Too many verification requests. Please try again later."
          );
        }
      }

      // 🛡️ RATE LIMITING (2): Check phone-based rate limit
      const otpDoc = await db.collection("otpCodes").doc(phone).get();

      if (otpDoc.exists) {
        const otpData = otpDoc.data();
        const lastSent = (otpData?.lastSentAt as number) || 0;
        const timeSinceLastSend = Date.now() - lastSent;

        // Must wait at least 30 seconds between sends
        if (timeSinceLastSend < 30000) {
          const waitTime = Math.ceil((30000 - timeSinceLastSend) / 1000);
          console.log(`⚠️ Rate limit: ${waitTime}s remaining`);
          throw new HttpsError(
            "resource-exhausted",
            `Please wait ${waitTime} seconds before requesting a new code`
          );
        }

        // 🛡️ RATE LIMITING: Max 5 codes per hour
        const sendHistory = (otpData?.sendHistory as number[]) || [];
        const oneHourAgo = Date.now() - 3600000; // 1 hour
        const recentSends = sendHistory.filter((time) => time > oneHourAgo);

        if (recentSends.length >= 5) {
          console.log("⚠️ Too many OTP requests for:", phone);
          throw new HttpsError(
            "resource-exhausted",
            "Too many requests. Please try again in an hour."
          );
        }
      }

      // Generate random 4-digit code
      const code = Math.floor(1000 + Math.random() * 9000).toString();

      // 🔄 Store new code
      if (otpDoc.exists) {
        // Update existing document to preserve sendHistory
        await db.collection("otpCodes").doc(phone).update({
          code: code,
          createdAt: FieldValue.serverTimestamp(),
          expiresAt: Date.now() + (5 * 60 * 1000), // 5 minutes
          lastSentAt: Date.now(),
          attempts: 0,
          sendHistory: FieldValue.arrayUnion(Date.now()), // Appends to array
        });
      } else {
        // Create new document for first-time users
        await db.collection("otpCodes").doc(phone).set({
          code: code,
          createdAt: FieldValue.serverTimestamp(),
          expiresAt: Date.now() + (5 * 60 * 1000), // 5 minutes
          lastSentAt: Date.now(),
          attempts: 0,
          sendHistory: [Date.now()], // Initialize array with first timestamp
        });
      }

      // 📱 Send WhatsApp message using centralized template
      // TODO: Get language from settings or client when multi-lang is implemented
      const lang = "en";
      const message = getMessage("otp", lang, { code });
      await sendWhatsAppMessage(phone, message);

      // 📊 Track IP request for rate limiting
      if (ipDoc.exists) {
        // Update existing IP tracking
        await db.collection("otpIPLimits").doc(clientIP).update({
          lastRequestAt: Date.now(),
          sendHistory: FieldValue.arrayUnion(Date.now()),
        });
      } else {
        // Create new IP tracking
        await db.collection("otpIPLimits").doc(clientIP).set({
          ip: clientIP,
          firstRequestAt: Date.now(),
          lastRequestAt: Date.now(),
          sendHistory: [Date.now()],
        });
      }

      console.log(`✅ OTP sent to ${phone} (IP: ${clientIP})`);

      return { success: true, message: "OTP sent successfully" };
    } catch (error: any) {
      // Re-throw HttpsError as-is
      if (error instanceof HttpsError) {
        throw error;
      }

      console.error("❌ OTP send failed:", error.message);
      throw new HttpsError("internal", "Failed to send OTP");
    }
  }
);





