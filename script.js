/**
 * script.js
 * ============================================================
 * Dashboard logic: Supabase data loading, risk classification,
 * card rendering, modals, chart.
 * 
 * CHANGES FROM ORIGINAL:
 * 1. Exposed `allResponses` as window.allResponses so analyzer.js
 *    can use it for anonymized aggregation context.
 * 2. Fixed duplicate script.js inclusion (was in HTML twice).
 * 3. Minor cleanup — no logic changes.
 * ============================================================
 */

const totalCount = document.getElementById("totalCount");
const highCount  = document.getElementById("highCount");
const mediumCount= document.getElementById("mediumCount");
const lowCount   = document.getElementById("lowCount");
const topFeature = document.getElementById("topFeature");

let riskChartInstance = null;

// CHANGE: Use window.allResponses so analyzer.js can read it for context
window.allResponses = [];

// ─── STATS + CHART ───────────────────────────────────────────
function updateStats(data) {
  const total  = data.length;
  const high   = data.filter(item => item.calculatedRisk.risk_level === "High").length;
  const medium = data.filter(item => item.calculatedRisk.risk_level === "Medium").length;
  const low    = data.filter(item => item.calculatedRisk.risk_level === "Low").length;

  totalCount.textContent  = total;
  highCount.textContent   = high;
  mediumCount.textContent = medium;
  lowCount.textContent    = low;

  const featureMap = {};
  data.forEach(item => {
    const feature = item.preferred_feature || "Unknown";
    featureMap[feature] = (featureMap[feature] || 0) + 1;
  });

  let mostRequested = "N/A";
  let maxCnt = 0;
  for (const feature in featureMap) {
    if (featureMap[feature] > maxCnt) {
      maxCnt = featureMap[feature];
      mostRequested = feature;
    }
  }

  topFeature.textContent = mostRequested;
  renderRiskChart(high, medium, low);
}

function renderRiskChart(high, medium, low) {
  const ctx = document.getElementById("riskChart").getContext("2d");
  if (riskChartInstance) riskChartInstance.destroy();

  riskChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["High", "Medium", "Low"],
      datasets: [{
        label: "Risk Distribution",
        data: [high, medium, low],
        backgroundColor: ["#dc2626", "#d97706", "#16a34a"],
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 } }
      }
    }
  });
}

// ─── SUPABASE SETUP ──────────────────────────────────────────
const SUPABASE_URL = "https://omvpwuxzdpkiigbtmmsx.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tdnB3dXh6ZHBraWlnYnRtbXN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NTE2NjUsImV4cCI6MjA5MzAyNzY2NX0.peYIwEEBOf1rcwa0w0stHp6G5gruZeRE1OYzM-zoHCQ";

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const cards         = document.getElementById("cards");
const statusBox     = document.getElementById("status");
const refreshBtn    = document.getElementById("refreshBtn");
const filterButtons = document.querySelectorAll(".filter-btn");

const modal          = document.getElementById("detailModal");
const modalBody      = document.getElementById("modalBody");
const closeModal     = document.getElementById("closeModal");
const reportModal    = document.getElementById("reportModal");
const reportModalBody= document.getElementById("reportModalBody");
const closeReportModal = document.getElementById("closeReportModal");

let currentFilter = "All";

// ─── RISK CALCULATION (survey-based) ─────────────────────────
function calculateRisk(item) {
  let score = 0;

  const delay   = (item.delay_doctor_visit || "").toLowerCase();
  const action  = (item.usual_action_when_unwell || "").toLowerCase();
  const trust   = (item.trust_online_medical_info || "").toLowerCase();
  const feature = (item.preferred_feature || "").toLowerCase();
  const interest= (item.ai_tool_interest || "").toLowerCase();

  if (delay.includes("often"))     score += 2;
  else if (delay.includes("sometimes")) score += 1;

  if (action.includes("ignore"))   score += 2;
  if (action.includes("search"))   score += 1;

  if (trust.includes("no"))        score += 1;
  if (trust.includes("not sure"))  score += 1;

  if (feature.includes("severity"))score += 1;
  if (feature.includes("doctor"))  score += 1;
  if (feature.includes("first-aid"))score+= 1;

  if (interest.includes("yes"))    score += 1;
  else if (interest.includes("maybe")) score += 0.5;

  let level = "Low";
  if (score >= 5) level = "High";
  else if (score >= 3) level = "Medium";

  let summary = `This response suggests a ${level.toLowerCase()} screening priority. `;
  if (delay.includes("often") || delay.includes("sometimes"))
    summary += "The user may delay seeking medical help. ";
  if (action.includes("ignore"))
    summary += "The response indicates symptom-ignoring behavior. ";
  if (feature.includes("severity"))
    summary += "The user values symptom severity guidance. ";
  summary += "This is an educational screening output, not a diagnosis.";

  return { risk_score: Math.round(score), risk_level: level, ai_summary: summary };
}

