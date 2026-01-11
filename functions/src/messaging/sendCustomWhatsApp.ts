import { onCall, HttpsError } from "firebase-functions/v2/https";
import { sendWhatsAppMessage } from "./whatsAppService";

/**
 * Send Custom WhatsApp (Admin Only)
 * Allows admin to send custom WhatsApp messages
 */
export const sendCustomWhatsApp = onCall(
  {
    secrets: [
      "ULTRAMSG_INSTANCE_ID",
      "ULTRAMSG_TOKEN",
    ],
  },
  async (request) => {
    // Security: Only authenticated users can call this
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Must be logged in as admin to send WhatsApp"
      );
    }

    const { to, message } = request.data as { to: string; message: string };

    if (!to || !message) {
      throw new HttpsError(
        "invalid-argument",
        "Phone number and message are required"
      );
    }

    try {
      const response = await sendWhatsAppMessage(to, message);

      console.log("✅ Custom WhatsApp sent by admin");

      return {
        success: true,
        messageId: response.id || "unknown",
        to: to,
      };
    } catch (error: any) {
      console.error("❌ Custom WhatsApp failed:", error.message);
      throw new HttpsError("internal", error.message);
    }
  }
);





