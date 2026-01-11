import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { sendWhatsAppMessage } from "../messaging/whatsAppService";

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

    // Format date nicely
    const dateObj = new Date(booking.date);
    const formattedDate = dateObj.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });

    // WhatsApp message - conversational format
    const message = `Hi ${booking.clientName}! 👋

Your appointment is all set for *${formattedDate}* at *${booking.time}* for ${booking.service}.

Looking forward to seeing you!`;

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





