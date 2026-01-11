import * as admin from "firebase-admin";

/**
 * Get slot duration from businessSettings (default: 15 minutes)
 */
export async function getSlotDuration(
  db: admin.firestore.Firestore
): Promise<number> {
  try {
    const settingsRef = db.collection("settings").doc("businessSettings");
    const settingsDoc = await settingsRef.get();

    if (settingsDoc.exists) {
      const data = settingsDoc.data();
      const slotDuration = data?.slotDuration;
      if (typeof slotDuration === "number" && slotDuration > 0) {
        return slotDuration;
      }
    }

    // Default to 15 minutes
    return 15;
  } catch (error) {
    console.error("Error getting slot duration, using default 15:", error);
    return 15;
  }
}

/**
 * Validate that a time aligns with slot duration boundaries
 * Example: If slotDuration = 30, only :00 and :30 are valid
 */
export function isTimeAlignedWithSlots(
  time: string,
  slotDuration: number
): boolean {
  const [, minutes] = time.split(":").map(Number);
  return minutes % slotDuration === 0;
}

/**
 * Validate that a time range aligns with slot duration
 * Both start and end times must align with slot boundaries
 */
export function validateTimeRangeAlignment(
  startTime: string,
  endTime: string,
  slotDuration: number
): { valid: boolean; error?: string } {
  if (!isTimeAlignedWithSlots(startTime, slotDuration)) {
    return {
      valid: false,
      error: `Start time ${startTime} must align with ${slotDuration}-minute slot boundaries (e.g., :00, :${slotDuration}, :${slotDuration * 2}, etc.)`,
    };
  }

  if (!isTimeAlignedWithSlots(endTime, slotDuration)) {
    return {
      valid: false,
      error: `End time ${endTime} must align with ${slotDuration}-minute slot boundaries (e.g., :00, :${slotDuration}, :${slotDuration * 2}, etc.)`,
    };
  }

  return { valid: true };
}

/**
 * Generate time slots in a range based on slot duration
 */
export function generateSlotsInRange(
  startTime: string,
  endTime: string,
  slotDuration: number
): string[] {
  const slots: string[] = [];
  const [startHour, startMin] = startTime.split(":").map(Number);
  const [endHour, endMin] = endTime.split(":").map(Number);

  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  for (let minutes = startMinutes; minutes < endMinutes; minutes += slotDuration) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const timeStr = `${hours.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}`;
    slots.push(timeStr);
  }

  return slots;
}

/**
 * Calculate how many slots a service duration needs (rounds up)
 */
export function calculateSlotsNeeded(
  serviceDuration: number,
  slotDuration: number
): number {
  return Math.ceil(serviceDuration / slotDuration);
}

