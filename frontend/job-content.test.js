const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class TestNode {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.attributes = {};
    this.style = {};
    this.className = '';
    this.dataset = {};
    this.listeners = {};
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  append(...nodes) {
    for (const node of nodes) {
      if (node?.tagName === '#DOCUMENT-FRAGMENT') this.children.push(...node.children);
      else this.children.push(node);
    }
  }
  prepend(...nodes) { this.children.unshift(...nodes); }
  addEventListener(type, handler) { (this.listeners[type] ||= []).push(handler); }
  dispatch(type) { (this.listeners[type] || []).forEach((handler) => handler({ target: this })); }
  set textContent(value) { this.children = []; this._text = String(value); }
  get textContent() { return (this._text || '') + this.children.map((child) => child.textContent).join(''); }
}

function contentApi() {
  const labels = {
    'jobDetails.tableOfContentsAria': 'Table of contents',
    'jobDetails.tableOfContents': 'On this page',
    'jobDetails.contentLanguage': 'Job content language',
    'jobDetails.contentLanguageOriginal': 'Original (English)',
    'jobDetails.contentLanguageHindi': 'हिन्दी',
    'jobDetails.contentLanguageBengali': 'বাংলা',
  };
  const i18n = { locale: 'bn', t: (key) => labels[key] || key };
  const window = { SetBGetI18n: i18n };
  const document = {
    createElement: (tag) => new TestNode(tag),
    createDocumentFragment: () => new TestNode('#document-fragment'),
  };
  const context = { window, document, URL };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'job-content.js'), 'utf8'), context, { filename: 'job-content.js' });
  return { api: window.JInfoJobContent, i18n };
}

function descendants(node, tagName) {
  return [ ...(node.tagName === tagName ? [node] : []), ...node.children.flatMap((child) => descendants(child, tagName)) ];
}

const id = '8b18ebd2-e9ee-4f0d-995c-48f9e10506a1';
const linkId = '619429fe-6e5b-4f1b-9241-61b267453f52';
const hindiId = '28f32abc-7bd1-4e21-98a1-36c9c95e1f2a';
const bengaliId = 'f8fbb2f8-5b28-4ddf-9c2c-36c9c95e1f2a';
const source = [
  { type: 'h2', attrs: { id: 'heading-guidance' }, content: [{ type: 'span', text: 'Application guidance', translationKey: id }] },
  { type: 'p', content: [{ type: 'span', text: 'This English-only run stays English.' }] },
  { type: 'p', content: [{ type: 'span', text: 'Hindi-only source.', translationKey: hindiId }] },
  { type: 'p', content: [{ type: 'span', text: 'Bengali-only source.', translationKey: bengaliId }] },
  { type: 'p', content: [{ type: 'span', text: 'Use the ' }, { type: 'a', attrs: { href: 'https://example.gov/notice.pdf' }, content: [{ type: 'span', text: 'official notification', translationKey: linkId }] }] },
  { type: 'table', content: [{ type: 'tbody', content: [{ type: 'tr', content: [{ type: 'td', content: [{ type: 'span', text: '240' }] }] }] }] },
];

function render(translations = {}) {
  const { api } = contentApi();
  return api.renderDocument(source, { contentTranslations: translations });
}

function runText(run) { return run.children.find((child) => child.className === 'job-document-translation-run')?.textContent; }
function selectors(root) { return descendants(root, 'SELECT'); }
function options(select) { return select.children.map((option) => [option.value, option.textContent]); }
function choose(select, locale) { select.value = locale; select.dispatch('change'); }

test('no stored translation renders normally without a content-language control', () => {
  const original = render();
  assert.equal(selectors(original).length, 0);
  assert.equal(descendants(original, 'P')[0].textContent, 'This English-only run stays English.');
});

test('Hindi-only and Bengali-only runs expose only their stored language and switch independently', () => {
  const hindi = render({ hi: { [hindiId]: 'हिंदी स्रोत।' } });
  const hindiSelect = selectors(hindi)[0];
  assert.deepEqual(options(hindiSelect), [['en', 'Original (English)'], ['hi', 'हिन्दी']]);
  assert.equal(runText(descendants(hindi, 'P')[1]), 'Hindi-only source.');
  choose(hindiSelect, 'hi');
  assert.equal(runText(descendants(hindi, 'P')[1]), 'हिंदी स्रोत।');
  assert.equal(descendants(hindi, 'P')[0].textContent, 'This English-only run stays English.');
  assert.equal(descendants(descendants(hindi, 'P')[0], 'SELECT').length, 0);

  const bengali = render({ bn: { [bengaliId]: 'বাংলা উৎস।' } });
  const bengaliSelect = selectors(bengali)[0];
  assert.deepEqual(options(bengaliSelect), [['en', 'Original (English)'], ['bn', 'বাংলা']]);
  choose(bengaliSelect, 'bn');
  assert.equal(runText(descendants(bengali, 'P')[2]), 'বাংলা উৎস।');
});

