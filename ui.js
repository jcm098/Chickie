/**
 * UI module for Chicken Tracker
 * Handles all UI rendering and event binding
 */

const refs = {
  statsGrid: null,
  eggsList: null,
  feedList: null,
  waterList: null,
  careList: null,
  taskList: null,
  inventoryList: null,
  rowTemplate: null,
  importInput: null,
  activeMember: null,
  membersList: null,
  mergeFromMember: null,
  mergeToMember: null,
  settingsPanel: null,
  settingsContent: null,
  settingsToggle: null,
  firebaseSigninBtn: null,
  firebaseSignoutBtn: null,
  createFlockBtn: null,
  pushFirebaseBtn: null,
  pullFirebaseBtn: null,
  flockSelector: null,
  syncStatus: null,
  autoSync: null,
  chartWindow: null,
  productionChart: null,
  consumptionChart: null,
  memberChart: null
};

/**
 * Initialize DOM references
 */
function initReferences() {
  refs.statsGrid = document.getElementById("stats-grid");
  refs.eggsList = document.getElementById("eggs-list");
  refs.feedList = document.getElementById("feed-list");
  refs.waterList = document.getElementById("water-list");
  refs.careList = document.getElementById("care-list");
  refs.taskList = document.getElementById("task-list");
  refs.inventoryList = document.getElementById("inventory-list");
  refs.rowTemplate = document.getElementById("row-template");
  refs.importInput = document.getElementById("import-input");
  refs.activeMember = document.getElementById("active-member");
  refs.membersList = document.getElementById("members-list");
  refs.mergeFromMember = document.getElementById("merge-from-member");
  refs.mergeToMember = document.getElementById("merge-to-member");
  refs.settingsPanel = document.getElementById("settings-panel");
  refs.settingsContent = document.getElementById("settings-content");
  refs.settingsToggle = document.getElementById("settings-toggle");
  refs.firebaseSigninBtn = document.getElementById("firebase-signin-btn");
  refs.firebaseSignoutBtn = document.getElementById("firebase-signout-btn");
  refs.createFlockBtn = document.getElementById("create-flock-btn");
  refs.pushFirebaseBtn = document.getElementById("push-firebase-btn");
  refs.pullFirebaseBtn = document.getElementById("pull-firebase-btn");
  refs.flockSelector = document.getElementById("flock-selector");
  refs.syncStatus = document.getElementById("sync-status");
  refs.autoSync = document.getElementById("auto-sync");
  refs.chartWindow = document.getElementById("chart-window");
  refs.productionChart = document.getElementById("production-chart");
  refs.consumptionChart = document.getElementById("consumption-chart");
  refs.memberChart = document.getElementById("member-chart");
}

/**
 * Initialize settings panel collapse state
 */
function initSettingsPanel() {
  const collapsed = getSettingsCollapsed();
  toggleSettingsCollapsed(collapsed);
}

/**
 * Toggle settings panel visibility
 */
function toggleSettingsPanel() {
  const isCollapsed = refs.settingsPanel.classList.contains("collapsed");
  toggleSettingsCollapsed(!isCollapsed);
}

/**
 * Set settings panel collapse state
 * @param {boolean} collapsed - State
 */
function toggleSettingsCollapsed(collapsed) {
  refs.settingsPanel.classList.toggle("collapsed", collapsed);
  refs.settingsContent.hidden = collapsed;
  refs.settingsToggle.textContent = collapsed ? "Show Settings" : "Hide Settings";
  setSettingsCollapsed(collapsed);
}

/**
 * Populate all forms with current data
 */
function hydrateForms() {
  document.getElementById("flock-name").value = data.profile.flockName;
  document.getElementById("hen-count").value = data.profile.henCount || "";

  [
    document.querySelector("#eggs-form [name='date']"),
    document.querySelector("#feed-form [name='date']"),
    document.querySelector("#water-form [name='date']"),
    document.querySelector("#care-form [name='date']"),
    document.querySelector("#task-form [name='lastDone']")
  ].forEach((input) => {
    if (input) input.value = todayISO();
  });
}

/**
 * Bind all form event listeners
 */
