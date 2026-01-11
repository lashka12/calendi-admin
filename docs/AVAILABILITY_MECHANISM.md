# Availability Mechanism - Design Specification

## Overview

The availability system supports two types of businesses with flexible scheduling needs:
1. **Fixed-Schedule Businesses**: Have consistent weekly hours (e.g., barber working Sun-Fri, 9-5)
2. **Planning-Based Businesses**: Need to manually plan availability every X weeks

The system uses a **hybrid approach** that allows both types to coexist, with a clear priority system for determining which slots are available on any given date.

---

## Core Principles

### 1. Priority System (Highest to Lowest)

```
Specials → Planning → Weekly
```

**Priority Rules:**
1. **Specials** (Highest Priority)
   - Purpose: Block/close specific days
   - Behavior: If a special day exists for a date → **CLOSED** (no slots available)
   - Use cases: Holidays, closures, one-time events

2. **Planning** (Medium Priority)
   - Purpose: Set custom slots for specific dates
   - Behavior: Overrides Weekly default for that specific date
   - Use cases: Custom hours, unpredictable schedules, one-off changes

3. **Weekly** (Lowest Priority - Default)
   - Purpose: Recurring weekly schedule template
   - Behavior: Base template, used when no Planning or Special exists
   - Use cases: Default recurring schedule, auto-generation base

### 2. Simple Override Approach

- **No merge logic**: Planning completely replaces Weekly for that date
- **No complex modes**: What you set is what you get
- **Predictable behavior**: Clear and easy to understand

### 3. Always Available Planning

- Planning tab is **always available** for all business types
- Fixed-schedule businesses can override specific dates without changing modes
- Acts as an "escape hatch" when schedules become unpredictable

---

## Business Types

### Fixed-Schedule Mode (Auto-Generate)

**Characteristics:**
- Has consistent weekly hours
- Weekly template auto-generates slots every week
- Planning available for exceptions/overrides

**Example:**
- Barber: Sun-Fri, 9-5 (auto-generates)
- Can still plan specific dates manually if needed

**Workflow:**
1. Set Weekly default schedule
2. System auto-generates slots from template
3. Use Planning tab to override specific dates when needed

### Planning-Based Mode (Manual-Only)

**Characteristics:**
- Schedule changes frequently
- Needs to plan availability every X weeks
- Weekly template exists but doesn't auto-generate

**Example:**
- Freelancer: Plans availability 2 weeks ahead
- Weekly template can be used as starting point

**Workflow:**
1. Set Weekly template (optional, as starting point)
2. Manually plan dates in Planning tab
3. Weekly template doesn't auto-generate

---

## Data Model

### Weekly Template

```typescript
weeklyTemplate: {
  monday: [
    { start: "09:00", end: "12:00" },
    { start: "14:00", end: "18:00" }
  ],
  tuesday: [
    { start: "09:00", end: "17:00" }
  ],
  // ... other days
}
```

**Features:**
- Multiple time slots per day supported
- Can be updated anytime (living template)
- Used as base for auto-generation (fixed-schedule mode)
- Used as template/starting point (planning-based mode)

### Planned Dates

```typescript
plannedDates: {
  "2025-12-11": [
    { start: "09:00", end: "12:00" },
    { start: "14:00", end: "18:00" }
  ],
  "2025-12-15": [
    { start: "10:00", end: "16:00" }
  ]
}
```

**Features:**
- Multiple time slots per date supported
- Completely replaces Weekly default for that date
- No merge logic - simple override

### Special Days

```typescript
specialDays: [
  {
    id: "1",
    name: "Christmas Day",
    dates: ["2025-12-25"],
    recurring: true,
    recurringPattern: "Yearly on December 25",
    isClosed: true  // Always true - specials only block/close
  }
]
```

**Features:**
- Only used to block/close days
- `isClosed` is always `true` (or field can be removed)
- Highest priority - overrides everything

---

## Slot Generation Logic

### Slot-Based System

The system uses a **slot-based approach** with configurable slot duration:

