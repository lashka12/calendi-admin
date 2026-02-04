import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { validateBookingData } from "./validators";
import { calculateEndTime, isPastDateTimeInTimezone } from "../utils/helpers";
import {
  getSlotDuration,
  calculateSlotsNeeded,
} from "../utils/slotHelpers";
import { verifyOTPCode } from "../otp/verifyOTP";
import { validateSlotForBooking } from "./slotValidationService";

/**
 * Create a new pending booking request with OTP verification
 * Verifies OTP code internally before creating the booking
 * This replaces direct client writes to Firestore
 */
export const createPendingRequest = onCall(
  {
    enforceAppCheck: false,
  },
  async (request) => {
  console.log("📝 [createPendingRequest] Function called");

  try {
    const db = admin.firestore();

    // Extract booking data (including OTP code)
    const {
      clientName,
      phone,
      date,
      time,
      serviceId,
      code, // OTP code for verification
    } = request.data as {
      clientName: string;
      phone: string;
      date: string;
      time: string;
      serviceId: string;
      code: string;
    };

    // Step 0: Verify OTP code (must be done first)
    if (!code) {
      throw new HttpsError(
        "invalid-argument",
        "Verification code is required"
      );
    }

    console.log("🔐 [createPendingRequest] Verifying OTP...");

    // Use the same verification function as verifyOTPWhatsApp
    const verification = await verifyOTPCode(db, phone, code);

    if (!verification.success) {
      console.log("❌ [createPendingRequest] OTP verification failed:", verification.code, verification.error);
      // Return OTP error details so client can handle appropriately
      // (e.g., show attempts remaining, prompt for new code)
      return {
        success: false,
        code: verification.code,
        error: verification.error,
        attemptsLeft: verification.attemptsLeft,
      };
    }

    console.log("✅ [createPendingRequest] OTP verified successfully");

    console.log("📋 [createPendingRequest] Data received:", {
      clientName,
      phone,
      date,
      time,
      serviceId,
    });

    // Step 1: Validate all required fields and formats (excluding code, which is handled above)
    const validationError = validateBookingData({
      clientName,
      phone,
      date,
      time,
      serviceId,
    });
    if (validationError) {
      console.log("❌ [createPendingRequest] Validation failed:", validationError);
      throw new HttpsError("invalid-argument", validationError);
    }

    console.log("✅ [createPendingRequest] Data validation passed");

    // Step 2: Get business settings (timezone, advance booking limit, min notice)
    const businessSettingsDoc = await db.collection("settings").doc("businessSettings").get();
    const businessSettings = businessSettingsDoc.exists ? businessSettingsDoc.data() : {};
    const timezone = businessSettings?.timezone || "Asia/Jerusalem";
    const advanceBookingLimit =
      typeof businessSettings?.advanceBookingLimit === "number" &&
      businessSettings.advanceBookingLimit > 0
        ? businessSettings.advanceBookingLimit
        : 90;
    const minBookingNotice =
      typeof businessSettings?.minBookingNotice === "number" &&
      businessSettings.minBookingNotice >= 0
        ? businessSettings.minBookingNotice
        : 0;

    // Step 2a: Validate booking is not in the past (timezone-aware)
    if (isPastDateTimeInTimezone(date, time, timezone)) {
      console.log(
        `❌ [createPendingRequest] Booking is in the past: ${date} ${time} (timezone: ${timezone})`
      );
      throw new HttpsError(
        "failed-precondition",
        "Cannot create bookings in the past"
      );
    }

    console.log(`✅ [createPendingRequest] Booking time is valid (not in past, timezone: ${timezone})`);

    // Step 2b: Validate booking is not beyond advance booking limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxBookableDate = new Date(today);
    maxBookableDate.setDate(maxBookableDate.getDate() + advanceBookingLimit);
    const requestedDate = new Date(date + "T00:00:00");

    if (requestedDate > maxBookableDate) {
      console.log(
        `❌ [createPendingRequest] Booking date ${date} is beyond advance limit of ${advanceBookingLimit} days`
      );
      throw new HttpsError(
        "failed-precondition",
        `Bookings are only available up to ${advanceBookingLimit} days in advance`
      );
    }

    console.log(`✅ [createPendingRequest] Booking date is within advance limit (${advanceBookingLimit} days)`);

    // Step 2c: Validate booking meets minimum notice requirement
    if (minBookingNotice > 0) {
      // Get current time in business timezone
      const now = new Date();
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      const parts = formatter.formatToParts(now);
      const currentYear = parts.find(p => p.type === "year")?.value;
      const currentMonth = parts.find(p => p.type === "month")?.value;
      const currentDay = parts.find(p => p.type === "day")?.value;
      const currentHour = parseInt(parts.find(p => p.type === "hour")?.value || "0");
      const currentMinute = parseInt(parts.find(p => p.type === "minute")?.value || "0");
      const todayStr = `${currentYear}-${currentMonth}-${currentDay}`;
      
      // Only check if booking is for today
      if (date === todayStr) {
        // Calculate minimum bookable time
        const minBookableMinutes = (currentHour * 60 + currentMinute) + (minBookingNotice * 60);
        const requestedMinutes = parseInt(time.split(":")[0]) * 60 + parseInt(time.split(":")[1]);
        
        if (requestedMinutes < minBookableMinutes) {
          console.log(
            `❌ [createPendingRequest] Booking time ${time} is within ${minBookingNotice}h notice window`
          );
          throw new HttpsError(
            "failed-precondition",
            `Bookings require at least ${minBookingNotice} hour${minBookingNotice > 1 ? 's' : ''} advance notice`
          );
        }
      }
    }

    console.log(`✅ [createPendingRequest] Booking meets minimum notice requirement (${minBookingNotice}h)`);

    // Step 3: Check if service exists and is active
    const serviceRef = admin.firestore()
      .collection("services").doc(serviceId);
    const serviceDoc = await serviceRef.get();

    if (!serviceDoc.exists) {
      console.log("❌ [createPendingRequest] Service not found:", serviceId);
      throw new HttpsError("not-found", "Service not found");
    }

    const serviceData = serviceDoc.data();

    if (serviceData?.active === false) {
      console.log("❌ [createPendingRequest] Service is inactive:", serviceId);
      throw new HttpsError("failed-precondition",
        "Service is not available");
    }

    // Step 5: Get service name in appropriate format
    // Support both old (name) and new (names) format
    let serviceName: string;
    if (serviceData?.names && typeof serviceData.names === "object") {
      // New format: use English name as default
      const names = serviceData.names as { en?: string; he?: string; ar?: string };
      serviceName = names.en || names.he || names.ar || "";
    } else {
      // Old format: use name field
      serviceName = serviceData?.name as string || "";
    }

    if (!serviceName) {
      console.log("❌ [createPendingRequest] Service has no name");
      throw new HttpsError("failed-precondition",
        "Service data is invalid");
    }

    console.log("✅ [createPendingRequest] Service validated:", serviceName);

    // Step 6: Get slot duration and round up service duration to slots
    const slotDuration = await getSlotDuration(db);
    const serviceDuration = (serviceData?.duration as number) || 60; // Default 60 min
    
    // Round up to full slots
    const slotsNeeded = calculateSlotsNeeded(serviceDuration, slotDuration);
    const bookingDuration = slotsNeeded * slotDuration; // Actual duration to book
    
    console.log(`📊 [createPendingRequest] Service duration: ${serviceDuration} min, Slots needed: ${slotsNeeded}, Booking duration: ${bookingDuration} min`);
    
    const endTime = calculateEndTime(time, bookingDuration);

    console.log(
      `⏱️  [createPendingRequest] Service: ${serviceDuration} min, Booking: ${bookingDuration} min, ` +
      `End time: ${endTime}`
    );

    // Step 7: Comprehensive slot validation (time alignment, availability windows, service fit, collisions)
    console.log("🔍 [createPendingRequest] Validating slot availability...");
    const slotValidation = await validateSlotForBooking(
      db,
      date,
      time,
      serviceDuration,
      slotDuration
    );

    if (!slotValidation.valid) {
      console.log(`❌ [createPendingRequest] Slot validation failed: ${slotValidation.error}`);
      throw new HttpsError(
        "failed-precondition",
        slotValidation.error || "This time slot is not available. Please select another time."
      );
    }

    console.log("✅ [createPendingRequest] Slot validation passed");

    // Step 8: Create pending booking in Firestore
    // Store actual service duration (not rounded), but endTime uses rounded duration
    const bookingData = {
      clientName: clientName.trim(),
      phone: phone.trim(),
      date,
      time,
      endTime, // Uses rounded bookingDuration
      duration: serviceDuration, // Store actual service duration
      service: serviceName,
      serviceId,
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
    };

    console.log("💾 [createPendingRequest] Creating booking in Firestore...");

    const bookingRef = await admin.firestore()
      .collection("pendingBookings")
      .add(bookingData);

    const msg = "Booking request created successfully:";
    console.log("✅ [createPendingRequest]", msg, bookingRef.id);

    // Step 9: Return success
    return {
      success: true,
      bookingId: bookingRef.id,
      message: "Booking request submitted successfully",
    };
  } catch (error: any) {
    // Log error for debugging
    console.error("❌ [createPendingRequest] Error:", error);

    // If it's already an HttpsError, re-throw it
    if (error instanceof HttpsError) {
      throw error;
    }

    // For unexpected errors, throw internal error
    throw new HttpsError(
      "internal",
      "An error occurred while creating the booking"
    );
  }
});