test('both stored languages are available and two translated runs keep independent selection state', () => {
  const rendered = render({
    hi: { [hindiId]: 'हिंदी स्रोत।', [id]: 'हिंदी शीर्षक' },
    bn: { [id]: 'বাংলা শিরোনাম' },
  });
  const controls = selectors(rendered);
  assert.equal(controls.length, 2);
  assert.deepEqual(options(controls[0]), [['en', 'Original (English)'], ['hi', 'हिन्दी'], ['bn', 'বাংলা']]);
  assert.deepEqual(options(controls[1]), [['en', 'Original (English)'], ['hi', 'हिन्दी']]);
  choose(controls[1], 'hi');
  assert.equal(runText(descendants(rendered, 'P')[1]), 'हिंदी स्रोत।');
  const heading = descendants(rendered, 'H2').find((item) => item.id === 'heading-guidance');
  assert.equal(runText(heading), 'Application guidance');
  choose(controls[0], 'bn');
  assert.equal(runText(heading), 'বাংলা শিরোনাম');
  assert.equal(runText(descendants(rendered, 'P')[1]), 'हिंदी स्रोत।');
});

test('rich text preserves links and heading anchors while translated run controls stay outside links', () => {
  const originalSnapshot = JSON.stringify(source);
  const rendered = render({
    hi: { [id]: 'आवेदन संबंधी मार्गदर्शन', [linkId]: 'आधिकारिक अधिसूचना' },
    bn: { [id]: 'আবেদনের নির্দেশিকা', [linkId]: 'সরকারি বিজ্ঞপ্তি' },
  });
  const heading = descendants(rendered, 'H2').find((item) => item.id === 'heading-guidance');
  const tocLink = descendants(rendered, 'A').find((item) => item.href === '#heading-guidance');
  const link = descendants(rendered, 'A').find((item) => item.href === 'https://example.gov/notice.pdf');
  const selects = selectors(rendered);

  assert.equal(selects.length, 2);
  assert.equal(descendants(link, 'SELECT').length, 0, 'interactive control must not be nested in an anchor');
  choose(selects[0], 'hi');
  assert.equal(runText(heading), 'आवेदन संबंधी मार्गदर्शन');
  assert.equal(heading.id, 'heading-guidance');
  assert.equal(tocLink.href, '#heading-guidance');
  assert.equal(tocLink.textContent, 'आवेदन संबंधी मार्गदर्शन');
  choose(selects[1], 'bn');
  assert.equal(link.href, 'https://example.gov/notice.pdf');
  assert.equal(runText(link), 'সরকারি বিজ্ঞপ্তি');
  assert.equal(descendants(rendered, 'TABLE').length, 1);
  assert.equal(descendants(rendered, 'TD')[0].textContent, '240');
  assert.equal(JSON.stringify(source), originalSnapshot);
});

test('rich content language selection is independent from global UI language and structured controls remain in job details', () => {
  const { api, i18n } = contentApi();
  const rendered = api.renderDocument(source, {
    contentTranslations: { hi: { [hindiId]: 'हिंदी स्रोत।' } },
  });
  const select = selectors(rendered)[0];
  assert.equal(i18n.locale, 'bn');
  assert.equal(select.value, 'en');
  choose(select, 'hi');
  assert.equal(i18n.locale, 'bn');

  const details = fs.readFileSync(path.join(__dirname, 'job-details.js'), 'utf8');
  assert.match(details, /contentSwitcher\(parent, translations/);
  assert.match(details, /renderDocument\(job\.contentDocument, \{\s*contentTranslations: documentTranslations/);
  assert.doesNotMatch(details, /contentSwitcher\(parent, documentTranslations/);
});

test('renderer keeps legacy static translation-map rendering available without a document selector', () => {
  const { api } = contentApi();
  const rendered = api.renderDocument(source, { translations: { [id]: 'Static translated heading' } });
  assert.equal(descendants(rendered, 'H2').find((item) => item.id === 'heading-guidance').textContent, 'Static translated heading');
  assert.equal(selectors(rendered).length, 0);
});
