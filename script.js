// Fetches the compiled data.json (built from content/ YAML via
// scripts/build_site_data.py) and renders the whole page client-side.
// No build tooling required beyond that one Python script - keep this
// vanilla, dependency-free JS so the site works as a plain static page.

async function loadData() {
  const res = await fetch("data.json");
  if (!res.ok) throw new Error(`Failed to load data.json: ${res.status}`);
  return res.json();
}

function el(tag, opts = {}, children = []) {
  const node = document.createElement(tag);
  if (opts.class) node.className = opts.class;
  if (opts.html) node.innerHTML = opts.html;
  if (opts.text) node.textContent = opts.text;
  if (opts.href) node.setAttribute("href", opts.href);
  if (opts.target) node.setAttribute("target", opts.target);
  if (opts.rel) node.setAttribute("rel", opts.rel);
  children.forEach((c) => c && node.appendChild(c));
  return node;
}

function formatDate(ym) {
  if (!ym) return "Present";
  const [y, m] = ym.split("-");
  const months = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return m ? `${months[parseInt(m, 10)]} ${y}` : y;
}

function renderHero(personal, summary, narrative) {
  document.getElementById("hero-name").textContent = personal.name || "";
  document.getElementById("hero-title").textContent = personal.title_current || "";
  const loc = personal.location || {};
  document.getElementById("hero-location").textContent =
    [loc.current_city, loc.current_country].filter(Boolean).join(", ");
  document.getElementById("hero-tagline").textContent = (narrative.tagline || "").trim();

  const linksWrap = document.getElementById("hero-links");
  const contact = personal.contact || {};
  if (contact.email) {
    linksWrap.appendChild(el("a", { href: `mailto:${contact.email}`, text: "Email" }));
  }
  if (contact.linkedin) {
    linksWrap.appendChild(el("a", { href: contact.linkedin, target: "_blank", rel: "noopener", text: "LinkedIn" }));
  }
  if (contact.github) {
    linksWrap.appendChild(el("a", { href: contact.github, target: "_blank", rel: "noopener", text: "GitHub" }));
  }
}

function renderPillars(narrative) {
  const wrap = document.getElementById("pillars-list");
  (narrative.pillars || []).forEach((p) => {
    wrap.appendChild(el("div", { class: "pillar-card" }, [
      el("h3", { text: p.title }),
      el("p", { text: (p.text || "").trim() }),
    ]));
  });
}

// project_ids on a case study cross-reference professional-projects.yaml entries so
// metrics/technologies aren't duplicated in the narrative content.
function renderCaseStudies(narrative, projects) {
  const wrap = document.getElementById("case-studies-list");
  const byId = new Map((projects.professional || []).map((p) => [p.id, p]));

  (narrative.case_studies || []).forEach((cs) => {
    const linked = (cs.project_ids || []).map((id) => byId.get(id)).filter(Boolean);
    const metrics = linked.flatMap((p) => p.metrics || []);
    const technologies = [...new Set(linked.flatMap((p) => p.technologies || []))];

    const title = el("h3", { class: "case-study-title", text: cs.title });

    const body = el("div", { class: "case-study-body" }, [
      el("p", {}, [el("strong", { text: "Problem: " }), document.createTextNode((cs.problem || "").trim())]),
      el("p", {}, [el("strong", { text: "Approach: " }), document.createTextNode((cs.approach || "").trim())]),
      el("p", {}, [el("strong", { text: "Outcome: " }), document.createTextNode((cs.outcome || "").trim())]),
    ]);

    const metricsEl = metrics.length
      ? el("div", { class: "highlight-metrics" }, metrics.map((m) => el("div", { class: "metric-pill", text: m })))
      : null;

    const tagsEl = technologies.length
      ? el("div", { class: "tag-list" }, technologies.map((t) => el("span", { class: "tag", text: t })))
      : null;

    wrap.appendChild(el("article", { class: "case-study-card" }, [title, body, metricsEl, tagsEl]));
  });
}

function renderExperience(jobs) {
  const list = document.getElementById("experience-list");
  // Most recent first.
  const sorted = [...jobs].sort((a, b) => (b.start_date || "").localeCompare(a.start_date || ""));

  sorted.forEach((job) => {
    const summary = el("summary", { class: "timeline-summary" }, [
      el("span", { class: "job-dates", text: `${formatDate(job.start_date)} – ${formatDate(job.end_date)}` }),
      el("span", { class: "job-title", text: job.title || "" }),
      el("span", { class: "job-company", text: job.company ? `@ ${job.company}` : "" }),
    ]);

    const bullets = el("ul", {}, (job.responsibilities || []).map((r) => el("li", { text: r })));
    const tags = el("div", { class: "tag-list" }, (job.technologies || []).map((t) => el("span", { class: "tag", text: t })));

    list.appendChild(el("details", { class: "timeline-row" }, [summary, bullets, tags]));
  });
}

