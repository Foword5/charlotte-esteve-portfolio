/* =========================================================
   Charlotte Esteve — Portfolio
   Global app: data loader, embed helpers, tweaks panel
   ========================================================= */

const STORAGE_KEY = "ce-portfolio-prefs";
const DEFAULT_PREFS = { palette: "ink", font: "modern" };

const PALETTES = [
  { id: "press", label: "Rouge presse", swatches: ["#f6f1e8", "#16110c", "#c2410c"] },
  { id: "ink",   label: "Bleu encre",   swatches: ["#f4f3ef", "#0e1422", "#3d4f8c"] },
  { id: "mono",  label: "Monochrome",   swatches: ["#ffffff", "#0a0a0a", "#6b6b6b"] }
];

const FONTS = [
  { id: "modern",        label: "Moderne",      preview: "Aa", sub: "Fraunces · Inter" },
  { id: "classic",       label: "Classique",    preview: "Aa", sub: "Playfair · Source" },
  { id: "institutional", label: "Institutionnel", preview: "Aa", sub: "Garamond · Plex" }
];

/* ---------- Preferences (palette / font) ---------- */

function loadPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch { return { ...DEFAULT_PREFS }; }
}

function savePrefs(prefs) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch {}
}

function applyPrefs(prefs) {
  document.documentElement.setAttribute("data-palette", prefs.palette);
  document.documentElement.setAttribute("data-font", prefs.font);
}

/* Apply preferences as early as possible */
const prefs = loadPrefs();
applyPrefs(prefs);

/* ---------- Tweaks panel ---------- */

function buildTweaksPanel() {
  const fab = document.createElement("button");
  fab.className = "tweaks-fab";
  fab.type = "button";
  fab.innerHTML = `<span>Apparence</span>`;
  fab.setAttribute("aria-label", "Ouvrir les options d'apparence");

  const panel = document.createElement("div");
  panel.className = "tweaks-panel";
  panel.innerHTML = `
    <h3 class="tweaks-title">Apparence</h3>
    <p class="tweaks-sub">Personnalisez les couleurs et la typographie.</p>
    <div class="tweak-group">
      <span class="tweak-label">Palette</span>
      <div class="tweak-options" data-group="palette">
        ${PALETTES.map(p => `
          <button class="tweak-option" type="button" data-value="${p.id}" title="${p.label}">
            <span class="tweak-swatch-row">
              ${p.swatches.map(s => `<span class="tweak-swatch" style="background:${s}"></span>`).join("")}
            </span>
            <span>${p.label}</span>
          </button>
        `).join("")}
      </div>
    </div>
    <div class="tweak-group">
      <span class="tweak-label">Typographie</span>
      <div class="tweak-options" data-group="font">
        ${FONTS.map(f => `
          <button class="tweak-option" type="button" data-value="${f.id}" title="${f.sub}">
            <span class="tweak-font-preview" style="font-family: ${fontFamilyFor(f.id)}">${f.preview}</span>
            <span>${f.label}</span>
          </button>
        `).join("")}
      </div>
    </div>
  `;

  document.body.appendChild(fab);
  document.body.appendChild(panel);

  function fontFamilyFor(id) {
    if (id === "modern") return "'Fraunces', serif";
    if (id === "classic") return "'Playfair Display', serif";
    return "'EB Garamond', serif";
  }

  function syncActive() {
    panel.querySelectorAll(".tweak-options").forEach(group => {
      const key = group.dataset.group;
      group.querySelectorAll(".tweak-option").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.value === prefs[key]);
      });
    });
  }

  fab.addEventListener("click", () => {
    panel.classList.toggle("open");
  });

  document.addEventListener("click", (e) => {
    if (!panel.classList.contains("open")) return;
    if (panel.contains(e.target) || fab.contains(e.target)) return;
    panel.classList.remove("open");
  });

  panel.querySelectorAll(".tweak-options").forEach(group => {
    const key = group.dataset.group;
    group.addEventListener("click", (e) => {
      const btn = e.target.closest(".tweak-option");
      if (!btn) return;
      prefs[key] = btn.dataset.value;
      applyPrefs(prefs);
      savePrefs(prefs);
      syncActive();
    });
  });

  syncActive();
}

/* ---------- Mobile nav ---------- */

function setupNav() {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".nav");
  if (!toggle || !nav) return;
  toggle.addEventListener("click", () => nav.classList.toggle("open"));
}

/* ---------- Data loader ---------- */

