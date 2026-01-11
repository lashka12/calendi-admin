import * as admin from "firebase-admin";
import {
  isTimeAlignedWithSlots,
  generateSlotsInRange,
  calculateSlotsNeeded,
} from "../utils/slotHelpers";
import { 
  calculateEndTime, 
  timeToMinutes, 
  getBusinessTimezone,
  isPastDateInTimezone,
  isPastDateTimeInTimezone 
} from "../utils/helpers";

interface TimeSlot {
  start: string; // HH:MM
  end: string; // HH:MM
}

interface WeeklyTemplate {
  monday?: TimeSlot[];
  tuesday?: TimeSlot[];
  wednesday?: TimeSlot[];
  thursday?: TimeSlot[];
  friday?: TimeSlot[];
  saturday?: TimeSlot[];
  sunday?: TimeSlot[];
}

/**
 * Shared validation service for slot availability
 * Used by both getAvailableTimeSlots (filtering) and createPendingRequest (validation)
 */
export async function validateSlotForBooking(
  db: admin.firestore.Firestore,
  date: string,
  time: string,
  serviceDuration: number,
  slotDuration: number
): Promise<{ valid: boolean; error?: string }> {
  console.log(`🔍 [validateSlotForBooking] Validating slot: ${date} ${time} for ${serviceDuration}min service`);

  // Get business timezone for timezone-aware validation
  const timezone = await getBusinessTimezone(db);

  // 0. Check if date is in the past (timezone-aware)
  if (isPastDateInTimezone(date, timezone)) {
    const error = "Cannot book appointments in the past";
    console.log(`❌ [validateSlotForBooking] ${error} (timezone: ${timezone})`);
    return { valid: false, error };
  }

  // 0.5. Check if datetime is in the past (for today's date) - timezone-aware
  if (isPastDateTimeInTimezone(date, time, timezone)) {
    const error = "Cannot book appointments in the past";
    console.log(`❌ [validateSlotForBooking] ${error} (timezone: ${timezone})`);
    return { valid: false, error };
  }

  // 1. Check time alignment with slot boundaries
  if (!isTimeAlignedWithSlots(time, slotDuration)) {
    const error = `Time ${time} must align with ${slotDuration}-minute slot boundaries (e.g., :00, :${slotDuration}, :${slotDuration * 2}, etc.)`;
    console.log(`❌ [validateSlotForBooking] ${error}`);
    return { valid: false, error };
  }

  // 2. Check special days (highest priority)
  const specialDaysRef = db.collection("specialDays");
  const specialSnapshot = await specialDaysRef.get();
  
  const specialDays = specialSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const isClosed = specialDays.some(
    (sd: any) => sd.dates?.includes(date) && sd.isClosed
  );

  if (isClosed) {
    const error = "This date is closed for bookings";
    console.log(`❌ [validateSlotForBooking] ${error}`);
    return { valid: false, error };
  }

  // 3. Get availability windows (planned dates or weekly template)
  const plannedRef = db.collection("plannedDates");
  const plannedQuery = plannedRef.where("date", "==", date);
  const plannedSnapshot = await plannedQuery.get();

  let availableSlots: TimeSlot[] = [];

  if (!plannedSnapshot.empty) {
    // Use planned date slots
    const plannedData = plannedSnapshot.docs[0].data();
    availableSlots = plannedData.slots || [];
  } else {
    // Fall back to weekly template
    const templateRef = db.collection("settings").doc("weeklyTemplate");
    const templateDoc = await templateRef.get();

    if (templateDoc.exists) {
      const template = templateDoc.data() as WeeklyTemplate;
      const dateObj = new Date(date + "T00:00:00");
      const dayOfWeek = dateObj.getDay();
      const dayNames = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ];
      const dayName = dayNames[dayOfWeek] as keyof WeeklyTemplate;
      availableSlots = template[dayName] || [];
    }
  }

  if (availableSlots.length === 0) {
    const error = "No availability configured for this date";
    console.log(`❌ [validateSlotForBooking] ${error}`);
    return { valid: false, error };
  }

  // 4. Check if time is within any availability window
  const timeMinutes = timeToMinutes(time);
  const isInAvailabilityWindow = availableSlots.some((slot) => {
    const windowStart = timeToMinutes(slot.start);
    const windowEnd = timeToMinutes(slot.end);
    return timeMinutes >= windowStart && timeMinutes < windowEnd;
  });

  if (!isInAvailabilityWindow) {
    const error = `Time ${time} is outside available hours for this date`;
    console.log(`❌ [validateSlotForBooking] ${error}`);
    return { valid: false, error };
  }

  // 5. Check if service duration fits at this time (using rounded duration)
  const slotsNeeded = calculateSlotsNeeded(serviceDuration, slotDuration);
  const bookingDuration = slotsNeeded * slotDuration; // Rounded duration (same as createPendingRequest)
  const endTime = calculateEndTime(time, bookingDuration);
  const endTimeMinutes = timeToMinutes(endTime);

  // 5.5. Also check business hours (if configured) as an additional safety check
  // Must use bookingDuration (rounded) not serviceDuration
  const businessSettingsRef = db.collection("settings").doc("business");
  const businessSettingsDoc = await businessSettingsRef.get();
  if (businessSettingsDoc.exists) {
    const businessSettings = businessSettingsDoc.data();
    const workingHours = businessSettings?.workingHours;
    if (workingHours) {
      const businessStart = timeToMinutes(workingHours.start);
      const businessEnd = timeToMinutes(workingHours.end);

      if (timeMinutes < businessStart) {
        const error = `Booking cannot start before business hours (${workingHours.start})`;
        console.log(`❌ [validateSlotForBooking] ${error}`);
        return { valid: false, error };
      }

      if (endTimeMinutes > businessEnd) {
        const error = `Booking cannot end after business hours (${workingHours.end})`;
        console.log(`❌ [validateSlotForBooking] ${error}`);
        return { valid: false, error };
      }
    }
  }

  // Check if service fits within available time ranges
  const fitsInRange = availableSlots.some((range) => {
    const rangeStart = timeToMinutes(range.start);
    const rangeEnd = timeToMinutes(range.end);
    return timeMinutes >= rangeStart && endTimeMinutes <= rangeEnd;
  });

  if (!fitsInRange) {
    const error = `Service duration (${serviceDuration} min) does not fit at ${time} within available hours`;
    console.log(`❌ [validateSlotForBooking] ${error}`);
    return { valid: false, error };
  }

  // 6. Check for collisions (sessions + pending bookings)
  const collisionCheck = await checkSlotCollisions(
    db,
    date,
    time,
    bookingDuration,
    slotDuration
  );

  if (!collisionCheck.valid) {
    console.log(`❌ [validateSlotForBooking] ${collisionCheck.error}`);
    return collisionCheck;
  }

  console.log(`✅ [validateSlotForBooking] Slot is valid`);
  return { valid: true };
}

