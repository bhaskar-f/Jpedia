(() => {
  if (!window.location.pathname.startsWith("/jobs/")) return;
  const root = document.querySelector("#jobDetailRoot");
  if (!root) return;
  const API_BASE = window.JPEDIA_CONFIG?.API_BASE_URL || window.JINFO_API_BASE || `${window.location.origin}/api`;
  const STATUSES = [
    "NOT_APPLIED",
    "APPLIED",
    "ADMIT_CARD",
    "EXAM_SCHEDULED",
    "EXAM_COMPLETED",
    "RESULT",
    "INTERVIEW",
    "SELECTED",
    "REJECTED",
  ];
  let user = null;
  let liveMessage = null;
  const el = (tag, cls = "", text) => {
    const item = document.createElement(tag);
    if (cls) item.className = cls;
    if (text !== undefined) item.textContent = text;
    return item;
  };
  const api = async (path, options = {}) => {
    const response = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.success === false) {
      const error = new Error(
        result.error?.message || `Request failed (${response.status})`,
      );
      error.status = response.status;
      error.code = result.error?.code;
      throw error;
    }
    return result.data;
  };
  const exists = (value) =>
    value !== undefined &&
    value !== null &&
    value !== "" &&
    (!Array.isArray(value) || value.length > 0);
  const text = (value) =>
    Array.isArray(value)
      ? value.map(text).filter(Boolean).join(", ")
      : value && typeof value === "object"
        ? Object.entries(value)
            .filter(([, v]) => exists(v))
            .map(([key, v]) => `${key}: ${text(v)}`)
            .join(" · ")
        : String(value ?? "");
  const date = (value) => {
    if (!value) return "";
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
      ? ""
      : parsed.toLocaleDateString(undefined, {
          day: "numeric",
          month: "long",
          year: "numeric",
        });
  };
  function safeUrl(value) {
    if (
      typeof value !== "string" ||
      !value.trim() ||
      !/^https?:\/\//i.test(value.trim())
    )
      return null;
    try {
      const url = new URL(value.trim());
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password
      )
        return null;
      return url.href;
    } catch {
      return null;
    }
  }
  function link(label, value) {
    const href = safeUrl(value);
    if (!href) return null;
    const anchor = el("a", "job-detail-link", label);
    anchor.href = value.trim();
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    return anchor;
  }
  function section(parent, title) {
    const item = el("section", "job-detail-section");
    item.append(el("h2", "", title));
    parent.append(item);
    return item;
  }
  function dataTable(parent, title, headers, rows) {
    if (!rows.length) return;
    const group = section(parent, title);
    const table = el("table", "job-detail-data-table");
    const thead = el("thead"),
      headerRow = el("tr");
    headers.forEach((header) => headerRow.append(el("th", "", header)));
    thead.append(headerRow);
    table.append(thead);
    const body = el("tbody");
    rows.forEach((values) => {
      const row = el("tr");
      values.forEach((value) => row.append(el("td", "", text(value))));
      body.append(row);
    });
    table.append(body);
    const wrap = el("div", "job-detail-table-wrap");
    wrap.append(table);
    group.append(wrap);
    return group;
  }
  function renderAuthoringData(parent, job) {
    dataTable(
      parent,
      "Important Dates",
      ["Event", "Date", "Description"],
      (job.importantDates || []).map((x) => [
        x.event,
        date(x.date),
        x.description,
      ]),
    );
    dataTable(
      parent,
      "Vacancy Breakdown",
      ["Post", "Vacancies", "Notes"],
      (job.vacancyBreakdown || []).map((x) => [
        x.post,
        x.vacancyCount,
        x.notes,
      ]),
    );
    dataTable(
      parent,
      "Age Relaxation",
      ["Category", "Relaxation", "Notes"],
      (job.ageRelaxations || []).map((x) => [
        x.category,
        x.relaxation,
        x.notes,
      ]),
    );
    dataTable(
      parent,
      "Application Fees",
      ["Category", "Fee", "Notes"],
      (job.applicationFees || []).map((x) => [x.category, x.fee, x.notes]),
    );
    dataTable(
      parent,
      "Qualifications",
      ["Requirement", "Field", "Condition", "Additional Requirement"],
      (job.qualifications || []).map((x) => [
        x.name,
        x.field,
        x.condition,
        x.additionalRequirement,
      ]),
    );
    if (job.selectionStages?.length) {
      const group = section(parent, "Selection Process");
      const list = el("ol", "job-detail-list");
      job.selectionStages.forEach((stage) => {
        const item = el("li");
        item.append(el("strong", "", stage.name));
        if (stage.description) item.append(el("p", "", stage.description));
        const details = [
          stage.maximumMarks != null
            ? `Maximum marks: ${stage.maximumMarks}`
            : "",
          stage.qualifyingMarks != null
            ? `Qualifying marks: ${stage.qualifyingMarks}`
            : "",
          stage.qualifyingPercentage != null
            ? `Qualifying: ${stage.qualifyingPercentage}%`
            : "",
          stage.duration,
          stage.weightage ? `Weightage: ${stage.weightage}` : "",
        ].filter(Boolean);
        if (details.length) item.append(el("p", "", details.join(" · ")));
        if (stage.components?.length) {
          const comps = el("ul");
          stage.components.forEach((c) =>
            comps.append(
              el(
                "li",
                "",
                `${c.name}${c.maximumMarks != null ? ` · ${c.maximumMarks} marks` : ""}${c.qualifyingOnly ? " · qualifying only" : ""}`,
              ),
            ),
          );
          item.append(comps);
        }
        list.append(item);
      });
      group.append(list);
    }
    if (job.salaryInfo && Object.values(job.salaryInfo).some(exists)) {
      const group = section(parent, "Pay and Salary");
      const dl = el("dl", "job-detail-fields");
      for (const [label, key] of [
        ["Pay level", "payLevel"],
        ["Pay scale", "payScale"],
        ["Grade pay", "gradePay"],
        ["Minimum", "minimum"],
        ["Maximum", "maximum"],
        ["Description", "description"],
      ])
        field(dl, label, job.salaryInfo[key]);
      group.append(dl);
    }
    if (job.importantLinks?.length) {
      const group = section(parent, "Important Links");
      const list = el("ul", "job-detail-list");
      job.importantLinks.forEach((item) => {
        const li = el("li");
        const a = link(item.label || "Official link", item.url);
        if (a) li.append(a);
        if (item.description)
          li.append(el("span", "", ` · ${item.description}`));
        if (li.childNodes.length) list.append(li);
      });
      if (list.children.length) group.append(list);
      else group.remove();
    }
    if (job.documentsRequired?.length) {
      const group = section(parent, "Documents Required");
      const list = el("ul", "job-detail-list");
      job.documentsRequired.forEach((x) =>
        list.append(
          el(
            "li",
            "",
            `${x.name}${x.required === false ? " (optional)" : ""}${x.description ? ` — ${x.description}` : ""}`,
          ),
        ),
      );
      group.append(list);
    }
    if (job.importantInstructions?.length) {
      const group = section(parent, "Important Instructions");
      const list = el("ul", "job-detail-list");
      job.importantInstructions.forEach((x) =>
        list.append(el("li", "", x.text)),
      );
      group.append(list);
    }
    if (job.posts?.length) {
      const buckets = new Map();
      job.posts.forEach((post) => {
        const key = post.groupName || "Posts";
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(post);
      });
      for (const [groupName, posts] of buckets) {
        const group = job.postGroups?.find((item) => item.name === groupName);
        const section = dataTable(
          parent,
          `${groupName}${group?.totalVacancies != null ? ` — ${group.totalVacancies} vacancies` : ""}`,
          ["Post", "Vacancies", "Age"],
          posts.map((post) => [
            post.name,
            post.vacancyCount,
            post.ageMin != null || post.ageMax != null
              ? `${post.ageMin ?? "Any"}–${post.ageMax ?? "Any"}${post.ageCutoffDate ? ` (as of ${date(post.ageCutoffDate)})` : ""}`
              : post.ageDescription,
          ]),
        );
        if (section && group?.description)
          section.append(el("p", "", group.description));
      }
      const postDetails = window.JInfoJobContent?.renderPosts(job);
      if (postDetails) parent.append(postDetails);
    }
    if (window.JInfoJobContent) {
      if (Array.isArray(job.contentDocument) && job.contentDocument.length) parent.append(window.JInfoJobContent.renderDocument(job.contentDocument));
      else parent.append(window.JInfoJobContent.renderSections(job.contentSections, job.contentBlocks));
    }
  }
  function field(parent, label, value) {
    if (!exists(value)) return;
    const row = el("div", "job-detail-field");
    row.append(el("dt", "", label), el("dd", "", text(value)));
    parent.append(row);
  }
  function listSection(parent, title, items) {
    if (!Array.isArray(items) || !items.length) return;
    const group = section(parent, title);
    const list = el("ul", "job-detail-list");
    items.forEach((resource) => {
      if (!resource || typeof resource !== "object") return;
      const row = el("li");
      row.append(el("strong", "", resource.title || "Resource"));
      const year =
        resource.year || ((resource.exam || "").match(/\b20\d{2}\b/) || [])[0];
      const meta = [
        year ? `Year: ${year}` : "",
        resource.type ? `Type: ${resource.type.replaceAll("_", " ")}` : "",
        resource.exam && !year ? resource.exam : "",
      ].filter(Boolean);
      if (meta.length)
        row.append(el("span", "job-resource-meta", meta.join(" · ")));
      if (resource.description) row.append(el("p", "", resource.description));
      const uploaded =
        resource.sourceType === "UPLOAD" || Boolean(resource.cloudinaryUrl);
      const fileKind = (resource.mimeType || "").includes("pdf")
        ? "PDF"
        : (resource.mimeType || "").startsWith("image/")
          ? "Image"
          : "File";
      const label = uploaded
        ? `${fileKind} · ${resource.accessMode === "DOWNLOAD" ? "Download" : "Open in browser"}`
        : resource.youtubeUrl
          ? "Watch video · Open"
          : "External link · Open";
      const open = link(
        label,
        resource.externalUrl ||
          resource.url ||
          resource.cloudinaryUrl ||
          resource.youtubeUrl,
      );
      if (open) row.append(open);
      list.append(row);
    });
    if (list.children.length) group.append(list);
    else group.remove();
  }
  function renderHowToApply(parent, job) {
    const videoId =
      window.JInfoYouTubeVideoId?.(job.howToApplyYoutubeUrl) || null;
    const steps = Array.isArray(job.howToApplySteps)
      ? job.howToApplySteps.filter((step) => String(step).trim())
      : [];
    if (!videoId && !steps.length) return;
    const group = section(parent, "How to Apply");
    if (videoId) {
      const note = el(
        "p",
        "job-detail-video-note",
        "Supplemental video guidance hosted on YouTube. Confirm requirements and instructions on the official recruitment website.",
      );
      const frame = el("div", "job-detail-video-frame");
      const iframe = el("iframe");
      iframe.src = `https://www.youtube.com/embed/${videoId}`;
      iframe.title = `How to apply for ${job.title || "this job"}`;
      iframe.loading = "lazy";
      iframe.referrerPolicy = "strict-origin-when-cross-origin";
      iframe.allow =
        "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
      iframe.allowFullscreen = true;
      frame.append(iframe);
      group.append(note, frame);
    }
    if (steps.length) {
      const list = el("ol", "job-detail-list");
      steps.forEach((step) => list.append(el("li", "", step)));
      group.append(list);
    }
  }
  function showSignIn(message, capability) {
    message.replaceChildren(el("span", "", `Sign in to ${capability}. `));
    const signIn = el("a", "", "Sign In");
    signIn.href = `/?auth=login&returnTo=${encodeURIComponent(window.location.pathname)}`;
    message.append(signIn);
  }
  async function currentUser() {
    try {
      return (await api("/users/me")).user;
    } catch (error) {
      if (error.status !== 401) return null;
      try {
        await api("/auth/refresh", { method: "POST" });
        return (await api("/users/me")).user;
      } catch {
        return null;
      }
    }
  }
  function setAppDate(input, value) {
    if (!value) return;
    const dateValue = new Date(value);
    if (!Number.isNaN(dateValue.getTime()))
      input.value = new Date(
        dateValue.getTime() - dateValue.getTimezoneOffset() * 60000,
      )
        .toISOString()
        .slice(0, 16);
  }
  function addApplicationForm(host, jobId, existing, onSaved) {
    host.replaceChildren();
    const form = el("form", "job-tracker-form");
    const statusLabel = el("label", "job-detail-control");
    statusLabel.append(el("span", "", "Application Status"));
    const status = el("select");
    status.name = "status";
    STATUSES.forEach((value) => {
      const option = el("option", "", value.replaceAll("_", " "));
      option.value = value;
      option.selected = value === (existing?.status || "NOT_APPLIED");
      status.append(option);
    });
    statusLabel.append(status);
    form.append(statusLabel);
    for (const [label, name] of [
      ["Applied at", "appliedAt"],
      ["Exam date", "examDate"],
      ["Reminder", "reminderDate"],
    ]) {
      const wrapper = el("label", "job-detail-control");
      wrapper.append(el("span", "", label));
      const input = el("input");
      input.type = "datetime-local";
      input.name = name;
      setAppDate(input, existing?.[name]);
      wrapper.append(input);
      form.append(wrapper);
    }
    for (const [label, name] of [
      ["Result", "result"],
      ["Notes", "notes"],
    ]) {
      const wrapper = el("label", "job-detail-control");
      wrapper.append(el("span", "", label));
      const input = name === "notes" ? el("textarea") : el("input");
      input.name = name;
      if (existing?.[name]) input.value = existing[name];
      wrapper.append(input);
      form.append(wrapper);
    }
    const feedback = el("p", "job-detail-message");
    const submit = el(
      "button",
      "job-detail-button is-primary",
      existing ? "Save Application" : "Track Application",
    );
    submit.type = "submit";
    form.append(submit, feedback);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      submit.disabled = true;
      submit.textContent = "Saving...";
      feedback.textContent = "";
      const values = Object.fromEntries(new FormData(form));
      const payload = {
        status: values.status,
        result: values.result,
        notes: values.notes,
      };
      for (const name of ["appliedAt", "examDate", "reminderDate"])
        if (values[name]) payload[name] = new Date(values[name]).toISOString();
      try {
        const saved = existing
          ? await api(`/applications/${existing._id}`, {
              method: "PATCH",
              body: JSON.stringify(payload),
            })
          : await api("/applications", {
              method: "POST",
              body: JSON.stringify({ job: jobId, ...payload }),
            });
        onSaved(saved);
      } catch (error) {
        feedback.textContent =
          error.status === 401
            ? "Sign in to track an application."
            : error.message;
      } finally {
        submit.disabled = false;
        if (submit.textContent === "Saving...")
          submit.textContent = existing
            ? "Save Application"
            : "Track Application";
      }
    });
    host.append(form);
  }
  function renderApplicationSummary(host, application, onEdit) {
    host.replaceChildren();
    if (!application) return;
    const summary = el("div", "job-tracker-summary");
    const details = el("dl", "job-detail-meta job-tracker-summary-fields");
    for (const [label, name] of [
      ["Status", "status"],
      ["Applied at", "appliedAt"],
      ["Exam date", "examDate"],
      ["Reminder", "reminderDate"],
      ["Result", "result"],
      ["Notes", "notes"],
    ]) {
      let value = application[name];
      if (["appliedAt", "examDate", "reminderDate"].includes(name))
        value = date(value);
      if (name === "status" && value)
        value = String(value).replaceAll("_", " ");
      field(details, label, value);
    }
    summary.append(details);
    const edit = el("button", "job-detail-button", "Edit Application");
    edit.type = "button";
    edit.addEventListener("click", onEdit);
    summary.append(edit);
    host.append(summary);
  }
  function loadingPage() {
    document.body.classList.add("job-details-shell");
    document.body.classList.add("public-mobile-shell");
    root.hidden = false;
    const publicHeader = document.querySelector("body > .site-header");
    if (publicHeader && root.previousElementSibling !== publicHeader)
      publicHeader.after(root);
    const account = document.querySelector("#loginBtn");
    if (account) {
      account.replaceChildren(
        icon("account", "home-account-icon"),
        document.createTextNode("Sign in"),
      );
      account.setAttribute("aria-label", "Sign in");
    }
    const mobileNav = document.querySelector("#mobileBottomNav");
    const items = [
      ["Home", "/", "home"],
      ["Jobs", "/jobs", "work"],
      ["Community", "/communities", "people"],
      ["Services", "/services", "list"],
    ];
    if (mobileNav)
      mobileNav.replaceChildren(
        ...items.map(([label, href, symbol]) => {
          const item = el(
            "a",
            `mobile-bottom-nav-link${label === "Jobs" ? " is-active" : ""}`,
          );
          item.href = href;
          if (label === "Jobs") item.setAttribute("aria-current", "page");
          item.append(icon(symbol), el("span", "", label));
          return item;
        }),
      );
    const page = el("div", "job-details-page");
    const main = el("main", "job-details-main");
    main.append(el("p", "job-detail-loading", "Loading job..."));
    page.append(main);
    root.replaceChildren(page);
    return { page, main };
  }
  async function start() {
    const { page, main } = loadingPage();
    const crumbs = el("nav", "job-breadcrumbs");
    crumbs.setAttribute("aria-label", "Breadcrumb");
    const home = el("a", "", "Home");
    home.href = "/";
    const jobs = el("a", "", "Jobs");
    jobs.href = "/jobs";
    crumbs.append(home, el("span", "job-breadcrumb-separator", "→"), jobs);
    main.replaceChildren(
      crumbs,
      el("p", "job-detail-loading", "Loading job..."),
    );
    const content = el("div", "job-details-content");
    main.append(content);
    const rawId = window.location.pathname
      .slice("/jobs/".length)
      .replace(/\/$/, "");
    let job;
    try {
      job = await api(
        `/jobs/public/${encodeURIComponent(decodeURIComponent(rawId))}`,
      );
    } catch (error) {
      main.replaceChildren(crumbs, content);
      content.replaceChildren(
        el(
          "h1",
          "job-detail-error",
          error.status === 404
            ? "Job not found."
            : error.status === 410
              ? "This job is no longer available."
              : "Failed to load job.",
        ),
      );
      return;
    }
    if (!job?._id) {
      main.replaceChildren(crumbs, content);
      content.replaceChildren(el("h1", "job-detail-error", "Job not found."));
      return;
    }
    main.replaceChildren(crumbs, content);
    const userPromise = currentUser();
    const currentCrumb = el(
      "span",
      "job-breadcrumb-current",
      job.title || "Job details",
    );
    currentCrumb.setAttribute("aria-current", "page");
    crumbs.append(el("span", "job-breadcrumb-separator", "→"), currentCrumb);
    const current = await userPromise;
    user = current;
    let isSaved = false;
    let application = null;
    let accountError = "";
    if (user) {
      try {
        const [saved, applications] = await Promise.all([
          api("/saved-jobs?limit=100"),
          api("/applications?limit=100"),
        ]);
        isSaved = saved.some((item) => String(item._id) === String(job._id));
        application =
          applications.find(
            (item) => String(item.job?._id || item.job) === String(job._id),
          ) || null;
      } catch {
        accountError =
          "Your saved jobs and application tracking could not be loaded.";
      }
    }
    const parsedDeadline = job.applicationDeadline
      ? new Date(job.applicationDeadline)
      : null;
    const closed =
      job.status === "EXPIRED" ||
      Boolean(
        parsedDeadline &&
        !Number.isNaN(parsedDeadline.getTime()) &&
        parsedDeadline.getTime() < Date.now(),
      );
    const header = el("header", "job-detail-header");
    if (job.organization)
      header.append(el("p", "job-detail-eyebrow", job.organization));
    header.append(el("h1", "", job.title));
    const boardName = job.board?.name || job.boardName;
    if (boardName && job.board?.slug) {
      const boardLink = el("a", "job-detail-subtitle", boardName);
      boardLink.href = `/boards/${encodeURIComponent(job.board.slug)}`;
      header.append(boardLink);
    }
    const headingMeta = [job.category].filter(exists);
    if (headingMeta.length)
      header.append(el("p", "job-detail-subtitle", headingMeta.join(" · ")));
    const summary = el("dl", "job-detail-meta");
    field(summary, "Organization", job.organization);
    field(summary, "Vacancies", job.vacancyCount);
    field(summary, "Location", job.location);
    field(summary, "Application Deadline", date(job.applicationDeadline));
    field(summary, "Status", closed ? "Application Closed" : "Open");
    header.append(summary);
    content.replaceChildren(header);
    const actions = el("section", "job-detail-actions");
    if (closed)
      actions.append(el("p", "job-detail-closed", "Application Closed"));
    const applyUrl = safeUrl(job.officialApplyUrl);
    const websiteUrl = safeUrl(job.officialWebsite);
    if (!closed && applyUrl) {
      const apply = el(
        "a",
        "job-detail-button is-primary",
        "Apply on Official Website ↗",
      );
      apply.href = applyUrl;
      apply.target = "_blank";
      apply.rel = "noopener noreferrer";
      actions.append(
        apply,
        el(
          "p",
          "job-detail-external-note",
          "You are leaving SetBGet for the official recruitment website.",
        ),
      );
    } else if (!closed && websiteUrl) {
      const website = el(
        "a",
        "job-detail-button is-primary",
        "Visit Official Website ↗",
      );
      website.href = websiteUrl;
      website.target = "_blank";
      website.rel = "noopener noreferrer";
      actions.append(
        website,
        el(
          "p",
          "job-detail-external-note",
          "You are leaving SetBGet for the official website.",
        ),
      );
    } else if (!closed)
      actions.append(
        el("p", "job-detail-muted", "Application link unavailable."),
      );
    const message = el("p", "job-detail-message");
    liveMessage = message;
    const share = el("button", "job-detail-button job-detail-share", "Share");
    share.type = "button";
    share.setAttribute("aria-label", `Share ${job.title || "this job"}`);
    share.addEventListener("click", async () => {
      const shareUrl = new URL(
        `/jobs/${encodeURIComponent(job.slug || job._id)}`,
        window.location.origin,
      ).href;
      const data = {
        title: job.title || "SetBGet job listing",
        text: `View ${job.title || "this job"}${job.organization ? ` at ${job.organization}` : ""} on SetBGet.`,
        url: shareUrl,
      };
      try {
        if (navigator.share) {
          await navigator.share(data);
          return;
        }
        if (navigator.clipboard?.writeText)
          await navigator.clipboard.writeText(data.url);
        else {
          const input = el("textarea");
          input.value = data.url;
          input.style.position = "fixed";
          input.style.opacity = "0";
          document.body.append(input);
          input.select();
          if (!document.execCommand("copy"))
            throw new Error("Clipboard unavailable");
          input.remove();
        }
        message.textContent = "Job link copied.";
      } catch (error) {
        if (error.name !== "AbortError")
          message.textContent =
            "Could not copy the link. Please copy the page address.";
      }
    });
    const controls = el("div", "job-detail-user-actions");
    const save = el(
      "button",
      "job-detail-button",
      isSaved ? "Saved" : "Save Job",
    );
    save.type = "button";
    save.disabled = isSaved;
    const unsave = el("button", "job-detail-button", "Unsave");
    unsave.type = "button";
    unsave.hidden = !isSaved;
    const track = el(
      "button",
      "job-detail-button",
      application ? "Update Application" : "Track Application",
    );
    track.type = "button";
    const tracker = el("div", "job-detail-tracker");
    const openTracker = () =>
      addApplicationForm(tracker, String(job._id), application, (saved) => {
        application = saved;
        track.textContent = "Update Application";
        renderApplicationSummary(tracker, saved, openTracker);
        message.textContent = "Application tracking saved.";
      });
    if (application)
      renderApplicationSummary(tracker, application, openTracker);
    if (!closed) {
      controls.append(save, unsave, track, share);
      actions.append(controls, message, tracker);
      save.addEventListener("click", async () => {
        if (!user) {
          showSignIn(message, "save this job");
          return;
        }
        save.disabled = true;
        save.textContent = "Saving...";
        try {
          await api(`/saved-jobs/${job._id}`, { method: "POST" });
          isSaved = true;
          save.textContent = "Saved";
          unsave.hidden = false;
        } catch (error) {
          message.textContent = error.message;
          save.textContent = "Save Job";
        } finally {
          save.disabled = isSaved;
        }
      });
      unsave.addEventListener("click", async () => {
        unsave.disabled = true;
        try {
          await api(`/saved-jobs/${job._id}`, { method: "DELETE" });
          isSaved = false;
          save.textContent = "Save Job";
          save.disabled = false;
          unsave.hidden = true;
          message.textContent = "Job removed from saved jobs.";
        } catch (error) {
          message.textContent = error.message;
        } finally {
          unsave.disabled = false;
        }
      });
      track.addEventListener("click", () => {
        if (!user) {
          showSignIn(message, "track an application");
          return;
        }
        openTracker();
      });
    }
    if (closed) actions.append(share);
    actions.append(
      closed ? message : el("span", "job-detail-closed-spacer", ""),
    );
    content.append(actions);
    if (accountError) message.textContent = accountError;
    if (closed)
      content.append(
        el(
          "p",
          "job-detail-closed-note",
          "This job is no longer available for applications.",
        ),
      );
    const sections = el("div", "job-detail-sections");
    const facts = section(sections, "Job Information");
    const hasMin = exists(job.ageMin),
      hasMax = exists(job.ageMax);
    const age =
      hasMin || hasMax
        ? `${hasMin ? job.ageMin : "Any"}${hasMax ? `–${job.ageMax}` : ""} years`
        : "";
    const varying = new Map(
      (job.conditionalFields || [])
        .filter((x) => x.mode === "VARIES")
        .map((x) => [x.field, x]),
    );
    const display = (key, value) =>
      varying.has(key) ? "Varies by post/category" : value;
    for (const [label, value] of [
      ["Vacancy Count", display("vacancyCount", job.vacancyCount)],
      ["Application Start Date", date(job.applicationStartDate)],
      ["Application Deadline", date(job.applicationDeadline)],
      ["Exam Date", date(job.examDate)],
      ["Qualification", display("qualification", job.qualification)],
      ["Age Limit", display("ageLimit", age)],
      ["Age Relaxation", job.ageRelaxation],
      ["Location", display("location", job.location)],
      ["Salary", display("salary", job.salary)],
      ["Selection Process", display("selectionProcess", job.selectionProcess)],
      ["Application Fee", display("applicationFee", job.applicationFee)],
      ["Category Eligibility", job.categoryEligibility],
      ["Gender Eligibility", job.genderEligibility],
    ])
      field(facts, label, value);
    if (!facts.querySelector("dd")) facts.remove();
    if (varying.size && window.JInfoJobContent)
      sections.append(window.JInfoJobContent.renderConditionalFields(job));
    if (job.description) {
      section(sections, "About this Recruitment").append(
        el("p", "job-detail-paragraph", job.description),
      );
    }
    renderHowToApply(sections, job);
    renderAuthoringData(sections, job);
    listSection(sections, "Syllabus", job.syllabusResources);
    listSection(sections, "Previous Year Papers", job.pyqResources);
    listSection(sections, "Mock Tests", job.mockTestResources);
    listSection(sections, "Study Materials", job.studyResources);
    listSection(sections, "Other Resources", job.otherResources);
    const sourceRows = [];
    if (job.source?.name) sourceRows.push(["Source", job.source.name]);
    if (job.source?.organization)
      sourceRows.push(["Organization", job.source.organization]);
    if (job.source?.websiteUrl || job.sourceUrl)
      sourceRows.push([
        "Source website",
        job.source?.websiteUrl || job.sourceUrl,
      ]);
    if (job.officialWebsite)
      sourceRows.push(["Official website", job.officialWebsite]);
    if (job.officialNotificationUrl)
      sourceRows.push(["Official notification", job.officialNotificationUrl]);
    if (sourceRows.length) {
      const sourceSection = section(sections, "Official Source");
      const list = el("ul", "job-detail-source-list");
      sourceRows.forEach(([label, value]) => {
        const row = el("li");
        if (["Source website", "Official website", "Official notification"].includes(label)) {
          const sourceLink = link(`${label} ↗`, value);
          row.append(sourceLink || el("span", "", label));
        } else {
          row.append(el("strong", "", `${label}: `), el("span", "", value));
        }
        list.append(row);
      });
      sourceSection.append(list);
    }
    try {
      const related = await api(
        `/jobs/public/${encodeURIComponent(String(job._id))}/related`,
      );
      if (Array.isArray(related) && related.length) {
        const group = section(sections, "Related Jobs");
        group.classList.add("job-related-section");
        const cards = el("div", "job-related-grid");
        related
          .slice(0, 3)
          .filter(
            (item) =>
              String(item._id) !== String(job._id) &&
              item.status === "PUBLISHED",
          )
          .forEach((item) => {
            const card = el("article", "job-card job-related-card");
            const icon = el(
              "div",
              "job-icon",
              (item.board?.name || "SetBGet").slice(0, 2).toUpperCase(),
            );
            const info = el("div", "job-info");
            info.append(
              el("div", "job-name", item.title || "Job"),
              el("div", "job-org", item.organization || item.board?.name || ""),
            );
            card.append(icon, info);
            const actions = el("div", "job-actions");
            if (item.applicationDeadline)
              actions.append(
                el(
                  "div",
                  "deadline job-related-deadline",
                  `Last Apply: ${date(item.applicationDeadline)}`,
                ),
              );
            const more = el("a", "small-btn", "More Info");
            more.href = `/jobs/${encodeURIComponent(item.slug || item._id)}`;
            actions.append(more);
            card.append(actions);
            cards.append(card);
          });
        if (cards.children.length) {
          group.append(cards);
          const params = new URLSearchParams({ excludeJobId: String(job._id) });
          if (job.board?.slug) params.set("board", job.board.slug);
          else if (job.category) params.set("category", job.category);
          const all = el("a", "job-related-all", "View All Related Jobs →");
          all.href = `/jobs?${params.toString()}`;
          group.append(all);
        } else group.remove();
      }
    } catch (error) {
      console.warn("Related jobs unavailable", error);
    }
    if (sections.children.length) content.append(sections);
  }
  start();
})();