function bindForms() {
  // Settings toggle
  refs.settingsToggle.addEventListener("click", toggleSettingsPanel);

  // Theme toggle
  const themeToggle = document.getElementById("theme-toggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const current = getThemePreference();
      const next = current === "system" ? "light" : current === "light" ? "dark" : "system";
      setThemePreference(next);
      updateThemeSelect();
    });
  }

  const themePreference = document.getElementById("theme-preference");
  if (themePreference) {
    themePreference.addEventListener("change", () => {
      setThemePreference(themePreference.value);
    });
  }

  // Profile form
  document.getElementById("profile-form").addEventListener("submit", onProfileSubmit);
  refs.activeMember.addEventListener("change", onActiveMemberChange);

  // Member management
  document.getElementById("member-form").addEventListener("submit", onAddMember);
  document.getElementById("merge-members-btn").addEventListener("click", onMergeMembers);

  // Auto-sync
  refs.autoSync.addEventListener("change", () => {
    data.household.autoSync = refs.autoSync.checked;
    persist({ skipAutoSync: true });
    setSyncStatus(data.household.autoSync ? "Auto-sync enabled." : "Auto-sync disabled.");
  });

  // Firebase sync
  refs.firebaseSigninBtn.addEventListener("click", signInFirebase);
  refs.firebaseSignoutBtn.addEventListener("click", signOutFirebase);
  refs.createFlockBtn.addEventListener("click", onCreateFlock);
  refs.pushFirebaseBtn.addEventListener("click", pushToFirebase);
  refs.pullFirebaseBtn.addEventListener("click", pullFromFirebase);
  refs.flockSelector.addEventListener("change", onFlockSelect);

  // Charts
  refs.chartWindow.addEventListener("change", renderCharts);

  // Data entry forms
  document.getElementById("eggs-form").addEventListener("submit", onEggsSubmit);
  document.getElementById("feed-form").addEventListener("submit", onFeedSubmit);
  document.getElementById("water-form").addEventListener("submit", onWaterSubmit);
  document.getElementById("care-form").addEventListener("submit", onCareSubmit);
  document.getElementById("task-form").addEventListener("submit", onTaskSubmit);
  document.getElementById("inventory-form").addEventListener("submit", onInventorySubmit);

  // Import/Export
  refs.importInput.addEventListener("change", onImport);
  document.getElementById("export-btn")?.addEventListener("click", onExport);
  document.getElementById("reset-btn")?.addEventListener("click", onReset);
}

// FORM SUBMISSION HANDLERS

function onProfileSubmit(e) {
  e.preventDefault();
  const flockName = validateString(document.getElementById("flock-name").value, 100);
  const henCount = validateNumber(document.getElementById("hen-count").value, 0, 10000);
  
  data.profile.flockName = flockName;
  data.profile.henCount = henCount;
  persist();
  renderAll();
}

function onActiveMemberChange() {
  data.household.activeMember = refs.activeMember.value;
  persist();
  renderAll();
}

function onAddMember(e) {
  e.preventDefault();
  const input = document.getElementById("member-name");
  const name = validateString(input.value, 100);
  
  if (!name) {
    alert("Please enter a member name.");
    return;
  }

  if (data.household.members.some((m) => m.toLowerCase() === name.toLowerCase())) {
    alert("That member already exists.");
    return;
  }

  data.household.members.push(name);
  data.household.activeMember = name;
  input.value = "";
  persist();
  renderAll();
}

function onMergeMembers() {
  const from = refs.mergeFromMember.value;
  const to = refs.mergeToMember.value;

  if (!from || !to) {
    alert("Select both source and target members.");
    return;
  }

  if (from === to) {
    alert("Source and target must be different.");
    return;
  }

  if (!confirm(`Merge all records from "${from}" to "${to}"? This cannot be undone.`)) {
    return;
  }

  try {
    const changed = mergeMemberRecords(from, to);
    renderAll();
    setSyncStatus(`Merged ${changed} records from "${from}" to "${to}".`);
  } catch (error) {
    alert(handleError(error, "Merge failed"));
  }
}

function onFlockSelect() {
  const selectedFlockId = refs.flockSelector.value;
  if (selectedFlockId && typeof selectFlock === "function") {
    selectFlock(selectedFlockId);
  }
}

function onCreateFlock() {
  const flockName = prompt("Enter flock name:", "My Flock");
  if (flockName && typeof createNewFlock === "function") {
    createNewFlock(flockName);
  }
}

