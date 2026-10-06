const test = require('node:test');
const assert = require('node:assert/strict');
const { job, jobDraft } = require('./schemas');
const { rankRelated, mergeContentTranslations } = require('../services/job.service');
const pid = '64b000000000000000000001';
const proseKey = '1b18ebd2-e9ee-4f0d-995c-48f9e10506a1';
const base = (extra = {}) => ({ title: 'Recruitment notice', organization: 'Public Board', ...extra });
const block = (type, data) => ({ type, data });

test('draft jobs accept an empty document without title or organization while complete-job schema stays strict', () => {
  assert.equal(jobDraft.safeParse({ contentDocument: [] }).success, true);
  assert.equal(jobDraft.safeParse({ contentDocument: [], title: '', organization: '' }).success, true);
  assert.equal(job.safeParse({ contentDocument: [] }).success, false);
});

test('job translations accept bounded Hindi and Bengali explanatory fields', () => {
  const result = jobDraft.safeParse({
    contentTranslations: {
      hi: {
        description: 'हिंदी में विवरण',
        importantDates: [{ description: 'आवेदन की जानकारी' }],
        qualifications: [{ additionalRequirement: 'अतिरिक्त योग्यता', notes: 'ध्यान दें' }],
        howToApplySteps: ['आवेदन करें'],
      },
      bn: { salaryInfo: { description: 'বেতনের ব্যাখ্যা' } },
    },
  });
  assert.equal(result.success, true);
});

test('job translations reject unsupported locales, protected fields, and unknown shapes', () => {
  for (const contentTranslations of [
    { en: { description: 'English copy' } },
    { hi: { title: 'Translated title' } },
    { bn: { importantLinks: [{ url: 'https://example.org' }] } },
    { hi: { contentDocument: [{ type: 'p', text: 'Translated rich content' }] } },
    { hi: { description: 'A'.repeat(20001) } },
    { hi: { howToApplySteps: Array.from({ length: 101 }, () => 'Apply') } },
    { hi: {} },
  ]) {
    assert.equal(jobDraft.safeParse({ contentTranslations }).success, false);
  }
});

test('partial translation updates retain the other language and existing locale fields', () => {
  assert.deepEqual(
    mergeContentTranslations(
      { hi: { description: 'पुराना विवरण', qualification: 'पुरानी योग्यता', contentDocument: { [proseKey]: 'पुराना पाठ' } }, bn: { description: 'পুরোনো বিবরণ', contentDocument: { [proseKey]: 'পুরোনো লেখা' } } },
      { hi: { description: 'नया विवरण', contentDocument: { [proseKey]: 'नया पाठ' } } },
    ),
    { hi: { description: 'नया विवरण', qualification: 'पुरानी योग्यता', contentDocument: { [proseKey]: 'नया पाठ' } }, bn: { description: 'পুরোনো বিবরণ', contentDocument: { [proseKey]: 'পুরোনো লেখা' } } },
  );
});

test('rich document translations accept only marked source text runs', () => {
  const contentDocument = [{ type: 'p', content: [{ type: 'span', text: 'Apply online.', translationKey: proseKey }] }];
  assert.equal(jobDraft.safeParse({ contentDocument, contentTranslations: { hi: { contentDocument: { [proseKey]: 'ऑनलाइन आवेदन करें।' } }, bn: { contentDocument: { [proseKey]: 'অনলাইনে আবেদন করুন।' } } } }).success, true);
  assert.equal(jobDraft.safeParse({ contentDocument, contentTranslations: { hi: { contentDocument: { [proseKey]: 'ऑनलाइन आवेदन करें।' } } } }).success, true);
  assert.equal(jobDraft.safeParse({ contentDocument, contentTranslations: { bn: { contentDocument: { [proseKey]: 'অনলাইনে আবেদন করুন।' } } } }).success, true);
  assert.equal(jobDraft.safeParse({ contentDocument, contentTranslations: { hi: { contentDocument: { '1b18ebd2-e9ee-4f0d-995c-48f9e10506a2': 'অন্য রান' } } } }).success, false);
  assert.equal(jobDraft.safeParse({ contentDocument: [{ type: 'p', translationKey: proseKey, text: 'Not a span' }] }).success, false);
  assert.equal(jobDraft.safeParse({ contentDocument: [{ type: 'span', translationKey: proseKey, text: 'Has protected metadata', attrs: { href: 'https://example.org/' } }] }).success, false);
  assert.equal(jobDraft.safeParse({ contentDocument, contentTranslations: { hi: { contentDocument: { [proseKey]: ' ' } } } }).success, false);
  assert.equal(jobDraft.safeParse({ contentDocument, contentTranslations: { hi: { contentDocument: { arbitrary: 'text' } } } }).success, false);
  assert.equal(jobDraft.safeParse({ contentDocument, contentTranslations: { hi: { contentDocument: { [proseKey]: { text: 'nested' } } } } }).success, false);
  assert.equal(jobDraft.safeParse({ contentDocument, contentTranslations: { en: { contentDocument: { [proseKey]: 'Unsupported locale' } } } }).success, false);
  assert.equal(jobDraft.safeParse({ contentDocument, contentTranslations: { hi: { contentDocument: { [proseKey]: 'x'.repeat(20001) } } } }).success, false);
  const oversized = Object.fromEntries(Array.from({ length: 26 }, (_, index) => [`1b18ebd2-e9ee-4f0d-995c-48f9e10506${String(index).padStart(2, '0')}`, 'x'.repeat(20000)]));
  const manyRuns = Object.keys(oversized).map((key) => ({ type: 'span', text: 'x', translationKey: key }));
  assert.equal(jobDraft.safeParse({ contentDocument: manyRuns, contentTranslations: { hi: { contentDocument: oversized } } }).success, false);
});

