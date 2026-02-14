const STORAGE_KEY = "chicken_tracker_v2";
const LEGACY_STORAGE_KEY = "chicken_tracker_v1";
const SETTINGS_COLLAPSED_KEY = "chicken_tracker_settings_collapsed";
const KG_TO_LB = 2.2046226218;
const L_TO_GAL = 0.2641720524;
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
const charts = {
  production: null,
  consumption: null,
  member: null
};

const data = loadData();

const refs = {
  statsGrid: document.getElementById("stats-grid"),
  eggsList: document.getElementById("eggs-list"),
  feedList: document.getElementById("feed-list"),
  waterList: document.getElementById("water-list"),
  careList: document.getElementById("care-list"),
  taskList: document.getElementById("task-list"),
  inventoryList: document.getElementById("inventory-list"),
  rowTemplate: document.getElementById("row-template"),
  importInput: document.getElementById("import-input"),
  activeMember: document.getElementById("active-member"),
  membersList: document.getElementById("members-list"),
  mergeFromMember: document.getElementById("merge-from-member"),
  mergeToMember: document.getElementById("merge-to-member"),
  settingsPanel: document.getElementById("settings-panel"),
  settingsContent: document.getElementById("settings-content"),
  settingsToggle: document.getElementById("settings-toggle"),
  iCloudSigninBtn: document.getElementById("icloud-signin-btn"),
  iCloudSignoutBtn: document.getElementById("icloud-signout-btn"),
  syncStatus: document.getElementById("sync-status"),
  autoSync: document.getElementById("auto-sync"),
  chartWindow: document.getElementById("chart-window"),
  productionChart: document.getElementById("production-chart"),
  consumptionChart: document.getElementById("consumption-chart"),
  memberChart: document.getElementById("member-chart")
};

init();

function init() {
  initSettingsPanel();
  hydrateForms();
  bindForms();
  renderAll();
  initCloudKit();
  window.addEventListener("storage", handleStorageSync);
}

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return withDefaults();
  try {
    return normalizeIncoming(JSON.parse(raw));
  } catch {
    return withDefaults();
  }
}

function withDefaults(parsed = {}) {
  const members = normalizeMembers(parsed.household?.members);
  const activeMember = members.includes(parsed.household?.activeMember)
    ? parsed.household.activeMember
    : members[0];

  return {
    profile: {
      flockName: parsed.profile?.flockName || "",
      henCount: Number(parsed.profile?.henCount || 0),
      units: parsed.profile?.units || (Object.keys(parsed).length ? "metric" : "imperial")
    },
    household: {
      members,
      activeMember,
      autoSync: Boolean(parsed.household?.autoSync),
      lastSyncedAt: parsed.household?.lastSyncedAt || ""
    },
    eggs: normalizeByRecords(parsed.eggs, activeMember, ["count", "broken"]),
    feed: normalizeByRecords(parsed.feed, activeMember, ["kg"]),
    water: normalizeByRecords(parsed.water, activeMember, ["liters"]),
    care: normalizeByRecords(parsed.care, activeMember, []),
    tasks: normalizeTasks(parsed.tasks, activeMember),
    inventory: normalizeInventory(parsed.inventory, activeMember)
  };
}

function normalizeIncoming(parsed = {}) {
  const next = withDefaults(parsed);
  migrateToImperial(next);
  return next;
}

function normalizeMembers(input) {
  const arr = Array.isArray(input) ? input : [];
  const cleaned = [...new Set(arr.map((name) => String(name || "").trim()).filter(Boolean))];
  return cleaned.length ? cleaned : ["Household"];
}

function initSettingsPanel() {
  const collapsed = localStorage.getItem(SETTINGS_COLLAPSED_KEY) === "1";
  setSettingsCollapsed(collapsed);
}

function toggleSettingsPanel() {
  const isCollapsed = refs.settingsPanel.classList.contains("collapsed");
  setSettingsCollapsed(!isCollapsed);
}

function setSettingsCollapsed(collapsed) {
  refs.settingsPanel.classList.toggle("collapsed", collapsed);
  refs.settingsContent.hidden = collapsed;
  refs.settingsToggle.textContent = collapsed ? "Show Settings" : "Hide Settings";
  localStorage.setItem(SETTINGS_COLLAPSED_KEY, collapsed ? "1" : "0");
}

