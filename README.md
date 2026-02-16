# Chicken Tracker

A lightweight browser app for tracking:

- Egg production
- Feed usage
- Water usage
- Health/care notes
- Recurring chores
- Supplies/inventory levels
- Household member activity

## Run

Open `index.html` in a browser (e.g. double-click or drag into a browser window).

## Features

- Daily logging forms for eggs, feed, water, and care notes
- Dashboard cards for today's totals, due chores, and low supplies
- Charts for production, feed/water consumption, and member activity
- Imperial units for measurements (`lb`, `gal`)
- Recurring task scheduler with due indicators and "Mark Done"
- Inventory list with low-stock alerts and quick +/- controls
- Household member profiles with active logger switching
- Responsive mobile + laptop layout
- Collapsible Settings panel to keep the dashboard focused
- Local data persistence in browser storage (local-first)
- Optional sync via Firebase (Google sign-in, multi-device family sharing)
- JSON export/import backup tools

## Units

- Feed is tracked in `lb`.
- Water is tracked in `gal`.
- Existing saved metric data is converted to imperial one time when loaded.

## Multi-User Setup

1. Add each household member in **Household Team**.
2. Select the current person in **Active Logger** before entering records.
3. Records and task completions are tagged by member.
4. If someone was deleted/renamed, use **Merge Member Records** to merge old stats into another person.

## Firebase Sync (optional)

1. In `firebase.js`, set `FIREBASE_CONFIG` with your Firebase project credentials.
2. In Firebase Console, create a Realtime Database (locked mode) and add the security rules described in `IMPROVEMENTS.md`.
3. Open the app and click **Sign In with Google**.
4. Create or select a flock, then use **Push to Cloud** / **Pull from Cloud** to sync.
5. Optionally enable **Auto-sync after changes**.
6. To share with family, add their Google account UIDs to the flock’s `sharedWith` in Firebase (see `IMPROVEMENTS.md`).

## Data

All data is stored in your browser `localStorage` under key:

`chicken_tracker_v2`
