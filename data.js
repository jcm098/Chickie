/**
 * Data management module for Chicken Tracker
 * Handles loading, normalizing, and persisting application data
 */

const STORAGE_KEY = "chicken_tracker_v2";
const LEGACY_STORAGE_KEY = "chicken_tracker_v1";
const SETTINGS_COLLAPSED_KEY = "chicken_tracker_settings_collapsed";

let data = null;

/**
 * Initialize and load data from storage
 * @returns {object} Application data object
 */
function initializeData() {
  try {
    data = loadData();
    return data;
  } catch (error) {
    console.error("Failed to initialize data:", error);
    data = withDefaults();
    return data;
  }
}

/**
 * Load data from localStorage
 * @returns {object} Loaded data
 */
function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return withDefaults();
  try {
    return normalizeIncoming(JSON.parse(raw));
  } catch (error) {
    console.error("Failed to parse stored data:", error);
    return withDefaults();
  }
}

/**
 * Get data with defaults applied
 * @param {object} parsed - Partially parsed data
 * @returns {object} Data with all required fields
 */
function withDefaults(parsed = {}) {
  const members = normalizeMembers(parsed.household?.members);
  const activeMember = members.includes(parsed.household?.activeMember)
    ? parsed.household.activeMember
    : members[0];

  return {
    profile: {
      flockName: validateString(parsed.profile?.flockName, 100),
      henCount: validateNumber(parsed.profile?.henCount, 0, 10000),
      units: parsed.profile?.units || (Object.keys(parsed).length ? "metric" : "imperial")
    },
    household: {
      members,
      activeMember,
      autoSync: Boolean(parsed.household?.autoSync),
      lastSyncedAt: String(parsed.household?.lastSyncedAt || "")
    },
    eggs: normalizeByRecords(parsed.eggs, activeMember, ["count", "broken"]),
    feed: normalizeByRecords(parsed.feed, activeMember, ["kg"]),
    water: normalizeByRecords(parsed.water, activeMember, ["liters"]),
    care: normalizeByRecords(parsed.care, activeMember, []),
    tasks: normalizeTasks(parsed.tasks, activeMember),
    inventory: normalizeInventory(parsed.inventory, activeMember)
  };
}

/**
 * Normalize incoming data and apply migrations
 * @param {object} parsed - Raw parsed data
 * @returns {object} Normalized data
 */
function normalizeIncoming(parsed = {}) {
  const next = withDefaults(parsed);
  migrateToImperial(next);
  return next;
}

/**
 * Normalize array of member names
 * @param {any} input - Input members array
 * @returns {array} Cleaned member names
 */
function normalizeMembers(input) {
  const arr = Array.isArray(input) ? input : [];
  const cleaned = [...new Set(arr.map((name) => validateString(name)).filter(Boolean))];
  return cleaned.length ? cleaned : ["Household"];
}

/**
 * Normalize record array (eggs, feed, water, care)
 * @param {any} input - Input records
 * @param {string} fallbackBy - Default member
 * @param {array} numberFields - Fields to convert to numbers
 * @returns {array} Normalized records
 */
function normalizeByRecords(input, fallbackBy, numberFields) {
  if (!Array.isArray(input)) return [];
  return input.map((item) => {
    const next = { ...item };
    next.id = item.id || uid();
    next.date = item.date || todayISO();
    next.by = validateString(item.by || fallbackBy, 100) || fallbackBy;
    numberFields.forEach((field) => {
      next[field] = validateNumber(item[field], 0);
    });
    return next;
  });
}

/**
 * Normalize tasks array
 * @param {any} input - Input tasks
 * @param {string} fallbackBy - Default member
 * @returns {array} Normalized tasks
 */
function normalizeTasks(input, fallbackBy) {
  if (!Array.isArray(input)) return [];
  return input.map((item) => {
    const cadenceDays = validateNumber(item.cadenceDays, 1, 365, 1);
    const lastDone = item.lastDone || todayISO();
    return {
      id: item.id || uid(),
      name: validateString(item.name || "Task", 100),
      cadenceDays,
      lastDone,
      nextDue: item.nextDue || addDays(lastDone, cadenceDays),
      createdBy: validateString(item.createdBy || item.by || fallbackBy, 100) || fallbackBy,
      lastDoneBy: validateString(item.lastDoneBy || item.by || fallbackBy, 100) || fallbackBy
    };
  });
}

/**
 * Normalize inventory items
 * @param {any} input - Input inventory
 * @param {string} fallbackBy - Default member
 * @returns {array} Normalized inventory
 */
function normalizeInventory(input, fallbackBy) {
  if (!Array.isArray(input)) return [];
  return input.map((item) => ({
    id: item.id || uid(),
    item: validateString(item.item || "Supply", 100),
    quantity: validateNumber(item.quantity, 0),
    unit: validateString(item.unit || "units", 50),
    threshold: validateNumber(item.threshold, 0),
    by: validateString(item.by || fallbackBy, 100) || fallbackBy
  }));
}

/**
 * Migrate data from metric to imperial units
 * @param {object} nextData - Data to migrate
 */