function normalizeByRecords(input, fallbackBy, numberFields) {
  if (!Array.isArray(input)) return [];
  return input.map((item) => {
    const next = { ...item };
    next.id = item.id || uid();
    next.date = item.date || todayISO();
    next.by = item.by || fallbackBy;
    numberFields.forEach((field) => {
      next[field] = Number(item[field] || 0);
    });
    return next;
  });
}

function normalizeTasks(input, fallbackBy) {
  if (!Array.isArray(input)) return [];
  return input.map((item) => {
    const cadenceDays = Math.max(1, Number(item.cadenceDays || 1));
    const lastDone = item.lastDone || todayISO();
    return {
      id: item.id || uid(),
      name: item.name || "Task",
      cadenceDays,
      lastDone,
      nextDue: item.nextDue || addDays(lastDone, cadenceDays),
      createdBy: item.createdBy || item.by || fallbackBy,
      lastDoneBy: item.lastDoneBy || item.by || fallbackBy
    };
  });
}

function normalizeInventory(input, fallbackBy) {
  if (!Array.isArray(input)) return [];
  return input.map((item) => ({
    id: item.id || uid(),
    item: item.item || "Supply",
    quantity: Number(item.quantity || 0),
    unit: item.unit || "units",
    threshold: Number(item.threshold || 0),
    by: item.by || fallbackBy
  }));
}

function persist(options = {}) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  if (!options.skipAutoSync && data.household.autoSync) {
    scheduleAutoSync();
  }
}

function bindForms() {
  refs.settingsToggle.addEventListener("click", toggleSettingsPanel);

  document.getElementById("profile-form").addEventListener("submit", (e) => {
    e.preventDefault();
    data.profile.flockName = document.getElementById("flock-name").value.trim();
    data.profile.henCount = Number(document.getElementById("hen-count").value || 0);
    persist();
    renderAll();
  });

  refs.activeMember.addEventListener("change", () => {
    data.household.activeMember = refs.activeMember.value;
    persist();
    renderAll();
  });

  document.getElementById("merge-members-btn").addEventListener("click", () => {
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
    mergeMemberRecords(from, to);
  });

  document.getElementById("member-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("member-name");
    const name = input.value.trim();
    if (!name) return;
    if (data.household.members.some((m) => m.toLowerCase() === name.toLowerCase())) {
      alert("That member already exists.");
      return;
    }
    data.household.members.push(name);
    data.household.activeMember = name;
    input.value = "";
    persist();
    renderAll();
  });

  refs.autoSync.addEventListener("change", () => {
    data.household.autoSync = refs.autoSync.checked;
    persist({ skipAutoSync: true });
    setSyncStatus(data.household.autoSync ? "Auto-sync enabled." : "Auto-sync disabled.");
  });

  refs.iCloudSigninBtn.addEventListener("click", signInCloudKit);
  refs.iCloudSignoutBtn.addEventListener("click", signOutCloudKit);
  document.getElementById("pull-sync-btn").addEventListener("click", () => pullFromSync());
  document.getElementById("push-sync-btn").addEventListener("click", () => pushToSync());

  refs.chartWindow.addEventListener("change", renderCharts);

  document.getElementById("eggs-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    data.eggs.push({
      id: uid(),
      date: form.date.value,
      count: Number(form.count.value),
      broken: Number(form.broken.value || 0),
      by: data.household.activeMember
    });
    persist();
    form.reset();
    form.date.value = todayISO();
    renderAll();
  });

  document.getElementById("feed-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    data.feed.push({
      id: uid(),
      date: form.date.value,
      type: form.type.value.trim(),
      kg: Number(form.kg.value),
      by: data.household.activeMember
    });
    persist();
    form.reset();
    form.date.value = todayISO();
    renderAll();
  });

  document.getElementById("water-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    data.water.push({
      id: uid(),
      date: form.date.value,
      liters: Number(form.liters.value),
      by: data.household.activeMember
    });
    persist();
    form.reset();
    form.date.value = todayISO();
    renderAll();
  });

  document.getElementById("care-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    data.care.push({
      id: uid(),
      date: form.date.value,
      category: form.category.value,
      note: form.note.value.trim(),
      by: data.household.activeMember
    });
    persist();
    form.reset();
    form.date.value = todayISO();
    renderAll();
  });

  document.getElementById("task-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const cadenceDays = Number(form.cadenceDays.value);
    const lastDone = form.lastDone.value;
    data.tasks.push({
      id: uid(),
      name: form.name.value.trim(),
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
  });

  document.getElementById("inventory-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    data.inventory.push({
      id: uid(),
      item: form.item.value.trim(),
      quantity: Number(form.quantity.value),
      unit: form.unit.value.trim(),
      threshold: Number(form.threshold.value),
      by: data.household.activeMember
    });
    persist();
    form.reset();
    renderAll();
  });

  refs.importInput.addEventListener("change", onImport);
  document.getElementById("export-btn").addEventListener("click", onExport);
  document.getElementById("reset-btn").addEventListener("click", onReset);
}

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
    input.value = todayISO();
  });
}

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
}

