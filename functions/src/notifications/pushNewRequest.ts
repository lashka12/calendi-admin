import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

/**
 * ============================================================================
 * PUSH NOTIFICATION - New Pending Request
 * ============================================================================
 * 
 * Sends a push notification to the admin when a new booking request is created.
 * 
 * TRIGGER: Document created in pendingBookings collection
 * 
 * TOKEN STORAGE: settings/adminPushToken
 * {
 *   token: "fcm_token_here",
 *   updatedAt: Timestamp
 * }
 * 
 * ============================================================================
 */

export const notifyAdminNewRequest = onDocumentCreated(
  {
    document: "pendingBookings/{bookingId}",
    // No secrets needed - FCM uses service account
  },
  async (event) => {
    const booking = event.data?.data();
    if (!booking) {
      console.log("⚠️ [pushNewRequest] No booking data found");
      return;
    }

    console.log("📱 [pushNewRequest] New pending request:", event.params.bookingId);

    const db = admin.firestore();

    try {
      // Get admin's FCM token from settings
      const tokenDoc = await db.collection("settings").doc("adminPushToken").get();
      
      if (!tokenDoc.exists) {
        console.log("⚠️ [pushNewRequest] No admin push token configured");
        return;
      }

      const tokenData = tokenDoc.data();
      const token = tokenData?.token;

      if (!token) {
        console.log("⚠️ [pushNewRequest] Admin push token is empty");
        return;
      }

      // Build notification message
      const clientName = booking.clientName || "Someone";
      const service = booking.service || "Service";
      const date = booking.date || "";
      const time = booking.time || "";

      const message: admin.messaging.Message = {
        token,
        notification: {
          title: "📅 New Booking Request",
          body: `${clientName} - ${service}${date ? ` on ${date}` : ""}${time ? ` at ${time}` : ""}`,
        },
        webpush: {
          notification: {
            icon: "/icons/icon-192.svg",
            badge: "/icons/icon-192.svg",
            vibrate: [200, 100, 200],
            tag: "new-request",
            renotify: true,
          },
          fcmOptions: {
            link: "/requests", // Opens requests page when notification clicked
          },
        },
        data: {
          type: "new_request",
          bookingId: event.params.bookingId,
          url: "/requests",
        },
      };

      // Send the push notification
      const response = await admin.messaging().send(message);
      
      console.log("✅ [pushNewRequest] Push notification sent:", response);
      console.log("   To token:", token.substring(0, 20) + "...");
      console.log("   Client:", clientName);
      console.log("   Service:", service);

    } catch (error: any) {
      // Handle invalid token (e.g., user uninstalled app)
      if (error.code === "messaging/registration-token-not-registered" ||
          error.code === "messaging/invalid-registration-token") {
        console.log("⚠️ [pushNewRequest] Invalid token, removing from settings");
        await db.collection("settings").doc("adminPushToken").delete();
      } else {
        console.error("❌ [pushNewRequest] Error sending push:", error.message);
      }
    }
  }
);
