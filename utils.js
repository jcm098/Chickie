/**
 * Utility functions for Chicken Tracker
 * Generic helpers used across modules
 */

const KG_TO_LB = 2.2046226218;
const L_TO_GAL = 0.2641720524;
const THEME_PREFERENCE_KEY = "chicken_tracker_theme_preference";

/**
 * Generate a unique ID string
 * @returns {string} Unique identifier
 */
function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Escape HTML special characters to prevent injection
 * @param {any} str - String to escape
 * @returns {string} Escaped HTML string
 */
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/**
 * Format JavaScript Date to ISO date string (YYYY-MM-DD) in local timezone
 * @param {Date} date - Date object to format
 * @returns {string} ISO date string in local timezone
 */
function formatLocalDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Get today's date as ISO string
 * @returns {string} Today's date in YYYY-MM-DD format
 */
function todayISO() {
  return formatLocalDate(new Date());
}

/**
 * Add days to an ISO date string
 * @param {string} dateISO - ISO date string (YYYY-MM-DD)
 * @param {number} days - Number of days to add
 * @returns {string} New ISO date string
 */
function addDays(dateISO, days) {
  const d = new Date(`${dateISO}T00:00:00`);
  d.setDate(d.getDate() + days);
  return formatLocalDate(d);
}

/**
 * Get array of last N days as ISO date strings
 * @param {number} days - Number of days
 * @returns {array} Array of ISO date strings from oldest to newest
 */
function getLastNDays(days) {
  const out = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(formatLocalDate(d));
  }
  return out;
}

/**
 * Convert ISO date to short label (MM-DD)
 * @param {string} dateISO - ISO date string
 * @returns {string} Short date label
 */
function shortDateLabel(dateISO) {
  return dateISO.slice(5);
}

/**
 * Sort records by date in descending order
 * @param {array} list - Records with date property
 * @returns {array} Sorted copy of array
 */
function sortByDateDesc(list) {
  return [...list].sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Sum values from records filtered by date
 * @param {array} list - Records with date and field
 * @param {string} date - ISO date to filter by
 * @param {string} field - Field to sum
 * @returns {number} Sum of field values
 */
function sumByDate(list, date, field) {
  return list
    .filter((item) => item.date === date)
    .reduce((sum, item) => sum + Number(item[field] || 0), 0);
}

/**
 * Calculate rolling average for a field over N days
 * @param {array} list - Records
 * @param {string} field - Field to average
 * @param {number} days - Number of days
 * @returns {number} Rolling average
 */
function rollingAvg(list, field, days) {
  const dateKeys = getLastNDays(days);
  const total = dateKeys.reduce((sum, day) => sum + sumByDate(list, day, field), 0);
  return total / days;
}

/**
 * Create time series values from records
 * @param {array} list - Records
 * @param {array} dateKeys - Array of dates
 * @param {string} field - Field to extract
 * @returns {array} Values for each date
 */
function seriesFromRecords(list, dateKeys, field) {
  return dateKeys.map((day) => sumByDate(list, day, field));
}

/**
 * Get select element options and render them
 * @param {HTMLSelectElement} selectEl - Select element
 * @param {array} options - Option values
 * @param {string} selected - Selected value
 */
function renderSelectOptions(selectEl, options, selected) {
  selectEl.innerHTML = "";
  options.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    if (value === selected) option.selected = true;
    selectEl.appendChild(option);
  });
}

/**
 * Validate number within range
 * @param {number} value - Value to validate
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @param {number} defaultValue - Default if invalid
 * @returns {number} Valid number
 */
function validateNumber(value, min = -Infinity, max = Infinity, defaultValue = 0) {
  const num = Number(value);
  if (isNaN(num)) return defaultValue;
  return Math.max(min, Math.min(max, num));
}

/**
 * Validate string within length constraints
 * @param {string} value - String to validate
 * @param {number} maxLength - Maximum length
 * @param {string} defaultValue - Default if invalid
 * @returns {string} Valid string
 */
function validateString(value, maxLength = 255, defaultValue = "") {
  const str = String(value || "").trim();
  if (str.length === 0) return defaultValue;
  return str.slice(0, maxLength);
}

/**
 * Error handler that shows user-friendly messages
 * @param {Error} error - Error object
 * @param {string} context - Context of error
 * @returns {string} User-friendly error message
 */
function handleError(error, context = "Operation") {
  console.error(`${context} error:`, error);
  const message = error.message || String(error);
  return `${context} failed: ${message}`;
}
/**
 * Get stored theme preference
 * @returns {string} Theme preference: "system", "light", or "dark"
 */
function getThemePreference() {
  return localStorage.getItem(THEME_PREFERENCE_KEY) || "system";
}

/**
 * Set and apply theme preference
 * @param {string} preference - "system", "light", or "dark"
 */
function setThemePreference(preference) {
  localStorage.setItem(THEME_PREFERENCE_KEY, preference);
  applyTheme(preference);
}

/**
 * Apply theme to document
 * @param {string} preference - Theme preference
 */
function applyTheme(preference) {
  const html = document.documentElement;
  
  if (preference === "system") {
    html.classList.remove("light-mode", "dark-mode");
  } else if (preference === "light") {
    html.classList.remove("dark-mode");
    html.classList.add("light-mode");
  } else if (preference === "dark") {
    html.classList.remove("light-mode");
    html.classList.add("dark-mode");
  }
  
  updateThemeIcon();
  updateThemeStatus();
}

/**
 * Update theme toggle icon based on current preference
 */
function updateThemeIcon() {
  const icon = document.getElementById("theme-icon");
  if (!icon) return;
  
  const preference = getThemePreference();
  if (preference === "system") {
    icon.textContent = "🖥️";
  } else if (preference === "light") {
    icon.textContent = "☀️";
  } else if (preference === "dark") {
    icon.textContent = "🌙";
  }
}

/**
 * Update theme status text in settings
 */
function updateThemeStatus() {
  const status = document.getElementById("theme-status");
  if (!status) return;
  
  const preference = getThemePreference();
  if (preference === "system") {
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    status.textContent = `Using system preference (${isDark ? "dark" : "light"} detected)`;
  } else {
    status.textContent = `Manually set to ${preference} mode`;
  }
}

/**
 * Initialize theme on page load
 */
function initializeTheme() {
  const preference = getThemePreference();
  applyTheme(preference);
  
  // Update when system preference changes
  if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (getThemePreference() === "system") {
        updateThemeStatus();
      }
    });
  }
}