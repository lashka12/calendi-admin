# Data Folder

This folder contains all data-related files for the project, organized into subfolders.

## Structure

```
/data/
  /seed/          # Seed data files (version controlled)
    - services.json
    - README.md
  /emulator/      # Exported emulator state (git-ignored)
    - firestore_export/
    - auth_export/
    - firebase-export-metadata.json
```

## Folders

### `/seed/` - Seed Data (Version Controlled)

Contains JSON files with initial test data that gets imported to Firestore.

**Files:**
- `services.json` - Initial services to import

**Usage:**
```bash
npm run seed  # Imports data from seed files
```

See `/data/seed/README.md` for more details.

### `/emulator/` - Emulator Exports (Git-Ignored)

Contains exported state from Firebase Emulators. This is generated automatically and not version controlled.

**Usage:**
```bash
npm run emulators:export  # Exports current emulator state here
npm run emulators        # Imports from here on startup
```

## Best Practice Workflow

### First Time Setup
1. Start emulators: `npm run emulators:start`
2. Seed data: `npm run seed` (reads from `/data/seed/`)
3. Export state: `npm run emulators:export` (saves to `/data/emulator/`)

### Daily Development
```bash
npm run emulators  # Auto-imports from /data/emulator/
```

## See Also

- `/docs/FIREBASE_DEVELOPMENT_WORKFLOW.md` - Complete development guide
- `/data/seed/README.md` - Seed data documentation
