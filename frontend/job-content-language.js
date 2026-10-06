(() => {
  const locales = ["hi", "bn"];

  function hasText(value) {
    if (typeof value === "string") return Boolean(value.trim());
    if (Array.isArray(value)) return value.some(hasText);
    if (value && typeof value === "object") return Object.values(value).some(hasText);
    return false;
  }

  function available(translations) {
    return locales.filter((locale) => hasText(translations?.[locale]));
  }

  function initialLocale(uiLocale, translations) {
    const choices = available(translations);
    return locales.includes(uiLocale) && choices.includes(uiLocale)
      ? uiLocale
      : "en";
  }

  function value(translation, source) {
    return hasText(translation) ? translation : source;
  }

  window.SetBGetJobContentLanguage = Object.freeze({
    hasText,
    available,
    initialLocale,
    value,
  });
})();