function projectCard(p) {
  const title = el("h4", { text: p.title || p.id || "" });
  const metaParts = [p.date_range || p.date, p.client_context].filter(Boolean);
  const meta = el("div", { class: "card-meta", text: metaParts.join(" · ") });
  const desc = el("p", { text: (p.description || "").trim() });

  const bulletsSrc = p.role_highlights || p.key_contributions || p.key_details;
  const bullets = bulletsSrc ? el("ul", {}, bulletsSrc.map((b) => el("li", { text: b }))) : null;

  const techs = p.technologies || [];
  const tags = techs.length ? el("div", { class: "tag-list" }, techs.map((t) => el("span", { class: "tag", text: t }))) : null;

  let links = null;
  if (p.links) {
    const anchors = [];
    Object.entries(p.links).forEach(([k, v]) => {
      if (!v) return;
      if (Array.isArray(v)) {
        v.forEach((item) => anchors.push(el("div", { text: item })));
      } else {
        anchors.push(el("a", { href: v, target: "_blank", rel: "noopener", text: k }));
      }
    });
    if (anchors.length) links = el("div", { class: "tag-list" }, anchors);
  }

  return el("div", { class: "card" }, [title, meta, desc, bullets, tags, links]);
}

function renderProjects(projects, narrative) {
  const profWrap = document.getElementById("projects-professional");
  const persWrap = document.getElementById("projects-personal");
  const eduWrap = document.getElementById("projects-edu");

  // Projects already covered by a case study above are skipped here to avoid
  // duplicating the same content twice - the catalogue is for everything else.
  const coveredIds = new Set((narrative.case_studies || []).flatMap((cs) => cs.project_ids || []));

  (projects.professional || []).filter((p) => !coveredIds.has(p.id)).forEach((p) => profWrap.appendChild(projectCard(p)));
  (projects.personal || []).forEach((p) => persWrap.appendChild(projectCard(p)));
  (projects.edu || []).forEach((p) => eduWrap.appendChild(projectCard(p)));
}

function renderSkills(skills) {
  const wrap = document.getElementById("skills-list");
  (skills.categories || []).forEach((cat) => {
    const chips = el("div", { class: "skill-chip-list" }, (cat.skills || []).map((s) =>
      el("span", { class: "skill-chip", text: s.name })
    ));
    wrap.appendChild(el("div", { class: "skill-category" }, [
      el("h4", { text: cat.name }),
      chips,
    ]));
  });
}

function renderEducation(education) {
  const wrap = document.getElementById("education-list");
  const sorted = [...education].sort((a, b) => (b.start_date || "").localeCompare(a.start_date || ""));
  sorted.forEach((edu) => {
    const title = el("h4", { text: `${edu.degree || ""}${edu.field_of_study ? ", " + edu.field_of_study : ""}` });
    const meta = el("div", { class: "card-meta", text: `${edu.institution || ""} · ${formatDate(edu.start_date)} – ${formatDate(edu.end_date)}` });
    wrap.appendChild(el("div", { class: "card" }, [title, meta]));
  });
}

function renderCertifications(certifications) {
  const list = document.getElementById("certifications-list");
  (certifications.certifications || []).forEach((c) => {
    list.appendChild(el("li", { text: c.name }));
  });
}

function renderContact(personal) {
  const wrap = document.getElementById("contact-info");
  const contact = personal.contact || {};
  const items = [];
  if (contact.email) items.push(`Email: ${contact.email}`);
  if (contact.mobile) items.push(`Phone: ${contact.mobile}`);
  if (contact.linkedin) items.push(`LinkedIn: ${contact.linkedin}`);
  items.forEach((t) => wrap.appendChild(el("p", { text: t })));
}

loadData()
  .then((data) => {
    const narrative = data.site_narrative || {};
    renderHero(data.personal_details || {}, data.summary || {}, narrative);
    renderPillars(narrative);
    renderCaseStudies(narrative, data.projects || {});
    renderExperience(data.work_experience || []);
    renderProjects(data.projects || {}, narrative);
    renderSkills(data.skills || {});
    renderEducation(data.education || []);
    renderCertifications(data.certifications || {});
    renderContact(data.personal_details || {});
  })
  .catch((err) => {
    document.getElementById("hero-name").textContent = "Failed to load profile data";
    console.error(err);
  });