function migrateToImperial(nextData) {
  if (nextData.profile.units === "imperial") return;

  nextData.feed = nextData.feed.map((item) => ({
    ...item,
    kg: Number((Number(item.kg || 0) * KG_TO_LB).toFixed(2))
  }));

  nextData.water = nextData.water.map((item) => ({
    ...item,
    liters: Number((Number(item.liters || 0) * L_TO_GAL).toFixed(2))
  }));

  nextData.inventory = nextData.inventory.map((item) => {
    const rawUnit = String(item.unit || "").trim().toLowerCase();
    if (["kg", "kgs", "kilogram", "kilograms"].includes(rawUnit)) {
      return {
        ...item,
        quantity: Number((Number(item.quantity || 0) * KG_TO_LB).toFixed(2)),
        threshold: Number((Number(item.threshold || 0) * KG_TO_LB).toFixed(2)),
        unit: "lb"
      };
    }
    if (["l", "liter", "liters", "litre", "litres"].includes(rawUnit)) {
      return {
        ...item,
        quantity: Number((Number(item.quantity || 0) * L_TO_GAL).toFixed(2)),
        threshold: Number((Number(item.threshold || 0) * L_TO_GAL).toFixed(2)),
        unit: "gal"
      };
    }
    return item;
  });

  nextData.profile.units = "imperial";
}

/**
 * Persist data to localStorage
 * @param {object} options - Persistence options
 * @returns {boolean} Success status
 */
function persist(options = {}) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    if (!options.skipAutoSync && data.household.autoSync) {
      scheduleAutoSync();
    }
    return true;
  } catch (error) {
    console.error("Storage quota exceeded or access denied:", error);
    throw new Error("Could not save data. Storage full or disabled.");
  }
}

/**
 * Get all members who have contributed to records
 * @returns {array} Sorted array of contributor names
 */
function getKnownContributorNames() {
  const seen = new Set();
  data.household.members.forEach((member) => seen.add(member));

  [data.eggs, data.feed, data.water, data.care, data.inventory].forEach((records) => {
    records.forEach((item) => {
      if (item.by) seen.add(item.by);
    });
  });

  data.tasks.forEach((task) => {
    if (task.createdBy) seen.add(task.createdBy);
    if (task.lastDoneBy) seen.add(task.lastDoneBy);
  });

  return [...seen].sort((a, b) => a.localeCompare(b));
}

/**
 * Calculate activity count by member over N days
 * @param {number} days - Number of days
 * @returns {object} Activity counts by member
 */
function activityByMember(days) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - (days - 1));
  const minDate = formatLocalDate(cutoff);

  const allRecords = [...data.eggs, ...data.feed, ...data.water, ...data.care].filter(
    (item) => item.date >= minDate
  );
  const tally = {};
  allRecords.forEach((item) => {
    const key = item.by || "Unknown";
    tally[key] = (tally[key] || 0) + 1;
  });
  return tally;
}

/**
 * Remove item from data array by ID
 * @param {array} arr - Array to modify
 * @param {string} id - Item ID to remove
 */
function removeById(arr, id) {
  const idx = arr.findIndex((item) => item.id === id);
  if (idx >= 0) {
    arr.splice(idx, 1);
    persist();
  }
}

/**
 * Remove member from household
 * @param {string} name - Member name
 */
function removeMember(name) {
  if (data.household.members.length === 1) {
    throw new Error("You must keep at least one member.");
  }
  if (name === data.household.activeMember) {
    throw new Error("Switch active logger before removing this member.");
  }
  data.household.members = data.household.members.filter((member) => member !== name);
  persist();
}

/**
 * Merge all records from one member to another
 * @param {string} fromName - Source member
 * @param {string} toName - Target member
 * @returns {number} Number of records merged
 */
function mergeMemberRecords(fromName, toName) {
  if (fromName === toName) {
    throw new Error("Cannot merge member to themselves.");
  }

  let changed = 0;

  [data.eggs, data.feed, data.water, data.care, data.inventory].forEach((records) => {
    records.forEach((item) => {
      if (item.by === fromName) {
        item.by = toName;
        changed += 1;
      }
    });
  });

  data.tasks.forEach((task) => {
    if (task.createdBy === fromName) {
      task.createdBy = toName;
      changed += 1;
    }
    if (task.lastDoneBy === fromName) {
      task.lastDoneBy = toName;
      changed += 1;
    }
  });

  if (!data.household.members.includes(toName)) {
    data.household.members.push(toName);
  }

  if (data.household.members.includes(fromName) && fromName !== toName) {
    data.household.members = data.household.members.filter((member) => member !== fromName);
    if (data.household.activeMember === fromName) {
      data.household.activeMember = toName;
    }
  }

  if (changed > 0) {
    persist();
  }

  return changed;
}

/**
 * Reset all data to defaults
 */
function resetAllData() {
  const next = withDefaults();
  Object.assign(data, next);
  persist({ skipAutoSync: true });
}

/**
 * Get settings collapse state from storage
 * @returns {boolean} Whether settings should be collapsed
 */
function getSettingsCollapsed() {
  return localStorage.getItem(SETTINGS_COLLAPSED_KEY) === "1";
}

/**
 * Set settings collapse state in storage
 * @param {boolean} collapsed - Collapse state
 */
function setSettingsCollapsed(collapsed) {
  localStorage.setItem(SETTINGS_COLLAPSED_KEY, collapsed ? "1" : "0");
}

/**
 * Handle storage sync across browser tabs
 * @param {StorageEvent} event - Storage event
 */
function handleStorageSync(event) {
  if (event.key === STORAGE_KEY && event.newValue) {
    try {
      data = normalizeIncoming(JSON.parse(event.newValue));
      renderAll();
    } catch (error) {
      console.error("Failed to sync from storage event:", error);
    }
  }
}