function renderHouseholdControls() {
  refs.activeMember.innerHTML = "";
  data.household.members.forEach((member) => {
    const option = document.createElement("option");
    option.value = member;
    option.textContent = member;
    if (member === data.household.activeMember) option.selected = true;
    refs.activeMember.appendChild(option);
  });

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
    btn.addEventListener("click", () => removeMember(member));
    row.appendChild(btn);
    refs.membersList.appendChild(row);
  });

  const mergeFromOptions = getKnownContributorNames();
  const mergeToOptions = [...data.household.members];

  renderSelectOptions(refs.mergeFromMember, mergeFromOptions, mergeFromOptions[0] || "");
  renderSelectOptions(
    refs.mergeToMember,
    mergeToOptions,
    mergeToOptions.includes(data.household.activeMember)
      ? data.household.activeMember
      : (mergeToOptions[0] || "")
  );
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

function renderCharts() {
  if (!window.Chart) return;

  const days = Number(refs.chartWindow.value || 30);
  const dateKeys = getLastNDays(days);
  const labels = dateKeys.map(shortDateLabel);

  const eggsData = seriesFromRecords(data.eggs, dateKeys, "count");
  const brokenData = seriesFromRecords(data.eggs, dateKeys, "broken");
  const feedData = seriesFromRecords(data.feed, dateKeys, "kg");
  const waterData = seriesFromRecords(data.water, dateKeys, "liters");

  upsertChart("production", refs.productionChart, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Eggs Collected",
          data: eggsData,
          borderColor: "#1f7a53",
          backgroundColor: "rgba(31, 122, 83, 0.22)",
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 3
        },
        {
          label: "Broken/Dirty",
          data: brokenData,
          borderColor: "#c65244",
          backgroundColor: "rgba(198, 82, 68, 0.14)",
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2
        }
      ]
    },
    options: chartOptions({
      yTitle: "Egg count",
      integerY: true,
      tooltipSuffix: " eggs"
    })
  });

  upsertChart("consumption", refs.consumptionChart, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Feed (lb)",
          data: feedData,
          yAxisID: "yFeed",
          borderColor: "#8ea91e",
          backgroundColor: "rgba(142, 169, 30, 0.16)",
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2.5
        },
        {
          label: "Water (gal)",
          data: waterData,
          yAxisID: "yWater",
          borderColor: "#2d6db5",
          backgroundColor: "rgba(45, 109, 181, 0.14)",
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2.5
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          position: "bottom",
          labels: { usePointStyle: true, boxWidth: 9, color: "#365046", padding: 16 }
        },
        tooltip: { padding: 10 }
      },
      scales: {
        x: {
          grid: { display: false, drawBorder: false },
          ticks: { color: "#4f6a56", maxRotation: 0, autoSkip: true, maxTicksLimit: days > 20 ? 8 : 12 }
        },
        yFeed: {
          type: "linear",
          position: "left",
          beginAtZero: true,
          title: { display: true, text: "Feed (lb)", color: "#4f6a56", font: { weight: "700" } },
          grid: { color: "rgba(19, 39, 24, 0.08)", drawBorder: false },
          ticks: { color: "#4f6a56" }
        },
        yWater: {
          type: "linear",
          position: "right",
          beginAtZero: true,
          title: { display: true, text: "Water (gal)", color: "#4f6a56", font: { weight: "700" } },
          grid: { drawOnChartArea: false, drawBorder: false },
          ticks: { color: "#4f6a56" }
        }
      }
    }
  });

  const memberRows = Object.entries(activityByMember(30))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const memberLabels = memberRows.map((row) => row[0]);
  const memberValues = memberRows.map((row) => row[1]);

  upsertChart("member", refs.memberChart, {
    type: "bar",
    data: {
      labels: memberLabels.length ? memberLabels : ["No records"],
      datasets: [
        {
          label: "Entries",
          data: memberValues.length ? memberValues : [1],
          backgroundColor: memberValues.length
            ? [
                "rgba(31, 122, 83, 0.86)",
                "rgba(62, 139, 95, 0.82)",
                "rgba(96, 157, 112, 0.8)",
                "rgba(133, 176, 130, 0.78)",
                "rgba(173, 196, 152, 0.75)",
                "rgba(199, 209, 174, 0.72)",
                "rgba(216, 223, 196, 0.7)",
                "rgba(230, 236, 220, 0.68)"
              ]
            : ["rgba(79, 106, 86, 0.35)"],
          borderRadius: 8,
          borderSkipped: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      plugins: {
        legend: { display: false },
        tooltip: { padding: 10 }
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: "rgba(19, 39, 24, 0.08)", drawBorder: false },
          ticks: { precision: 0, color: "#4f6a56" }
        },
        y: {
          grid: { display: false, drawBorder: false },
          ticks: { color: "#365046" }
        }
      }
    }
  });
}

