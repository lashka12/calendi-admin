import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";

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
 * Generate weekly slots from template
 * Runs weekly (every Sunday at midnight) to auto-generate slots for the next week
 * Only generates for dates that don't have Planning or Specials
 */
export const generateWeeklySlots = onSchedule(
  {
    schedule: "0 0 * * 0", // Every Sunday at midnight
    timeZone: "Asia/Jerusalem",
  },
  async (event) => {
    console.log("🔄 Starting weekly slot generation...");

    try {
      const db = admin.firestore();

      // Get weekly template
      const templateRef = db.collection("settings").doc("weeklyTemplate");
      const templateDoc = await templateRef.get();

      if (!templateDoc.exists) {
        console.log("⚠️ No weekly template found. Skipping generation.");
        return;
      }

      const template = templateDoc.data() as WeeklyTemplate;
      const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

      // Get today's date
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Generate slots for next 7 days
      const slotsRef = db.collection("availableSlots");
      let generatedCount = 0;

      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        const dateStr = date.toISOString().split("T")[0];
        const dayOfWeek = date.getDay();
        const dayName = dayNames[dayOfWeek];

        // Check if special day exists (closed)
        const specialDaysRef = db.collection("specialDays");
        const specialQuery = specialDaysRef.where("dates", "array-contains", dateStr);
        const specialSnapshot = await specialQuery.get();

        if (!specialSnapshot.empty) {
          console.log(`⏭️ Skipping ${dateStr} - special day (closed)`);
          continue;
        }

        // Check if planned date exists
        const plannedRef = db.collection("plannedDates");
        const plannedQuery = plannedRef.where("date", "==", dateStr);
        const plannedSnapshot = await plannedQuery.get();

        if (!plannedSnapshot.empty) {
          console.log(`⏭️ Skipping ${dateStr} - planned date exists`);
          continue;
        }

        // Get slots for this day from template
        const daySlots = template[dayName as keyof WeeklyTemplate] || [];

        if (daySlots.length === 0) {
          console.log(`⏭️ Skipping ${dateStr} - no slots in template for ${dayName}`);
          continue;
        }

        // Generate time slots (15-minute intervals)
        const generatedSlots: string[] = [];

        for (const slot of daySlots) {
          const [startHour, startMin] = slot.start.split(":").map(Number);
          const [endHour, endMin] = slot.end.split(":").map(Number);
          const startMinutes = startHour * 60 + startMin;
          const endMinutes = endHour * 60 + endMin;

          // Generate 15-minute slots
          for (let minutes = startMinutes; minutes < endMinutes; minutes += 15) {
            const hours = Math.floor(minutes / 60);
            const mins = minutes % 60;
            const timeStr = `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
            generatedSlots.push(timeStr);
          }
        }

        if (generatedSlots.length === 0) {
          continue;
        }

        // Check if slots already exist for this date
        const existingQuery = slotsRef.where("date", "==", dateStr);
        const existingSnapshot = await existingQuery.get();

        if (existingSnapshot.empty) {
          // Create new
          await slotsRef.add({
            date: dateStr,
            slots: generatedSlots,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            generatedBy: "weeklyTemplate",
          });
          generatedCount++;
          console.log(`✅ Generated ${generatedSlots.length} slots for ${dateStr}`);
        } else {
          // Update existing (only if not manually set)
          const existingDoc = existingSnapshot.docs[0];
          const existingData = existingDoc.data();
          
          // Only update if it was auto-generated (not manually set)
          if (existingData.generatedBy === "weeklyTemplate" || !existingData.createdBy) {
            await existingDoc.ref.update({
              slots: generatedSlots,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              generatedBy: "weeklyTemplate",
            });
            generatedCount++;
            console.log(`✅ Updated ${generatedSlots.length} slots for ${dateStr}`);
          } else {
            console.log(`⏭️ Skipping ${dateStr} - manually set slots exist`);
          }
        }
      }

      console.log(`✅ Weekly slot generation complete. Generated/updated ${generatedCount} days.`);
    } catch (error: any) {
      console.error("❌ Failed to generate weekly slots:", error.message);
      throw error;
    }
  }
);