function renderFlockSelector(flocks) {
  refs.flockSelector.innerHTML = "";
  if (!flocks || flocks.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No flocks available";
    option.disabled = true;
    refs.flockSelector.appendChild(option);
    return;
  }

  flocks.forEach((flockId) => {
    const option = document.createElement("option");
    option.value = flockId;
    option.textContent = flockId.substring(0, 12) + "...";
    refs.flockSelector.appendChild(option);
  });
}

function onEggsSubmit(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const count = validateNumber(form.count.value, 0);
  const broken = validateNumber(form.broken.value, 0);

  data.eggs.push({
    id: uid(),
    date: form.date.value,
    count,
    broken,
    by: data.household.activeMember
  });
  persist();
  form.reset();
  form.date.value = todayISO();
  renderAll();
}

function onFeedSubmit(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const type = validateString(form.type.value, 100);
  const kg = validateNumber(form.kg.value, 0);

  if (!type) {
    alert("Please enter a feed type.");
    return;
  }

  data.feed.push({
    id: uid(),
    date: form.date.value,
    type,
    kg,
    by: data.household.activeMember
  });
  persist();
  form.reset();
  form.date.value = todayISO();
  renderAll();
}

function onWaterSubmit(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const liters = validateNumber(form.liters.value, 0);

  data.water.push({
    id: uid(),
    date: form.date.value,
    liters,
    by: data.household.activeMember
  });
  persist();
  form.reset();
  form.date.value = todayISO();
  renderAll();
}

function onCareSubmit(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const category = validateString(form.category.value, 100);
  const note = validateString(form.note.value, 500);

  if (!category) {
    alert("Please enter a care category.");
    return;
  }

  data.care.push({
    id: uid(),
    date: form.date.value,
    category,
    note,
    by: data.household.activeMember
  });
  persist();
  form.reset();
  form.date.value = todayISO();
  renderAll();
}

function onTaskSubmit(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const name = validateString(form.name.value, 100);
  const cadenceDays = validateNumber(form.cadenceDays.value, 1, 365);
  const lastDone = form.lastDone.value;

  if (!name) {
    alert("Please enter a task name.");
    return;
  }

  data.tasks.push({
    id: uid(),
    name,
    cadenceDays,
    lastDone,
    nextDue: addDays(lastDone, cadenceDays),
    createdBy: data.household.activeMember,
    lastDoneBy: data.household.activeMember
  });
  persist();
  form.reset();
  form.lastDone.value = todayISO();
  renderAll();
}

function onInventorySubmit(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const item = validateString(form.item.value, 100);
  const quantity = validateNumber(form.quantity.value, 0);
  const unit = validateString(form.unit.value, 50);
  const threshold = validateNumber(form.threshold.value, 0);

  if (!item || !unit) {
    alert("Please enter item name and unit.");
    return;
  }

  data.inventory.push({
    id: uid(),
    item,
    quantity,
    unit,
    threshold,
    by: data.household.activeMember
  });
  persist();
  form.reset();
  renderAll();
}

function onExport() {
  try {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chicken-tracker-backup-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    alert(handleError(error, "Export failed"));
  }
}

function onImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const next = normalizeIncoming(JSON.parse(reader.result));
      Object.assign(data, next);
      persist({ skipAutoSync: true });
      hydrateForms();
      renderAll();
      setSyncStatus("Imported data successfully.");
    } catch (error) {
      alert(handleError(error, "Import failed"));
    }
  };
  reader.readAsText(file);
  event.target.value = "";
}

function onReset() {
  if (!confirm("Reset all records and profile data? This cannot be undone.")) return;
  try {
    resetAllData();
    hydrateForms();
    renderAll();
    setSyncStatus("All data reset.");
  } catch (error) {
    alert(handleError(error, "Reset failed"));
  }
}

// RENDERING FUNCTIONS

/**
 * Render all UI elements
 */
function renderAll() {
  renderHouseholdControls();
  renderStats();
  renderCharts();
  renderEggs();
  renderFeed();
  renderWater();
  renderCare();
  renderTasks();
  renderInventory();
  renderVersionInfo();
}

