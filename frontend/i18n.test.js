const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = __dirname;
const storedValues = new Map();

function loadI18n({ failedLocales = [] } = {}) {
  const listeners = new Map();
  const attributes = [
    ['data-i18n', 'i18n'],
    ['data-i18n-aria-label', 'i18nAriaLabel'],
    ['data-i18n-title', 'i18nTitle'],
    ['data-i18n-placeholder', 'i18nPlaceholder'],
  ];
  const elements = [
    { dataset: { i18n: 'navigation.jobs' }, textContent: '' },
    { dataset: { i18nAriaLabel: 'accessibility.mainNavigation' }, setAttribute(name, value) { this[name] = value; } },
  ];
  const selector = {
    value: '',
    addEventListener(name, callback) { listeners.set(`selector:${name}`, callback); },
  };
  const documentListeners = new Map();
  const document = {
    documentElement: { lang: 'en' },
    querySelector(query) { return query === '#localeSelector' ? selector : null; },
    querySelectorAll(query) {
      const [attribute, dataName] = attributes.find(([name]) => query === `[${name}]`) || [];
      if (!attribute) return [];
      return elements.filter((element) => Object.hasOwn(element.dataset, dataName));
    },
    addEventListener(name, callback) { documentListeners.set(name, callback); },
    dispatchEvent(event) { documentListeners.get(`event:${event.type}`)?.(event); },
  };
  const context = {
    window: {},
    document,
    location: { hostname: 'example.test', pathname: '/' },
    localStorage: {
      getItem(key) { return storedValues.get(key) ?? null; },
      setItem(key, value) { storedValues.set(key, value); },
    },
    fetch: async (url) => ({
      ok: !failedLocales.includes(url.split('/').at(-1).replace('.json', '')),
      json: async () => JSON.parse(fs.readFileSync(path.join(root, url), 'utf8')),
    }),
    Intl,
    CustomEvent: class CustomEvent { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } },
    console,
  };
  context.document.dispatchEvent = (event) => {
    context.dispatched ||= [];
    context.dispatched.push(event);
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'i18n.js'), 'utf8'), context, { filename: 'i18n.js' });
  documentListeners.get('DOMContentLoaded')();
  return { api: context.window.SetBGetI18n, context, elements, selector, listeners };
}

test('locale catalogs, language persistence, document language, formatting and plural lookup work', async () => {
  storedValues.clear();
  const { api, context, elements, selector, listeners } = loadI18n();
  await api.ready;
  assert.equal(api.locale, 'en');
  assert.equal(context.document.documentElement.lang, 'en');
  assert.equal(api.t('navigation.jobs'), 'Jobs');

  selector.value = 'hi';
  listeners.get('selector:change')();
  assert.equal(context.document.documentElement.lang, 'hi');
  assert.equal(storedValues.get('setbget_locale'), 'hi');
  assert.equal(elements[0].textContent, 'नौकरियाँ');
  assert.equal(elements[1]['aria-label'], 'मुख्य नेविगेशन');
  assert.match(api.t('applications.tracked', { count: 3 }), /3/);
  assert.match(api.formatDate('2026-10-04T00:00:00Z', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }), /2026/);
  assert.equal(api.formatCurrency(1200, 'INR').includes('₹'), true);

  const reloaded = loadI18n();
  await reloaded.api.ready;
  assert.equal(reloaded.api.locale, 'hi');
  assert.equal(reloaded.context.document.documentElement.lang, 'hi');
  assert.equal(reloaded.selector.value, 'hi');
  reloaded.api.setLocale('bn');
  assert.equal(reloaded.api.t('navigation.home'), 'হোম');
  assert.equal(reloaded.api.intlLocale, 'bn-IN');
  assert.equal(reloaded.api.formatNumber(1234567), new Intl.NumberFormat('bn-IN').format(1234567));
  assert.equal(reloaded.api.formatCurrency(1200, 'INR'), new Intl.NumberFormat('bn-IN', { style: 'currency', currency: 'INR' }).format(1200));
  assert.equal(reloaded.api.formatDate('2026-10-04T00:00:00Z', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }), new Intl.DateTimeFormat('bn-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date('2026-10-04T00:00:00Z')));
  assert.equal(reloaded.api.pluralCategory(1), new Intl.PluralRules('bn-IN').select(1));
  assert.equal(reloaded.api.t('not.a.real.key'), 'not.a.real.key');
});

test('supported locale codes map to their India regional formatting locales', async () => {
  storedValues.clear();
  const { api } = loadI18n();
  await api.ready;
  assert.deepEqual(Array.from(api.supportedLocales), ['en', 'hi', 'bn']);
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /<option value="en">English<\/option>/);
  assert.match(html, /<option value="hi">हिन्दी<\/option>/);
  assert.match(html, /<option value="bn">বাংলা<\/option>/);
  for (const [code, expected] of [['en', 'en-IN'], ['hi', 'hi-IN'], ['bn', 'bn-IN']]) {
    api.setLocale(code);
    assert.equal(api.locale, code);
    assert.equal(api.intlLocale, expected);
  }
});

test('English strings are used if a selected locale catalog cannot be loaded', async () => {
  storedValues.clear();
  const { api } = loadI18n({ failedLocales: ['hi'] });
  await api.ready;
  api.setLocale('hi');
  assert.equal(api.t('navigation.jobs'), 'Jobs');
});
