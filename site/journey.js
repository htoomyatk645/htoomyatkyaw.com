// About page: the "My non-linear journey so far" list. Each experience is an
// accordion with a plus on the right that opens its description. It replaces
// the template's static timeline (hidden by CSS below) once the page has loaded.
(function () {
  var IMG = "/_v2/framerusercontent.com/images/";
  var CYAN = "rgb(164, 229, 248)";

  // Newest first. `badge` is a logo image, or [initials, colour] for a round badge.
  // `roles` are the descriptions shown when the row is opened; a row with no
  // roles has nothing to open and shows no plus.
  var JOURNEY = [
    {
      org: "Briefly Apps Inc.", role: "Co-Founder", date: "Mar 2026 - Present", current: true,
      badge: IMG + "aWwxH6dqmUu5jCNRFneN4Z8gLE0.svg",
      roles: [{ bullets: [
        "Co-founded Briefly, a short-form, audio-only podcast app that turns full episodes into a personalized feed of AI-selected highlights. Think Instagram for podcasts.",
        "Developing interactive features that improve engagement, increase access to information, and combat misinformation in the podcasting space.",
        "Working with a talented team on a dynamic feed that adapts to each listener's preferences.",
        "Grew our social presence organically to 2,700 followers and 1.5M+ views."
      ] }]
    },
    {
      org: "Tufts HRI Lab", role: "Research Assistant, part-time", date: "Sep 2026 - Present", current: true,
      badge: IMG + "oCWnU4BxvjGfHzEiZF1rhnFs.svg",
      roles: [{ bullets: [
        "Recruit participants and support IRB-compliant human-robot interaction studies.",
        "Analyze trust and usability data in R with ggplot2."
      ] }]
    },
    {
      org: "Tufts AI Safety", role: "Policy Fellow", date: "Sep 2026 - Present", current: true,
      badge: ["AI", "#1f6feb"],
      roles: [{ bullets: [
        "Selected fellow in a student-run program studying governance and policy solutions for the risks posed by transformative AI systems.",
        "Read and dissected draft legislation and governance frameworks across responsible scaling policies, compute governance, AI companions, deepfakes and misinformation, energy and the environment, and international strategic frameworks.",
        "Built a working understanding of the technical, social, and political challenges of AI."
      ] }]
    },
    {
      org: "Amal House", role: "Project Management Intern, remote", date: "Sep 2026 - Present", current: true,
      badge: ["AH", "#2b2d2f"], roles: []
    },
    {
      org: "Tufts University", role: "Student roles", date: "Aug 2025 - Present", current: true,
      badge: ["TU", "#3e8ede"],
      roles: [
        { title: "Undergraduate Admissions Student Communications Group", meta: "Part-time, remote · Sep 2026 - Present" },
        { title: "Intern, Student Alumni Collective", meta: "Internship, on-site · Sep 2026 - Present" },
        { title: "Class Ambassador", meta: "On-site · Aug 2025 - Present" }
      ]
    },
    {
      org: "Albany Medical Center", role: "Anesthesia Technician and Administrative Assistant", date: "Feb 2025 - Aug 2026",
      badge: IMG + "yMcXNSNKzTKIukLJc4d9uhurDwE.svg",
      roles: [
        { title: "Anesthesia Technician", meta: "Full-time · Mar 2025 - Aug 2026", bullets: [
          "Prepared, set up, sterilized, and maintained operating rooms for 10+ surgical procedures daily, ensuring equipment readiness and procedural efficiency.",
          "Inspected, troubleshot, and resolved 50+ anesthesia machine and monitoring issues before procedures, reducing delays across 34 ORs, 14 non-ORs, and 5 catheterization labs.",
          "Worked cross-functionally with anesthesiologists, nurses, and surgical teams in high-pressure clinical and emergency settings, practicing closed-loop communication and accountability."
        ] },
        { title: "Administrative Assistant", meta: "Part-time · Feb 2025 - Mar 2025", bullets: [
          "Primary front-office point of contact, greeting and assisting 50+ patients and customers daily in a professional, patient-centered environment.",
          "Managed high-volume phone traffic, document scanning, and filing at once, keeping routing accurate and daily operations efficient.",
          "Handled confidential records and sensitive information in strict compliance with privacy guidelines."
        ] }
      ]
    },
    {
      org: "The RNA Institute", role: "Research Student, Computational Biology", date: "Jul 2025 - Aug 2025",
      badge: IMG + "c8llj7bjZDasXPotcD32uirJjwU.svg",
      roles: [{ bullets: [
        "Selected as one of a few high school students nationwide for a research-based summer program led by faculty at the RNA Institute, University at Albany.",
        "Conducted collaborative research on spinocerebellar ataxia (SCA), a neurodegenerative disorder marked by progressive loss of coordination, using bioinformatics tools and real-world RNA datasets.",
        "Explored the molecular basis of SCA, focusing on trinucleotide repeat expansions in genes like ATXN1 and ATXN3.",
        "Gained hands-on experience in R, RStudio, and the Linux command line to process genomic data.",
        "Investigated the role of alternative splicing and RNA toxicity in neurodegeneration, and presented findings from a mentored small-group project."
      ] }]
    },
    {
      org: "Albany Medical College", role: "Neuroscience Immersion Program", date: "Jun 2025 - Jul 2025",
      badge: ["NI", "#8a2c45"],
      roles: [{ bullets: ["Took part in the NextGen Neuroscience Summer Program."] }]
    },
    {
      org: "New York State Senate", role: "Senate Intern", date: "Jul 2024 - Aug 2024",
      badge: ["NY", "#1d3557"],
      roles: [{ bullets: [
        "Designed and produced print and digital communication materials distributed statewide, supporting legislative outreach to hundreds of thousands of constituents.",
        "Coordinated production timelines, revisions, and logistics under immovable legislative deadlines while balancing several requests at once.",
        "Worked with senators and staff to tailor visual messaging to constituent engagement goals and public events."
      ] }]
    }
  ];

  var CSS = [
    ".framer-1no5cfb{display:none!important}",
    "#journey{position:relative;z-index:3;width:100%;color:rgb(17,18,18);font-family:Inter,system-ui,sans-serif}",
    "#journey .jr-item+.jr-item{border-top:1px solid rgba(17,18,18,.16)}",
    "#journey .jr-h{margin:0;font:inherit}",
    "#journey .jr-row{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:20px;width:100%;padding:32px 0;cursor:default}",
    "#journey button.jr-row{cursor:pointer}",
    "#journey button.jr-row:focus-visible{outline:2px solid rgb(17,18,18);outline-offset:4px;border-radius:12px}",
    "#journey .jr-badge{flex:none;width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;overflow:hidden;color:#fff;font:700 13px/1 Inter,system-ui,sans-serif;letter-spacing:.02em}",
    "#journey .jr-badge img{width:100%;height:100%;object-fit:cover;display:block}",
    "#journey .jr-text{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}",
    "#journey .jr-org{font-size:clamp(26px,5.4vw,40px);line-height:1.1;font-weight:500;letter-spacing:-.03em}",
    "#journey .jr-role{font-size:16px;line-height:1.4;opacity:.72}",
    "#journey .jr-date{align-self:flex-start;margin-top:8px;padding:6px 10px;border:2px solid rgb(17,18,18);border-radius:8px;font:500 14px/1.2 'DM Mono',ui-monospace,monospace;text-transform:uppercase;letter-spacing:-.02em;white-space:nowrap}",
    "#journey .jr-date.is-now{background:" + CYAN + "}",
    "#journey .jr-plus{flex:none;position:relative;width:44px;height:44px;border:2px solid rgb(17,18,18);border-radius:50%;transition:transform .3s cubic-bezier(.25,0,.75,1),background-color .2s}",
    "#journey .jr-plus::before,#journey .jr-plus::after{content:'';position:absolute;left:50%;top:50%;width:16px;height:2px;margin:-1px 0 0 -8px;background:rgb(17,18,18)}",
    "#journey .jr-plus::after{transform:rotate(90deg)}",
    "#journey button.jr-row:hover .jr-plus{background:" + CYAN + "}",
    "#journey button.jr-row[aria-expanded=true] .jr-plus{transform:rotate(45deg);background:" + CYAN + "}",
    "#journey .jr-panel{display:grid;grid-template-rows:0fr;transition:grid-template-rows .3s cubic-bezier(.25,0,.75,1)}",
    "#journey .jr-panel.open{grid-template-rows:1fr}",
    "#journey .jr-clip{overflow:hidden;min-height:0}",
    "#journey .jr-body{padding:0 64px 32px 64px;font-size:16px;line-height:1.5;display:flex;flex-direction:column;gap:20px}",
    "#journey .jr-body ul{margin:0;padding:0 0 0 18px;display:flex;flex-direction:column;gap:8px}",
    "#journey .jr-sub{font-size:18px;font-weight:500;letter-spacing:-.01em;margin:0 0 4px}",
    "#journey .jr-meta{font:500 13px/1.3 'DM Mono',ui-monospace,monospace;text-transform:uppercase;opacity:.66;margin:0 0 8px}",
    "@media (max-width:809.98px){#journey .jr-row{gap:14px;padding:24px 0}#journey .jr-badge{width:36px;height:36px;font-size:11px}#journey .jr-plus{width:36px;height:36px}#journey .jr-body{padding:0 0 24px 0}}",
    "@media (prefers-reduced-motion:reduce){#journey .jr-panel,#journey .jr-plus{transition:none}}"
  ].join("");

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function badge(b) {
    var n = el("span", "jr-badge");
    n.setAttribute("aria-hidden", "true");
    if (typeof b === "string") {
      var i = el("img");
      i.src = b; i.alt = ""; i.loading = "lazy";
      n.appendChild(i);
    } else {
      n.textContent = b[0];
      n.style.background = b[1];
    }
    return n;
  }

  function bullets(list) {
    var ul = el("ul");
    list.forEach(function (t) { ul.appendChild(el("li", null, t)); });
    return ul;
  }

  function build() {
    var root = el("div");
    root.id = "journey";
    JOURNEY.forEach(function (it, idx) {
      var item = el("div", "jr-item");
      var canOpen = it.roles && it.roles.length;
      var row = el(canOpen ? "button" : "div", "jr-row");
      var text = el("span", "jr-text");
      text.appendChild(el("span", "jr-org", it.org));
      text.appendChild(el("span", "jr-role", it.role));
      text.appendChild(el("span", "jr-date" + (it.current ? " is-now" : ""), it.date));
      row.appendChild(badge(it.badge));
      row.appendChild(text);
      var h = el("h4", "jr-h");
      h.appendChild(row);
      item.appendChild(h);
      if (canOpen) {
        var id = "journey-panel-" + idx;
        row.type = "button";
        row.setAttribute("aria-expanded", "false");
        row.setAttribute("aria-controls", id);
        row.appendChild(el("span", "jr-plus")).setAttribute("aria-hidden", "true");
        var panel = el("div", "jr-panel");
        panel.id = id;
        panel.setAttribute("role", "region");
        var clip = el("div", "jr-clip");
        var body = el("div", "jr-body");
        it.roles.forEach(function (r) {
          var block = el("div");
          if (r.title) block.appendChild(el("p", "jr-sub", r.title));
          if (r.meta) block.appendChild(el("p", "jr-meta", r.meta));
          if (r.bullets) block.appendChild(bullets(r.bullets));
          body.appendChild(block);
        });
        clip.appendChild(body);
        panel.appendChild(clip);
        item.appendChild(panel);
        // Collapsed content must not be reachable by keyboard or screen readers.
        clip.inert = true;
        row.addEventListener("click", function () {
          var open = row.getAttribute("aria-expanded") !== "true";
          row.setAttribute("aria-expanded", open ? "true" : "false");
          panel.classList.toggle("open", open);
          clip.inert = !open;
        });
      }
      root.appendChild(item);
    });
    return root;
  }

  function mount() {
    if (document.getElementById("journey")) return;
    var list = document.querySelector(".framer-1no5cfb");
    if (!list || !list.parentNode) return;
    list.parentNode.insertBefore(build(), list.nextSibling);
  }

  var style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  // Framer hydrates after load and may rebuild its tree: keep the list in place.
  function start() {
    mount();
    var queued = false;
    new MutationObserver(function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; mount(); });
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === "complete") setTimeout(start, 300);
  else addEventListener("load", function () { setTimeout(start, 300); });
})();
