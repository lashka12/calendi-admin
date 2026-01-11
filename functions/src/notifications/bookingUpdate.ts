import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { sendWhatsAppMessage } from "../messaging/whatsAppService";

/**
 * Send Booking Update WhatsApp
 * Triggers when a session is updated
 */
export const sendBookingUpdateWhatsApp = onDocumentUpdated(
  {
    document: "sessions/{sessionId}",
    secrets: [
      "ULTRAMSG_INSTANCE_ID",
      "ULTRAMSG_TOKEN",
    ],
  },
  async (event) => {
    // TypeScript guard: event.data should always exist for onDocumentUpdated
    if (!event.data) {
      console.log("⚠️ No event data, skipping WhatsApp");
      return null;
    }

    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();

    console.log("📝 Session updated, checking if WhatsApp needed...");

    if (!afterData?.phone) {
      console.log("⚠️ No phone number, skipping WhatsApp");
      return null;
    }

    // Only send WhatsApp if meaningful fields changed
    const dateChanged = beforeData?.date !== afterData?.date;
    const timeChanged = beforeData?.time !== afterData?.time;
    const serviceChanged = beforeData?.service !== afterData?.service;

    if (!dateChanged && !timeChanged && !serviceChanged) {
      console.log("⚠️ No important changes, skipping WhatsApp");
      return null;
    }

    console.log("📞 Sending update WhatsApp to:", afterData.phone);

    // Format date nicely
    const dateObj = new Date(afterData.date);
    const formattedDate = dateObj.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });

    // WhatsApp message - conversational format
    const message = `Hi ${afterData.clientName},

Just wanted to let you know we've updated your appointment to *${formattedDate}* at *${afterData.time}* for ${afterData.service}.

Any questions? Feel free to reach out!`;

    try {
      const response = await sendWhatsAppMessage(afterData.phone, message);

      console.log("✅ Update WhatsApp sent");
      console.log("   To:", afterData.phone);
      console.log("   Client:", afterData.clientName);

      return response;
    } catch (error: any) {
      console.error("❌ Update WhatsApp failed:", error.message);
      return null;
    }
  }
);

