import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Set special day (block/close day)
 * Checks for bookings before allowing blocking
 */
export const setSpecialDay = onCall(
  {
    enforceAppCheck: false,
  },
  async (request) => {
    const { id, name, dates, recurring, recurringPattern } = request.data as {
      id?: string;
      name: string;
      dates: string[];
      recurring: boolean;
      recurringPattern?: string;
    };

    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "You must be logged in to set special day"
      );
    }

    if (!name || !dates || !Array.isArray(dates) || dates.length === 0) {
      throw new HttpsError(
        "invalid-argument",
        "Name and dates are required"
      );
    }

    // Validate date formats
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    for (const date of dates) {
      if (!dateRegex.test(date)) {
        throw new HttpsError(
          "invalid-argument",
          `Invalid date format: ${date}. Use YYYY-MM-DD`
        );
      }
      // Validate dates are not in past
      const inputDate = new Date(date + "T00:00:00Z");
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (inputDate < today) {
        throw new HttpsError(
          "invalid-argument",
          `Cannot block past date: ${date}`
        );
      }
    }

    try {
      const db = admin.firestore();

      // Check for bookings on all dates
      for (const date of dates) {
        const sessionsRef = db.collection("sessions");
        const sessionsQuery = sessionsRef
          .where("date", "==", date)
          .where("status", "in", ["approved", "pending"]);
        const sessionsSnapshot = await sessionsQuery.get();

        const pendingRef = db.collection("pendingBookings");
        const pendingQuery = pendingRef.where("date", "==", date);
        const pendingSnapshot = await pendingQuery.get();

        const totalBookings = sessionsSnapshot.size + pendingSnapshot.size;

        if (totalBookings > 0) {
          throw new HttpsError(
            "failed-precondition",
            `Cannot block date ${date}. There are ${totalBookings} existing booking(s). Please cancel or reschedule bookings first.`
          );
        }
      }

      // Save special day
      const specialDaysRef = db.collection("specialDays");
      
      if (id) {
        // Update existing
        const docRef = specialDaysRef.doc(id);
        const doc = await docRef.get();
        if (!doc.exists) {
          throw new HttpsError(
            "not-found",
            "Special day not found"
          );
        }
        await docRef.update({
          name,
          dates,
          recurring,
          recurringPattern: recurring ? recurringPattern : null,
          isClosed: true, // Always true - specials only block/close
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: request.auth.uid,
        });
      } else {
        // Create new
        await specialDaysRef.add({
          name,
          dates,
          recurring,
          recurringPattern: recurring ? recurringPattern : null,
          isClosed: true, // Always true
          createdAt: FieldValue.serverTimestamp(),
          createdBy: request.auth.uid,
        });
      }

      console.log(`✅ Special day "${name}" ${id ? "updated" : "created"} by ${request.auth.uid}`);

      return {
        success: true,
        message: `Special day ${id ? "updated" : "created"} successfully`,
      };
    } catch (error: any) {
      if (error instanceof HttpsError) {
        throw error;
      }
      console.error("❌ Failed to set special day:", error.message);
      throw new HttpsError(
        "internal",
        "Failed to save special day. Please try again."
      );
    }
  }
);

/**
 * Delete special day
 */
export const deleteSpecialDay = onCall(
  {
    enforceAppCheck: false,
  },
  async (request) => {
    const { id } = request.data as { id: string };

    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "You must be logged in to delete special day"
      );
    }

    if (!id) {
      throw new HttpsError(
        "invalid-argument",
        "Special day ID is required"
      );
    }

    try {
      const db = admin.firestore();

      // Get special day to check dates
      const specialDaysRef = db.collection("specialDays");
      const docRef = specialDaysRef.doc(id);
      const doc = await docRef.get();

      if (!doc.exists) {
        throw new HttpsError(
          "not-found",
          "Special day not found"
        );
      }

      // Delete special day (no need to check bookings - unblocking is fine)
      await docRef.delete();

      console.log(`✅ Special day ${id} deleted by ${request.auth.uid}`);

      return {
        success: true,
        message: "Special day deleted successfully",
      };
    } catch (error: any) {
      if (error instanceof HttpsError) {
        throw error;
      }
      console.error("❌ Failed to delete special day:", error.message);
      throw new HttpsError(
        "internal",
        "Failed to delete special day. Please try again."
      );
    }
  }
);