/**
 * Check if a time slot has collisions with existing bookings
 */
async function checkSlotCollisions(
  db: admin.firestore.Firestore,
  date: string,
  startTime: string,
  bookingDuration: number,
  slotDuration: number
): Promise<{ valid: boolean; error?: string }> {
  const { calculateSlotsNeeded } = await import("../utils/slotHelpers");
  
  // Calculate which slots this booking would occupy
  const endTime = calculateEndTime(startTime, bookingDuration);
  const requiredSlots = generateSlotsInRange(startTime, endTime, slotDuration);
  
  console.log(`🔍 [checkSlotCollisions] Checking slots: ${requiredSlots.join(", ")}`);

  // Check sessions (approved/pending bookings)
  const sessionsRef = db.collection("sessions");
  const sessionsQuery = sessionsRef
    .where("date", "==", date)
    .where("status", "in", ["approved", "pending"]);
  const sessionsSnapshot = await sessionsQuery.get();

  console.log(`📊 [checkSlotCollisions] Found ${sessionsSnapshot.size} sessions for ${date}`);

  for (const doc of sessionsSnapshot.docs) {
    const data = doc.data();
    const existingStartTime = data.time;
    const existingDuration = data.duration || 60;
    
    const existingSlotsNeeded = calculateSlotsNeeded(existingDuration, slotDuration);
    const existingTotalDuration = existingSlotsNeeded * slotDuration;
    const existingEndTime = calculateEndTime(existingStartTime, existingTotalDuration);
    
    const existingSlots = generateSlotsInRange(existingStartTime, existingEndTime, slotDuration);
    
    // Check for overlap
    const hasOverlap = requiredSlots.some(slot => existingSlots.includes(slot));
    if (hasOverlap) {
      const error = `Time slot overlaps with existing booking: ${existingStartTime}-${existingEndTime}`;
      console.log(`❌ [checkSlotCollisions] ${error}`);
      return { valid: false, error };
    }
  }

  // Check pending bookings
  const pendingRef = db.collection("pendingBookings");
  const pendingQuery = pendingRef.where("date", "==", date);
  const pendingSnapshot = await pendingQuery.get();

  console.log(`📊 [checkSlotCollisions] Found ${pendingSnapshot.size} pending bookings for ${date}`);

  for (const doc of pendingSnapshot.docs) {
    const data = doc.data();
    const existingStartTime = data.time;
    const existingDuration = data.duration || 60;
    
    const existingSlotsNeeded = calculateSlotsNeeded(existingDuration, slotDuration);
    const existingTotalDuration = existingSlotsNeeded * slotDuration;
    const existingEndTime = calculateEndTime(existingStartTime, existingTotalDuration);
    
    const existingSlots = generateSlotsInRange(existingStartTime, existingEndTime, slotDuration);
    
    // Check for overlap
    const hasOverlap = requiredSlots.some(slot => existingSlots.includes(slot));
    if (hasOverlap) {
      const error = `Time slot overlaps with existing pending booking: ${existingStartTime}-${existingEndTime}`;
      console.log(`❌ [checkSlotCollisions] ${error}`);
      return { valid: false, error };
    }
  }

  console.log(`✅ [checkSlotCollisions] No collisions found`);
  return { valid: true };
}

