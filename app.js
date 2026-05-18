/* =========================================================
   Charlotte Esteve — Portfolio
   Global app: data loader, embed helpers
   ========================================================= */

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

/* ---------- Media helpers ---------- */

function mediaSrc(item) {
  // `file` (chemin local) prioritaire, fallback sur l'ancien `driveUrl`.
  if (item.file) return item.file;
  if (item.driveUrl) {
    const m = item.driveUrl.match(/\/file\/d\/([^/]+)/) || item.driveUrl.match(/[?&]id=([^&]+)/);
    return m ? `https://drive.google.com/file/d/${m[1]}/preview` : item.driveUrl;
  }
  return "";
}

function hasMedia(item) {
  return Boolean(item.file || item.driveUrl);
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
    <span>${fmtDateShort(item.date)}</span>
  `;

  const body = document.createElement("div");
  body.className = "card-body";
  const kindLabel = kind === "article" ? "Article" : kind === "audio" ? "Reportage audio" : "Reportage vidéo";
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
  const src = mediaSrc(item);
  const available = hasMedia(item);
  // Fichier local => player natif. Sinon (driveUrl seul, fichier trop gros) => iframe Drive.
  const useNativePlayer = Boolean(item.file);

  let playerHTML = "";
  if (!available) {
    playerHTML = `<p class="embed-empty">Document non disponible pour le moment.</p>`;
  } else if (!useNativePlayer) {
    playerHTML = `<iframe class="embed-frame ${frameClass}" src="" title="${item.title}" allow="autoplay" allowfullscreen></iframe>`;
  } else if (kind === "video") {
    playerHTML = `<video class="embed-frame ${frameClass}" controls preload="metadata" src="${src}"></video>`;
  } else if (kind === "audio") {
    playerHTML = `<audio class="embed-frame ${frameClass}" controls preload="metadata" src="${src}"></audio>`;
  } else {
    playerHTML = `<iframe class="embed-frame ${frameClass}" src="" title="${item.title}"></iframe>`;
  }

  const actionLink = available
    ? (useNativePlayer
        ? `<a href="${src}" target="_blank" rel="noopener" download>Télécharger ↓</a>`
        : `<a href="${item.driveUrl}" target="_blank" rel="noopener">Ouvrir sur Google Drive ↗</a>`)
    : `<span></span>`;

  embed.innerHTML = `
    ${playerHTML}
    <div class="embed-actions">
      ${actionLink}
      <button class="embed-close" type="button">Fermer</button>
    </div>
  `;
  embed.style.gridColumn = "1 / -1";

  function closePlayer(el) {
    el.classList.remove("open");
    const v = el.querySelector("video, audio");
    if (v) { v.pause(); v.currentTime = 0; }
    const f = el.querySelector("iframe");
    if (f) f.src = "";
  }

  action.querySelector("button").addEventListener("click", () => {
    if (!available) return;
    const isOpen = embed.classList.contains("open");
    document.querySelectorAll(".embed-card.open").forEach(el => {
      if (el !== embed) closePlayer(el);
    });
    if (isOpen) {
      closePlayer(embed);
    } else {
      embed.classList.add("open");
      const frame = embed.querySelector("iframe");
      if (frame) frame.src = src;
    }
  });
  embed.querySelector(".embed-close").addEventListener("click", () => closePlayer(embed));

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
      { kind: "article", page: "articles", label: "Article", item: data.articles?.[0] },
      { kind: "audio",   page: "audio",    label: "Audio",   item: data.audio?.[0] },
      { kind: "video",   page: "video",    label: "Vidéo",   item: data.video?.[0] }
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

/* ---------- Init ---------- */

document.addEventListener("DOMContentLoaded", () => {
  setupNav();

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