function chartOptions({ yTitle, integerY = false, tooltipSuffix = "" }) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: {
        position: "bottom",
        labels: { usePointStyle: true, boxWidth: 9, color: "#365046", padding: 16 }
      },
      tooltip: {
        padding: 10,
        callbacks: {
          label(context) {
            const value = Number(context.parsed.y || 0);
            const display = integerY ? Math.round(value) : value.toFixed(2);
            return `${context.dataset.label}: ${display}${tooltipSuffix}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false, drawBorder: false },
        ticks: { color: "#4f6a56", maxRotation: 0, autoSkip: true, maxTicksLimit: 10 }
      },
      y: {
        beginAtZero: true,
        title: { display: true, text: yTitle, color: "#4f6a56", font: { weight: "700" } },
        grid: { color: "rgba(19, 39, 24, 0.08)", drawBorder: false },
        ticks: {
          color: "#4f6a56",
          precision: integerY ? 0 : 2
        }
      }
    }
  };
}

function upsertChart(key, canvas, config) {
  if (!canvas) return;
  const current = charts[key];
  if (current) current.destroy();
  charts[key] = new window.Chart(canvas.getContext("2d"), config);
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
      (isDue ? ` <span style="color:#b73d2f;font-weight:800;">(DUE)</span>` : "");

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
      (low ? ` <span style="color:#b73d2f;font-weight:800;">(LOW)</span>` : "");

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
      removeById(data.inventory, item.id);
      renderAll();
    });

    actions.append(minus, plus, del);
    refs.inventoryList.appendChild(node);
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
      onDelete(item.id);
      renderAll();
    });
    actions.append(del);
    container.appendChild(node);
  });
}

function removeMember(name) {
  if (data.household.members.length === 1) {
    alert("You must keep at least one member.");
    return;
  }
  if (name === data.household.activeMember) {
    alert("Switch active logger before removing this member.");
    return;
  }
  data.household.members = data.household.members.filter((member) => member !== name);
  persist();
  renderAll();
}

function mergeMemberRecords(fromName, toName) {
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

  if (changed === 0) {
    setSyncStatus(`No records found for "${fromName}".`);
    return;
  }

  persist();
  renderAll();
  setSyncStatus(`Merged ${changed} attribution fields from "${fromName}" to "${toName}".`);
}

function onExport() {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `chicken-tracker-backup-${todayISO()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
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
    } catch {
      alert("Could not import file. Please select a valid JSON backup.");
    }
  };
  reader.readAsText(file);
  event.target.value = "";
}

function onReset() {
  if (!confirm("Reset all records and profile data? This cannot be undone.")) return;
  Object.assign(data, withDefaults());
  persist({ skipAutoSync: true });
  hydrateForms();
  renderAll();
  setSyncStatus("All data reset.");
}

async function initCloudKit() {
  if (!window.CloudKit) {
    setSyncStatus("CloudKit SDK failed to load.", true);
    updateSyncButtons();
    return;
  }
  if (!CLOUDKIT_CONTAINER_ID.includes(".") || CLOUDKIT_API_TOKEN.startsWith("REPLACE_")) {
    setSyncStatus("Configure CloudKit container ID and web API token in app.js.", true);
    updateSyncButtons();
    return;
  }

  try {
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
    setSyncStatus(`CloudKit setup failed: ${error.message}`, true);
  }
}

async function signInCloudKit() {
  if (!cloudKitContainer) {
    await initCloudKit();
  }
  if (!cloudKitContainer) return;

  try {
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
    setSyncStatus(`Apple sign-in failed: ${error.message}`, true);
  }
}

async function signOutCloudKit() {
  if (!cloudKitContainer) return;
  try {
    await cloudKitContainer.unauthorize();
    cloudKitSignedIn = false;
    updateSyncButtons();
    setSyncStatus("Signed out of iCloud sync.");
  } catch (error) {
    setSyncStatus(`Sign-out failed: ${error.message}`, true);
  }
}

async function getCloudKitUser() {
  if (!cloudKitContainer) return null;
  try {
    return await cloudKitContainer.getUserInfo();
  } catch {
    return null;
  }
}

function updateSyncButtons() {
  const signedIn = cloudKitAvailable && cloudKitSignedIn;
  refs.iCloudSigninBtn.disabled = !cloudKitAvailable || signedIn;
  refs.iCloudSignoutBtn.disabled = !signedIn;
  document.getElementById("pull-sync-btn").disabled = !signedIn;
  document.getElementById("push-sync-btn").disabled = !signedIn;
}

async function pullFromSync() {
  if (!cloudKitAvailable || !cloudKitSignedIn || !cloudKitDb) {
    alert("Sign in with Apple first.");
    return;
  }

  try {
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
    setSyncStatus(`Could not pull from iCloud: ${error.message}`, true);
  }
}

async function pushToSync(options = {}) {
  const silent = Boolean(options.silent);
  if (!cloudKitAvailable || !cloudKitSignedIn || !cloudKitDb) {
    if (!silent) alert("Sign in with Apple first.");
    return;
  }

  try {
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
    setSyncStatus(`Could not push to iCloud: ${error.message}`, true);
  }
}

function scheduleAutoSync() {
  clearTimeout(autoSyncTimer);
  autoSyncTimer = setTimeout(() => {
    pushToSync({ silent: true });
  }, 1200);
}

function handleStorageSync(event) {
  if (event.key !== STORAGE_KEY || !event.newValue) return;
  try {
    const next = normalizeIncoming(JSON.parse(event.newValue));
    Object.assign(data, next);
    hydrateForms();
    renderAll();
    setSyncStatus("Local data refreshed from another tab.");
  } catch {
    /* Ignore bad data from other tabs */
  }
}

function stampSyncedAt() {
  data.household.lastSyncedAt = new Date().toLocaleString();
}

function setSyncStatus(message, isError = false) {
  refs.syncStatus.textContent = message;
  refs.syncStatus.style.color = isError ? "#b73d2f" : "";
}

function removeById(arr, id) {
  const idx = arr.findIndex((item) => item.id === id);
  if (idx >= 0) {
    arr.splice(idx, 1);
    persist();
  }
}

function sumByDate(list, date, field) {
  return list
    .filter((item) => item.date === date)
    .reduce((sum, item) => sum + Number(item[field] || 0), 0);
}

function rollingAvg(list, field, days) {
  const dateKeys = getLastNDays(days);
  const total = dateKeys.reduce((sum, day) => sum + sumByDate(list, day, field), 0);
  return total / days;
}

function seriesFromRecords(list, dateKeys, field) {
  return dateKeys.map((day) => sumByDate(list, day, field));
}

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

function getLastNDays(days) {
  const out = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(formatLocalDate(d));
  }
  return out;
}

function sortByDateDesc(list) {
  return [...list].sort((a, b) => b.date.localeCompare(a.date));
}

function shortDateLabel(dateISO) {
  return dateISO.slice(5);
}

function addDays(dateISO, days) {
  const d = new Date(`${dateISO}T00:00:00`);
  d.setDate(d.getDate() + days);
  return formatLocalDate(d);
}

function todayISO() {
  return formatLocalDate(new Date());
}

function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatLocalDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

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
