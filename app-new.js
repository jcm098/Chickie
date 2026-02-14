/**
 * Chicken Tracker - Main Application File
 * Modular architecture: utils.js, data.js, firebase.js, charts.js, ui.js
 */

const APP_VERSION = "2.1.0-optimized";
const BUILD_DATE = "2026-02-14";

/**
 * Register service worker for PWA support
 */
function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("./service-worker.js")
      .then((registration) => {
        console.log("Service Worker registered successfully:", registration);

        // Listen for updates
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                // New service worker is ready
                console.log("App update available. Refresh to update.");
              }
            });
          }
        });
      })
      .catch((error) => {
        console.warn("Service Worker registration failed:", error);
      });
  }
}

/**
 * Initialize the application
 */
async function initApp() {
  try {
    // Initialize theme immediately (before rendering anything)
    initializeTheme();

    // Initialize data first
    initializeData();

    // Initialize UI references and components
    initReferences();
    initSettingsPanel();

    // Populate and bind forms
    hydrateForms();
    bindForms();

    // Render all UI elements
    renderAll();

    // Initialize Firebase for sync
    initFirebase();

    // Listen for storage changes from other tabs
    window.addEventListener("storage", handleStorageSync);

    // Register service worker for offline support
    registerServiceWorker();

    console.log(`✨ Chicken Tracker v${APP_VERSION} (${BUILD_DATE}) initialized successfully`);
  } catch (error) {
    console.error("Failed to initialize app:", error);
    alert("Failed to load app. Please refresh the page.");
  }
}

// Start application when DOM is ready
document.addEventListener("DOMContentLoaded", initApp);
