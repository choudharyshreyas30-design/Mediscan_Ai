const SUPABASE_URL = "https://omvpwuxzdpkiigbtmmsx.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tdnB3dXh6ZHBraWlnYnRtbXN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NTE2NjUsImV4cCI6MjA5MzAyNzY2NX0.peYIwEEBOf1rcwa0w0stHp6G5gruZeRE1OYzM-zoHCQ";

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const reportCards = document.getElementById("reportCards");
const reportStatus = document.getElementById("reportStatus");
const refreshReportsBtn = document.getElementById("refreshReportsBtn");
const searchInput = document.getElementById("searchInput");

let allReports = [];

function renderReports(filteredReports) {
  reportCards.innerHTML = "";

  if (filteredReports.length === 0) {
    reportCards.innerHTML = "<p>No matching reports found.</p>";
    return;
  }

  filteredReports.forEach((report) => {
    const card = document.createElement("div");
    card.className = "report-card";

    card.innerHTML = `
      <h3>${report.report_title || "Untitled Report"}</h3>
      <p><strong>Survey ID:</strong> ${report.survey_id}</p>
      <p><strong>Created:</strong> ${report.created_at || "N/A"}</p>
      <p><strong>Summary:</strong> ${report.report_summary || "N/A"}</p>
      <p><strong>Concern Areas:</strong> ${report.concern_areas || "N/A"}</p>
      <p><strong>Recommendation:</strong> ${report.recommendation || "N/A"}</p>
      <p style="color:#9a3412; background:#fff7ed; padding:10px; border-radius:8px;">
        <strong>Disclaimer:</strong> ${report.disclaimer || "N/A"}
      </p>
    `;

    reportCards.appendChild(card);
  });
}

async function loadReports() {
  reportStatus.textContent = "Loading reports...";
  reportCards.innerHTML = "";

  try {
    const { data, error } = await db
      .from("ai_reports")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase error:", error);
      reportStatus.textContent = "Error loading reports: " + error.message;
      return;
    }

    allReports = data || [];
    console.log("Reports loaded:", allReports);

    reportStatus.textContent = `Loaded ${allReports.length} report(s).`;
    renderReports(allReports);
  } catch (err) {
    console.error("JS error:", err);
    reportStatus.textContent = "Unexpected error: " + err.message;
  }
}

searchInput.addEventListener("input", () => {
  const term = searchInput.value.toLowerCase().trim();

  const filtered = allReports.filter((report) =>
    String(report.survey_id).toLowerCase().includes(term) ||
    (report.report_title || "").toLowerCase().includes(term) ||
    (report.report_summary || "").toLowerCase().includes(term) ||
    (report.concern_areas || "").toLowerCase().includes(term) ||
    (report.recommendation || "").toLowerCase().includes(term)
  );

  renderReports(filtered);
});

refreshReportsBtn.addEventListener("click", loadReports);

loadReports();