test('Author Save Draft payload with a UUID text run and Hindi/Bengali sparse maps validates as sent', () => {
  const key = '8b18ebd2-e9ee-4f0d-995c-48f9e10506a1';
  const authorSavePayload = {
    contentDocument: [
      { type: 'h2', attrs: { id: 'heading-application-steps' }, content: [{ type: 'span', text: 'Application steps' }] },
      { type: 'p', content: [{ type: 'span', translationKey: key, text: 'Submit the application online.' }] },
      { type: 'p', content: [{ type: 'a', attrs: { href: 'https://example.gov/apply' }, content: [{ type: 'span', text: 'Apply online' }] }] },
    ],
    contentTranslations: {
      hi: { contentDocument: { [key]: 'आवेदन ऑनलाइन जमा करें।' } },
      bn: { contentDocument: { [key]: 'অনলাইনে আবেদন জমা দিন।' } },
    },
  };
  const result = jobDraft.safeParse(JSON.parse(JSON.stringify(authorSavePayload)));
  assert.equal(result.success, true, result.success ? '' : JSON.stringify(result.error.issues));
  assert.deepEqual(result.data.contentDocument, authorSavePayload.contentDocument);
  assert.deepEqual(result.data.contentTranslations, authorSavePayload.contentTranslations);
});

test('document translation keys are unique and may not be attached to factual structures', () => {
  assert.equal(jobDraft.safeParse({ contentDocument: [{ type: 'span', text: 'one', translationKey: proseKey }, { type: 'span', text: 'two', translationKey: proseKey }] }).success, false);
  assert.equal(jobDraft.safeParse({ contentDocument: [{ type: 'td', text: '240', translationKey: proseKey }] }).success, false);
  assert.equal(jobDraft.safeParse({ contentDocument: [{ type: 'span', text: 'Visit', translationKey: proseKey }], contentTranslations: { hi: { contentDocument: {} } } }).success, true);
});

