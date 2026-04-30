/**
 * analyzer.js
 * ============================================================
 * NEW FILE — Medical Symptom Analyzer (Rule-Based Engine)
 * 
 * WHAT THIS DOES:
 *  - Reads user input (age, gender, symptoms, conditions, etc.)
 *  - Applies rule-based logic to compute a risk score
 *  - Returns structured results: risk level, steps, doctor type
 * 
 * PRIVACY NOTE:
 *  - No raw PII is stored in UI state
 *  - Only anonymized pattern info is used for aggregation
 * 
 * DISCLAIMER:
 *  This is NOT a medical diagnosis system. Results are for
 *  educational/informational purposes only.
 * ============================================================
 */

// ─── SYMPTOM RULES ───────────────────────────────────────────
// Each symptom maps to a severity weight (1–3) and a category
const SYMPTOM_WEIGHTS = {
  fever:              { score: 1, category: "infectious" },
  cough:              { score: 1, category: "respiratory" },
  chest_pain:         { score: 3, category: "cardiac" },     // HIGH weight
  shortness_of_breath:{ score: 3, category: "cardiac" },     // HIGH weight
  fatigue:            { score: 1, category: "general" },
  headache:           { score: 1, category: "neurological" },
  nausea:             { score: 1, category: "gastrointestinal" },
  joint_pain:         { score: 1, category: "musculoskeletal" },
  dizziness:          { score: 2, category: "neurological" },
  rash:               { score: 1, category: "dermatological" },
  abdominal_pain:     { score: 2, category: "gastrointestinal" },
  sore_throat:        { score: 1, category: "infectious" },
};

// ─── PRE-EXISTING CONDITION MULTIPLIERS ──────────────────────
const CONDITION_MULTIPLIERS = {
  diabetes:       1.3,
  hypertension:   1.3,
  heart_disease:  1.5,
  asthma:         1.2,
  thyroid:        1.1,
  kidney:         1.3,
  none:           1.0,
};

// ─── DURATION WEIGHTS ────────────────────────────────────────
const DURATION_WEIGHTS = {
  today:      0,
  "2_3_days": 1,
  week:       2,
  weeks_plus: 3,
  months:     3,
};

// ─── SEVERITY WEIGHTS ────────────────────────────────────────
const SEVERITY_WEIGHTS = {
  mild:     0,
  moderate: 2,
  severe:   4,
};

// ─── DOCTOR MAPPING by dominant symptom category ─────────────
const DOCTOR_MAP = {
  cardiac:           { type: "Cardiologist", urgency: "Seek consultation soon" },
  respiratory:       { type: "Pulmonologist / General Physician", urgency: "See a doctor if symptoms persist >3 days" },
  neurological:      { type: "Neurologist / General Physician", urgency: "Consult if recurring" },
  infectious:        { type: "General Physician / Infectious Disease Specialist", urgency: "Monitor closely; visit if fever persists" },
  gastrointestinal:  { type: "Gastroenterologist / General Physician", urgency: "Consult if pain is severe or persistent" },
  musculoskeletal:   { type: "Orthopedic Specialist / Rheumatologist", urgency: "Rest and consult if no improvement in a week" },
  dermatological:    { type: "Dermatologist", urgency: "Monitor for spread; consult promptly" },
  general:           { type: "General Physician", urgency: "Schedule a routine check-up" },
};

// ─── IMMEDIATE STEPS by category ─────────────────────────────
const IMMEDIATE_STEPS = {
  fever:              ["Stay hydrated — drink water every 30 minutes", "Rest and avoid exertion", "Monitor temperature; if >103°F (39.4°C), seek medical help"],
  cough:              ["Stay hydrated with warm liquids (honey + lemon tea helps)", "Avoid cold air and dust", "Use steam inhalation for relief"],
  chest_pain:         ["⚠️ Seek emergency help immediately if pain is crushing or radiates to arm/jaw", "Sit down, stay calm, loosen tight clothing", "Do NOT drive yourself — call for help"],
  shortness_of_breath:["⚠️ Sit upright; avoid lying flat", "Call emergency services if it worsens suddenly", "Note any triggers (dust, exertion, emotions)"],
  fatigue:            ["Ensure 7–9 hours of sleep nightly", "Eat iron-rich foods (spinach, lentils)", "Reduce screen time and stress triggers"],
  headache:           ["Drink water — dehydration is a common cause", "Rest in a quiet, dim room", "Avoid screens for 1–2 hours"],
  nausea:             ["Sip small amounts of water or electrolyte drinks frequently", "Avoid heavy, spicy, or greasy foods", "Try ginger tea for mild nausea relief"],
  joint_pain:         ["Apply ice for acute pain, heat for chronic stiffness", "Avoid strenuous activity until evaluated", "Gentle stretching may help"],
  dizziness:          ["Sit or lie down immediately when dizzy", "Avoid sudden head movements", "Increase water and salt intake if not hypertensive"],
  rash:               ["Avoid scratching to prevent infection", "Use gentle, fragrance-free soap", "Note any new foods, detergents, or medications introduced recently"],
  abdominal_pain:     ["Avoid solid food if pain is severe; try clear liquids", "Apply a warm compress to ease cramping", "Seek care immediately if pain is sharp, localized, or with fever"],
  sore_throat:        ["Gargle with warm salt water", "Stay hydrated, preferably warm liquids", "Avoid cold drinks and smoking environments"],
};