// ─── REPORT BUILDER ──────────────────────────────────────────
function buildFullReport(item, result) {
  const concernAreas     = [];
  const recommendations  = [];

  const delay   = (item.delay_doctor_visit || "").toLowerCase();
  const action  = (item.usual_action_when_unwell || "").toLowerCase();
  const trust   = (item.trust_online_medical_info || "").toLowerCase();
  const feature = (item.preferred_feature || "").toLowerCase();

  if (delay.includes("often") || delay.includes("sometimes")) {
    concernAreas.push("Delayed medical consultation");
    recommendations.push("Encourage earlier professional consultation when symptoms persist.");
  }
  if (action.includes("ignore")) {
    concernAreas.push("Symptom ignoring behavior");
    recommendations.push("Promote awareness about early symptom reporting.");
  }
  if (action.includes("search")) {
    concernAreas.push("Self-directed symptom checking");
    recommendations.push("Provide trusted, clinician-reviewed symptom guidance.");
  }
  if (trust.includes("no") || trust.includes("not sure")) {
    concernAreas.push("Low confidence in online medical information");
    recommendations.push("Offer verified medical education resources and local referral options.");
  }
  if (feature.includes("severity")) {
    concernAreas.push("Needs symptom severity support");
    recommendations.push("Include severity scoring and escalation prompts.");
  }
  if (feature.includes("doctor"))  recommendations.push("Add nearby doctor recommendation or referral support.");
  if (feature.includes("first-aid")) recommendations.push("Include first-aid guidance for minor urgent situations.");

  if (concernAreas.length === 0)    concernAreas.push("No major behavioral concern flagged from current survey.");
  if (recommendations.length === 0) recommendations.push("Continue routine symptom monitoring and consult a doctor if concerns increase.");

  return {
    report_title:    `AI Screening Report for Survey #${item.id}`,
    report_summary:  result.ai_summary,
    concern_areas:   concernAreas.join("; "),
    recommendation:  recommendations.join(" "),
    disclaimer: "This report is for educational screening support only and does not provide medical diagnosis or treatment advice."
  };
}

// ─── SUPABASE SAVE HELPERS ───────────────────────────────────
async function saveRiskResult(id, result) {
  const { error } = await db
    .from("patient_survey")
    .update({
      risk_score: result.risk_score,
      risk_level: result.risk_level,
      ai_summary: result.ai_summary
    })
    .eq("id", id);
  if (error) console.error("Update error for row", id, error.message);
}

async function saveFullReport(item, report) {
  const { data, error } = await db
    .from("ai_reports")
    .insert([{
      survey_id:       item.id,
      report_title:    report.report_title,
      report_summary:  report.report_summary,
      concern_areas:   report.concern_areas,
      recommendation:  report.recommendation,
      disclaimer:      report.disclaimer
    }])
    .select();
  if (error) { alert("Error saving report: " + error.message); return null; }
  return data[0];
}

// ─── UI HELPERS ──────────────────────────────────────────────
function getRiskColor(level) {
  if (level === "High")   return "#dc2626";
  if (level === "Medium") return "#d97706";
  return "#16a34a";
}

function getRiskPriority(level) {
  if (level === "High")   return 1;
  if (level === "Medium") return 2;
  return 3;
}

function openModal(item, result) {
  modalBody.innerHTML = `
    <p><strong>ID:</strong> ${item.id}</p>
    <p><strong>Created At:</strong> ${item.created_at || "N/A"}</p>
    <p><strong>Age Group:</strong> ${item.age_group || "N/A"}</p>
    <p><strong>Location:</strong> ${item.location_type || "N/A"}</p>
    <p><strong>Usual Action When Unwell:</strong> ${item.usual_action_when_unwell || "N/A"}</p>
    <p><strong>Delay Doctor Visit:</strong> ${item.delay_doctor_visit || "N/A"}</p>
    <p><strong>Barrier to Early Help:</strong> ${item.barrier_to_early_help || "N/A"}</p>
    <p><strong>Ignored Symptoms Before:</strong> ${item.ignored_symptoms_before || "N/A"}</p>
    <p><strong>Trust Online Medical Info:</strong> ${item.trust_online_medical_info || "N/A"}</p>
    <p><strong>AI Tool Interest:</strong> ${item.ai_tool_interest || "N/A"}</p>
    <p><strong>Preferred Feature:</strong> ${item.preferred_feature || "N/A"}</p>
    <hr style="margin:16px 0;">
    <p><strong>Risk Score:</strong> ${result.risk_score}</p>
    <p><strong>Risk Level:</strong> <span style="color:${getRiskColor(result.risk_level)};font-weight:bold;">${result.risk_level}</span></p>
    <p><strong>Summary:</strong> ${result.ai_summary}</p>
  `;
  modal.style.display = "block";
}