test('job content architecture accepts single and multi-post legacy recruitment data', () => {
  assert.equal(job.safeParse(base({ vacancyCount: 1, qualification: '12th Pass' })).success, true);
  assert.equal(job.safeParse(base({ posts: [{ name: 'Clerk' }, { name: 'Data Entry Operator' }] })).success, true);
});
test('content sections accept mixed paragraph, table, callout, headings and lists', () => {
  const mixed = [block('paragraph',{text:'Eligibility details.'}),block('table',{headers:['Category','Relaxation'],rows:[['SC/ST','5 years']]}),block('callout',{text:'Read the official notice.'})];
  assert.equal(job.safeParse(base({contentSections:[{title:'Age Relaxation',blocks:mixed}]})).success,true);
  assert.equal(job.safeParse(base({contentSections:[{title:'Selection',blocks:[block('heading',{text:'Stage 1'}),block('paragraph',{text:'Written test.'}),block('bulletList',{items:['Reasoning']}),block('table',{headers:['Stage','Marks'],rows:[['Written','100']]}),block('paragraph',{text:'Shortlisting applies.'})]}]})).success,true);
});
test('free-form document content accepts semantic blocks and safe formatting',()=>{
  const contentDocument=[{type:'h1',attrs:{id:'heading-sbi-so-2026'},content:[{type:'strong',text:'SBI SO Recruitment 2026'}]},{type:'p',content:[{type:'span',text:'Apply at '},{type:'a',attrs:{href:'https://example.gov/apply'},content:[{type:'span',text:'official website'}]}]},{type:'ul',content:[{type:'li',content:[{type:'span',text:'Manager'}]}]},{type:'table',content:[{type:'tbody',content:[{type:'tr',content:[{type:'th',content:[{type:'span',text:'Post'}]},{type:'th',content:[{type:'span',text:'Vacancies'}]}]},{type:'tr',content:[{type:'td',content:[{type:'span',text:'Manager'}]},{type:'td',content:[{type:'span',text:'20'}]}]}]}]}];
  assert.equal(job.safeParse(base({contentDocument})).success,true);
});
test('free-form documents reject unsafe URLs, executable tags, and unbounded text',()=>{
  assert.equal(job.safeParse(base({contentDocument:[{type:'a',attrs:{href:'javascript:alert(1)'}}]})).success,false);
  assert.equal(job.safeParse(base({contentDocument:[{type:'script',text:'alert(1)'}]})).success,false);
  assert.equal(job.safeParse(base({contentDocument:[{type:'p',text:'x'.repeat(20001)}]})).success,false);
  assert.equal(job.safeParse(base({contentDocument:[{type:'table',content:[{type:'tbody',content:[{type:'tr',content:[{type:'td'}]},{type:'tr',content:[{type:'td'},{type:'td'}]}]}]}]})).success,false);
});
test('custom tables accept 2 by 3 and 5 by 8 structures without fixed schemas', () => {
  const small={headers:['Category','Fee'],rows:[['General','100'],['SC/ST','0'],['Women','0']]};
  const wide={headers:['Post','Qualification','Experience','Age','Salary'],rows:Array.from({length:8},(_,i)=>[`Post ${i+1}`,'Graduate','None','18–30','As notified'])};
  assert.equal(job.safeParse(base({contentBlocks:[block('table',small),block('table',wide)]})).success,true);
});
test('conditional age may reference an embedded post record', () => {
  const result=job.safeParse(base({posts:[{_id:pid,name:'Clerk',ageMin:18,ageMax:27}],conditionalFields:[{field:'ageLimit',mode:'VARIES',entries:[{postId:pid,value:'18–27 years'}]}]}));
  assert.equal(result.success,true);
});
test('conditional fee supports category and post plus category references', () => {
  assert.equal(job.safeParse(base({conditionalFields:[{field:'applicationFee',mode:'VARIES',entries:[{category:'General',value:'₹100'},{category:'SC/ST',value:'Exempted'}]}]})).success,true);
  assert.equal(job.safeParse(base({posts:[{_id:pid,name:'Clerk'}],conditionalFields:[{field:'applicationFee',mode:'VARIES',entries:[{postId:pid,category:'General',value:'₹100'}]}]})).success,true);
});
test('paragraph-only and multiple mixed sections need no table', () => {
  assert.equal(job.safeParse(base({contentSections:[{title:'Instructions',blocks:[block('paragraph',{text:'Apply online.'})]},{title:'Steps',blocks:[block('steps',{items:['Register','Apply']})]}]})).success,true);
});
test('structured content rejects empty paragraphs, lists, rows, unnamed columns and malformed links', () => {
  for(const content of [block('paragraph',{text:' '}),block('numberedList',{items:[]}),block('table',{headers:[''],rows:[['x']]}),block('table',{headers:['A'],rows:[['']]}),block('externalLink',{label:'Notice',url:'javascript:alert(1)'})]) {
    assert.equal(job.safeParse(base({contentBlocks:[content]})).success,false);
  }
});
test('related ranking returns at most three published matches and excludes the current job', () => {
  const current={_id:'current',board:'b1',category:'exam',organization:'Org',tags:['clerk']};
  const candidates=[
    {_id:'current',status:'PUBLISHED',board:'b1'},
    {_id:'draft',status:'DRAFT',board:'b1'},
    {_id:'same-board',status:'PUBLISHED',board:'b1'},
    {_id:'same-category',status:'PUBLISHED',category:'exam'},
    {_id:'same-tags',status:'PUBLISHED',tags:['clerk']},
    {_id:'other',status:'PUBLISHED',organization:'Elsewhere'},
  ];
  const results=rankRelated(current,candidates,3);
  assert.deepEqual(results.map(item=>item._id),['same-board','same-category','same-tags']);
  assert.equal(results.some(item=>item._id==='current'),false);
  assert.equal(results.length<=3,true);
});
