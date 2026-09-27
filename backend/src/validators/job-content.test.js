const test = require('node:test');
const assert = require('node:assert/strict');
const { job } = require('./schemas');
const { rankRelated } = require('../services/job.service');
const pid = '64b000000000000000000001';
const base = (extra = {}) => ({ title: 'Recruitment notice', organization: 'Public Board', ...extra });
const block = (type, data) => ({ type, data });

test('job content architecture accepts single and multi-post legacy recruitment data', () => {
  assert.equal(job.safeParse(base({ vacancyCount: 1, qualification: '12th Pass' })).success, true);
  assert.equal(job.safeParse(base({ posts: [{ name: 'Clerk' }, { name: 'Data Entry Operator' }] })).success, true);
});
test('content sections accept mixed paragraph, table, callout, headings and lists', () => {
  const mixed = [block('paragraph',{text:'Eligibility details.'}),block('table',{headers:['Category','Relaxation'],rows:[['SC/ST','5 years']]}),block('callout',{text:'Read the official notice.'})];
  assert.equal(job.safeParse(base({contentSections:[{title:'Age Relaxation',blocks:mixed}]})).success,true);
  assert.equal(job.safeParse(base({contentSections:[{title:'Selection',blocks:[block('heading',{text:'Stage 1'}),block('paragraph',{text:'Written test.'}),block('bulletList',{items:['Reasoning']}),block('table',{headers:['Stage','Marks'],rows:[['Written','100']]}),block('paragraph',{text:'Shortlisting applies.'})]}]})).success,true);
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