// ─── LIFESTYLE SUGGESTIONS ───────────────────────────────────
const LIFESTYLE_BY_CATEGORY = {
  cardiac:          ["Adopt a low-sodium, heart-healthy diet (oats, leafy greens, fish)", "Walk 30 mins daily at a comfortable pace", "Manage stress through meditation or deep breathing", "Avoid tobacco and excess caffeine"],
  respiratory:      ["Avoid dust, smoke, and allergens", "Practice deep breathing exercises daily", "Keep indoor air clean — open windows when possible", "Stay hydrated to thin mucus"],
  infectious:       ["Wash hands frequently with soap for 20 seconds", "Boost immunity with Vitamin C, D, and Zinc-rich foods", "Avoid sharing utensils or close contact while symptomatic"],
  neurological:     ["Maintain a consistent sleep schedule", "Limit screen time, especially before bed", "Stay hydrated throughout the day", "Track headache triggers in a simple journal"],
  gastrointestinal: ["Eat smaller, more frequent meals", "Reduce spicy, oily, and processed food", "Stay hydrated; include probiotic foods (yogurt, buttermilk)", "Avoid lying down immediately after meals"],
  musculoskeletal:  ["Incorporate gentle stretching and low-impact exercise", "Maintain a healthy weight to reduce joint stress", "Eat calcium and Vitamin D rich foods", "Practice good posture"],
  dermatological:   ["Use fragrance-free moisturizer twice daily", "Avoid harsh soaps and synthetic clothing", "Stay hydrated and eat antioxidant-rich fruits"],
  general:          ["Sleep 7–9 hours per night", "Exercise at least 150 mins/week (walking counts!)", "Eat a balanced diet with plenty of vegetables and fruits", "Reduce alcohol and avoid smoking"],
};

// ─── MAIN ANALYSIS FUNCTION ───────────────────────────────────
/**
 * analyzeSymptoms(input)
 * @param {Object} input - { age, gender, city, symptoms[], conditions[], duration, severity }
 * @returns {Object} result - risk level, score, steps, lifestyle, doctor
 * 
 * PRIVACY: Only processed metadata is returned — no raw PII stored
 */
