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

Open `/Users/jeff/Desktop/Chicken Tracker/index.html` in a browser.

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
- Optional iCloud sync with Apple ID (CloudKit JS pull/push + auto-push)
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

## iCloud Setup (CloudKit JS)

1. In `/Users/jeff/Desktop/Chicken Tracker/app.js`, set:
   - `CLOUDKIT_CONTAINER_ID`
   - `CLOUDKIT_ENVIRONMENT` (`development` or `production`)
   - `CLOUDKIT_API_TOKEN`
2. Open the app and click **Sign In with Apple**.
3. Click **Push to iCloud** to upload this device's state.
4. On other Apple devices signed into the same Apple ID, click **Pull from iCloud**.
5. Optionally enable **Auto-push after changes**.

## Current CloudKit Scope

- Current implementation syncs one shared app snapshot in the signed-in user's private iCloud database.
- Multi-Apple-ID family sharing via CloudKit record sharing is a separate step and not yet implemented in this web app.

## Data

All data is stored in your browser `localStorage` under key:

`chicken_tracker_v2`
