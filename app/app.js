const RESOURCE_NAMES = new Set(["frame.md", "dashboard.md"]);
const state = { resource: "frame.md", text: "", checking: false, deferredInstall: null };
const viewport = document.getElementById("viewport");
const connection = document.getElementById("connection");
const title = document.getElementById("screen-title");
const subtitle = document.getElementById("screen-subtitle");

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function appendInline(container, source) {
  const pattern = /(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|`[^`]+`)/g;
  let cursor = 0;
  for (const match of source.matchAll(pattern)) {
    container.append(document.createTextNode(source.slice(cursor, match.index)));
    const token = match[0];
    if (token.startsWith("[")) {
      const parts = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      const anchor = el("a", "", parts[1]);
      anchor.href = parts[2];
      const resource = resourceName(parts[2]);
      if (resource) {
        anchor.dataset.resource = resource;
        anchor.className = "resource-link";
      }
      container.append(anchor);
    } else if (token.startsWith("**")) {
      container.append(el("strong", "", token.slice(2, -2)));
    } else {
      container.append(el("code", "badge", token.slice(1, -1)));
    }
    cursor = match.index + token.length;
  }
  container.append(document.createTextNode(source.slice(cursor)));
}

function resourceName(destination) {
  const clean = destination.split("#")[0].split("?")[0];
  const name = clean.split("/").pop();
  return RESOURCE_NAMES.has(name) ? name : null;
}

function parseTable(lines) {
  const cells = line => line.trim().replace(/^\||\|$/g, "").split("|").map(value => value.trim());
  const headers = cells(lines[0]);
  const rows = lines.slice(1).filter(line => !/^\|?[\s:|-]+\|?$/.test(line.trim())).map(cells);
  return { headers, rows };
}

function renderTable(lines) {
  const { headers, rows } = parseTable(lines);
  if (headers.length === 2 && headers.every(value => !value)) {
    const grid = el("div", "stat-grid");
    rows.forEach(row => {
      const card = el("div", "stat");
      const label = el("span", "label");
      const value = el("span", "value");
      appendInline(label, row[0] || "Metric");
      appendInline(value, row[1] || "—");
      card.append(label, value); grid.append(card);
    });
    return grid;
  }
  const wrap = el("div", "table-card");
  const cards = el("div", "table-cards");
  rows.forEach(row => {
    const card = el("article", "table-row");
    row.forEach((value, index) => {
      const cell = el("div", "table-cell");
      cell.append(el("span", "label", headers[index] || `Field ${index + 1}`));
      const content = el("span", "value"); appendInline(content, value); cell.append(content); card.append(cell);
    });
    cards.append(card);
  });
  wrap.append(cards); return wrap;
}

function renderMarkdown(markdown) {
  const fragment = document.createDocumentFragment();
  const lines = markdown.replace(/\r/g, "").split("\n");
  let section = null;
  let panel = null;
  let screenTitle = state.resource === "frame.md" ? "Frame" : "Dashboard";
  let i = 0;
  const target = () => panel || section || fragment;
  const ensurePanel = () => {
    if (!panel) { panel = el("div", "panel"); (section || fragment).append(panel); }
    return panel;
  };

  while (i < lines.length) {
    const raw = lines[i]; const line = raw.trim();
    if (!line) { i += 1; continue; }
    if (line.startsWith("<div")) {
      i += 1; let depth = 1;
      while (i < lines.length && depth) { if (lines[i].includes("<div")) depth += 1; if (lines[i].includes("</div>")) depth -= 1; i += 1; }
      continue;
    }
    if (line.startsWith("<details")) {
      const details = el("details", "panel"); const summaryText = (line.match(/<summary>(.*?)<\/summary>/) || [,"More"])[1];
      details.append(el("summary", "", summaryText.replace(/<[^>]+>/g, ""))); target().append(details);
      i += 1; while (i < lines.length && !lines[i].includes("</details>")) { const p = el("p"); appendInline(p, lines[i].replace(/<[^>]+>/g, "")); if (p.textContent.trim()) details.append(p); i += 1; } i += 1; continue;
    }
    if (line.startsWith("# ")) {
      screenTitle = line.slice(2).trim();
      const head = el("header", "screen-head"); head.append(el("span", "kicker", "5ET · live company state"), el("h1", "", screenTitle)); fragment.append(head); i += 1; continue;
    }
    if (line.startsWith("## ")) {
      section = el("section", "section"); section.append(el("h2", "section-title", line.slice(3).replace(/^[^\w]+/, "").trim())); fragment.append(section); panel = null; i += 1; continue;
    }
    if (/^#{3,6}\s/.test(line)) {
      panel = el("div", "panel"); panel.append(el("h3", "", line.replace(/^#{3,6}\s+/, ""))); (section || fragment).append(panel); i += 1; continue;
    }
    if (line.startsWith(">")) {
      const quote = el("div", "quote");
      const values = []; while (i < lines.length && lines[i].trim().startsWith(">")) { values.push(lines[i].trim().replace(/^>\s?/, "")); i += 1; }
      appendInline(quote, values.join(" ")); target().append(quote); continue;
    }
    if (line.startsWith("```")) {
      const code = []; i += 1; while (i < lines.length && !lines[i].trim().startsWith("```")) { code.push(lines[i]); i += 1; } i += 1;
      if (code.some(value => value.includes("█") || value.includes("▁"))) {
        const meter = el("div", "turn-meter panel"); meter.append(el("div", "track"), el("code", "", code.join("\n"))); target().append(meter);
      } else target().append(el("pre", "code-card", code.join("\n")));
      continue;
    }
    if (line.startsWith("|")) {
      const rows = []; while (i < lines.length && lines[i].trim().startsWith("|")) { rows.push(lines[i]); i += 1; }
      target().append(renderTable(rows)); continue;
    }
    if (/^-\s+/.test(line)) {
      const list = el("ul", "list-card");
      while (i < lines.length && /^-\s+/.test(lines[i].trim())) { const item = el("li"); appendInline(item, lines[i].trim().slice(2)); list.append(item); i += 1; }
      target().append(list); continue;
    }
    if (/^---+$/.test(line)) { panel = null; i += 1; continue; }
    if (line.startsWith("<")) { i += 1; continue; }
    const paragraph = el("p"); appendInline(paragraph, line); ensurePanel().append(paragraph); i += 1;
  }

  title.textContent = screenTitle.replace(/^The\s+/, "");
  subtitle.textContent = state.resource === "frame.md" ? "Immediate company frame" : "Company dashboard";
  viewport.replaceChildren(fragment);
  viewport.focus({ preventScroll: true });
}

