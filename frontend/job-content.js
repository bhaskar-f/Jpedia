(() => {
  const t = (key, values) => window.SetBGetI18n?.t(key, values) ?? key;
  const formatMoney = (value) =>
    typeof value === "number" && Number.isFinite(value)
      ? window.SetBGetI18n?.formatCurrency(value, "INR") ?? String(value)
      : value;
  const make = (tag, cls, value) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (value != null) node.textContent = String(value);
    return node;
  };
  const safeUrl = (value) => {
    try {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol) &&
        !url.username &&
        !url.password
        ? url.href
        : null;
    } catch {
      return null;
    }
  };
  const documentTags = new Set([
    "p",
    "h1",
    "h2",
    "h3",
    "ul",
    "ol",
    "li",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "blockquote",
    "hr",
    "strong",
    "em",
    "u",
    "s",
    "a",
    "span",
    "div",
    "br",
  ]);
  const slug = (value) =>
    String(value || "section")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "section";
  function renderDocument(nodes, options = {}) {
    const root = document.createElement("div");
    root.className = options.className || "job-document";
    const translations = options.contentTranslations || options.translationsByLocale || {};
    const staticTranslations = options.translations || options.translationMap || {};
    const toc = [],
      used = new Set();
    function nodeText(item, translatedValues = {}) {
      if (item?.translationKey && typeof translatedValues[item.translationKey] === "string")
        return translatedValues[item.translationKey];
      return item?.text || (item?.content || []).map((child) => nodeText(child, translatedValues)).join("");
    }
    function languageControl(available, update) {
      const label = document.createElement("label");
      label.className = "job-document-language-control";
      const accessibleName = document.createElement("span");
      accessibleName.className = "job-document-language-sr-only";
      accessibleName.textContent = t("jobDetails.contentLanguage");
      const select = document.createElement("select");
      select.className = "job-document-language-select";
      select.setAttribute("aria-label", t("jobDetails.contentLanguage"));
      select.dataset.i18nAriaLabel = "jobDetails.contentLanguage";
      const addOption = (key, locale) => {
        const option = document.createElement("option");
        option.value = locale;
        option.textContent = t(key);
        select.append(option);
      };
      addOption("jobDetails.contentLanguageOriginal", "en");
      if (available.includes("hi")) addOption("jobDetails.contentLanguageHindi", "hi");
      if (available.includes("bn")) addOption("jobDetails.contentLanguageBengali", "bn");
      select.value = "en";
      select.addEventListener("change", () => update(select.value));
      label.append(accessibleName, select);
      return label;
    }
    function build(item, context = {}) {
      if (!item || !documentTags.has(item.type)) return null;
      const node = document.createElement(item.type);
      const attrs = item.attrs || {};
      let headingEntry = null;
      if (/^h[1-3]$/.test(item.type)) {
        let id = /^heading-[a-z0-9-]{1,88}$/.test(attrs.id || "")
          ? attrs.id
          : "";
        if (!id) id = `heading-${slug(nodeText(item))}`;
        let unique = id,
          n = 2;
        while (used.has(unique)) unique = `${id}-${n++}`;
        used.add(unique);
        node.id = unique;
        const title = nodeText(item);
        headingEntry = { id: unique, title, level: Number(item.type[1]), source: item, translatedValues: {}, link: null };
        toc.push(headingEntry);
      }
      if (item.type === "a") {
        const href = safeUrl(attrs.href);
        if (!href) return null;
        node.href = href;
        node.rel = "noopener noreferrer";
        node.target = "_blank";
      }
      if (["left", "center", "right"].includes(attrs.align))
        node.style.textAlign = attrs.align;
      const originalText = item.text || "";
      const available = item.type === "span" && item.translationKey
        ? ["hi", "bn"].filter((locale) => {
            const value = translations?.[locale]?.[item.translationKey];
            return typeof value === "string" && value.trim();
          })
        : [];
      const legacyTranslation = item.translationKey ? staticTranslations[item.translationKey] : null;
      if (available.length) {
        node.className = "job-document-translation-run";
        node.textContent = originalText;
        const control = languageControl(available, (locale) => {
          const value = locale === "en" ? "" : translations?.[locale]?.[item.translationKey];
          node.textContent = typeof value === "string" && value.trim() ? value : originalText;
          if (context.headingEntry) {
            if (locale === "en") delete context.headingEntry.translatedValues[item.translationKey];
            else context.headingEntry.translatedValues[item.translationKey] = node.textContent;
            if (context.headingEntry.link)
              context.headingEntry.link.textContent = nodeText(context.headingEntry.source, context.headingEntry.translatedValues);
          }
        });
        if (context.deferredControls) context.deferredControls.push(control);
        else {
          const fragment = document.createDocumentFragment();
          fragment.append(node, control);
          (item.content || []).forEach((child) => {
            const rendered = build(child, context);
            if (rendered) fragment.append(rendered);
          });
          return fragment;
        }
      } else if (typeof legacyTranslation === "string" && legacyTranslation.trim()) node.textContent = legacyTranslation;
      else if (item.text) node.textContent = item.text;
      const childContext = {
        ...context,
        ...(item.type === "a" ? { deferredControls: [] } : {}),
        ...(headingEntry ? { headingEntry } : {}),
      };
      (item.content || []).forEach((child) => {
        const rendered = build(child, childContext);
        if (rendered) node.append(rendered);
      });
      if (item.type === "a" && childContext.deferredControls.length) {
        const fragment = document.createDocumentFragment();
        fragment.append(node, ...childContext.deferredControls);
        return fragment;
      }
      return node;
    }
    (Array.isArray(nodes) ? nodes : []).forEach((item) => {
      const node = build(item);
      if (node) root.append(node);
    });
    const tocEntries = toc.filter((item) => item.title.trim());
    if (tocEntries.length) {
      const nav = document.createElement("nav");
      nav.className = "job-document-toc";
      nav.setAttribute("aria-label", t("jobDetails.tableOfContentsAria"));
      const title = document.createElement("h2");
      title.textContent = t("jobDetails.tableOfContents");
      nav.append(title);
      const list = document.createElement("ul");
      tocEntries.forEach((item) => {
        const li = document.createElement("li");
        li.style.marginInlineStart = `${Math.max(0, item.level - 1) * 1.25}rem`;
        const a = document.createElement("a");
        a.href = `#${item.id}`;
        a.textContent = item.title;
        item.link = a;
        li.append(a);
        list.append(li);
      });
      nav.append(list);
      root.prepend(nav);
    }
    return root;
  }
  function renderBlocks(blocks, classPrefix = "job-detail") {
    const fragment = document.createDocumentFragment();
    for (const block of Array.isArray(blocks) ? blocks : []) {
      const d = block?.data || {};
      let node;
      if (block.type === "heading" && d.text?.trim())
        node = make("h3", `${classPrefix}-block-heading`, d.text);
      else if (block.type === "paragraph" && d.text?.trim())
        node = make("p", `${classPrefix}-paragraph`, d.text);
      else if (block.type === "callout" && d.text?.trim()) {
        node = make("aside", `${classPrefix}-callout`, d.text);
        if (d.tone) node.dataset.tone = d.tone.toLowerCase();
      } else if (
        ["bulletList", "numberedList", "steps"].includes(block.type) &&
        d.items?.some((x) => String(x).trim())
      ) {
        node = make(
          block.type === "bulletList" ? "ul" : "ol",
          `${classPrefix}-list`,
        );
        d.items
          .filter((x) => String(x).trim())
          .forEach((x) => node.append(make("li", "", x)));
      } else if (
        block.type === "table" &&
        d.headers?.length &&
        d.rows?.length
      ) {
        const wrap = make("div", `${classPrefix}-table-wrap`);
        if (d.title) wrap.append(make("h4", "", d.title));
        const table = make("table", `${classPrefix}-data-table`),
          thead = make("thead"),
          tr = make("tr");
        d.headers.forEach((h) => tr.append(make("th", "", h)));
        thead.append(tr);
        table.append(thead);
        const body = make("tbody");
        d.rows
          .filter((row) => row.some((cell) => String(cell).trim()))
          .forEach((row) => {
            const r = make("tr");
            d.headers.forEach((_, i) => r.append(make("td", "", row[i] || "")));
            body.append(r);
          });
        table.append(body);
        wrap.append(table);
        if (d.note) wrap.append(make("p", `${classPrefix}-table-note`, d.note));
        node = wrap;
      } else if (block.type === "keyValueList" && d.items?.length) {
        node = make("dl", `${classPrefix}-key-values`);
        if (d.title) node.append(make("h4", "", d.title));
        d.items
          .filter((x) => x.key?.trim() && x.value?.trim())
          .forEach((x) =>
            node.append(make("dt", "", x.key), make("dd", "", x.value)),
          );
      } else if (["link", "externalLink", "youtube"].includes(block.type)) {
        const href = safeUrl(d.url);
        if (href) {
          node = make("p", `${classPrefix}-external-link`);
          const a = make(
            "a",
            "",
            d.label ||
              d.caption ||
              (block.type === "youtube" ? t("jobDetails.watchOnYoutube") : t("jobDetails.openLink")),
          );
          a.href = href;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          node.append(a);
          if (d.description)
            node.append(make("span", "", ` — ${d.description}`));
        }
      } else if (block.type === "image") {
        const src = safeUrl(d.url);
        if (src) {
          node = make("figure", `${classPrefix}-image`);
          const img = make("img");
          img.src = src;
          img.alt = d.alt || d.caption || t("jobDetails.recruitmentInformationAlt");
          img.loading = "lazy";
          node.append(img);
          if (d.caption) node.append(make("figcaption", "", d.caption));
        }
      } else if (block.type === "divider")
        node = make("hr", `${classPrefix}-divider`);
      if (node) fragment.append(node);
    }
    return fragment;
  }
  function renderSections(sections, legacyBlocks = []) {
    const root = document.createElement("div");
    root.className = "job-detail-custom-sections";
    const all = [...(Array.isArray(sections) ? sections : [])];
    if (!all.length && Array.isArray(legacyBlocks) && legacyBlocks.length)
      all.push({ title: t("jobDetails.additionalInformation"), blocks: legacyBlocks });
    all.forEach((item) => {
      const blocks = renderBlocks(item.blocks);
      if (!blocks.childNodes.length) return;
      const section = make("section", "job-detail-section");
      if (item.title?.trim()) section.append(make("h2", "", item.title));
      section.append(blocks);
      root.append(section);
    });
    return root;
  }
  function renderConditionalFields(job) {
    const fields = Array.isArray(job?.conditionalFields)
      ? job.conditionalFields.filter((item) => item.mode === "VARIES")
      : [];
    if (!fields.length) return null;
    const section = make("section", "job-detail-section job-detail-variations");
    section.append(make("h2", "", t("jobDetails.postCategoryVariations")));
    const list = make("ul", "job-detail-list");
    const labels = {
      vacancyCount: t("jobDetails.vacancyCount"),
      qualification: t("jobDetails.qualification"),
      ageLimit: t("jobDetails.ageLimit"),
      salary: t("jobDetails.salary"),
      applicationFee: t("jobDetails.applicationFee"),
      location: t("jobDetails.location"),
      experience: t("jobDetails.experience"),
      selectionProcess: t("jobDetails.selectionProcess"),
    };
    fields.forEach((field) => {
      (field.entries || []).forEach((entry) => {
        if (!entry.value) return;
        const post = job.posts?.find(
          (item) => String(item._id) === String(entry.postId),
        );
        const who = [post?.name, entry.category].filter(Boolean).join(" · ");
        list.append(
          make(
            "li",
            "",
          `${labels[field.field] || field.field}${who ? ` · ${who}` : ""}: ${["salary", "applicationFee"].includes(field.field) ? formatMoney(entry.value) : entry.value}`,
          ),
        );
      });
    });
    if (list.children.length) section.append(list);
    else
      section.append(
        make(
          "p",
          "job-detail-paragraph",
          t("jobDetails.valuesVaryNotice"),
        ),
      );
    const more = make("a", "job-detail-link", t("jobDetails.viewPostDetails"));
    more.href = "#job-post-details";
    section.append(more);
    return section;
  }
  function renderPosts(job, classPrefix = "job-detail", contentLocale = "en") {
    if (!Array.isArray(job?.posts) || !job.posts.length) return null;
    const section = make(
      "section",
      `${classPrefix}-section job-detail-section`,
    );
    section.id = "job-post-details";
    section.append(make("h2", "", t("jobDetails.postWiseDetails")));
    job.posts.forEach((post, postIndex) => {
      const translatedPost = ["hi", "bn"].includes(contentLocale)
        ? job.contentTranslations?.[contentLocale]?.posts?.[postIndex] || {}
        : {};
      const translated = (candidate, source) =>
        typeof candidate === "string" && candidate.trim() ? candidate : source;
      const card = make("details", "job-post-detail");
      card.open = job.posts.length <= 3;
      card.append(make("summary", "job-post-summary", post.name || t("jobDetails.post")));
      const facts = [];
      if (post.code) facts.push(`${t("jobDetails.codeLabel")}: ${post.code}`);
      if (post.groupName) facts.push(post.groupName);
      if (post.vacancyCount != null)
        facts.push(t("jobDetails.vacancyCountForPost", { count: post.vacancyCount }));
      if (post.ageMin != null || post.ageMax != null)
        facts.push(t("jobDetails.ageRange", { minimum: post.ageMin ?? t("jobDetails.any"), maximum: post.ageMax ?? t("jobDetails.any") }));
      else if (post.ageDescription) facts.push(translated(translatedPost.ageDescription, post.ageDescription));
      if (post.salary) {
        const value = Object.values(post.salary).filter(Boolean).map(formatMoney).join(" · ");
        if (value) facts.push(value);
      }
      if (facts.length) card.append(make("p", "", facts.join(" · ")));
      if (post.categoryVacancyBreakdown?.length) {
        card.append(make("h4", "", t("jobDetails.categoryVacancies")));
        const list = make("ul", "");
        post.categoryVacancyBreakdown.forEach((item, rowIndex) =>
          list.append(
            make(
              "li",
              "",
              [
                item.category,
                item.vacancyCount != null
                  ? t("jobDetails.vacancyCountForPost", { count: item.vacancyCount })
                  : null,
                translated(translatedPost.categoryVacancyBreakdown?.[rowIndex]?.notes, item.notes),
              ]
                .filter(Boolean)
                .join(" · "),
            ),
          ),
        );
        card.append(list);
      }
      for (const [label, items] of [
        [
          t("jobDetails.qualifications"),
          (post.qualifications || []).map((x, rowIndex) =>
            [
              x.name,
              x.field,
              x.condition,
              x.minimumMarks && t("jobDetails.minimumMarks", { value: x.minimumMarks }),
              translated(translatedPost.qualifications?.[rowIndex]?.additionalRequirement, x.additionalRequirement),
            ]
              .filter(Boolean)
              .join(" · "),
          ),
        ],
        [
          t("jobDetails.experience"),
          (post.experienceRequirements || []).map((x, rowIndex) =>
            [x.minimumExperience, x.domain, translated(translatedPost.experienceRequirements?.[rowIndex]?.description, x.description)]
              .filter(Boolean)
              .join(" · "),
          ),
        ],
        [t("jobDetails.mandatoryCertifications"), post.mandatoryCertifications || []],
        [t("jobDetails.preferredCertifications"), post.preferredCertifications || []],
        [t("jobDetails.selectionRequirements"), post.selectionRequirements || []],
      ])
        if (items.length) {
          card.append(make("h4", "", label));
          const list = make("ul", "");
          items.forEach((item) => list.append(make("li", "", item)));
          card.append(list);
        }
      for (const [label, value] of [
        [t("jobDetails.additionalRequirements"), translated(translatedPost.additionalRequirements, post.additionalRequirements)],
        [t("jobDetails.postNotes"), translated(translatedPost.postSpecificNotes, post.postSpecificNotes)],
      ])
        if (value) card.append(make("p", "", `${label}: ${value}`));
      section.append(card);
    });
    return section;
  }
  window.JInfoJobContent = {
    renderBlocks,
    renderSections,
    renderDocument,
    renderConditionalFields,
    renderPosts,
  };
})();
