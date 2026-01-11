import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { 
  getBusinessTimezone, 
  isPastDateInTimezone, 
  isTodayInTimezone,
  isPastTimeInTimezone 
} from "../utils/helpers";

/**
 * Securely set available time slots for a specific date
 * Validates that slots are not in the past
 * Admin must be authenticated
 */
export const setAvailableSlots = onCall(
  {
    enforceAppCheck: false, // Set to true in production if using App Check
  },
  async (request) => {
    const { date, slots } = request.data as {
      date: string;
      slots: string[];
    };

    // 🔒 SECURITY: Require authentication
    if (!request.auth) {
      console.log("🚫 Unauthorized attempt to set slots");
      throw new HttpsError(
        "unauthenticated",
        "You must be logged in to manage slots"
      );
    }

    console.log(
      `📅 Admin ${request.auth.uid} setting slots for ${date}`
    );

    // ✅ VALIDATION 1: Check required fields
    if (!date || !slots) {
      throw new HttpsError(
        "invalid-argument",
        "Date and slots are required"
      );
    }

    // ✅ VALIDATION 2: Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      throw new HttpsError(
        "invalid-argument",
        "Invalid date format. Use YYYY-MM-DD"
      );
    }

    // ✅ VALIDATION 3: Validate slots is an array
    if (!Array.isArray(slots)) {
      throw new HttpsError(
        "invalid-argument",
        "Slots must be an array of time strings"
      );
    }

    // ✅ VALIDATION 4: Validate each slot format (HH:MM)
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    for (const slot of slots) {
      if (typeof slot !== "string" || !timeRegex.test(slot)) {
        throw new HttpsError(
          "invalid-argument",
          `Invalid time format: ${slot}. Use HH:MM (24-hour format)`
        );
      }
    }

    try {
      const db = admin.firestore();

      // Get business timezone for validation
      const timezone = await getBusinessTimezone(db);

      // ✅ VALIDATION 5: Check if date is in the past (timezone-aware)
      if (isPastDateInTimezone(date, timezone)) {
        console.log(`🚫 Attempt to set slots for past date: ${date} (timezone: ${timezone})`);
        throw new HttpsError(
          "invalid-argument",
          "Cannot create slots for past dates"
        );
      }

      // ✅ VALIDATION 6: If date is TODAY, filter out past times (timezone-aware)
      const isTodayDate = isTodayInTimezone(date, timezone);
      let validSlots = slots;

      if (isTodayDate) {
        validSlots = slots.filter((slot) => {
          const isPast = isPastTimeInTimezone(slot, timezone);
          if (isPast) {
            console.log(`⏰ Filtered out past slot: ${slot} (timezone: ${timezone})`);
          }
          return !isPast;
        });

        // If all slots were in the past, return error
        if (validSlots.length === 0 && slots.length > 0) {
          throw new HttpsError(
            "invalid-argument",
            "All provided time slots are in the past"
          );
        }
      }

      // Create/update slots in Firestore
      const slotsRef = db.collection("availableSlots");
      const q = slotsRef.where("date", "==", date);
      const snapshot = await q.get();

      if (snapshot.empty) {
        // Create new document
        await slotsRef.add({
          date: date,
          slots: validSlots,
          createdAt: FieldValue.serverTimestamp(),
          createdBy: request.auth.uid,
        });

        console.log(
          `✅ Created ${validSlots.length} slots for ${date}`
        );
      } else {
        // Update existing document
        const docRef = snapshot.docs[0].ref;
        await docRef.update({
          slots: validSlots,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: request.auth.uid,
        });

        console.log(
          `✅ Updated ${validSlots.length} slots for ${date}`
        );
      }

      return {
        success: true,
        message: `Successfully set ${validSlots.length} slot(s)`,
        slots: validSlots,
        filteredCount: slots.length - validSlots.length,
      };
    } catch (error: any) {
      console.error("❌ Failed to set slots:", error.message);
      throw new HttpsError(
        "internal",
        "Failed to save slots. Please try again."
      );
    }
  }
);