function openReportModal(savedReport) {
  reportModalBody.innerHTML = `
    <p><strong>Report Title:</strong> ${savedReport.report_title}</p>
    <p><strong>Summary:</strong> ${savedReport.report_summary}</p>
    <p><strong>Concern Areas:</strong> ${savedReport.concern_areas}</p>
    <p><strong>Recommendation:</strong> ${savedReport.recommendation}</p>
    <p style="margin-top:16px; color:#9a3412; background:#fff7ed; padding:12px; border-radius:8px;">
      <strong>Disclaimer:</strong> ${savedReport.disclaimer}
    </p>
  `;
  reportModal.style.display = "block";
}

// ─── RENDER CARDS ────────────────────────────────────────────
function renderResponses() {
  cards.innerHTML = "";

  let filtered = [...window.allResponses];
  if (currentFilter !== "All") {
    filtered = filtered.filter(item => item.calculatedRisk.risk_level === currentFilter);
  }
  filtered.sort((a, b) => getRiskPriority(a.calculatedRisk.risk_level) - getRiskPriority(b.calculatedRisk.risk_level));

  if (filtered.length === 0) {
    cards.innerHTML = "<p>No responses found for this filter.</p>";
    return;
  }

  filtered.forEach((item) => {
    const result = item.calculatedRisk;
    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <h3>Survey #${item.id}</h3>
      <p><span class="label">Age Group:</span> ${item.age_group || "N/A"}</p>
      <p><span class="label">Location:</span> ${item.location_type || "N/A"}</p>
      <p><span class="label">Risk Score:</span> ${result.risk_score}</p>
      <p><span class="label">Risk Level:</span>
        <strong style="color:${getRiskColor(result.risk_level)}">${result.risk_level}</strong>
      </p>
      <p><span class="label">Summary:</span> ${result.ai_summary}</p>
      <p style="margin-top:12px;color:#2563eb;font-weight:600;">Click card to view full details</p>
      <button class="report-btn">Generate Full Report</button>
    `;

    card.addEventListener("click", () => openModal(item, result));

    const reportBtn = card.querySelector(".report-btn");
    reportBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const fullReport  = buildFullReport(item, result);
      const savedReport = await saveFullReport(item, fullReport);
      if (savedReport) openReportModal(savedReport);
    });

    cards.appendChild(card);
  });
}

// ─── LOAD DATA ───────────────────────────────────────────────
async function loadResponses() {
  statusBox.textContent = "Loading data...";
  updateStats(window.allResponses);
  cards.innerHTML = "";

  const { data, error } = await db
    .from("patient_survey")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) { statusBox.textContent = "Error loading data: " + error.message; return; }
  if (!data || data.length === 0) { statusBox.textContent = "No responses found."; return; }

  window.allResponses = [];

  for (const item of data) {
    const result = calculateRisk(item);
    if (
      item.risk_score !== result.risk_score ||
      item.risk_level !== result.risk_level ||
      item.ai_summary !== result.ai_summary
    ) {
      await saveRiskResult(item.id, result);
    }
    window.allResponses.push({ ...item, calculatedRisk: result });
  }

  statusBox.textContent = `Loaded ${window.allResponses.length} response(s).`;
  updateStats(window.allResponses);
  renderResponses();
}

// ─── EVENT LISTENERS ─────────────────────────────────────────
filterButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    filterButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.dataset.filter;
    renderResponses();
  });
});

refreshBtn.addEventListener("click", loadResponses);
closeModal.addEventListener("click", () => { modal.style.display = "none"; });
closeReportModal.addEventListener("click", () => { reportModal.style.display = "none"; });

window.addEventListener("click", (e) => {
  if (e.target === modal)       modal.style.display = "none";
  if (e.target === reportModal) reportModal.style.display = "none";
});

loadResponses();