function analyzeSymptoms(input) {
  const { age, symptoms, conditions, duration, severity } = input;

  let rawScore = 0;
  const categoryCount = {};
  const concernAreas = [];
  const immediateSteps = new Set();

  // ── Step 1: Score symptoms ────────────────────────────────
  symptoms.forEach(sym => {
    const rule = SYMPTOM_WEIGHTS[sym];
    if (!rule) return;

    rawScore += rule.score;
    categoryCount[rule.category] = (categoryCount[rule.category] || 0) + rule.score;

    // Collect immediate steps for each symptom
    const steps = IMMEDIATE_STEPS[sym] || [];
    steps.forEach(s => immediateSteps.add(s));
  });

  // ── Step 2: Add duration and severity scores ──────────────
  rawScore += (DURATION_WEIGHTS[duration] || 0);
  rawScore += (SEVERITY_WEIGHTS[severity] || 0);

  // ── Step 3: Apply condition multipliers ───────────────────
  let maxMultiplier = 1.0;
  conditions.forEach(cond => {
    const m = CONDITION_MULTIPLIERS[cond] || 1.0;
    if (m > maxMultiplier) maxMultiplier = m;
  });

  // Apply age-based modifier (>60 or <5 increases risk slightly)
  let ageMod = 1.0;
  if (age > 60) ageMod = 1.2;
  else if (age < 5) ageMod = 1.15;

  const finalScore = Math.round(rawScore * maxMultiplier * ageMod);

  // ── Step 4: Risk level classification ─────────────────────
  let riskLevel = "Low";
  if (finalScore >= 10) riskLevel = "High";
  else if (finalScore >= 5) riskLevel = "Medium";

  // ── Step 5: Override for critical symptoms ────────────────
  // Chest pain or shortness of breath alone = at least Medium
  if (symptoms.includes("chest_pain") || symptoms.includes("shortness_of_breath")) {
    if (riskLevel === "Low") riskLevel = "Medium";
  }

  // ── Step 6: Identify dominant category ───────────────────
  let dominantCategory = "general";
  let maxCatScore = 0;
  for (const cat in categoryCount) {
    if (categoryCount[cat] > maxCatScore) {
      maxCatScore = categoryCount[cat];
      dominantCategory = cat;
    }
  }

  // ── Step 7: Build concern areas list ─────────────────────
  if (symptoms.length > 0) {
    const symLabels = {
      fever: "Fever", cough: "Persistent cough", chest_pain: "Chest discomfort",
      shortness_of_breath: "Breathing difficulty", fatigue: "Fatigue / Low energy",
      headache: "Headache", nausea: "Nausea/Vomiting", joint_pain: "Joint/Muscle pain",
      dizziness: "Dizziness", rash: "Skin rash", abdominal_pain: "Abdominal discomfort",
      sore_throat: "Throat irritation"
    };
    symptoms.forEach(s => { if (symLabels[s]) concernAreas.push(symLabels[s]); });
  }

  if (duration === "weeks_plus" || duration === "months") {
    concernAreas.push("Prolonged symptom duration (may indicate chronic pattern)");
  }

  if (conditions.length > 0 && !conditions.includes("none")) {
    concernAreas.push("Pre-existing conditions noted — increases monitoring priority");
  }

  // ── Step 8: Get doctor recommendation ────────────────────
  const doctorInfo = DOCTOR_MAP[dominantCategory] || DOCTOR_MAP["general"];

  // ── Step 9: Get lifestyle suggestions ────────────────────
  const lifestyle = LIFESTYLE_BY_CATEGORY[dominantCategory] || LIFESTYLE_BY_CATEGORY["general"];

  // ── Return clean, anonymized result object ────────────────
  return {
    riskLevel,
    riskScore: finalScore,
    dominantCategory,
    concernAreas,
    immediateSteps: Array.from(immediateSteps).slice(0, 5), // max 5
    lifestyle: lifestyle.slice(0, 4),
    doctorInfo,
    // NOTE: No city, name, or personal identifiers in this output
  };
}

// ─── AGGREGATION HELPER ───────────────────────────────────────
/**
 * getAggregatedContext(allResponses)
 * Returns a summary note based on anonymized historical survey data.
 * PRIVACY: Uses only counts and risk levels — no personal data.
 */
function getAggregatedContext(allResponses) {
  if (!allResponses || allResponses.length === 0) return null;

  const total = allResponses.length;
  const highCount = allResponses.filter(r => r.calculatedRisk?.risk_level === "High").length;
  const pct = Math.round((highCount / total) * 100);

  return `Based on ${total} anonymized survey responses in this system, ${pct}% of respondents were classified as High Risk. This provides context — your result is calculated independently from your inputs.`;
}


// ─── UI CONTROLLER ────────────────────────────────────────────
// Wires up the form, runs analysis, and displays results