let _dataPromise = null;
async function loadData() {
  if (!_dataPromise) {
    _dataPromise = fetch("content.json", { cache: "no-cache" })
      .then(r => {
        if (!r.ok) throw new Error("Impossible de charger content.json");
        return r.json();
      });
  }
  return _dataPromise;
}

/* ---------- Google Drive helpers ---------- */

function driveFileId(url) {
  if (!url) return null;
  const m = url.match(/\/file\/d\/([^/]+)/) || url.match(/[?&]id=([^&]+)/);
  return m ? m[1] : null;
}

function drivePreviewUrl(url) {
  const id = driveFileId(url);
  return id ? `https://drive.google.com/file/d/${id}/preview` : url;
}

/* ---------- Date format ---------- */

function fmtDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  } catch { return iso; }
}

function fmtDateShort(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
  } catch { return iso; }
}

/* ---------- Card renderer ---------- */

function renderCard(item, kind, index) {
  const li = document.createElement("li");
  li.className = "card";

  const num = String(index + 1).padStart(2, "0");
  const meta = document.createElement("div");
  meta.className = "card-meta";
  meta.innerHTML = `
    <span class="num">N°${num}</span>
    <span>${fmtDateShort(item.date)}</span>
    ${item.duration ? `<span>${item.duration}</span>` : ""}
    ${item.outlet ? `<span>${item.outlet}</span>` : ""}
  `;

  const body = document.createElement("div");
  body.className = "card-body";
  const kindLabel = kind === "article" ? "Article · PDF" : kind === "audio" ? "Reportage audio" : "Reportage vidéo";
  body.innerHTML = `
    <p class="card-kind">${kindLabel}</p>
    <h3 class="card-title">${item.title}</h3>
    <p class="card-desc">${item.description || ""}</p>
  `;

  const action = document.createElement("div");
  action.className = "card-action";
  const btnLabel = kind === "article" ? "Lire" : kind === "audio" ? "Écouter" : "Regarder";
  action.innerHTML = `<button class="btn btn-ghost" type="button">${btnLabel} <span class="arrow">→</span></button>`;

  li.appendChild(meta);
  li.appendChild(body);
  li.appendChild(action);

  /* Embed area attached after card */
  const embed = document.createElement("div");
  embed.className = "embed-card";
  const frameClass = kind === "video" ? "video" : kind === "audio" ? "audio" : "pdf";
  embed.innerHTML = `
    <iframe class="embed-frame ${frameClass}" allow="autoplay" allowfullscreen></iframe>
    <div class="embed-actions">
      <a href="${item.driveUrl}" target="_blank" rel="noopener">Ouvrir sur Google Drive ↗</a>
      <button class="embed-close" type="button">Fermer</button>
    </div>
  `;
  embed.style.gridColumn = "1 / -1";

  action.querySelector("button").addEventListener("click", () => {
    const isOpen = embed.classList.contains("open");
    /* Close any other open embed first */
    document.querySelectorAll(".embed-card.open").forEach(el => {
      if (el !== embed) {
        el.classList.remove("open");
        const f = el.querySelector("iframe");
        if (f) f.src = "";
      }
    });
    if (isOpen) {
      embed.classList.remove("open");
      embed.querySelector("iframe").src = "";
    } else {
      embed.classList.add("open");
      embed.querySelector("iframe").src = drivePreviewUrl(item.driveUrl);
    }
  });
  embed.querySelector(".embed-close").addEventListener("click", () => {
    embed.classList.remove("open");
    embed.querySelector("iframe").src = "";
  });

  /* Wrapper li actually contains embed below — append both into a fragment */
  const wrapper = document.createDocumentFragment();
  wrapper.appendChild(li);
  const embedLi = document.createElement("li");
  embedLi.style.listStyle = "none";
  embedLi.style.padding = "0";
  embedLi.style.borderTop = "none";
  embedLi.appendChild(embed);
  wrapper.appendChild(embedLi);
  return wrapper;
}

/* ---------- Page renderers ---------- */

async function renderListPage(kind, listSelector) {
  const list = document.querySelector(listSelector);
  if (!list) return;
  try {
    const data = await loadData();
    const items = data[kind === "article" ? "articles" : kind === "audio" ? "audio" : "video"] || [];
    list.innerHTML = "";
    if (items.length === 0) {
      list.innerHTML = `<li class="loading">Aucun élément pour le moment.</li>`;
      return;
    }
    items.forEach((item, i) => list.appendChild(renderCard(item, kind, i)));
  } catch (err) {
    list.innerHTML = `<li class="loading">Erreur de chargement : ${err.message}</li>`;
  }
}