function setConnection(mode, label) {
  connection.className = `connection ${mode || ""}`.trim();
  connection.querySelector("span").textContent = label;
}

function showToast(message) {
  const toast = document.getElementById("toast"); toast.textContent = message; toast.classList.add("show");
  clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove("show"), 1800);
}

async function fetchResource(resource) {
  const response = await fetch(`../${resource}?_5et=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

async function loadResource(resource, { history = true, quiet = false } = {}) {
  if (!RESOURCE_NAMES.has(resource) || state.checking) return;
  state.checking = true; setConnection("syncing", "syncing");
  try {
    const text = await fetchResource(resource);
    const changed = text !== state.text || resource !== state.resource;
    state.resource = resource;
    document.querySelectorAll(".tab").forEach(tab => tab.classList.toggle("active", tab.dataset.resource === resource));
    if (changed) { state.text = text; renderMarkdown(text); if (!quiet) showToast(`${resource} loaded`); }
    if (history) historyAPI(resource);
    setConnection("", "live");
  } catch (error) {
    setConnection("offline", "offline");
    if (!state.text) viewport.replaceChildren(el("div", "loading-card cut", "Frame unavailable. Pull down or reopen to retry."));
  } finally { state.checking = false; }
}

function historyAPI(resource) {
  const url = new URL(location.href); url.searchParams.set("resource", resource); history.pushState({ resource }, "", url);
}

function unlock() {
  localStorage.setItem("5et-frame-unlocked", "yes");
  document.getElementById("gate").hidden = true; document.getElementById("app").hidden = false;
  const requested = new URL(location.href).searchParams.get("resource");
  loadResource(RESOURCE_NAMES.has(requested) ? requested : "frame.md", { history: false });
}

document.getElementById("gate-form").addEventListener("submit", event => {
  event.preventDefault();
  if (document.getElementById("passcode").value === "5") unlock();
  else document.getElementById("gate-error").textContent = "Passcode not recognised.";
});
document.querySelectorAll("[data-resource]").forEach(button => button.addEventListener("click", () => loadResource(button.dataset.resource)));
document.getElementById("home-button").addEventListener("click", () => loadResource("frame.md"));
document.addEventListener("click", event => {
  const anchor = event.target.closest("a[data-resource]"); if (!anchor) return;
  event.preventDefault(); loadResource(anchor.dataset.resource);
});
addEventListener("popstate", event => loadResource(event.state?.resource || "frame.md", { history: false }));
setInterval(() => { if (!document.hidden) loadResource(state.resource, { history: false, quiet: true }); }, 30000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) loadResource(state.resource, { history: false, quiet: true }); });

addEventListener("beforeinstallprompt", event => {
  event.preventDefault(); state.deferredInstall = event; document.getElementById("install-button").hidden = false;
});
document.getElementById("install-button").addEventListener("click", async () => {
  if (state.deferredInstall) { await state.deferredInstall.prompt(); state.deferredInstall = null; }
  else showToast("On iPhone: Share → Add to Home Screen");
});
if (/iPhone|iPad/.test(navigator.userAgent) && !matchMedia("(display-mode: standalone)").matches) document.getElementById("install-button").hidden = false;
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");
if (localStorage.getItem("5et-frame-unlocked") === "yes") unlock();

// 🤖 Last AI edit: 2026-08-26 18:05 · gpt-5 · ~30k in / ~10k out · ~$0.45
// Log: ../../../Compliance/_data/ai-observability-log.md#session-20260826-pwa-frame-renderer
