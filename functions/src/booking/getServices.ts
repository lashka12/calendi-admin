import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

/**
 * Get all active services (public - no authentication required)
 * Used by client booking interface
 */
export const getServices = onCall(
  {
    enforceAppCheck: false,
  },
  async (request) => {
    try {
      const db = admin.firestore();
      const servicesRef = db.collection("services");
      const snapshot = await servicesRef.get();

      const services = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .filter(
          (service: any) =>
            service.active !== false && !service.deletedAt
        )
        .sort((a: any, b: any) => {
          const nameA = a.names?.en || a.name || "";
          const nameB = b.names?.en || b.name || "";
          return nameA.localeCompare(nameB);
        });

      return {
        success: true,
        services,
      };
    } catch (error: any) {
      console.error("❌ Failed to get services:", error.message);
      throw new HttpsError(
        "internal",
        "Failed to load services. Please try again."
      );
    }
  }
);




