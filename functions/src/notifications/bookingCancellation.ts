import { onDocumentDeleted } from "firebase-functions/v2/firestore";
import { sendWhatsAppMessage } from "../messaging/whatsAppService";

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

    // Format date nicely
    const dateObj = new Date(deletedData.date);
    const formattedDate = dateObj.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });

    // WhatsApp message - conversational format
    const message = `Hi ${deletedData.clientName},

Your appointment for ${deletedData.service} on *${formattedDate}* at *${deletedData.time}* has been cancelled.

Want to reschedule? Just let us know!`;

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





