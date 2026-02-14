/**
 * Firebase sync module for Chicken Tracker
 * Handles multi-device data sync via Firebase Realtime Database
 */

// Firebase configuration - UPDATE WITH YOUR CONFIG
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDXswDN53Ohr7lfDjEryiINHJSpJ_MTEsE",
  authDomain: "chickie-c6c24.firebaseapp.com",
  projectId: "chickie-c6c24",
  storageBucket: "chickie-c6c24.firebasestorage.app",
  messagingSenderId: "429784064094",
  appId: "1:429784064094:web:ce64b0700e90ec85b2d4cf"
};

let firebaseUser = null;
let firebaseDb = null;
let firebaseAuth = null;
let firebaseAvailable = false;
let syncListeners = [];
let currentFlockId = null;
let userFlocks = [];

/**
 * Initialize Firebase
 */
async function initFirebase() {
  try {
    if (!window.firebase) {
      setSyncStatus("Firebase SDK not loaded. Sync disabled.", true);
      return;
    }

    // Check if config is placeholder
    if (FIREBASE_CONFIG.apiKey.startsWith("REPLACE_")) {
      setSyncStatus("Configure Firebase credentials in firebase.js to enable sync.", true);
      updateSyncButtons();
      return;
    }

    // Initialize Firebase
    firebase.initializeApp(FIREBASE_CONFIG);
    firebaseAuth = firebase.auth();
    firebaseDb = firebase.database();
    firebaseAvailable = true;

    // Listen for auth state changes
    firebaseAuth.onAuthStateChanged((user) => {
      firebaseUser = user;
      updateSyncButtons();
      if (user) {
        setSyncStatus(`Signed in as ${user.email}`);
        loadUserFlocks();
      } else {
        setSyncStatus("Not signed in. Sign in with Google to share data.");
        stopRealtimeSync();
        userFlocks = [];
        currentFlockId = null;
      }
    });
  } catch (error) {
    firebaseAvailable = false;
    const msg = handleError(error, "Firebase initialization");
    setSyncStatus(msg, true);
  }
}

/**
 * Sign in to Firebase with Google
 */
async function signInFirebase() {
  try {
    if (!firebaseAvailable) {
      throw new Error("Firebase not available");
    }

    setSyncStatus("Opening Google sign-in...");
    const provider = new firebase.auth.GoogleAuthProvider();
    await firebaseAuth.signInWithPopup(provider);
  } catch (error) {
    const msg = handleError(error, "Google sign-in");
    setSyncStatus(msg, true);
  }
}

/**
 * Sign out from Firebase
 */
async function signOutFirebase() {
  try {
    await firebaseAuth.signOut();
    setSyncStatus("Signed out.");
  } catch (error) {
    const msg = handleError(error, "Sign-out");
    setSyncStatus(msg, true);
  }
}

/**
 * Update sync button enabled/disabled states
 */
function updateSyncButtons() {
  const signedIn = firebaseAvailable && firebaseUser;
  const signInBtn = document.getElementById("firebase-signin-btn");
  const signOutBtn = document.getElementById("firebase-signout-btn");
  const createFlockBtn = document.getElementById("create-flock-btn");
  const pushBtn = document.getElementById("push-firebase-btn");
  const pullBtn = document.getElementById("pull-firebase-btn");

  if (signInBtn) signInBtn.disabled = !firebaseAvailable || signedIn;
  if (signOutBtn) signOutBtn.disabled = !signedIn;
  if (createFlockBtn) createFlockBtn.disabled = !signedIn;
  if (pushBtn) pushBtn.disabled = !signedIn || !currentFlockId;
  if (pullBtn) pullBtn.disabled = !signedIn || !currentFlockId;
}

/**
 * Load all flocks the user has access to
 */
async function loadUserFlocks() {
  if (!firebaseUser || !firebaseDb) return;

  try {
    const userFlockRef = firebaseDb.ref(`userFlocks/${firebaseUser.uid}`);
    userFlockRef.once("value", (snapshot) => {
      userFlocks = snapshot.val() ? Object.keys(snapshot.val()) : [];
      
      // Render flock selector dropdown
      if (typeof renderFlockSelector === "function") {
        renderFlockSelector(userFlocks);
      }
      
      updateSyncButtons();
      
      if (userFlocks.length === 0) {
        setSyncStatus("No flocks yet. Create a new one or join a shared flock.");
      } else {
        // Auto-select first flock if none selected
        if (!currentFlockId) {
          selectFlock(userFlocks[0]);
        }
      }
    });
  } catch (error) {
    console.error("Failed to load user flocks:", error);
  }
}

/**
 * Create a new shared flock
 * @param {string} flockName - Name of the flock
 */
