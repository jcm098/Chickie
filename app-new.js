/**
 * Chicken Tracker - Main Application File
 * Modular architecture: utils.js, data.js, firebase.js, charts.js, ui.js
 */

const APP_VERSION = "2.1.0-optimized";
const BUILD_DATE = "2026-02-14";

/**
 * Show a small banner when a new app version is available
 */
function showUpdateBanner() {
  const banner = document.createElement("div");
  banner.setAttribute("role", "status");
  banner.className = "update-banner";
  banner.innerHTML = "Update available. <button type=\"button\" class=\"update-banner-btn\">Refresh</button>";
  const btn = banner.querySelector("button");
  btn.addEventListener("click", () => {
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "SKIP_WAITING" });
    }
    window.location.reload();
  });
  document.body.appendChild(banner);
  window.addEventListener("controllerchange", () => window.location.reload());
}

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
                showUpdateBanner();
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
