import { onDocumentDeleted } from "firebase-functions/v2/firestore";
import { sendWhatsAppMessage } from "../messaging/whatsAppService";
import { getMessage, formatDateForMessage } from "../messaging/messageTemplates";

/**
 * Send Booking Cancellation WhatsApp
 * Triggers when a session is deleted
 */
export const sendBookingCancellationWhatsApp = onDocumentDeleted(
  {
    document: "sessions/{sessionId}",
    secrets: [
      "ULTRAMSG_INSTANCE_ID",
      "ULTRAMSG_TOKEN",
    ],
  },
  async (event) => {
    const deletedData = event.data?.data();

    console.log("🗑️ Session deleted, checking if WhatsApp needed...");

    if (!deletedData?.phone) {
      console.log("⚠️ No phone number in deleted data, skipping WhatsApp");
      return null;
    }

    console.log("📞 Sending cancellation WhatsApp to:", deletedData.phone);

    // Build message using centralized template
    // TODO: Get language from settings when multi-lang is implemented
    const lang = "en";
    const message = getMessage("bookingCancelled", lang, {
      clientName: deletedData.clientName,
      date: formatDateForMessage(deletedData.date, lang),
      time: deletedData.time,
      service: deletedData.service,
    });

    try {
      const response = await sendWhatsAppMessage(deletedData.phone, message);

      console.log("✅ Cancellation WhatsApp sent");
      console.log("   To:", deletedData.phone);
      console.log("   Client:", deletedData.clientName);

      return response;
    } catch (error: any) {
      console.error("❌ Cancellation WhatsApp failed:", error.message);
      return null;
    }
  }
);