- **Slot Duration**: Configurable minimum bookable time unit (default: 15 minutes)
- **Time Ranges**: Stored as start/end times (e.g., "09:00" - "17:00")
- **Slot Generation**: Time ranges are converted to discrete slots based on slot duration
- **Service Duration Rounding**: Service durations are rounded up to full slots when booking

### Slot Duration Configuration

**Location**: `settings/bookingSettings.slotDuration`

**Default Value**: 15 minutes (if not configured)

**How it works**:
```typescript
// Get slot duration from settings
const slotDuration = await getSlotDuration(db);
// Returns: configured value or 15 (default)
```

**Example**:
- Slot duration: 15 minutes → slots at :00, :15, :30, :45
- Slot duration: 30 minutes → slots at :00, :30
- Slot duration: 60 minutes → slots at :00

### Algorithm

```typescript
function getAvailableTimeSlots(date: string, serviceDuration?: number): string[] {
  // 1. Check Specials first (highest priority)
  if (hasSpecialDay(date) && specialDay.isClosed) {
    return []; // Closed - no slots available
  }
  
  // 2. Check Planning (medium priority)
  let timeRanges: TimeSlot[] = [];
  if (hasPlannedDate(date)) {
    timeRanges = plannedDate.slots; // Custom slots - replaces weekly
  } else {
    // 3. Fall back to Weekly (lowest priority)
    const dayOfWeek = getDayOfWeek(date);
    timeRanges = weeklyTemplate[dayOfWeek] || [];
  }
  
  // 4. Get slot duration from settings
  const slotDuration = getSlotDuration(); // Default: 15 minutes
  
  // 5. Generate slots from time ranges
  const allSlots: string[] = [];
  for (const range of timeRanges) {
    const slots = generateSlotsInRange(range.start, range.end, slotDuration);
    allSlots.push(...slots);
  }
  
  // 6. Filter out booked times (sessions + pending bookings)
  // Bookings round up service duration to full slots
  const bookedSlots = getBookedSlots(date, slotDuration);
  const availableSlots = allSlots.filter(slot => !bookedSlots.has(slot));
  
  // 7. Filter out past times (if today)
  const today = new Date().toISOString().split("T")[0];
  if (date === today) {
    const now = new Date();
    return availableSlots.filter(slot => {
      const [hour, minute] = slot.split(":").map(Number);
      const slotTime = new Date();
      slotTime.setHours(hour, minute, 0, 0);
      return slotTime > now;
    });
  }
  
  // 8. If serviceDuration provided, filter slots that can fit the service
  if (serviceDuration) {
    return filterSlotsForService(availableSlots, serviceDuration, slotDuration, timeRanges);
  }
  
  return availableSlots;
}
```

### Slot Generation from Ranges

**Function**: `generateSlotsInRange(startTime, endTime, slotDuration)`

**Example**:
- Range: "09:00" - "12:00"
- Slot duration: 15 minutes
- Generated slots: ["09:00", "09:15", "09:30", "09:45", "10:00", "10:15", ..., "11:45"]

**Example**:
- Range: "09:00" - "12:00"
- Slot duration: 30 minutes
- Generated slots: ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"]

### Service Duration Rounding

**Function**: `calculateSlotsNeeded(serviceDuration, slotDuration)`

**How it works**:
- Service duration is rounded **up** to the nearest multiple of slot duration
- Example: Service 50 min, slot 30 min → needs 2 slots (60 min total)
- Example: Service 45 min, slot 15 min → needs 3 slots (45 min total - perfect fit)
- Example: Service 20 min, slot 15 min → needs 2 slots (30 min total - 10 min buffer)

**Booking Duration Calculation**:
```typescript
const slotsNeeded = Math.ceil(serviceDuration / slotDuration);
const bookingDuration = slotsNeeded * slotDuration;
// Example: 50 min service, 30 min slots → 2 slots → 60 min booking
```

### Booked Slots Calculation

