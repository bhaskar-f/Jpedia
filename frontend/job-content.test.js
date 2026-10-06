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
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  append(...nodes) { this.children.push(...nodes); }
  prepend(...nodes) { this.children.unshift(...nodes); }
  set textContent(value) { this.children = []; this._text = String(value); }
  get textContent() { return (this._text || '') + this.children.map((child) => child.textContent).join(''); }
}

function contentApi() {
  const window = { SetBGetI18n: { t: (key) => key } };
  const document = { createElement: (tag) => new TestNode(tag) };
  const context = { window, document, URL };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'job-content.js'), 'utf8'), context, { filename: 'job-content.js' });
  return window.JInfoJobContent;
}

function descendants(node, tagName) {
  return [ ...(node.tagName === tagName ? [node] : []), ...node.children.flatMap((child) => descendants(child, tagName)) ];
}

const id = '8b18ebd2-e9ee-4f0d-995c-48f9e10506a1';
const linkId = '619429fe-6e5b-4f1b-9241-61b267453f52';
const source = [
  { type: 'h2', attrs: { id: 'heading-guidance' }, content: [{ type: 'span', text: 'Application guidance', translationKey: id }] },
  { type: 'p', content: [{ type: 'span', text: 'This English-only run stays English.' }] },
  { type: 'p', content: [{ type: 'a', attrs: { href: 'https://example.gov/notice.pdf' }, content: [{ type: 'span', text: 'Official notification', translationKey: linkId }] }] },
  { type: 'table', content: [{ type: 'tbody', content: [{ type: 'tr', content: [{ type: 'td', content: [{ type: 'span', text: '240' }] }] }] }] },
];

test('rich document renderer substitutes stored text only and preserves canonical structure and metadata', () => {
  const api = contentApi();
  const originalSnapshot = JSON.stringify(source);
  const original = api.renderDocument(source);
  const hindi = api.renderDocument(source, { translations: { [id]: 'आवेदन संबंधी मार्गदर्शन', [linkId]: 'आधिकारिक अधिसूचना' } });
  const bengali = api.renderDocument(source, { translations: { [id]: 'আবেদনের নির্দেশিকা' } });

  assert.equal(descendants(original, 'H2').find((item) => item.id === 'heading-guidance').textContent, 'Application guidance');
  assert.equal(descendants(hindi, 'H2').find((item) => item.id === 'heading-guidance').textContent, 'आवेदन संबंधी मार्गदर्शन');
  assert.equal(descendants(bengali, 'H2').find((item) => item.id === 'heading-guidance').textContent, 'আবেদনের নির্দেশিকা');
  assert.equal(descendants(bengali, 'P')[0].textContent, 'This English-only run stays English.');
  const hindiLink = descendants(hindi, 'A').find((item) => item.href === 'https://example.gov/notice.pdf');
  const bengaliLink = descendants(bengali, 'A').find((item) => item.href === 'https://example.gov/notice.pdf');
  assert.equal(hindiLink.textContent, 'आधिकारिक अधिसूचना');
  assert.equal(bengaliLink.textContent, 'Official notification');
  assert.equal(hindiLink.href, 'https://example.gov/notice.pdf');
  assert.equal(descendants(hindi, 'TABLE').length, 1);
  assert.equal(descendants(hindi, 'TR').length, 1);
  assert.equal(descendants(hindi, 'TD')[0].textContent, '240');
  assert.equal(JSON.stringify(source), originalSnapshot);
});
