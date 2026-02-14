/**
 * Charts module for Chicken Tracker
 * Handles all chart rendering and updates
 */

const charts = {
  production: null,
  consumption: null,
  member: null
};

/**
 * Create or update a chart
 * @param {string} key - Chart key
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {object} config - Chart.js config
 */
function upsertChart(key, canvas, config) {
  if (!canvas) return;
  const current = charts[key];
  if (current) current.destroy();
  charts[key] = new window.Chart(canvas.getContext("2d"), config);
}

/**
 * Get standard chart options
 * @param {object} opts - Options
 * @returns {object} Chart.js options
 */
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

/**
 * Render all charts
 */
function renderCharts() {
  if (!window.Chart) return;

  const days = Number(document.getElementById("chart-window")?.value || 30);
  const dateKeys = getLastNDays(days);
  const labels = dateKeys.map(shortDateLabel);

  const eggsData = seriesFromRecords(data.eggs, dateKeys, "count");
  const brokenData = seriesFromRecords(data.eggs, dateKeys, "broken");
  const feedData = seriesFromRecords(data.feed, dateKeys, "kg");
  const waterData = seriesFromRecords(data.water, dateKeys, "liters");

  // Production chart
  upsertChart("production", document.getElementById("production-chart"), {
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

  // Consumption chart
  upsertChart("consumption", document.getElementById("consumption-chart"), {
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

  // Member activity chart
  const memberRows = Object.entries(activityByMember(30))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const memberLabels = memberRows.map((row) => row[0]);
  const memberValues = memberRows.map((row) => row[1]);

  upsertChart("member", document.getElementById("member-chart"), {
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