When checking availability, the system:
1. Gets all sessions (approved/pending bookings) for the date
2. Gets all pending bookings for the date
3. For each booking:
   - Calculates slots needed (rounds up service duration)
   - Generates all slots occupied by the booking
   - Marks those slots as booked

**Example**:
- Booking: 10:00, service 50 min, slot 30 min
- Slots needed: 2 (60 min total)
- Occupied slots: ["10:00", "10:30"]

### Auto-Generation (Fixed-Schedule Mode)

For fixed-schedule businesses, a Cloud Function runs weekly to generate slots:

```typescript
// Weekly cron job (every Sunday at midnight)
function generateWeeklySlots() {
  const nextWeek = getNextWeekDates();
  
  for (const date of nextWeek) {
    // Skip if special day exists (closed)
    if (hasSpecialDay(date)) continue;
    
    // Skip if already planned (planning takes priority)
    if (hasPlannedDate(date)) continue;
    
    // Generate from weekly template
    const dayOfWeek = getDayOfWeek(date);
    const slots = weeklyTemplate[dayOfWeek];
    
    if (slots && slots.length > 0) {
      createSlotsForDate(date, slots);
    }
  }
}
```

---

## User Flows

### Flow 1: Fixed-Schedule Business (Normal Operation)

1. **Initial Setup:**
   - Go to Availability → Weekly tab
   - Set default schedule (e.g., Mon-Fri, 9-5)
   - Save

2. **Auto-Generation:**
   - System auto-generates slots every week from template
   - No manual intervention needed

3. **Exception Handling:**
   - Need different hours for specific date?
   - Go to Planning tab → Select date → Set custom slots → Save
   - That date now uses Planning slots instead of Weekly

### Flow 2: Planning-Based Business

1. **Initial Setup (Optional):**
   - Go to Availability → Weekly tab
   - Set template schedule (used as starting point)
   - Save

2. **Planning Workflow:**
   - Go to Availability → Planning tab
   - Select dates in calendar
   - Set time slots for each date
   - Save

3. **Repeat:**
   - Plan next X weeks as needed
   - Weekly template remains but doesn't auto-generate

### Flow 3: Schedule Evolution (Unpredictable → Routine)

1. **Start:** Fixed-schedule with Weekly default (9-5)

2. **Becomes Unpredictable:**
   - Use Planning tab to manually plan all dates
   - Weekly still exists but Planning overrides everything

3. **New Pattern Emerges:**
   - Update Weekly template to match new routine (e.g., Mon-Wed 10-3, Thu-Fri 9-5)
   - Start using auto-generation again with new template

4. **Result:** Natural evolution without mode switching

### Flow 4: Mixed Approach (Some Days Planned, Some Default)

**Example:**
- Weekly default: Mon-Fri, 9-5
- Planning:
  - Monday: 10-2 (planned)
  - Tuesday: 10-2 (planned)
  - Wednesday: (not planned → uses Weekly 9-5)
  - Thursday: (not planned → uses Weekly 9-5)
  - Friday: 10-2 (planned)

**Result:**
- Mon, Tue, Fri: Use Planning slots (10-2)
- Wed, Thu: Use Weekly default (9-5)

---

## UI/UX Guidelines

### Weekly Tab

**Fixed-Schedule Mode:**
- Label: "Default Schedule" or "Recurring Hours"
- Description: "This schedule auto-generates every week"
- Show: Days of week with time slots
- Support: Multiple slots per day

**Planning-Based Mode:**
- Label: "Weekly Template"
- Description: "Use as starting point for planning"
- Show: Days of week with time slots
- Support: Multiple slots per day

### Planning Tab

**For All Modes:**
- Calendar view for date selection
- Time slot editor for selected date
- Support: Multiple slots per date
- Visual indicators:
  - Planned dates: Amber/yellow highlight
  - Dates using weekly: Gray/default
  - Special days: Red/closed indicator

**Info Messages:**
- "Planning dates override your weekly schedule"
- "This date uses your weekly default"

### Specials Tab

