/* =========================================================
   Charlotte Esteve — Portfolio
   Global app: data loader, embed helpers
   ========================================================= */

/* ---------- Fixed appearance ---------- */

document.documentElement.setAttribute("data-palette", "ink");
document.documentElement.setAttribute("data-font", "classic");

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
