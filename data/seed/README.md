# Seed Data

This folder contains seed data files (JSON) for populating Firestore with initial test data.

**Location**: `/data/seed/` (version controlled in git)

## Files

- `services.json` - Initial services to import to Firestore

## Best Practice Workflow

### First Time Setup

1. **Start emulators (empty):**
   ```bash
   npm run emulators:start
   ```

2. **Seed initial data:**
   ```bash
   npm run seed
   ```

3. **Export the state:**
   ```bash
   npm run emulators:export
   ```

4. **Now emulators auto-import on every start:**
   ```bash
   npm run emulators  # Automatically loads exported data
   ```

### Daily Development

Just run:
```bash
npm run emulators  # Auto-imports exported data
```

### When You Need Fresh Data

```bash
# Option 1: Clear and start fresh
npm run emulators:reset

# Option 2: Just reseed (if emulators already running)
npm run seed
```

### Quick Setup (All-in-One)

```bash
npm run setup:dev  # Starts emulators, seeds, and exports
```

## Services JSON Format

```json
{
  "services": [
    {
      "names": {
        "en": "Service Name (English)",
        "he": "שם השירות (עברית)",
        "ar": "اسم الخدمة (عربي)"
      },
      "descriptions": {
        "en": "Service description in English",
        "he": "תיאור השירות בעברית",
        "ar": "وصف الخدمة بالعربية"
      },
      "price": 150,
      "duration": 60,
      "active": true
    }
  ]
}
```

## Adding More Data Files

You can add more JSON files here:
- `users.json` - Test users
- `sessions.json` - Sample bookings
- `settings.json` - Business settings

Then create corresponding seed scripts in this folder (similar to `seedData.js`).

## See Also

- `/docs/SEED_DATA_BEST_PRACTICES.md` - Complete guide on best practices
- `seedData.js` - Seed script (in this folder)
