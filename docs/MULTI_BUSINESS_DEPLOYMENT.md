# Multi-Business Deployment Strategy

> **Status:** Planned for future implementation  
> **Last Updated:** January 2026

## Overview

This document outlines the strategy for deploying Calendi as independent projects for multiple businesses. Each business will have its own Firebase project with isolated data, configurations, and customizations.

---

## Architecture

```
Calendi Core Codebase
        │
        ├── Business A (Firebase Project A)
        │   ├── Own Firestore database
        │   ├── Own Authentication
        │   ├── Own Cloud Functions
        │   └── Own Hosting (calendi-client-a.web.app)
        │
        ├── Business B (Firebase Project B)
        │   └── ...
        │
        └── Business C (Firebase Project C)
            └── ...
```

---

## Files That Change Per Business

### Must Change

| File | Purpose | What Changes |
|------|---------|--------------|
| `.firebaserc` | Firebase project reference | `projects.default` project ID |
| `.env.local` | Environment config | All Firebase keys + VAPID key |
| `public/firebase-messaging-sw.js` | Push notifications | Firebase config (currently hardcoded!) |
| `functions/.env` or Firebase config | Server secrets | UltraMsg token, instance ID |

### May Change (customizations)

| File | Purpose |
|------|---------|
| `public/manifest.json` | PWA name, colors |
| `public/icons/*` | Business logo/branding |
| App theme/colors | Business branding |

---

## Environment Variables

### Client-Side (`.env.local`)

These get baked into the JavaScript bundle at build time. They are **public** (visible in browser).

```env
# Firebase Config
NEXT_PUBLIC_FIREBASE_API_KEY=xxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxx
NEXT_PUBLIC_FIREBASE_PROJECT_ID=xxx
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=xxx
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=xxx
NEXT_PUBLIC_FIREBASE_APP_ID=xxx

# Push Notifications
NEXT_PUBLIC_FIREBASE_VAPID_KEY=xxx
```

### Server-Side (Cloud Functions)

These are **secret** and never exposed to the client.

```bash
# Set via Firebase CLI
firebase functions:config:set ultramsg.token="SECRET_TOKEN"
firebase functions:config:set ultramsg.instance="INSTANCE_ID"
```

---

## Deployment Options

### Option A: Git Branches Per Client

```
main (core code - never deploy directly)
  │
  ├── client-a (branch with their config)
  │   └── Deploy: firebase deploy
  │
  ├── client-b (branch with their config)
  │   └── Deploy: firebase deploy
  │
  └── client-c (branch with their config)
      └── Deploy: firebase deploy
```

**Pros:**
- Simple mental model
- Each client fully isolated
- Easy to add client-specific features

**Cons:**
- Merging core updates to all branches
- Many branches to maintain

### Option B: Config Files + Deploy Script

```
/configs/
  ├── client-a/
  │   ├── .env.local
  │   ├── .firebaserc
  │   └── firebase-messaging-sw.js
  │
  ├── client-b/
  │   └── ...
  │
  └── client-c/
      └── ...

# Deploy script
./deploy.sh client-a
```

**Deploy script would:**
1. Copy client config files to root
2. Run `npm run build`
3. Run `firebase deploy`

**Pros:**
- Single branch for core code
- Easy to update all clients
- Centralized config management

**Cons:**
- Need to build deploy tooling
- Client-specific features harder

---

## Current Issues to Fix

### 1. Hardcoded Firebase Config in Service Worker

**File:** `public/firebase-messaging-sw.js`

Currently Firebase config is hardcoded. Need to either:
- Generate at build time from env vars
- Or create per-client service worker files

### 2. Hardcoded Config in `app/lib/firebase/config.ts`

Should read from `process.env.NEXT_PUBLIC_*` variables.

---

## Security Notes

### Public Keys (OK to expose)
- Firebase API Key - just identifies the project
- VAPID Key - public key for web push

### Secret Keys (NEVER expose)
- UltraMsg Token - can send messages as you
- Firebase Admin SDK key - full database access
- Any payment processor secrets

**Rule:** If it goes to the browser (`NEXT_PUBLIC_*`), assume it's public.

---

## Setup Checklist for New Business

1. [ ] Create Firebase project in console
2. [ ] Enable Authentication (Email/Password)
3. [ ] Create Firestore database
4. [ ] Enable Cloud Messaging
5. [ ] Generate VAPID key pair
6. [ ] Set up Firestore security rules
7. [ ] Create `.env.local` with all config
8. [ ] Update `.firebaserc` with project ID
9. [ ] Update `firebase-messaging-sw.js` with config
10. [ ] Deploy Cloud Functions with secrets
11. [ ] Deploy Hosting
12. [ ] Create admin user account
13. [ ] Test push notifications

---

## Future Improvements

- [ ] Refactor all config to use environment variables
- [ ] Create deployment script for multi-client
- [ ] Add client branding configuration system
- [ ] Consider monorepo with shared packages