**For All Modes:**
- List of special days (holidays, closures)
- Add/Edit/Delete special days
- Always sets `isClosed: true`
- Purpose: Block/close days only

---

## Examples

### Example 1: Barber (Fixed-Schedule)

**Weekly Default:**
- Sunday: 9-5
- Monday: 9-5
- Tuesday: 9-5
- Wednesday: 9-5
- Thursday: 9-5
- Friday: 9-5
- Saturday: Closed

**Planning:**
- Dec 15 (Monday): 10-3 (custom hours)
- Dec 20 (Saturday): 9-2 (special opening)

**Specials:**
- Dec 25: Christmas (closed)

**Result:**
- Dec 15: Uses Planning (10-3) - overrides Weekly
- Dec 20: Uses Planning (9-2) - overrides Weekly
- Dec 25: Uses Specials (closed) - overrides everything
- Other dates: Use Weekly default (9-5)

### Example 2: Freelancer (Planning-Based)

**Weekly Template:**
- Monday: 9-12, 14-18
- Tuesday: 9-12, 14-18
- Wednesday: 9-12, 14-18
- Thursday: 9-12, 14-18
- Friday: 9-12, 14-18

**Planning (Next 2 Weeks):**
- Dec 11: 10-12, 15-17
- Dec 12: 9-11
- Dec 13: 14-18
- Dec 15: 10-16
- (Only planned dates have slots)

