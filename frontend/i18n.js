(() => {
  "use strict";

  const supportedLocales = ["en", "hi", "bn"];
  const storageKey = "setbget_locale";
  const englishFallback = {
    navigation: {
      home: "Home",
      jobs: "Jobs",
      communities: "Communities",
      services: "Services",
      notifications: "Notifications",
      faqs: "FAQs",
      signIn: "Sign in",
      signInRegister: "Sign in / Register",
      register: "Register",
      dashboard: "Dashboard",
    },
    common: { language: "Language", loading: "Loading..." },
    accessibility: {
      mainNavigation: "Main navigation",
      mobileNavigation: "Mobile navigation",
      languageSelector: "Language",
      showPassword: "Show password",
      hidePassword: "Hide password",
      closeNavigation: "Close navigation",
      openDashboardNavigation: "Open dashboard navigation",
      setbgetHome: "SetBGet Home",
    },
    loading: { publicPage: "Loading SetBGet…" },
    errors: {
      pageUnavailable: "Page unavailable",
      pageLoadFailed: "We could not load this page right now.",
      connectionRetry: "Please check your connection and try again shortly.",
      requestFailed: "Request failed.",
      byCode: {},
    },
  };
  const dictionaries = { en: englishFallback };
  const isDevelopment = ["localhost", "127.0.0.1", "::1"].includes(
    location.hostname,
  );

  function getSavedLocale() {
    try {
      const stored = localStorage.getItem(storageKey);
      return supportedLocales.includes(stored) ? stored : "en";
    } catch {
      return "en";
    }
  }

  let activeLocale = getSavedLocale();
  document.documentElement.lang = activeLocale;
  const localeTag = { en: "en-IN", hi: "hi-IN", bn: "bn-IN" };

  function lookup(dictionary, key) {
    return String(key)
      .split(".")
      .reduce((value, part) => value?.[part], dictionary);
  }

  function interpolate(value, values = {}) {
    if (typeof value !== "string") return value;
    return value.replace(/\{(\w+)\}/g, (match, name) => {
      if (!Object.prototype.hasOwnProperty.call(values, name)) return match;
      const replacement = values[name];
      return typeof replacement === "number" && Number.isFinite(replacement)
        ? new Intl.NumberFormat(localeTag[activeLocale]).format(replacement)
        : String(replacement);
    });
  }

  function pluralCategory(count) {
    return new Intl.PluralRules(localeTag[activeLocale]).select(Number(count));
  }

  function t(key, values = {}) {
    let value = lookup(dictionaries[activeLocale], key);
    if (value === undefined) value = lookup(dictionaries.en, key);
    if (value === undefined) {
      if (isDevelopment)
        console.warn(`[i18n] Missing translation: ${key} (${activeLocale})`);
      return String(key);
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const count = Number(values.count);
      const category = Number.isFinite(count) ? pluralCategory(count) : "other";
      value = value[category] ?? value.other ?? value.one;
    }
    return interpolate(value, values);
  }

  function applyTranslations(root = document) {
    root.querySelectorAll?.("[data-i18n]").forEach((element) => {
      element.textContent = t(element.dataset.i18n);
    });
    for (const [attribute, dataKey] of [
      ["aria-label", "i18nAriaLabel"],
      ["title", "i18nTitle"],
      ["placeholder", "i18nPlaceholder"],
    ]) {
      root
        .querySelectorAll?.(
          `[data-${dataKey.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}]`,
        )
        .forEach((element) =>
          element.setAttribute(attribute, t(element.dataset[dataKey])),
        );
    }
  }

  function setLocale(locale) {
    if (!supportedLocales.includes(locale)) return false;
    activeLocale = locale;
    document.documentElement.lang = locale;
    try {
      localStorage.setItem(storageKey, locale);
    } catch {
      /* Storage may be disabled. */
    }
    const selector = document.querySelector("#localeSelector");
    if (selector && selector.value !== locale) selector.value = locale;
    applyTranslations();
    document.dispatchEvent(
      new CustomEvent("setbget:localechange", { detail: { locale } }),
    );
    return true;
  }

  function formatDate(value, options = {}) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat(localeTag[activeLocale], options).format(
      date,
    );
  }

  function formatNumber(value, options = {}) {
    const number = Number(value);
    return Number.isFinite(number)
      ? new Intl.NumberFormat(localeTag[activeLocale], options).format(number)
      : "";
  }

  function formatCurrency(value, currency = "INR", options = {}) {
    const number = Number(value);
    return Number.isFinite(number)
      ? new Intl.NumberFormat(localeTag[activeLocale], {
          style: "currency",
          currency,
          ...options,
        }).format(number)
      : "";
  }

  function errorKey(error) {
    if (error?.code) return `errors.byCode.${error.code}`;
    if (error?.status) return `errors.http.${error.status}`;
    return "errors.requestFailed";
  }

  const ready = Promise.all(
    supportedLocales.map(async (locale) => {
      try {
        const response = await fetch(`/locales/${locale}.json`, {
          credentials: "same-origin",
        });
        if (!response.ok)
          throw new Error(
            `Could not load ${locale} catalog (${response.status})`,
          );
        dictionaries[locale] = await response.json();
      } catch (error) {
        if (isDevelopment) console.warn(`[i18n] ${error.message}`);
      }
    }),
  ).then(() => {
    document.documentElement.lang = activeLocale;
    applyTranslations();
    document.dispatchEvent(
      new CustomEvent("setbget:catalogsready", {
        detail: { locale: activeLocale },
      }),
    );
    return activeLocale;
  });

  window.SetBGetI18n = Object.freeze({
    supportedLocales: Object.freeze([...supportedLocales]),
    get locale() {
      return activeLocale;
    },
    get intlLocale() {
      return localeTag[activeLocale];
    },
    ready,
    t,
    setLocale,
    applyTranslations,
    formatDate,
    formatNumber,
    formatCurrency,
    pluralCategory,
    errorKey,
  });

  document.addEventListener(
    "DOMContentLoaded",
    () => {
      const selector = document.querySelector("#localeSelector");
      if (selector) {
        selector.value = activeLocale;
        selector.addEventListener("change", () => setLocale(selector.value));
      }
      if (location.pathname.startsWith("/admin")) {
        const label = document.querySelector(".locale-selector-label");
        if (label) label.hidden = true;
      }
    },
    { once: true },
  );
})();