async function createNewFlock(flockName) {
  try {
    if (!firebaseUser || !firebaseDb) {
      throw new Error("Not signed in");
    }

    setSyncStatus("Creating flock...");
    const flockId = firebaseDb.ref("flocks").push().key;
    const timestamp = new Date().toLocaleString();

    const newFlock = {
      owner: firebaseUser.uid,
      ownerEmail: firebaseUser.email,
      sharedWith: {
        [firebaseUser.uid]: true
      },
      profile: {
        flockName: flockName || "My Flock",
        henCount: 0,
        units: "imperial"
      },
      household: {
        members: ["Household"],
        activeMember: "Household",
        autoSync: true,
        lastSyncedAt: timestamp
      },
      eggs: [],
      feed: [],
      water: [],
      care: [],
      tasks: [],
      inventory: []
    };

    await firebaseDb.ref(`flocks/${flockId}`).set(newFlock);
    await firebaseDb.ref(`userFlocks/${firebaseUser.uid}/${flockId}`).set(true);

    currentFlockId = flockId;
    await selectFlock(flockId);
    setSyncStatus(`Created flock "${flockName}"`);
  } catch (error) {
    const msg = handleError(error, "Create flock");
    setSyncStatus(msg, true);
  }
}

/**
 * Select a flock to work with
 * @param {string} flockId - Flock ID to select
 */
async function selectFlock(flockId) {
  if (currentFlockId !== flockId) {
    stopRealtimeSync();
    currentFlockId = flockId;
  }
  startRealtimeSync();
  updateSyncButtons();
}

/**
 * Share a flock with another user by email
 * @param {string} flockId - Flock ID to share
 * @param {string} email - Email address of person to share with
 */
async function shareFlockWith(flockId, email) {
  try {
    if (!firebaseUser || !firebaseDb) {
      throw new Error("Not signed in");
    }

    setSyncStatus(`Sharing flock with ${email}...`);
    
    // In production, you'd look up the user ID by email using a Cloud Function
    // For now, we'll store the email and require manual acceptance
    const flockRef = firebaseDb.ref(`flocks/${flockId}`);
    const snapshot = await flockRef.once("value");
    const flock = snapshot.val();

    if (flock.owner !== firebaseUser.uid) {
      throw new Error("Only the flock owner can share it");
    }

    // Note: This requires a backend function or workaround to map email → uid
    setSyncStatus(`Share request sent to ${email}. (Manual setup required)`, true);
  } catch (error) {
    const msg = handleError(error, "Share flock");
    setSyncStatus(msg, true);
  }
}

/**
 * Start real-time sync for the current flock
 */
function startRealtimeSync() {
  if (!firebaseUser || !firebaseDb || !currentFlockId) return;

  try {
    stopRealtimeSync();

    const flockRef = firebaseDb.ref(`flocks/${currentFlockId}`);

    // Listen for remote changes
    const listener = flockRef.on("value", (snapshot) => {
      const remoteData = snapshot.val();
      if (remoteData) {
        const normalized = normalizeIncoming(remoteData);
        // Only apply if newer than local
        if (!data.household.lastSyncedAt || remoteData.household?.lastSyncedAt > data.household.lastSyncedAt) {
          Object.assign(data, normalized);
          hydrateForms();
          renderAll();
          setSyncStatus(`Synced from cloud (${new Date().toLocaleTimeString()})`);
        }
      }
    });

    syncListeners.push({ ref: flockRef, listener });
  } catch (error) {
    console.error("Failed to start real-time sync:", error);
  }
}

/**
 * Stop real-time sync listeners
 */
function stopRealtimeSync() {
  syncListeners.forEach(({ ref }) => {
    ref.off();
  });
  syncListeners = [];
}

/**
 * Push local data to Firebase for current flock
 */
async function pushToFirebase() {
  try {
    if (!firebaseUser || !firebaseDb || !currentFlockId) {
      throw new Error("Not signed in or no flock selected");
    }

    setSyncStatus("Uploading to cloud...");

    data.household.lastSyncedAt = new Date().toLocaleString();
    await firebaseDb.ref(`flocks/${currentFlockId}`).set(data);

    setSyncStatus("Uploaded to cloud.");
  } catch (error) {
    const msg = handleError(error, "Upload to Firebase");
    setSyncStatus(msg, true);
  }
}

/**
 * Pull latest data from Firebase for current flock
 */
async function pullFromFirebase() {
  try {
    if (!firebaseUser || !firebaseDb || !currentFlockId) {
      throw new Error("Not signed in or no flock selected");
    }

    setSyncStatus("Downloading from cloud...");

    const snapshot = await firebaseDb.ref(`flocks/${currentFlockId}`).once("value");
    const remoteData = snapshot.val();

    if (!remoteData) {
      setSyncStatus("No cloud data found. Push first to create one.");
      return;
    }

    Object.assign(data, normalizeIncoming(remoteData));
    persist({ skipAutoSync: true });
    hydrateForms();
    renderAll();
    setSyncStatus("Downloaded from cloud.");
  } catch (error) {
    const msg = handleError(error, "Download from Firebase");
    setSyncStatus(msg, true);
  }
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