function renderHouseholdControls() {
  renderSelectOptions(refs.activeMember, data.household.members, data.household.activeMember);

  refs.membersList.innerHTML = "";
  data.household.members.forEach((member) => {
    const row = document.createElement("div");
    row.className = "member-chip";
    row.innerHTML = `<span>${escapeHtml(member)}</span>`;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "danger";
    btn.textContent = "Remove";
    btn.disabled = data.household.members.length === 1;
    btn.addEventListener("click", () => {
      if (!confirm(`Remove member "${member}"?`)) return;
      try {
        removeMember(member);
        renderAll();
      } catch (error) {
        alert(handleError(error, "Remove member failed"));
      }
    });
    row.appendChild(btn);
    refs.membersList.appendChild(row);
  });

  const mergeFromOptions = getKnownContributorNames();
  const mergeToOptions = [...data.household.members];
  renderSelectOptions(refs.mergeFromMember, mergeFromOptions, mergeFromOptions[0] || "");
  renderSelectOptions(refs.mergeToMember, mergeToOptions, mergeToOptions[0] || "");

  refs.mergeFromMember.disabled = mergeFromOptions.length === 0;
  refs.mergeToMember.disabled = mergeToOptions.length === 0;
  document.getElementById("merge-members-btn").disabled =
    mergeFromOptions.length === 0 || mergeToOptions.length === 0;

  refs.autoSync.checked = data.household.autoSync;
  updateSyncButtons();

  if (data.household.lastSyncedAt) {
    setSyncStatus(`Last sync: ${data.household.lastSyncedAt}`);
  }
}

function renderStats() {
  const today = todayISO();
  const eggsToday = sumByDate(data.eggs, today, "count");
  const feedToday = sumByDate(data.feed, today, "kg");
  const waterToday = sumByDate(data.water, today, "liters");
  const eggsWeekAvg = rollingAvg(data.eggs, "count", 7);
  const dueTasks = data.tasks.filter((task) => task.nextDue <= today).length;
  const lowInventory = data.inventory.filter((item) => item.quantity <= item.threshold).length;

  const cards = [
    { label: "Flock", metric: data.profile.flockName || "Unnamed flock" },
    { label: "Active Logger", metric: data.household.activeMember },
    { label: "Hens", metric: String(data.profile.henCount || 0) },
    { label: "Eggs Today", metric: String(eggsToday) },
    { label: "Eggs 7-Day Avg", metric: eggsWeekAvg.toFixed(1) },
    { label: "Feed Today (lb)", metric: feedToday.toFixed(2) },
    { label: "Water Today (gal)", metric: waterToday.toFixed(1) },
    { label: "Tasks Due", metric: String(dueTasks) },
    { label: "Low Supplies", metric: String(lowInventory) }
  ];

  refs.statsGrid.innerHTML = "";
  cards.forEach((card) => {
    const wrap = document.createElement("article");
    wrap.className = "stat-card";
    wrap.innerHTML = `<p>${escapeHtml(card.label)}</p><p class="metric">${escapeHtml(card.metric)}</p>`;
    refs.statsGrid.appendChild(wrap);
  });
}

function renderList(container, list, bodyFormatter, onDelete) {
  container.innerHTML = "";
  if (!list.length) {
    container.innerHTML = `<p class="hint">No records yet.</p>`;
    return;
  }

  list.forEach((item) => {
    const node = refs.rowTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector(".row-main").innerHTML = bodyFormatter(item);
    const actions = node.querySelector(".row-actions");
    const del = document.createElement("button");
    del.className = "danger";
    del.textContent = "Delete";
    del.addEventListener("click", () => {
      if (!confirm("Delete this record?")) return;
      onDelete(item.id);
      renderAll();
    });
    actions.append(del);
    container.appendChild(node);
  });
}

function renderEggs() {
  renderList(
    refs.eggsList,
    sortByDateDesc(data.eggs),
    (item) =>
      `<strong>${item.date}</strong><br />Collected: ${item.count} | Broken/Dirty: ${item.broken}<br />By: ${escapeHtml(item.by || "Unknown")}`,
    (id) => removeById(data.eggs, id)
  );
}

function renderFeed() {
  renderList(
    refs.feedList,
    sortByDateDesc(data.feed),
    (item) =>
      `<strong>${item.date}</strong><br />${escapeHtml(item.type)}: ${item.kg.toFixed(2)} lb<br />By: ${escapeHtml(item.by || "Unknown")}`,
    (id) => removeById(data.feed, id)
  );
}