**Result:**
- Planned dates: Use Planning slots
- Unplanned dates: No slots (weekly doesn't auto-generate)

### Example 3: Mixed Approach

**Weekly Default:**
- Monday: 9-12, 14-18
- Tuesday: 9-5
- Wednesday: 9-5
- Thursday: 9-5
- Friday: 9-5

**Planning:**
- Dec 11 (Monday): 10-2 (planned)
- Dec 12 (Tuesday): 10-2 (planned)
- Dec 13 (Wednesday): (not planned)
- Dec 14 (Thursday): (not planned)
- Dec 15 (Friday): 10-2 (planned)

**Result:**
- Dec 11, 12, 15: Use Planning slots (10-2)
- Dec 13, 14: Use Weekly default (9-5)

---

## Edge Cases

### Edge Case 1: Special + Planning on Same Date

**Scenario:**
- Special: Dec 25 (Christmas - closed)
- Planning: Dec 25 (9-5 slots)

**Result:**
- Special wins (highest priority)
- Date is closed, Planning ignored

### Edge Case 2: Planning Empty Slots

**Scenario:**
- Weekly: Monday 9-5
- Planning: Monday (empty slots array)

**Result:**
- Date has no slots (Planning overrides Weekly, even if empty)

### Edge Case 3: Weekly Template Updated

**Scenario:**
- Weekly template changed from 9-5 to 10-4
- Already planned dates remain unchanged
- Future auto-generated dates use new template

**Result:**
- Existing planned dates: Keep their slots
- Future dates: Use new Weekly template (unless planned)

### Edge Case 4: Extending Hours

**Scenario:**
- Weekly: 9-5
- Want to extend to 9-7 for specific date

**Solution:**
- Go to Planning → Select date → Set slots: 9-7
- Full range must be set (no merge logic)
- Simple and predictable

---

## Technical Implementation Notes

### Settings/Configuration

```typescript
// Slot Duration Configuration
settings/bookingSettings: {
  slotDuration: number  // Minimum bookable time unit in minutes (default: 15)
  // Examples: 15, 30, 60
  // Used to generate slots from time ranges
  // Service durations are rounded up to full slots
}

// Business Settings
businessSettings: {
  defaultScheduleMode: "auto-generate" | "manual-only"
  // auto-generate: Weekly template auto-creates slots
  // manual-only: Weekly template is just a template
  workingHours: {
    start: "08:00",  // Business opening time
    end: "21:00"     // Business closing time
  }
}
```

### Collections Structure

```typescript
// Firestore Collections

// Weekly template (single document)
weeklyTemplate: {
  monday: TimeSlot[],
  tuesday: TimeSlot[],
  // ...
}

// Planned dates (collection)
plannedDates/{dateId}: {
  date: string, // YYYY-MM-DD
  slots: TimeSlot[]
}

// Special days (collection)
specialDays/{specialId}: {
  name: string,
  dates: string[], // YYYY-MM-DD[]
  recurring: boolean,
  recurringPattern?: string,
  isClosed: true // Always true
}

// Note: We no longer store availableSlots collection
// Slots are generated on-demand from time ranges using getAvailableTimeSlots function

### Cloud Functions

1. **getAvailableTimeSlots** (Callable - Public)
   - **Purpose**: Get available time slots for a specific date
   - **Authentication**: None required (public)
   - **Parameters**:
     - `date` (string, required): Date in YYYY-MM-DD format
     - `serviceDuration` (number, optional): Service duration in minutes (filters slots)
   - **Returns**:
     ```typescript
     {
       success: true,
       date: "2025-12-10",
       slots: ["09:00", "09:15", "09:30", ...], // Array of time strings (HH:MM)
       totalAvailable: 32,
       totalBooked: 8
     }
     ```
   - **Algorithm**:
     1. Check special days (if closed, return empty)
     2. Check planned dates (if exists, use those ranges)
     3. Fall back to weekly template
     4. Get slot duration from settings (default: 15 minutes)
     5. Generate slots from time ranges using slot duration
     6. Get booked times (sessions + pending bookings, rounded up to slots)
     7. Filter out booked times and past times (if today)
     8. If serviceDuration provided, filter slots that can fit the service
   - **Usage**: Called by client booking interface when user selects a date

2. **generateWeeklySlots** (Scheduled)
   - Runs weekly (Sunday midnight)
   - Only for `auto-generate` mode
   - Generates slots from Weekly template
   - Respects priority (skips Specials and Planned dates)

3. **setAvailableSlots** (Callable)
   - Admin sets slots for specific date
   - Used by Planning tab
   - Validates date not in past
   - Validates slot format

4. **setWeeklyTemplate** (Callable)
   - Admin sets weekly availability template
   - Validates time ranges align with slot duration boundaries
   - Stores time ranges (not individual slots)

5. **setPlannedDate** (Callable)
   - Admin sets custom availability for specific date
   - Validates time ranges align with slot duration boundaries
   - Stores time ranges (not individual slots)

---

## Summary

### Key Design Decisions

1. **Hybrid Approach**: Supports both fixed-schedule and planning-based businesses
2. **Simple Override**: Planning replaces Weekly (no merge logic)
3. **Clear Priority**: Specials > Planning > Weekly
4. **Always Available Planning**: Escape hatch for all business types
5. **Living Template**: Weekly can be updated anytime
6. **Multiple Slots**: Both Weekly and Planning support multiple time ranges

### Benefits

- ✅ Flexible: Handles both business types
- ✅ Simple: Easy to understand and use
- ✅ Predictable: Clear behavior, no surprises
- ✅ Scalable: Natural evolution from fixed to unpredictable
- ✅ User-friendly: No complex modes or merge logic

---

## Future Considerations

### Potential Enhancements (Not in Initial Implementation)

1. **Bulk Planning**: Plan multiple dates at once
2. **Template Copying**: Copy Weekly template to Planning dates
3. **Recurring Planning**: "Plan every Monday for next month"
4. **Slot Templates**: Save common slot patterns
5. **Conflict Detection**: Warn if Planning conflicts with Specials

---

## Implementation Details

### Slot Duration System

**Default Value**: 15 minutes

**Configuration Location**: `settings/bookingSettings.slotDuration`

**How Slots Are Generated**:
1. Admin sets time ranges (e.g., "09:00" - "17:00")
2. System gets slot duration from settings (default: 15 min)
3. System generates slots: ["09:00", "09:15", "09:30", ..., "16:45"]
4. Slots are generated on-demand when fetching availability

**Service Duration Rounding**:
- Service duration: 50 minutes
- Slot duration: 30 minutes
- Slots needed: `Math.ceil(50 / 30) = 2 slots`
- Booking duration: `2 * 30 = 60 minutes`
- Waste/buffer: `60 - 50 = 10 minutes`

**Time Range Validation**:
- When setting weekly template or planned dates, time ranges must align with slot duration
- Example: If slot duration is 30 min, times must be at :00 or :30
- Validation happens in `setWeeklyTemplate` and `setPlannedDate` functions

**Time Alignment Validation**:
- All booking times must align with slot boundaries
- Example: If slot duration is 15 min, times must be at :00, :15, :30, :45
- Misaligned times (e.g., 09:05, 09:23) are rejected
- Validation happens in `createPendingRequest` and `getAvailableTimeSlots` (filters misaligned slots)
- Prevents collision detection bugs from misaligned slot arrays

**Shared Validation Service**:
- `slotValidationService.ts` provides centralized validation logic
- Used by both `getAvailableTimeSlots` (filtering) and `createPendingRequest` (validation)
- Ensures consistent validation rules across the system
- Validates:
  1. Time alignment with slot boundaries
  2. Special days (closed dates)
  3. Availability windows (weekly template, planned dates)
  4. Business hours (if configured)
  5. Service duration fit
  6. Collision detection (sessions + pending bookings)

### API Usage

**Client Booking Flow**:
1. User selects service → gets service duration
2. User selects date → calls `getAvailableTimeSlots(date, serviceDuration)`
3. Function returns available slots filtered by service duration (validated for time alignment)
4. User selects time slot
5. User enters details and receives OTP via WhatsApp
6. User completes booking → calls `createPendingRequest(code, bookingData)`
   - OTP verification happens internally
   - Comprehensive validation (time alignment, availability, collisions)
   - Creates pending booking request

**Function**: `getAvailableTimeSlots`
- **Endpoint**: Cloud Function (callable)
- **Input**: `{ date: "2025-12-10", serviceDuration: 50 }`
- **Output**: `{ success: true, slots: ["09:00", "09:30", ...], totalAvailable: 32 }`
- **No authentication required** (public endpoint)
- **Validation**: Filters out misaligned slots (safety check)

**Function**: `createPendingRequest`
- **Endpoint**: Cloud Function (callable)
- **Input**: `{ code: "1234", clientName: "...", phone: "...", date: "...", time: "...", serviceId: "..." }`
- **Output**: `{ success: true, bookingId: "...", message: "..." }`
- **No authentication required** (public endpoint)
- **Validation**: 
  - OTP verification (required, happens internally)
  - Time alignment with slot boundaries
  - Availability windows (weekly template, planned dates, special days)
  - Service duration fit
  - Collision detection (sessions + pending bookings)
- **Uses**: Shared validation service (`slotValidationService.ts`) for consistency

---

**Document Version:** 2.1  
**Last Updated:** 2025-12-19  
**Status:** Implementation Complete - Slot-Based System with Comprehensive Validation

## Recent Updates (2025-12-19)

### Security & Validation Improvements
1. **OTP Verification Integration**: `createPendingRequest` now verifies OTP internally before creating booking
2. **Time Alignment Validation**: All booking times must align with slot boundaries (prevents collision detection bugs)
3. **Shared Validation Service**: Centralized validation logic in `slotValidationService.ts` used by both `getAvailableTimeSlots` and `createPendingRequest`
4. **Comprehensive Validation**: Server-side validation includes:
   - Time alignment with slot boundaries
   - Availability windows (weekly template, planned dates, special days)
   - Business hours check
   - Service duration fit validation
   - Collision detection (sessions + pending bookings)
5. **Function Rename**: `createBooking` → `createPendingRequest` (more accurate naming)

### Bug Fixes
- Fixed business hours validation to use `bookingDuration` (rounded) instead of `serviceDuration`
- Fixed collision detection for misaligned times by enforcing time alignment validation

