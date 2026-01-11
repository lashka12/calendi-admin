import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { sendWhatsAppMessage } from "../messaging/whatsAppService";
import { getMessage, formatDateForMessage } from "../messaging/messageTemplates";

/**
 * Send Booking Confirmation WhatsApp
 * Triggers when a new session is created
 */
export const sendBookingConfirmation = onDocumentCreated(
  {
    document: "sessions/{sessionId}",
    secrets: [
      "ULTRAMSG_INSTANCE_ID",
      "ULTRAMSG_TOKEN",
    ],
  },
  async (event) => {
    const booking = event.data?.data();

    console.log("📱 New session created, checking if WhatsApp needed...");

    if (!booking?.phone) {
      console.log("⚠️ No phone number, skipping WhatsApp");
      return null;
    }

    if (booking.status !== "approved") {
      console.log("⚠️ Not approved status, skipping WhatsApp");
      return null;
    }

    // Build message using centralized template
    // TODO: Get language from settings when multi-lang is implemented
    const lang = "en";
    const message = getMessage("bookingConfirmed", lang, {
      clientName: booking.clientName,
      date: formatDateForMessage(booking.date, lang),
      time: booking.time,
      service: booking.service,
    });

    try {
      const response = await sendWhatsAppMessage(booking.phone, message);

      console.log("✅ Confirmation WhatsApp sent");
      console.log("   To:", booking.phone);
      console.log("   Client:", booking.clientName);

      return response;
    } catch (error: any) {
      console.error("❌ WhatsApp failed:", error.message);
      return null;
    }
  }
);