function renderWater() {
  renderList(
    refs.waterList,
    sortByDateDesc(data.water),
    (item) => `<strong>${item.date}</strong><br />${item.liters.toFixed(1)} gal<br />By: ${escapeHtml(item.by || "Unknown")}`,
    (id) => removeById(data.water, id)
  );
}

function renderCare() {
  renderList(
    refs.careList,
    sortByDateDesc(data.care),
    (item) =>
      `<strong>${item.date} • ${escapeHtml(item.category)}</strong><br />${escapeHtml(item.note)}<br />By: ${escapeHtml(item.by || "Unknown")}`,
    (id) => removeById(data.care, id)
  );
}

function renderTasks() {
  refs.taskList.innerHTML = "";
  const items = [...data.tasks].sort((a, b) => a.nextDue.localeCompare(b.nextDue));
  
  if (!items.length) {
    refs.taskList.innerHTML = `<p class="hint">No recurring tasks yet.</p>`;
    return;
  }

  items.forEach((item) => {
    const node = refs.rowTemplate.content.firstElementChild.cloneNode(true);
    const isDue = item.nextDue <= todayISO();
    node.querySelector(".row-main").innerHTML =
      `<strong>${escapeHtml(item.name)}</strong><br />Every ${item.cadenceDays} days | Last: ${item.lastDone} | Next: ${item.nextDue}<br />Created by: ${escapeHtml(item.createdBy || "Unknown")} | Last done by: ${escapeHtml(item.lastDoneBy || "Unknown")}` +
      (isDue ? ` <span style="color:var(--warn);font-weight:800;">(DUE)</span>` : "");

    const actions = node.querySelector(".row-actions");
    const done = document.createElement("button");
    done.className = "ghost";
    done.textContent = "Mark Done";
    done.addEventListener("click", () => {
      item.lastDone = todayISO();
      item.lastDoneBy = data.household.activeMember;
      item.nextDue = addDays(item.lastDone, item.cadenceDays);
      persist();
      renderAll();
    });

    const del = document.createElement("button");
    del.className = "danger";
    del.textContent = "Delete";
    del.addEventListener("click", () => {
      if (!confirm("Delete this task?")) return;
      removeById(data.tasks, item.id);
      renderAll();
    });

    actions.append(done, del);
    refs.taskList.appendChild(node);
  });
}

function renderInventory() {
  refs.inventoryList.innerHTML = "";
  if (!data.inventory.length) {
    refs.inventoryList.innerHTML = `<p class="hint">No inventory items yet.</p>`;
    return;
  }

  data.inventory.forEach((item) => {
    const node = refs.rowTemplate.content.firstElementChild.cloneNode(true);
    const low = item.quantity <= item.threshold;
    node.querySelector(".row-main").innerHTML =
      `<strong>${escapeHtml(item.item)}</strong><br />${item.quantity} ${escapeHtml(item.unit)} | Alert at ${item.threshold} ${escapeHtml(item.unit)}<br />By: ${escapeHtml(item.by || "Unknown")}` +
      (low ? ` <span style="color:var(--warn);font-weight:800;">(LOW)</span>` : "");

    const actions = node.querySelector(".row-actions");
    const minus = document.createElement("button");
    minus.className = "ghost";
    minus.textContent = "-1";
    minus.addEventListener("click", () => {
      item.quantity = Math.max(0, Number((item.quantity - 1).toFixed(2)));
      persist();
      renderAll();
    });

    const plus = document.createElement("button");
    plus.className = "ghost";
    plus.textContent = "+1";
    plus.addEventListener("click", () => {
      item.quantity = Number((item.quantity + 1).toFixed(2));
      persist();
      renderAll();
    });

    const del = document.createElement("button");
    del.className = "danger";
    del.textContent = "Delete";
    del.addEventListener("click", () => {
      if (!confirm("Delete this item?")) return;
      removeById(data.inventory, item.id);
      renderAll();
    });

    actions.append(minus, plus, del);
    refs.inventoryList.appendChild(node);
  });
}
/**
 * Render version info in settings panel
 */
function renderVersionInfo() {
  const versionEl = document.getElementById("app-version");
  if (versionEl) {
    versionEl.textContent = `Chicken Tracker v${APP_VERSION}`;
  }
  updateThemeSelect();
}

/**
 * Update theme select to match current preference
 */
function updateThemeSelect() {
  const select = document.getElementById("theme-preference");
  if (select) {
    select.value = getThemePreference();
  }
}