document.addEventListener("DOMContentLoaded", () => {

  // ── Tag toggle logic (symptoms) ───────────────────────────
  document.querySelectorAll(".tag").forEach(btn => {
    btn.addEventListener("click", () => {
      btn.classList.toggle("tag-active");
    });
  });

  // ── Analyze button ────────────────────────────────────────
  const analyzeBtn = document.getElementById("analyzeBtn");
  const btnText    = document.getElementById("btnText");
  const btnLoader  = document.getElementById("btnLoader");
  const formError  = document.getElementById("formError");

  analyzeBtn.addEventListener("click", () => {
    formError.classList.add("hidden");

    // ── Collect inputs ──
    const age      = parseInt(document.getElementById("ageInput").value);
    const gender   = document.getElementById("genderSelect").value;
    const city     = document.getElementById("cityInput").value.trim();
    const duration = document.getElementById("durationSelect").value;
    const severity = document.getElementById("severitySelect").value;

    const selectedSymptoms = Array.from(
      document.querySelectorAll(".tag.tag-active:not(.condition-tag)")
    ).map(t => t.dataset.symptom);

    const selectedConditions = Array.from(
      document.querySelectorAll(".condition-tag.tag-active")
    ).map(t => t.dataset.condition);

    // ── Validation ──
    const errors = [];
    if (!age || age < 1 || age > 120) errors.push("Please enter a valid age (1–120).");
    if (!gender)   errors.push("Please select a gender.");
    if (!city)     errors.push("Please enter your city.");
    if (selectedSymptoms.length === 0) errors.push("Please select at least one symptom.");
    if (!duration) errors.push("Please select symptom duration.");
    if (!severity) errors.push("Please select symptom severity.");

    if (errors.length > 0) {
      formError.textContent = errors.join(" ");
      formError.classList.remove("hidden");
      return;
    }

    // ── Show loader ──
    btnText.classList.add("hidden");
    btnLoader.classList.remove("hidden");
    analyzeBtn.disabled = true;

    // Simulate a brief "thinking" delay (300ms) for UX feel
    setTimeout(() => {
      const input = {
        age,
        gender,    // used for context only, not stored
        city,      // used for context only, not stored
        symptoms:   selectedSymptoms,
        conditions: selectedConditions.length > 0 ? selectedConditions : ["none"],
        duration,
        severity,
      };

      const result = analyzeSymptoms(input);
      displayResult(result);

      // Hide loader, reset button
      btnText.classList.remove("hidden");
      btnLoader.classList.add("hidden");
      analyzeBtn.disabled = false;
    }, 350);
  });

  // ── Reset button ──────────────────────────────────────────
  document.getElementById("resetBtn").addEventListener("click", () => {
    document.getElementById("resultSection").classList.add("hidden");
    document.getElementById("inputSection").scrollIntoView({ behavior: "smooth" });
    // Clear selections
    document.querySelectorAll(".tag").forEach(t => t.classList.remove("tag-active"));
    document.getElementById("ageInput").value = "";
    document.getElementById("cityInput").value = "";
    document.getElementById("genderSelect").value = "";
    document.getElementById("durationSelect").value = "";
    document.getElementById("severitySelect").value = "";
    document.getElementById("otherSymptoms").value = "";
  });
});

// ─── DISPLAY RESULT ───────────────────────────────────────────
function displayResult(result) {
  const resultSection = document.getElementById("resultSection");
  resultSection.classList.remove("hidden");

  // Risk badge
  const badge = document.getElementById("riskBadge");
  badge.textContent = result.riskLevel;
  badge.className = "risk-badge risk-" + result.riskLevel.toLowerCase();
  document.getElementById("riskScore").textContent = `Risk Score: ${result.riskScore}`;

  const banner = document.getElementById("riskBanner");
  banner.className = "risk-banner risk-banner-" + result.riskLevel.toLowerCase();

  // Concern list
  const concernList = document.getElementById("concernList");
  concernList.innerHTML = result.concernAreas.length > 0
    ? result.concernAreas.map(c => `<li>${c}</li>`).join("")
    : "<li>No major concerns flagged based on inputs.</li>";

  // Immediate steps
  const stepsList = document.getElementById("immediateStepsList");
  stepsList.innerHTML = result.immediateSteps.length > 0
    ? result.immediateSteps.map(s => `<li>${s}</li>`).join("")
    : "<li>Rest, stay hydrated, and monitor your symptoms.</li>";

  // Lifestyle
  const lifestyleList = document.getElementById("lifestyleList");
  lifestyleList.innerHTML = result.lifestyle.map(l => `<li>${l}</li>`).join("");

  // Doctor recommendation
  const doctorDiv = document.getElementById("doctorType");
  doctorDiv.innerHTML = `
    <p class="doctor-type">${result.doctorInfo.type}</p>
    <p class="doctor-urgency">${result.doctorInfo.urgency}</p>
  `;

  // Context note from historical data (anonymized)
  const contextNote = document.getElementById("contextNote");
  const aggregatedNote = getAggregatedContext(window.allResponses || []);
  if (aggregatedNote) {
    contextNote.textContent = "📊 " + aggregatedNote;
    contextNote.classList.remove("hidden");
  }

  // Scroll to result
  resultSection.scrollIntoView({ behavior: "smooth" });
}