async function renderHomeFeatured() {
  const grid = document.querySelector("[data-featured]");
  if (!grid) return;
  try {
    const data = await loadData();
    const picks = [
      { kind: "article", page: "articles.html", label: "Article", item: data.articles?.[0] },
      { kind: "audio",   page: "audio.html",    label: "Audio",   item: data.audio?.[0] },
      { kind: "video",   page: "video.html",    label: "Vidéo",   item: data.video?.[0] }
    ];
    grid.innerHTML = picks.filter(p => p.item).map(p => `
      <a class="featured-item" href="${p.page}">
        <span class="featured-kind">${p.label}</span>
        <h3 class="featured-title">${p.item.title}</h3>
        <p class="featured-desc">${p.item.description || ""}</p>
        <span class="featured-link">Voir la rubrique</span>
      </a>
    `).join("");
  } catch (err) {
    grid.innerHTML = `<div class="loading">Erreur de chargement.</div>`;
  }
}

async function renderHomeIntro() {
  try {
    const data = await loadData();
    const titleEl = document.querySelector("[data-site-name]");
    const taglineEl = document.querySelector("[data-tagline]");
    const introEl = document.querySelector("[data-intro]");
    if (titleEl) titleEl.textContent = data.site.name;
    if (taglineEl) taglineEl.textContent = data.site.tagline;
    if (introEl) introEl.textContent = data.site.intro;
  } catch {}
}

async function renderCV() {
  const container = document.querySelector("[data-cv]");
  if (!container) return;
  try {
    const data = await loadData();
    const cv = data.cv;
    container.innerHTML = `
      <p class="cv-summary">${cv.summary}</p>
      <div class="cv-grid">
        <aside class="cv-side">
          <div class="cv-section">
            <h3 class="cv-section-title">Compétences</h3>
            <ul class="skills-list">
              ${cv.skills.map(s => `<li>${s}</li>`).join("")}
            </ul>
          </div>
          <div class="cv-section">
            <h3 class="cv-section-title">CV complet</h3>
            <a class="btn btn-accent" href="${cv.pdfUrl}" target="_blank" rel="noopener">Télécharger (PDF) <span class="arrow">↓</span></a>
          </div>
        </aside>
        <div class="cv-main">
          <div class="cv-section">
            <h3 class="cv-section-title">Expérience</h3>
            ${cv.experience.map(e => `
              <article class="cv-entry">
                <div class="cv-entry-period">${e.period}</div>
                <div>
                  <h4 class="cv-entry-role">${e.role}</h4>
                  <p class="cv-entry-org">${e.org}</p>
                  <p class="cv-entry-details">${e.details || ""}</p>
                </div>
              </article>
            `).join("")}
          </div>
          <div class="cv-section">
            <h3 class="cv-section-title">Formation</h3>
            ${cv.education.map(e => `
              <article class="cv-entry">
                <div class="cv-entry-period">${e.period}</div>
                <div>
                  <h4 class="cv-entry-role">${e.degree}</h4>
                  <p class="cv-entry-org">${e.school}</p>
                </div>
              </article>
            `).join("")}
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<p class="loading">Erreur de chargement : ${err.message}</p>`;
  }
}

async function renderContact() {
  const container = document.querySelector("[data-contact]");
  if (!container) return;
  try {
    const data = await loadData();
    container.innerHTML = `
      <div class="contact-grid">
        <div>
          <p class="contact-block-title">Email</p>
          <a class="contact-email" href="mailto:${data.site.email}">${data.site.email}</a>
          <p class="cv-summary" style="margin-top: 12px;">
            Pour toute proposition de pige, collaboration ou question, n'hésitez pas à m'écrire.
            Je réponds sous 48h.
          </p>
        </div>
        <div>
          <p class="contact-block-title">Réseaux</p>
          <ul class="social-list">
            ${data.site.social.map(s => `
              <li><a href="${s.url}" target="_blank" rel="noopener">${s.label}</a></li>
            `).join("")}
          </ul>
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<p class="loading">Erreur de chargement : ${err.message}</p>`;
  }
}

/* ---------- Init ---------- */

document.addEventListener("DOMContentLoaded", () => {
  setupNav();
  buildTweaksPanel();

  const page = document.body.dataset.page;
  if (page === "home") {
    renderHomeIntro();
    renderHomeFeatured();
  } else if (page === "articles") {
    renderListPage("article", "[data-list]");
  } else if (page === "audio") {
    renderListPage("audio", "[data-list]");
  } else if (page === "video") {
    renderListPage("video", "[data-list]");
  } else if (page === "cv") {
    renderCV();
  } else if (page === "contact") {
    renderContact();
  }
});
