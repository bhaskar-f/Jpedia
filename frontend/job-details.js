(() => {
  const jobDetailPath = window.location.pathname.replace(/\/+$/, "");
  if (!jobDetailPath.startsWith("/jobs/")) return;
  const root = document.querySelector("#jobDetailRoot");
  if (!root) return;
  const i18n = window.SetBGetI18n;
  const contentLanguage = window.SetBGetJobContentLanguage;
  const t = (key, values) => i18n?.t(key, values) ?? key;
  const formatNumber = (value) => i18n?.formatNumber(value) ?? String(value);
  const formatMoney = (value) =>
    typeof value === "number" && Number.isFinite(value)
      ? i18n?.formatCurrency(value, "INR") ?? formatNumber(value)
      : value;
  const apiError = (error, fallbackKey) => {
    if (error?.code || error?.status) {
      const key = i18n?.errorKey(error);
      const translated = key ? t(key) : key;
      if (translated && translated !== key) return translated;
    }
    return error?.message || t(fallbackKey);
  };
  document.addEventListener("setbget:localechange", () => window.location.reload());
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
  const STATUS_KEYS = {
    NOT_APPLIED: "statusNotApplied", APPLIED: "statusApplied", ADMIT_CARD: "statusAdmitCard",
    EXAM_SCHEDULED: "statusExamScheduled", EXAM_COMPLETED: "statusExamCompleted",
    RESULT: "statusResult", INTERVIEW: "statusInterview", SELECTED: "statusSelected", REJECTED: "statusRejected",
  };
  const translateStatus = (status) => t(`jobDetails.${STATUS_KEYS[status] || "statusNotApplied"}`);
  let user = null;
  let liveMessage = null;
  const el = (tag, cls = "", text) => {
    const item = document.createElement(tag);
    if (cls) item.className = cls;
    if (text !== undefined) item.textContent = text;
    return item;
  };
  let contentLanguageControlId = 0;
  function contentSwitcher(parent, translations, render) {
    const available = contentLanguage?.available(translations) || [];
    if (!available.length) {
      render(parent, null, "en");
      return;
    }
    const desiredLocale = i18n?.locale || "en";
    const initialLocale = contentLanguage?.initialLocale(desiredLocale, translations) || "en";
    const control = el("div", "job-detail-content-language");
    const label = el("label", "job-detail-content-language-label", t("jobDetails.contentLanguage"));
    label.dataset.i18n = "jobDetails.contentLanguage";
    const select = el("select", "job-detail-content-language-select");
    const selectId = `job-content-language-${++contentLanguageControlId}`;
    select.id = selectId;
    select.setAttribute("aria-label", t("jobDetails.contentLanguage"));
    select.dataset.i18nAriaLabel = "jobDetails.contentLanguage";
    select.append(new Option(t("jobDetails.contentLanguageOriginal"), "en"));
    if (available.includes("hi")) select.append(new Option(t("jobDetails.contentLanguageHindi"), "hi"));
    if (available.includes("bn")) select.append(new Option(t("jobDetails.contentLanguageBengali"), "bn"));
    select.value = initialLocale;
    label.htmlFor = selectId;
    control.append(label, select);
    const unavailable = el("p", "job-detail-translation-unavailable");
    unavailable.setAttribute("aria-live", "polite");
    let showInitialUnavailable = ["hi", "bn"].includes(desiredLocale) && !available.includes(desiredLocale);
    const setUnavailableMessage = () => {
      const language = desiredLocale === "hi"
        ? t("jobDetails.contentLanguageHindi")
        : t("jobDetails.contentLanguageBengali");
      unavailable.textContent = t("jobDetails.contentTranslationUnavailable", { language });
      unavailable.hidden = !(showInitialUnavailable && select.value === "en");
    };
    control.append(unavailable);
    const body = el("div", "job-detail-translated-content");
    parent.append(control, body);
    const update = () => {
      const selected = select.value;
      body.replaceChildren();
      render(body, selected === "en" ? null : translations[selected], selected);
      setUnavailableMessage();
    };
    select.addEventListener("change", () => {
      showInitialUnavailable = false;
      update();
    });
    update();
  }
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
        result.error?.message || t("errors.requestFailed"),
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
        : typeof value === "number" && Number.isFinite(value)
          ? formatNumber(value)
          : String(value ?? "");
  const date = (value) => {
    if (!value) return "";
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
      ? ""
      : i18n?.formatDate(parsed, {
          day: "numeric",
          month: "long",
          year: "numeric",
        }) || parsed.toLocaleDateString(undefined, {
          day: "numeric", month: "long", year: "numeric",
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
  function dataTable(parent, title, headers, rows, translations = null, localizeRows = value => value) {
    if (!rows.length) return;
    const group = section(parent, title);
    contentSwitcher(group, translations, (target, translation) => {
      const table = el("table", "job-detail-data-table");
      const thead = el("thead"),
        headerRow = el("tr");
      headers.forEach((header) => headerRow.append(el("th", "", header)));
      thead.append(headerRow);
      table.append(thead);
      const body = el("tbody");
      localizeRows(rows, translation).forEach((values) => {
        const row = el("tr");
        values.forEach((value) => row.append(el("td", "", text(value))));
        body.append(row);
      });
      table.append(body);
      const wrap = el("div", "job-detail-table-wrap");
      wrap.append(table);
      target.append(wrap);
    });
    return group;
  }
  function arrayTextTranslations(job, path, field, sourceItems) {
    const result = {};
    for (const locale of ["hi", "bn"]) {
      const values = (sourceItems || []).map((item, index) => {
        const source = typeof item === "string" ? item : item?.[field];
        const candidate = typeof item === "string"
          ? job.contentTranslations?.[locale]?.[path]?.[index]
          : job.contentTranslations?.[locale]?.[path]?.[index]?.[field];
        return exists(source) && contentLanguage?.hasText(candidate) ? candidate : "";
      });
      if (contentLanguage?.hasText(values)) result[locale] = values;
    }
    return result;
  }
  function localizedValue(translation, source) {
    return contentLanguage?.value(translation, source) ?? source;
  }
  function localizedParagraph(parent, source, translations) {
    contentSwitcher(parent, translations, (target, translation) => {
      target.append(el("p", "job-detail-paragraph", localizedValue(translation, source)));
    });
  }
  function renderedPostTranslations(job) {
    const result = {};
    for (const locale of ["hi", "bn"]) {
      const values = (job.posts || []).map((post, index) => {
        const translated = job.contentTranslations?.[locale]?.posts?.[index] || {};
        const visible = {};
        if (post.ageMin == null && post.ageMax == null && exists(post.ageDescription) && contentLanguage?.hasText(translated.ageDescription))
          visible.ageDescription = translated.ageDescription;
        if (post.categoryVacancyBreakdown?.length)
          visible.categoryVacancyBreakdown = post.categoryVacancyBreakdown.map((row, rowIndex) =>
            exists(row.notes) && contentLanguage?.hasText(translated.categoryVacancyBreakdown?.[rowIndex]?.notes)
              ? { notes: translated.categoryVacancyBreakdown[rowIndex].notes }
              : {},
          );
        if (post.qualifications?.length)
          visible.qualifications = post.qualifications.map((row, rowIndex) =>
            exists(row.additionalRequirement) && contentLanguage?.hasText(translated.qualifications?.[rowIndex]?.additionalRequirement)
              ? { additionalRequirement: translated.qualifications[rowIndex].additionalRequirement }
              : {},
          );
        if (post.experienceRequirements?.length)
          visible.experienceRequirements = post.experienceRequirements.map((row, rowIndex) =>
            exists(row.description) && contentLanguage?.hasText(translated.experienceRequirements?.[rowIndex]?.description)
              ? { description: translated.experienceRequirements[rowIndex].description }
              : {},
          );
        if (exists(post.additionalRequirements) && contentLanguage?.hasText(translated.additionalRequirements))
          visible.additionalRequirements = translated.additionalRequirements;
        if (exists(post.postSpecificNotes) && contentLanguage?.hasText(translated.postSpecificNotes))
          visible.postSpecificNotes = translated.postSpecificNotes;
        return visible;
      });
      if (contentLanguage?.hasText(values)) result[locale] = values;
    }
    return result;
  }
  function renderAuthoringData(parent, job) {
    const dates = job.importantDates || [];
    dataTable(
      parent,
      t("jobDetails.importantDates"),
      [t("jobDetails.event"), t("jobDetails.date"), t("jobDetails.description")],
      dates.map((x) => [
        x.event,
        date(x.date),
        x.description,
      ]),
      arrayTextTranslations(job, "importantDates", "description", dates),
      (rows, translation) => rows.map((row, index) => [row[0], row[1], localizedValue(translation?.[index], row[2])]),
    );
    const vacancies = job.vacancyBreakdown || [];
    dataTable(
      parent,
      t("jobDetails.vacancyBreakdown"),
      [t("jobDetails.post"), t("jobDetails.vacancies"), t("jobDetails.notesLabel")],
      vacancies.map((x) => [
        x.post,
        x.vacancyCount,
        x.notes,
      ]),
      arrayTextTranslations(job, "vacancyBreakdown", "notes", vacancies),
      (rows, translation) => rows.map((row, index) => [row[0], row[1], localizedValue(translation?.[index], row[2])]),
    );
    const relaxations = job.ageRelaxations || [];
    dataTable(
      parent,
      t("jobDetails.ageRelaxations"),
      [t("jobDetails.category"), t("jobDetails.relaxation"), t("jobDetails.notesLabel")],
      relaxations.map((x) => [
        x.category,
        x.relaxation,
        x.notes,
      ]),
      arrayTextTranslations(job, "ageRelaxations", "notes", relaxations),
      (rows, translation) => rows.map((row, index) => [row[0], row[1], localizedValue(translation?.[index], row[2])]),
    );
    const fees = job.applicationFees || [];
    dataTable(
      parent,
      t("jobDetails.applicationFees"),
      [t("jobDetails.category"), t("jobDetails.fee"), t("jobDetails.notesLabel")],
      fees.map((x) => [x.category, x.fee, x.notes]),
      arrayTextTranslations(job, "applicationFees", "notes", fees),
      (rows, translation) => rows.map((row, index) => [row[0], row[1], localizedValue(translation?.[index], row[2])]),
    );
    const qualifications = job.qualifications || [];
    dataTable(
      parent,
      t("jobDetails.qualifications"),
      [t("jobDetails.requirement"), t("jobDetails.field"), t("jobDetails.condition"), t("jobDetails.additionalRequirement")],
      qualifications.map((x) => [
        x.name,
        x.field,
        x.condition,
        x.additionalRequirement,
      ]),
      arrayTextTranslations(job, "qualifications", "additionalRequirement", qualifications),
      (rows, translation) => rows.map((row, index) => [row[0], row[1], row[2], localizedValue(translation?.[index], row[3])]),
    );
    if (job.selectionStages?.length) {
      const group = section(parent, t("jobDetails.selectionProcess"));
      contentSwitcher(group, arrayTextTranslations(job, "selectionStages", "description", job.selectionStages), (target, translation) => {
        const list = el("ol", "job-detail-list");
        job.selectionStages.forEach((stage, index) => {
          const item = el("li");
          item.append(el("strong", "", stage.name));
          const description = localizedValue(translation?.[index], stage.description);
          if (description) item.append(el("p", "", description));
          const details = [
            stage.maximumMarks != null
              ? t("jobDetails.maximumMarks", { value: stage.maximumMarks })
              : "",
            stage.qualifyingMarks != null
              ? t("jobDetails.qualifyingMarks", { value: stage.qualifyingMarks })
              : "",
            stage.qualifyingPercentage != null
              ? t("jobDetails.qualifyingPercentage", { value: stage.qualifyingPercentage })
              : "",
            stage.duration,
            stage.weightage ? t("jobDetails.weightage", { value: stage.weightage }) : "",
          ].filter(Boolean);
          if (details.length) item.append(el("p", "", details.join(" · ")));
          if (stage.components?.length) {
            const comps = el("ul");
            stage.components.forEach((c) =>
              comps.append(
                el(
                  "li",
                  "",
                  `${c.name}${c.maximumMarks != null ? ` · ${t("jobDetails.marks", { value: c.maximumMarks })}` : ""}${c.qualifyingOnly ? ` · ${t("jobDetails.qualifyingOnly")}` : ""}`,
                ),
              ),
            );
            item.append(comps);
          }
          list.append(item);
        });
        target.append(list);
      });
    }
    if (job.salaryInfo && Object.values(job.salaryInfo).some(exists)) {
      const group = section(parent, t("jobDetails.payAndSalary"));
      const salaryTranslations = {};
      for (const locale of ["hi", "bn"]) {
        const value = job.contentTranslations?.[locale]?.salaryInfo?.description;
        if (exists(job.salaryInfo.description) && contentLanguage?.hasText(value))
          salaryTranslations[locale] = { description: value };
      }
      contentSwitcher(group, salaryTranslations, (target, translation) => {
        const dl = el("dl", "job-detail-fields");
        for (const [label, key] of [
          [t("jobDetails.payLevel"), "payLevel"],
          [t("jobDetails.payScale"), "payScale"],
          [t("jobDetails.gradePay"), "gradePay"],
          [t("jobDetails.minimum"), "minimum"],
          [t("jobDetails.maximum"), "maximum"],
          [t("jobDetails.description"), "description"],
        ])
          field(dl, label, key === "description"
            ? localizedValue(translation?.description, job.salaryInfo[key])
            : job.salaryInfo[key]);
        target.append(dl);
      });
    }
    if (job.importantLinks?.length) {
      const group = section(parent, t("jobDetails.importantLinks"));
      const links = job.importantLinks;
      contentSwitcher(group, arrayTextTranslations(job, "importantLinks", "description", links), (target, translation) => {
        const list = el("ul", "job-detail-list");
        links.forEach((item, index) => {
          const li = el("li");
          const a = link(item.label || t("jobDetails.officialLink"), item.url);
          if (a) li.append(a);
          const description = localizedValue(translation?.[index], item.description);
          if (description)
            li.append(el("span", "", ` · ${description}`));
          if (li.childNodes.length) list.append(li);
        });
        if (list.children.length) target.append(list);
        else group.remove();
      });
    }
    if (job.documentsRequired?.length) {
      const group = section(parent, t("jobDetails.documentsRequired"));
      const documents = job.documentsRequired;
      contentSwitcher(group, arrayTextTranslations(job, "documentsRequired", "description", documents), (target, translation) => {
        const list = el("ul", "job-detail-list");
        documents.forEach((x, index) => {
          const description = localizedValue(translation?.[index], x.description);
          list.append(el("li", "", `${x.name}${x.required === false ? ` (${t("jobDetails.optional")})` : ""}${description ? ` — ${description}` : ""}`));
        });
        target.append(list);
      });
    }
    if (job.importantInstructions?.length) {
      const group = section(parent, t("jobDetails.importantInstructions"));
      const instructions = job.importantInstructions;
      contentSwitcher(group, arrayTextTranslations(job, "importantInstructions", "text", instructions), (target, translation) => {
        const list = el("ul", "job-detail-list");
        instructions.forEach((x, index) => list.append(el("li", "", localizedValue(translation?.[index], x.text))));
        target.append(list);
      });
    }
    if (job.posts?.length) {
      const buckets = new Map();
      job.posts.forEach((post) => {
        const key = post.groupName || t("jobDetails.posts");
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(post);
      });
      for (const [groupName, posts] of buckets) {
        const group = job.postGroups?.find((item) => item.name === groupName);
        const postIndices = posts.map((post) => job.posts.indexOf(post));
        const ageTranslations = {};
        for (const locale of ["hi", "bn"]) {
          const values = postIndices.map((index) => {
            const post = job.posts[index];
            const source = post.ageMin == null && post.ageMax == null ? post.ageDescription : "";
            const translated = job.contentTranslations?.[locale]?.posts?.[index]?.ageDescription;
            return exists(source) && contentLanguage?.hasText(translated) ? translated : "";
          });
          if (contentLanguage?.hasText(values)) ageTranslations[locale] = values;
        }
        const section = dataTable(
          parent,
          group?.totalVacancies != null ? `${groupName} — ${t("jobDetails.groupVacancies", { count: group.totalVacancies })}` : groupName,
          [t("jobDetails.post"), t("jobDetails.vacancies"), t("jobDetails.age")],
          posts.map((post) => [
            post.name,
            post.vacancyCount,
            post.ageMin != null || post.ageMax != null
              ? `${post.ageMin ?? t("jobDetails.any")}–${post.ageMax ?? t("jobDetails.any")}${post.ageCutoffDate ? ` ${t("jobDetails.asOfDate", { date: date(post.ageCutoffDate) })}` : ""}`
              : post.ageDescription,
          ]),
          ageTranslations,
          (rows, translation) => rows.map((row, index) => [
            row[0], row[1], localizedValue(translation?.[index], row[2]),
          ]),
        );
        if (section && group?.description) {
          const groupIndex = job.postGroups.indexOf(group);
          const groupTranslations = {};
          for (const locale of ["hi", "bn"]) {
            const value = job.contentTranslations?.[locale]?.postGroups?.[groupIndex]?.description;
            if (contentLanguage?.hasText(value)) groupTranslations[locale] = { description: value };
          }
          localizedParagraph(section, group.description, Object.keys(groupTranslations).length
            ? Object.fromEntries(Object.entries(groupTranslations).map(([locale, data]) => [locale, data.description]))
            : null);
        }
      }
      if (window.JInfoJobContent) {
        contentSwitcher(parent, renderedPostTranslations(job), (target, _translation, locale) => {
          const postDetails = window.JInfoJobContent.renderPosts(job, "job-detail", locale);
          if (postDetails) target.append(postDetails);
        });
      }
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
  function localizedField(parent, label, source, translations) {
    if (!(contentLanguage?.available(translations) || []).length) {
      field(parent, label, source);
      return;
    }
    const row = el("div", "job-detail-field");
    const value = el("dd");
    row.append(el("dt", "", label), value);
    contentSwitcher(value, translations, (target, translation) => {
      target.append(el("span", "", text(localizedValue(translation, source))));
    });
    parent.append(row);
  }
  function listSection(parent, title, items) {
    if (!Array.isArray(items) || !items.length) return;
    const group = section(parent, title);
    const list = el("ul", "job-detail-list");
    items.forEach((resource) => {
      if (!resource || typeof resource !== "object") return;
      const row = el("li");
      row.append(el("strong", "", resource.title || t("jobDetails.resource")));
      const year =
        resource.year || ((resource.exam || "").match(/\b20\d{2}\b/) || [])[0];
      const meta = [
        year ? t("jobDetails.year", { year }) : "",
        resource.type ? `${t("jobDetails.type")}: ${resource.type.replaceAll("_", " ")}` : "",
        resource.exam && !year ? resource.exam : "",
      ].filter(Boolean);
      if (meta.length)
        row.append(el("span", "job-resource-meta", meta.join(" · ")));
      if (resource.description) row.append(el("p", "", resource.description));
      const uploaded =
        resource.sourceType === "UPLOAD" || Boolean(resource.cloudinaryUrl);
      const fileKind = (resource.mimeType || "").includes("pdf")
        ? t("jobDetails.pdf")
        : (resource.mimeType || "").startsWith("image/")
          ? t("jobDetails.image")
          : t("jobDetails.file");
      const label = uploaded
        ? `${fileKind} · ${resource.accessMode === "DOWNLOAD" ? t("jobDetails.download") : t("jobDetails.openInBrowser")}`
        : resource.youtubeUrl
          ? t("jobDetails.watchVideoOpen")
          : t("jobDetails.externalLinkOpen");
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
      ? job.howToApplySteps.map((step, index) => ({ step, index })).filter(({ step }) => String(step).trim())
      : [];
    if (!videoId && !steps.length) return;
    const group = section(parent, t("jobDetails.howToApply"));
    if (videoId) {
      const note = el(
        "p",
        "job-detail-video-note",
        t("jobDetails.videoGuidance"),
      );
      const frame = el("div", "job-detail-video-frame");
      const iframe = el("iframe");
      iframe.src = `https://www.youtube.com/embed/${videoId}`;
      iframe.title = `${t("jobDetails.howToApplyFor")} ${job.title || t("jobDetails.fallbackTitle")}`;
      iframe.loading = "lazy";
      iframe.referrerPolicy = "strict-origin-when-cross-origin";
      iframe.allow =
        "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
      iframe.allowFullscreen = true;
      frame.append(iframe);
      group.append(note, frame);
    }
    if (steps.length) {
      const translations = {};
      for (const locale of ["hi", "bn"]) {
        const values = steps.map(({ index }) => job.contentTranslations?.[locale]?.howToApplySteps?.[index] || "");
        if (contentLanguage?.hasText(values)) translations[locale] = values;
      }
      contentSwitcher(group, translations, (target, translation) => {
        const list = el("ol", "job-detail-list");
        steps.forEach(({ step, index }, position) => list.append(el("li", "", localizedValue(translation?.[position], step))));
        target.append(list);
      });
    }
  }
  function showSignIn(message, capabilityKey) {
    message.replaceChildren(el("span", "", t("jobDetails.signInCapability", { capability: t(capabilityKey) }) + " "));
    const signIn = el("a", "", t("jobDetails.signIn"));
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
    statusLabel.append(el("span", "", t("jobDetails.applicationStatus")));
    const status = el("select");
    status.name = "status";
    STATUSES.forEach((value) => {
      const option = el("option", "", translateStatus(value));
      option.value = value;
      option.selected = value === (existing?.status || "NOT_APPLIED");
      status.append(option);
    });
    statusLabel.append(status);
    form.append(statusLabel);
    for (const [label, name] of [
      [t("jobDetails.appliedAt"), "appliedAt"],
      [t("jobDetails.examDate"), "examDate"],
      [t("jobDetails.reminder"), "reminderDate"],
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
      [t("jobDetails.result"), "result"],
      [t("jobDetails.notes"), "notes"],
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
      existing ? t("jobDetails.saveApplication") : t("jobDetails.trackApplication"),
    );
    submit.type = "submit";
    form.append(submit, feedback);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      submit.disabled = true;
      submit.textContent = t("jobDetails.saving");
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
        feedback.textContent = error.status === 401
          ? t("jobDetails.signInTrackError")
          : apiError(error, "errors.requestFailed");
      } finally {
        submit.disabled = false;
        if (submit.textContent === t("jobDetails.saving"))
          submit.textContent = existing
            ? t("jobDetails.saveApplication")
            : t("jobDetails.trackApplication");
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
      [t("jobDetails.status"), "status"],
      [t("jobDetails.appliedAt"), "appliedAt"],
      [t("jobDetails.examDate"), "examDate"],
      [t("jobDetails.reminder"), "reminderDate"],
      [t("jobDetails.result"), "result"],
      [t("jobDetails.notes"), "notes"],
    ]) {
      let value = application[name];
      if (["appliedAt", "examDate", "reminderDate"].includes(name))
        value = date(value);
      if (name === "status" && value)
        value = translateStatus(value);
      field(details, label, value);
    }
    summary.append(details);
    const edit = el("button", "job-detail-button", t("jobDetails.editApplication"));
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
      const label = el("span", "", t("navigation.signIn"));
      label.dataset.i18n = "navigation.signIn";
      account.replaceChildren(icon("account", "home-account-icon"), label);
      account.dataset.i18nAriaLabel = "navigation.signIn";
      account.setAttribute("aria-label", t("navigation.signIn"));
    }
    const mobileNav = document.querySelector("#mobileBottomNav");
    const items = [
      ["navigation.home", "/", "home"],
      ["navigation.jobs", "/jobs", "work"],
      ["navigation.communities", "/communities", "people"],
      ["navigation.services", "/services", "list"],
    ];
    if (mobileNav)
      mobileNav.replaceChildren(
        ...items.map(([label, href, symbol]) => {
          const item = el(
            "a",
            `mobile-bottom-nav-link${label === "navigation.jobs" ? " is-active" : ""}`,
          );
          item.href = href;
          if (label === "navigation.jobs") item.setAttribute("aria-current", "page");
          const text = el("span", "", t(label)); text.dataset.i18n = label;
          item.append(icon(symbol), text);
          return item;
        }),
      );
    const page = el("div", "job-details-page");
    const main = el("main", "job-details-main");
    main.append(el("p", "job-detail-loading", t("jobDetails.loading")));
    page.append(main);
    root.replaceChildren(page);
    return { page, main };
  }
  async function start() {
    await i18n?.ready;
    const { page, main } = loadingPage();
    const crumbs = el("nav", "job-breadcrumbs");
    crumbs.setAttribute("aria-label", t("jobDetails.breadcrumb"));
    const home = el("a", "", t("navigation.home"));
    home.href = "/";
    const jobs = el("a", "", t("navigation.jobs"));
    jobs.href = "/jobs";
    crumbs.append(home, el("span", "job-breadcrumb-separator", "→"), jobs);
    main.replaceChildren(
      crumbs,
      el("p", "job-detail-loading", t("jobDetails.loading")),
    );
    const content = el("div", "job-details-content");
    main.append(content);
    const routeMatch = jobDetailPath.match(/^\/jobs\/([^/]+)$/);
    if (!routeMatch) {
      main.replaceChildren(crumbs, content);
      content.replaceChildren(el("h1", "job-detail-error", t("jobDetails.notFound")));
      return;
    }
    let job;
    try {
      const jobIdentifier = decodeURIComponent(routeMatch[1]);
      job = await api(`/jobs/public/${encodeURIComponent(jobIdentifier)}`);
    } catch (error) {
      main.replaceChildren(crumbs, content);
      content.replaceChildren(
        el(
          "h1",
          "job-detail-error",
          error.status === 404
            ? apiError(error, "jobDetails.notFound")
            : error.status === 410
              ? t("jobDetails.noLongerAvailable")
              : t("jobDetails.loadFailed"),
        ),
      );
      return;
    }
    if (!job?._id) {
      main.replaceChildren(crumbs, content);
      content.replaceChildren(el("h1", "job-detail-error", t("jobDetails.notFound")));
      return;
    }
    const canonical = `https://www.setbget.in/jobs/${encodeURIComponent(job.slug || job._id)}`;
    const metaDescription = String(job.description || `${job.title || t("jobDetails.fallbackTitle")}${job.organization ? ` at ${job.organization}` : ""}. ${t("jobDetails.metaDescription")}`).replace(/\s+/g, " ").slice(0, 300);
    document.title = `${job.title || t("jobDetails.fallbackTitle")}${job.organization ? ` at ${job.organization}` : ""} | SetBGet`;
    const setMeta = (selector, attr, value, tag, key, keyValue) => {
      let node = document.head.querySelector(selector);
      if (!node) { node = document.createElement(tag); node.setAttribute(key, keyValue); document.head.append(node); }
      node.setAttribute(attr, value);
    };
    setMeta('meta[name="description"]', "content", metaDescription, "meta", "name", "description");
    setMeta('link[rel="canonical"]', "href", canonical, "link", "rel", "canonical");
    setMeta('meta[name="robots"]', "content", "index, follow", "meta", "name", "robots");
    setMeta('meta[property="og:type"]', "content", "article", "meta", "property", "og:type");
    setMeta('meta[property="og:title"]', "content", document.title, "meta", "property", "og:title");
    setMeta('meta[property="og:description"]', "content", metaDescription, "meta", "property", "og:description");
    setMeta('meta[property="og:url"]', "content", canonical, "meta", "property", "og:url");
    setMeta('meta[name="twitter:title"]', "content", document.title, "meta", "name", "twitter:title");
    setMeta('meta[name="twitter:description"]', "content", metaDescription, "meta", "name", "twitter:description");
    setMeta('meta[name="twitter:url"]', "content", canonical, "meta", "name", "twitter:url");
    main.replaceChildren(crumbs, content);
    const userPromise = currentUser();
    const currentCrumb = el(
      "span",
      "job-breadcrumb-current",
      job.title || t("jobDetails.fallbackTitle"),
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
        accountError = t("jobDetails.savedApplicationLoadFailed");
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
    field(summary, t("jobDetails.organization"), job.organization);
    field(summary, t("jobDetails.vacancies"), job.vacancyCount);
    field(summary, t("jobDetails.location"), job.location);
    field(summary, t("jobDetails.applicationDeadline"), date(job.applicationDeadline));
    field(summary, t("jobDetails.status"), closed ? t("jobDetails.applicationClosed") : t("jobDetails.open"));
    header.append(summary);
    content.replaceChildren(header);
    const actions = el("section", "job-detail-actions");
    if (closed)
      actions.append(el("p", "job-detail-closed", t("jobDetails.applicationClosed")));
    const applyUrl = safeUrl(job.officialApplyUrl);
    const websiteUrl = safeUrl(job.officialWebsite);
    if (!closed && applyUrl) {
      const apply = el(
        "a",
        "job-detail-button is-primary",
        t("jobDetails.applyOfficial"),
      );
      apply.href = applyUrl;
      apply.target = "_blank";
      apply.rel = "noopener noreferrer";
      actions.append(
        apply,
        el(
          "p",
          "job-detail-external-note",
          t("jobDetails.leavingOfficialRecruitment"),
        ),
      );
    } else if (!closed && websiteUrl) {
      const website = el(
        "a",
        "job-detail-button is-primary",
        t("jobDetails.visitOfficial"),
      );
      website.href = websiteUrl;
      website.target = "_blank";
      website.rel = "noopener noreferrer";
      actions.append(
        website,
        el(
          "p",
          "job-detail-external-note",
          t("jobDetails.leavingOfficial"),
        ),
      );
    } else if (!closed)
      actions.append(
        el("p", "job-detail-muted", t("jobDetails.applicationLinkUnavailable")),
      );
    const message = el("p", "job-detail-message");
    liveMessage = message;
    const share = el("button", "job-detail-button job-detail-share", t("jobDetails.share"));
    share.type = "button";
    share.setAttribute("aria-label", `${t("jobDetails.shareJobAria")} ${job.title || t("jobDetails.fallbackTitle")}`);
    share.addEventListener("click", async () => {
      const shareUrl = new URL(
        `/jobs/${encodeURIComponent(job.slug || job._id)}`,
        window.location.origin,
      ).href;
      const data = {
        title: job.title || t("jobDetails.shareFallbackTitle"),
        text: `${t("jobDetails.shareViewPrefix")} ${job.title || t("jobDetails.fallbackTitle")}${job.organization ? ` ${t("jobDetails.atOrganization")} ${job.organization}` : ""} ${t("jobDetails.shareOnSuffix")}`,
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
        message.textContent = t("jobDetails.jobLinkCopied");
      } catch (error) {
        if (error.name !== "AbortError")
          message.textContent =
            t("jobDetails.copyFailed");
      }
    });
    const controls = el("div", "job-detail-user-actions");
    const save = el(
      "button",
      "job-detail-button",
      isSaved ? t("jobDetails.saved") : t("jobDetails.saveJob"),
    );
    save.type = "button";
    save.disabled = isSaved;
    const unsave = el("button", "job-detail-button", t("jobDetails.unsave"));
    unsave.type = "button";
    unsave.hidden = !isSaved;
    const track = el(
      "button",
      "job-detail-button",
      application ? t("jobDetails.updateApplication") : t("jobDetails.trackApplication"),
    );
    track.type = "button";
    const tracker = el("div", "job-detail-tracker");
    const openTracker = () =>
      addApplicationForm(tracker, String(job._id), application, (saved) => {
        application = saved;
        track.textContent = t("jobDetails.updateApplication");
        renderApplicationSummary(tracker, saved, openTracker);
        message.textContent = t("jobDetails.applicationSaved");
      });
    if (application)
      renderApplicationSummary(tracker, application, openTracker);
    if (!closed) {
      controls.append(save, unsave, track, share);
      actions.append(controls, message, tracker);
      save.addEventListener("click", async () => {
        if (!user) {
          showSignIn(message, "jobDetails.capabilitySave");
          return;
        }
        save.disabled = true;
        save.textContent = t("jobDetails.saving");
        try {
          await api(`/saved-jobs/${job._id}`, { method: "POST" });
          isSaved = true;
          save.textContent = t("jobDetails.saved");
          unsave.hidden = false;
        } catch (error) {
          message.textContent = apiError(error, "errors.requestFailed");
          save.textContent = t("jobDetails.saveJob");
        } finally {
          save.disabled = isSaved;
        }
      });
      unsave.addEventListener("click", async () => {
        unsave.disabled = true;
        try {
          await api(`/saved-jobs/${job._id}`, { method: "DELETE" });
          isSaved = false;
          save.textContent = t("jobDetails.saveJob");
          save.disabled = false;
          unsave.hidden = true;
          message.textContent = t("jobDetails.jobRemovedFromSaved");
        } catch (error) {
          message.textContent = apiError(error, "errors.requestFailed");
        } finally {
          unsave.disabled = false;
        }
      });
      track.addEventListener("click", () => {
        if (!user) {
          showSignIn(message, "jobDetails.capabilityTrack");
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
          t("jobDetails.noLongerAcceptingApplications"),
        ),
      );
    const sections = el("div", "job-detail-sections");
    const facts = section(sections, t("jobDetails.jobInformation"));
    const hasMin = exists(job.ageMin),
      hasMax = exists(job.ageMax);
    const age =
      hasMin || hasMax
        ? t("jobDetails.ageYears", { age: `${hasMin ? formatNumber(job.ageMin) : t("jobDetails.any")}${hasMax ? `–${formatNumber(job.ageMax)}` : ""}` })
        : "";
    const varying = new Map(
      (job.conditionalFields || [])
        .filter((x) => x.mode === "VARIES")
        .map((x) => [x.field, x]),
    );
    const display = (key, value) =>
      varying.has(key) ? t("jobDetails.variesByPost") : value;
    const translationFor = (key, source) => Object.fromEntries(["hi", "bn"].flatMap((locale) => {
      const value = job.contentTranslations?.[locale]?.[key];
      const hasSource = Array.isArray(source)
        ? source.some((item) => typeof item === "string" && item.trim())
        : exists(source);
      return hasSource && contentLanguage?.hasText(value) ? [[locale, value]] : [];
    }));
    field(facts, t("jobDetails.vacancyCount"), display("vacancyCount", job.vacancyCount));
    field(facts, t("jobDetails.applicationStartDate"), date(job.applicationStartDate));
    field(facts, t("jobDetails.applicationDeadline"), date(job.applicationDeadline));
    field(facts, t("jobDetails.examDate"), date(job.examDate));
    if (varying.has("qualification")) field(facts, t("jobDetails.qualification"), display("qualification", job.qualification));
    else localizedField(facts, t("jobDetails.qualification"), job.qualification, translationFor("qualification", job.qualification));
    field(facts, t("jobDetails.ageLimit"), display("ageLimit", age));
    localizedField(facts, t("jobDetails.ageRelaxation"), job.ageRelaxation, translationFor("ageRelaxation", job.ageRelaxation));
    field(facts, t("jobDetails.location"), display("location", job.location));
    field(facts, t("jobDetails.salary"), display("salary", formatMoney(job.salary)));
    if (varying.has("selectionProcess")) field(facts, t("jobDetails.selectionProcess"), display("selectionProcess", job.selectionProcess));
    else localizedField(facts, t("jobDetails.selectionProcess"), job.selectionProcess, translationFor("selectionProcess", job.selectionProcess));
    field(facts, t("jobDetails.applicationFee"), display("applicationFee", formatMoney(job.applicationFee)));
    field(facts, t("jobDetails.categoryEligibility"), job.categoryEligibility);
    field(facts, t("jobDetails.genderEligibility"), job.genderEligibility);
    if (!facts.querySelector("dd")) facts.remove();
    if (varying.size && window.JInfoJobContent)
      sections.append(window.JInfoJobContent.renderConditionalFields(job));
    if (job.description) {
      const descriptionTranslations = {};
      for (const locale of ["hi", "bn"]) {
        const value = job.contentTranslations?.[locale]?.description;
        if (contentLanguage?.hasText(value)) descriptionTranslations[locale] = value;
      }
      localizedParagraph(section(sections, t("jobDetails.aboutRecruitment")), job.description, descriptionTranslations);
    }
    renderHowToApply(sections, job);
    renderAuthoringData(sections, job);
    listSection(sections, t("jobDetails.syllabus"), job.syllabusResources);
    listSection(sections, t("jobDetails.previousYearPapers"), job.pyqResources);
    listSection(sections, t("jobDetails.mockTests"), job.mockTestResources);
    listSection(sections, t("jobDetails.studyMaterials"), job.studyResources);
    listSection(sections, t("jobDetails.otherResources"), job.otherResources);
    const sourceRows = [];
    if (job.source?.name) sourceRows.push([t("jobDetails.source"), job.source.name]);
    if (job.source?.organization)
      sourceRows.push([t("jobDetails.organization"), job.source.organization]);
    if (job.source?.websiteUrl || job.sourceUrl)
      sourceRows.push([
        t("jobDetails.sourceWebsite"),
        job.source?.websiteUrl || job.sourceUrl,
      ]);
    if (job.officialWebsite)
      sourceRows.push([t("jobDetails.officialWebsite"), job.officialWebsite]);
    if (job.officialNotificationUrl)
      sourceRows.push([t("jobDetails.officialNotification"), job.officialNotificationUrl]);
    if (sourceRows.length) {
      const sourceSection = section(sections, t("jobDetails.officialSource"));
      const list = el("ul", "job-detail-source-list");
      sourceRows.forEach(([label, value]) => {
        const row = el("li");
        if ([t("jobDetails.sourceWebsite"), t("jobDetails.officialWebsite"), t("jobDetails.officialNotification")].includes(label)) {
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
        const group = section(sections, t("jobDetails.relatedJobs"));
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
              el("div", "job-name", item.title || t("jobDetails.fallbackTitle")),
              el("div", "job-org", item.organization || item.board?.name || ""),
            );
            card.append(icon, info);
            const actions = el("div", "job-actions");
            if (item.applicationDeadline)
              actions.append(
                el(
                  "div",
                  "deadline job-related-deadline",
                  t("jobDetails.lastApply", { date: date(item.applicationDeadline) }),
                ),
              );
            const more = el("a", "small-btn", t("jobDetails.moreInfo"));
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
          const all = el("a", "job-related-all", t("jobDetails.viewAllRelated"));
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
