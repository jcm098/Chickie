/**
 * CloudKit sync module for Chicken Tracker
 * Handles Apple iCloud sync via CloudKit
 */

// CloudKit configuration - UPDATE THESE IN PRODUCTION
const CLOUDKIT_CONTAINER_ID = "iCloud.com.example.chickentracker";
const CLOUDKIT_ENVIRONMENT = "development";
const CLOUDKIT_API_TOKEN = "REPLACE_WITH_CLOUDKIT_WEB_API_TOKEN";
const CLOUDKIT_RECORD_TYPE = "ChickenTrackerSnapshot";
const CLOUDKIT_RECORD_NAME = "global-state";

let autoSyncTimer = null;
let cloudKitContainer = null;
let cloudKitDb = null;
let cloudKitSignedIn = false;
let cloudKitAvailable = false;

/**
 * Initialize CloudKit
 */
async function initCloudKit() {
  try {
    if (!window.CloudKit) {
      throw new Error("CloudKit SDK not loaded");
    }

    if (!CLOUDKIT_CONTAINER_ID.includes(".") || CLOUDKIT_API_TOKEN.startsWith("REPLACE_")) {
      setSyncStatus("Configure CloudKit container ID and web API token in cloudkit.js.", true);
      updateSyncButtons();
      return;
    }

    window.CloudKit.configure({
      services: {
        fetch: window.fetch.bind(window)
      },
      containers: [
        {
          containerIdentifier: CLOUDKIT_CONTAINER_ID,
          apiTokenAuth: {
            apiToken: CLOUDKIT_API_TOKEN,
            persist: true
          },
          environment: CLOUDKIT_ENVIRONMENT
        }
      ]
    });

    cloudKitContainer = window.CloudKit.getDefaultContainer();
    cloudKitDb = cloudKitContainer.privateCloudDatabase;
    cloudKitAvailable = true;

    await cloudKitContainer.setUpAuth();
    const user = await getCloudKitUser();
    cloudKitSignedIn = Boolean(user);
    updateSyncButtons();
    setSyncStatus(
      cloudKitSignedIn
        ? `Signed in to iCloud as ${user.nameComponents?.givenName || "Apple user"}.`
        : "Not signed in. Use Sign In with Apple for iCloud sync."
    );
  } catch (error) {
    cloudKitAvailable = false;
    cloudKitSignedIn = false;
    updateSyncButtons();
    const msg = handleError(error, "CloudKit initialization");
    setSyncStatus(msg, true);
  }
}

/**
 * Sign in to CloudKit with Apple ID
 */
async function signInCloudKit() {
  try {
    if (!cloudKitContainer) {
      await initCloudKit();
    }
    if (!cloudKitContainer) {
      throw new Error("CloudKit not available");
    }

    setSyncStatus("Opening Apple sign-in...");
    await cloudKitContainer.authorize();
    const user = await getCloudKitUser();
    cloudKitSignedIn = Boolean(user);
    updateSyncButtons();
    setSyncStatus(
      cloudKitSignedIn
        ? `Signed in as ${user.nameComponents?.givenName || "Apple user"}.`
        : "Sign-in completed, but no user info returned."
    );
  } catch (error) {
    const msg = handleError(error, "Apple sign-in");
    setSyncStatus(msg, true);
  }
}

/**
 * Sign out from CloudKit
 */
async function signOutCloudKit() {
  try {
    if (!cloudKitContainer) {
      throw new Error("Not signed in");
    }

    await cloudKitContainer.unauthorize();
    cloudKitSignedIn = false;
    updateSyncButtons();
    setSyncStatus("Signed out of iCloud sync.");
  } catch (error) {
    const msg = handleError(error, "Sign-out");
    setSyncStatus(msg, true);
  }
}

/**
 * Get current CloudKit user info
 * @returns {object|null} User info or null
 */
async function getCloudKitUser() {
  if (!cloudKitContainer) return null;
  try {
    return await cloudKitContainer.getUserInfo();
  } catch (error) {
    console.error("Failed to get CloudKit user:", error);
    return null;
  }
}

/**
 * Update sync button enabled/disabled states
 */
function updateSyncButtons() {
  const signedIn = cloudKitAvailable && cloudKitSignedIn;
  const signInBtn = document.getElementById("icloud-signin-btn");
  const signOutBtn = document.getElementById("icloud-signout-btn");
  const pullBtn = document.getElementById("pull-sync-btn");
  const pushBtn = document.getElementById("push-sync-btn");

  if (signInBtn) signInBtn.disabled = !cloudKitAvailable || signedIn;
  if (signOutBtn) signOutBtn.disabled = !signedIn;
  if (pullBtn) pullBtn.disabled = !signedIn;
  if (pushBtn) pushBtn.disabled = !signedIn;
}

/**
 * Pull data from iCloud
 */
async function pullFromSync() {
  try {
    if (!cloudKitAvailable || !cloudKitSignedIn || !cloudKitDb) {
      throw new Error("Not signed in to iCloud");
    }

    setSyncStatus("Pulling data from iCloud...");
    const response = await cloudKitDb.fetchRecords({
      desiredKeys: ["payload"],
      records: [{ recordName: CLOUDKIT_RECORD_NAME }]
    });

    const record = response.records?.[0];
    const payload = record?.fields?.payload?.value;
    if (!payload) {
      setSyncStatus("No cloud snapshot found yet. Push first to create one.");
      return;
    }

    Object.assign(data, normalizeIncoming(JSON.parse(payload)));
    stampSyncedAt();
    persist({ skipAutoSync: true });
    hydrateForms();
    renderAll();
    setSyncStatus("Pulled latest data from iCloud.");
  } catch (error) {
    const msg = handleError(error, "Pull from iCloud");
    setSyncStatus(msg, true);
  }
}

/**
 * Push data to iCloud
 * @param {object} options - Push options
 */
async function pushToSync(options = {}) {
  const silent = Boolean(options.silent);
  try {
    if (!cloudKitAvailable || !cloudKitSignedIn || !cloudKitDb) {
      if (!silent) {
        throw new Error("Not signed in to iCloud");
      }
      return;
    }

    if (!silent) setSyncStatus("Pushing local data to iCloud...");
    const record = {
      recordType: CLOUDKIT_RECORD_TYPE,
      recordName: CLOUDKIT_RECORD_NAME,
      fields: {
        payload: { value: JSON.stringify(data) },
        updatedAt: { value: new Date().toISOString() }
      }
    };

    await cloudKitDb.saveRecords({ records: [record] });
    stampSyncedAt();
    persist({ skipAutoSync: true });
    renderHouseholdControls();
    if (!silent) setSyncStatus("Pushed latest data to iCloud.");
  } catch (error) {
    if (!silent) {
      const msg = handleError(error, "Push to iCloud");
      setSyncStatus(msg, true);
    }
  }
}

/**
 * Schedule auto-sync with debounce
 */
function scheduleAutoSync() {
  clearTimeout(autoSyncTimer);
  autoSyncTimer = setTimeout(() => {
    pushToSync({ silent: true });
  }, 1200);
}

/**
 * Update last synced timestamp
 */
function stampSyncedAt() {
  data.household.lastSyncedAt = new Date().toLocaleString();
}

/**
 * Set sync status message display
 * @param {string} message - Status message
 * @param {boolean} isError - Whether this is an error
 */
function setSyncStatus(message, isError = false) {
  const syncStatusEl = document.getElementById("sync-status");
  if (syncStatusEl) {
    syncStatusEl.textContent = message;
    syncStatusEl.style.color = isError ? "var(--warn)" : "";
  }
}
