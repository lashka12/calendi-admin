# Timezone Issues - Current Status & Solution Plan

## Problem Summary

Multiple functions have timezone-dependent past-time validation that fails when:
- Server timezone ≠ User timezone
- Server timezone ≠ Business timezone
- Emulator runs in different timezone than production

## Current Issues

### 1. **Session Creation** (`functions/src/booking/createSession.ts`)
- **Issue**: Uses `getTodayDateString()` and `now.getHours()`/`getMinutes()` which are server timezone dependent
- **Impact**: Can create sessions for past times if server timezone differs from user timezone
- **Line**: ~107-139

### 2. **Get Available Time Slots** (`functions/src/booking/getAvailableTimeSlots.ts`)
- **Issue**: Uses `isPastTime()` which compares server time with slot times
- **Impact**: Returns past time slots for today if server timezone differs
- **Line**: ~180

### 3. **Set Planned Date** (`functions/src/availability/setPlannedDate.ts`)
- **Issue**: Uses `new Date(date + "T00:00:00Z")` (UTC) but compares with `new Date()` (server timezone)
- **Impact**: Can add planned dates with past times for same day
- **Line**: ~52-60

### 4. **Set Available Slots** (`functions/src/slots/setAvailableSlots.ts`)
- **Issue**: Uses `new Date()` and `getHours()`/`getMinutes()` - server timezone dependent
- **Impact**: Can set slots for past times on today's date
- **Line**: ~82-111

### 5. **Create Pending Request** (`functions/src/booking/createPendingRequest.ts`)
- **Issue**: Uses `isPastDateTime()` which is server timezone dependent
- **Impact**: Can create pending bookings for past times
- **Line**: ~89

### 6. **Slot Validation Service** (`functions/src/booking/slotValidationService.ts`)
- **Issue**: Uses `isPastDateTime()` and `isPastDate()` - server timezone dependent
- **Impact**: Validation may fail incorrectly due to timezone mismatch
- **Line**: ~38, 45

### 7. **Helper Functions** (`functions/src/utils/helpers.ts`)
- **Issue**: 
  - `getTodayDateString()` - uses server timezone
  - `isPastDateTime()` - uses server timezone for time comparison
  - `isPastTime()` - uses server timezone
- **Impact**: All functions using these helpers are affected

## Why Deployment Won't Fully Solve This

### Current Understanding (Incorrect)
❌ "When deployed, functions and hosting are on the same server, so timezone issues will be resolved"

### Reality
✅ **Deployment won't solve it because:**

1. **Firebase Functions run in specific regions:**
   - `us-central1` (Iowa, USA) = UTC-6 (or UTC-5 with DST)
   - `europe-west1` (Belgium) = UTC+1 (or UTC+2 with DST)
   - `asia-east1` (Taiwan) = UTC+8
   - Your business might be in Israel (UTC+2) or another timezone

2. **User's client runs in their local timezone:**
   - User sends "17:00" meaning 17:00 in their local time
   - Server receives this and compares to server time
   - If server is UTC and user is UTC+2:
     - User's 17:00 = 15:00 UTC
     - Server's current time might be 16:59 UTC
     - Comparison: 15:00 UTC < 16:59 UTC = past ✅ (correct)
     - BUT if server interprets "17:00" as 17:00 UTC:
       - 17:00 UTC > 16:59 UTC = future ❌ (wrong!)

3. **The real issue:**
   - We're comparing **user's local time** (as a string) with **server's local time**
   - These are in different timezones, so comparison is invalid

## Proper Solution

### Option 1: Store Business Timezone (Recommended)
1. Add `timezone` field to `settings` collection (e.g., "Asia/Jerusalem", "America/New_York")
2. Convert all times to UTC for storage and comparison
3. Convert back to business timezone for display

### Option 2: Use UTC Consistently
1. Store all times in UTC
2. Convert to business timezone only for display
3. Compare all times in UTC

### Option 3: Client-Side Timezone
1. Client sends timezone offset with requests
2. Server converts to UTC for comparison
3. More complex but handles multiple timezones

## Recommended Approach

**Use Option 1: Store Business Timezone**

### Implementation Steps:
1. Add `timezone` to settings (default: "Asia/Jerusalem" or detect from location)
2. Create timezone utility functions:
   - `convertToUTC(date, time, timezone)` - Convert business time to UTC
   - `convertFromUTC(utcDate, timezone)` - Convert UTC to business time
   - `getCurrentBusinessTime(timezone)` - Get current time in business timezone
3. Update all validation functions to:
   - Get business timezone from settings
   - Convert input time to UTC
   - Compare with current UTC time
4. Update all display functions to convert back to business timezone

### Libraries Needed:
- `date-fns-tz` or `luxon` for timezone handling
- Or use native `Intl.DateTimeFormat` with timezone support

## Files That Need Updates

1. `functions/src/utils/helpers.ts` - Add timezone conversion functions
2. `functions/src/booking/createSession.ts` - Use timezone-aware validation
3. `functions/src/booking/getAvailableTimeSlots.ts` - Filter past times using business timezone
4. `functions/src/booking/createPendingRequest.ts` - Use timezone-aware validation
5. `functions/src/booking/slotValidationService.ts` - Use timezone-aware validation
6. `functions/src/availability/setPlannedDate.ts` - Validate using business timezone
7. `functions/src/slots/setAvailableSlots.ts` - Filter past times using business timezone
8. `functions/src/booking/validators.ts` - Use timezone-aware validation

## Temporary Workaround (Current)

The current string-based comparison (`timeStr < currentTime`) works **only if**:
- Server timezone = Business timezone
- OR we accept that validation uses server timezone (not ideal)

This is why it works in some cases but fails in others.

## Next Steps

1. ✅ Document all affected functions (this file)
2. ⏸️ Wait for decision on timezone solution approach
3. ⏳ Implement timezone-aware validation
4. ⏳ Test with different timezones
5. ⏳ Update documentation

---

**Last Updated**: 2025-12-19  
**Status**: Documented - Awaiting implementation decision

