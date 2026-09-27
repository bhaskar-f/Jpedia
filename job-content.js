(() => {
  const make = (tag, cls, value) => { const node=document.createElement(tag); if(cls)node.className=cls; if(value!=null)node.textContent=String(value); return node; };
  const safeUrl = value => { try { const url=new URL(value); return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password?url.href:null; } catch { return null; } };
  function renderBlocks(blocks, classPrefix='job-detail') {
    const fragment=document.createDocumentFragment();
    for(const block of Array.isArray(blocks)?blocks:[]) {
      const d=block?.data||{}; let node;
      if(block.type==='heading'&&d.text?.trim()) node=make('h3',`${classPrefix}-block-heading`,d.text);
      else if(block.type==='paragraph'&&d.text?.trim()) node=make('p',`${classPrefix}-paragraph`,d.text);
      else if(block.type==='callout'&&d.text?.trim()) {node=make('aside',`${classPrefix}-callout`,d.text); if(d.tone)node.dataset.tone=d.tone.toLowerCase();}
      else if(['bulletList','numberedList','steps'].includes(block.type)&&d.items?.some(x=>String(x).trim())) {node=make(block.type==='bulletList'?'ul':'ol',`${classPrefix}-list`); d.items.filter(x=>String(x).trim()).forEach(x=>node.append(make('li','',x)));}
      else if(block.type==='table'&&d.headers?.length&&d.rows?.length) {const wrap=make('div',`${classPrefix}-table-wrap`);if(d.title)wrap.append(make('h4','',d.title));const table=make('table',`${classPrefix}-data-table`),thead=make('thead'),tr=make('tr');d.headers.forEach(h=>tr.append(make('th','',h)));thead.append(tr);table.append(thead);const body=make('tbody');d.rows.filter(row=>row.some(cell=>String(cell).trim())).forEach(row=>{const r=make('tr');d.headers.forEach((_,i)=>r.append(make('td','',row[i]||'')));body.append(r);});table.append(body);wrap.append(table);if(d.note)wrap.append(make('p',`${classPrefix}-table-note`,d.note));node=wrap;}
      else if(block.type==='keyValueList'&&d.items?.length) {node=make('dl',`${classPrefix}-key-values`);if(d.title)node.append(make('h4','',d.title));d.items.filter(x=>x.key?.trim()&&x.value?.trim()).forEach(x=>node.append(make('dt','',x.key),make('dd','',x.value)));}
      else if(['link','externalLink','youtube'].includes(block.type)) {const href=safeUrl(d.url);if(href){node=make('p',`${classPrefix}-external-link`);const a=make('a','',d.label||d.caption||(block.type==='youtube'?'Watch on YouTube':'Open link'));a.href=href;a.target='_blank';a.rel='noopener noreferrer';node.append(a);if(d.description)node.append(make('span','',` — ${d.description}`));}}
      else if(block.type==='image') {const src=safeUrl(d.url);if(src){node=make('figure',`${classPrefix}-image`);const img=make('img');img.src=src;img.alt=d.alt||d.caption||'Recruitment information';img.loading='lazy';node.append(img);if(d.caption)node.append(make('figcaption','',d.caption));}}
      else if(block.type==='divider') node=make('hr',`${classPrefix}-divider`);
      if(node)fragment.append(node);
    }
    return fragment;
  }
  function renderSections(sections, legacyBlocks=[]) {
    const root=document.createElement('div'); root.className='job-detail-custom-sections';
    const all=[...(Array.isArray(sections)?sections:[])]; if(!all.length&&Array.isArray(legacyBlocks)&&legacyBlocks.length)all.push({title:'Additional Information',blocks:legacyBlocks});
    all.forEach(item=>{const blocks=renderBlocks(item.blocks);if(!blocks.childNodes.length)return;const section=make('section','job-detail-section');if(item.title?.trim())section.append(make('h2','',item.title));section.append(blocks);root.append(section);});
    return root;
  }
  function renderConditionalFields(job) {
    const fields=Array.isArray(job?.conditionalFields)?job.conditionalFields.filter(item=>item.mode==='VARIES'):[];
    if(!fields.length)return null;const section=make('section','job-detail-section job-detail-variations');section.append(make('h2','','Post / Category Variations'));
    const list=make('ul','job-detail-list');const labels={vacancyCount:'Vacancy Count',qualification:'Qualification',ageLimit:'Age Limit',salary:'Salary',applicationFee:'Application Fee',location:'Location',experience:'Experience',selectionProcess:'Selection Process'};
    fields.forEach(field=>{(field.entries||[]).forEach(entry=>{if(!entry.value)return;const post=job.posts?.find(item=>String(item._id)===String(entry.postId));const who=[post?.name,entry.category].filter(Boolean).join(' · ');list.append(make('li','',`${labels[field.field]||field.field}${who?` · ${who}`:''}: ${entry.value}`));});});
    if(list.children.length)section.append(list);else section.append(make('p','job-detail-paragraph','Values vary by post or category. See the post-wise details below.'));const more=make('a','job-detail-link','View Post-wise Details');more.href='#job-post-details';section.append(more);return section;
  }
  function renderPosts(job, classPrefix='job-detail') {
    if(!Array.isArray(job?.posts)||!job.posts.length)return null;const section=make('section',`${classPrefix}-section job-detail-section`);section.id='job-post-details';section.append(make('h2','','Post-wise Details'));
    job.posts.forEach(post=>{const card=make('details','job-post-detail');card.open=job.posts.length<=3;card.append(make('summary','job-post-summary',post.name||'Post'));const facts=[];if(post.code)facts.push(`Code: ${post.code}`);if(post.groupName)facts.push(post.groupName);if(post.vacancyCount!=null)facts.push(`${post.vacancyCount} vacancies`);if(post.ageMin!=null||post.ageMax!=null)facts.push(`Age ${post.ageMin??'Any'}–${post.ageMax??'Any'}`);else if(post.ageDescription)facts.push(post.ageDescription);if(post.salary){const value=Object.values(post.salary).filter(Boolean).join(' · ');if(value)facts.push(value);}if(facts.length)card.append(make('p','',facts.join(' · ')));
      if(post.categoryVacancyBreakdown?.length){card.append(make('h4','','Category Vacancies'));const list=make('ul','');post.categoryVacancyBreakdown.forEach(item=>list.append(make('li','',[item.category,item.vacancyCount!=null?`${item.vacancyCount} vacancies`:null,item.notes].filter(Boolean).join(' · '))));card.append(list);}
      for(const [label,items] of [['Qualifications',(post.qualifications||[]).map(x=>[x.name,x.field,x.condition,x.minimumMarks&&`Minimum marks ${x.minimumMarks}`,x.additionalRequirement].filter(Boolean).join(' · '))],['Experience',(post.experienceRequirements||[]).map(x=>[x.minimumExperience,x.domain,x.description].filter(Boolean).join(' · '))],['Mandatory certifications',post.mandatoryCertifications||[]],['Preferred certifications',post.preferredCertifications||[]],['Selection requirements',post.selectionRequirements||[]]])if(items.length){card.append(make('h4','',label));const list=make('ul','');items.forEach(item=>list.append(make('li','',item)));card.append(list);}
      for(const [label,value] of [['Additional requirements',post.additionalRequirements],['Post notes',post.postSpecificNotes]])if(value)card.append(make('p','',`${label}: ${value}`));section.append(card);
    });return section;
  }
  window.JInfoJobContent={renderBlocks,renderSections,renderConditionalFields,renderPosts};
})();
