const API_BASE = "http://localhost:8002";

const STATUS_LABELS = {
  completed: "Completed",
  in_progress: "In Progress",
  planned: "Planned",
  needed: "Needed",
};

const openCategories = new Set();

async function apiGet(path, fallback = {}) {
  try {
    const resp = await fetch(API_BASE + path);
    if (!resp.ok) throw new Error(resp.status + " " + resp.statusText);
    return await resp.json();
  } catch (e) {
    showError("Could not reach API: " + e.message);
    return fallback;
  }
}

async function apiPost(path, body) {
  try {
    const resp = await fetch(API_BASE + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      let detail = "";
      try { detail = (await resp.json()).detail; } catch (_) {}
      showError(detail || "Request failed: " + resp.status);
      return false;
    }
    clearError();
    return true;
  } catch (e) {
    showError("Could not reach API: " + e.message);
    return false;
  }
}

function showError(msg) { document.getElementById("error").textContent = msg; }
function clearError() { document.getElementById("error").textContent = ""; }

function el(tag, text) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}

async function addToPlan(reqId, code) {
  if (await apiPost("/plan/add", { req_id: reqId, code })) {
    renderAudit();
  }
}

async function removeFromPlan(reqId, code) {
  if (await apiPost("/plan/remove", { req_id: reqId, code })) {
    renderAudit();
  }
}

async function renderAudit() {
  const [program, progress, requirements] = await Promise.all([
    apiGet("/program"),
    apiGet("/progress"),
    apiGet("/requirements", []),
  ]);

  const header = document.getElementById("header");
  header.replaceChildren();
  header.appendChild(el("h1", program.major || ""));
  header.appendChild(el("div",
    `${program.student || ""} | Catalog ${program.catalog_year || ""} | Advisor: ${program.advisor || ""}`));

  const percentComplete = progress.percent_complete || 0;
  const percentProjected = progress.percent_projected || 0;

  const progressBox = document.getElementById("progress");
  progressBox.replaceChildren();
  progressBox.appendChild(el("div", `Completed: ${percentComplete}%`));
  const bar1 = el("progress");
  bar1.max = 100;
  bar1.value = percentComplete;
  progressBox.appendChild(bar1);

  progressBox.appendChild(el("div", `Projected with plan: ${percentProjected}%`));
  const bar2 = el("progress");
  bar2.max = 100;
  bar2.value = percentProjected;
  progressBox.appendChild(bar2);

  const container = document.getElementById("requirements");
  container.replaceChildren();

  for (const req of requirements) {
    const details = el("details");
    details.open = openCategories.has(req.id);
    details.addEventListener("toggle", () => {
      if (details.open) openCategories.add(req.id);
      else openCategories.delete(req.id);
    });

    const plannedNote = req.credits_planned ? ` (+${req.credits_planned} planned)` : "";
    details.appendChild(el("summary",
      `${req.name} (${req.credits_completed}/${req.credits_required} credits${plannedNote})`));

    renderCourses(details, req.id, req.courses);
    container.appendChild(details);
  }
}

function renderCourses(parent, reqId, courses) {
  for (const c of courses) {
    const row = el("div");
    row.className = "row";
    row.appendChild(el("span",
      `${c.code} - ${c.title} (${c.credits} cr) - ${STATUS_LABELS[c.status] || c.status}`));

    if (c.status === "needed") {
      const btn = el("button", "+ Add to Plan");
      btn.onclick = () => addToPlan(reqId, c.code);
      row.appendChild(btn);
    } else if (c.status === "planned") {
      const btn = el("button", "- Remove from Plan");
      btn.onclick = () => removeFromPlan(reqId, c.code);
      row.appendChild(btn);
    }
    parent.appendChild(row);
  }
}

renderAudit();
