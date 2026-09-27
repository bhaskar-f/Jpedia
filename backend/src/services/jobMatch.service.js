const ALL_INDIA = /\ball\s*india\b|\bnationwide\b/i;
const normal = value => String(value || '').normalize('NFKD').replace(/[^a-z0-9]+/gi, ' ').trim().toLowerCase();
const locations = require('../data/india-locations.json');
const indianPlaces = locations.states.flatMap(state => [state.name, ...state.districts]).map(value => normal(value));

function userPreferences(user) {
  const structured=user.preferences||{};
  const location=structured.location||{};
  const education=structured.education||{};
  return {
    boards:(structured.preferredBoards?.length?structured.preferredBoards:user.preferredExams||[]).map(normal),
    categories:(structured.jobCategories?.length?structured.jobCategories:user.preferredJobCategories||[]).map(normal),
    state:normal(location.state||String(user.location||'').split(',')[0]),
    district:normal(location.district||String(user.location||'').split(',')[1]),
    education:[education.level,...(education.degrees||[]),...(education.fields||[]),user.education].filter(Boolean).map(normal),
    dateOfBirth:user.dateOfBirth
  };
}

function preferenceReasons(job,user){
  const p=userPreferences(user), reasons=[];
  const board=normal(job.board?.name||job.boardName||job.board?.slug);
  if(board&&p.boards.some(value=>board.includes(value)||value.includes(board)))reasons.push(`${job.board?.name||job.boardName||'Exam board'} is in your preferred boards`);
  const category=normal([job.category,...(job.tags||[])].filter(Boolean).join(' '));
  if(category&&p.categories.some(value=>category.includes(value)||value.includes(category)||value.split(' ').some(token=>token.length>3&&category.split(' ').includes(token))))reasons.push('The job category matches your preferences');
  const location=String(job.location||'');
  if(ALL_INDIA.test(location))reasons.push('The job is open across India');
  else if(location&&p.state&&normal(location).includes(p.state)){
    if(p.district&&normal(location).includes(p.district))reasons.push(`The job lists ${p.district} in your state`);
    else reasons.push('The job lists your selected state');
  }
  return reasons;
}

function locationConflicts(job,user){
  const p=userPreferences(user), target=normal(job.location);
  if(!target||ALL_INDIA.test(job.location)||!p.state)return false;
  const mentionsState=target.includes(p.state), mentionsDistrict=p.district&&target.includes(p.district);
  const otherPlace=indianPlaces.some(value=>value&&target.includes(value)&&value!==p.state&&value!==p.district);
  return otherPlace&&!mentionsState&&!mentionsDistrict;
}

function qualificationMatches(requirements, profile){
  const candidate=profile.education.join(' ');
  if(!requirements.length||!candidate)return null;
  const labels=requirements.map(item=>normal(typeof item==='string'?item:[item.name,item.field,item.additionalRequirement].filter(Boolean).join(' '))).filter(Boolean);
  if(!labels.length)return null;
  const terms=profile.education.flatMap(value=>value.split(' ')).filter(value=>value.length>2);
  const fieldTerms=terms.filter(value=>!['bachelors','masters','doctoral','diploma','certificate','professional','other'].includes(value));
  return labels.some(label=>candidate.includes(label)||label.includes(candidate)||fieldTerms.some(term=>label.split(' ').includes(term)));
}

function evaluateJobMatch(job,user,application){
  if(locationConflicts(job,user))return {matched:false,level:'INCOMPATIBLE',reasons:[],unknown:[]};
  const reasons=preferenceReasons(job,user);
  if(!reasons.length)return {matched:false,level:'NO_MATCH',reasons:[],unknown:[]};
  if(job.applicationDeadline&&new Date(job.applicationDeadline)<new Date())return {matched:false,level:'CLOSED',reasons,unknown:[]};
  if(application&&application.status!=='NOT_APPLIED')return {matched:false,level:'ALREADY_TRACKED',reasons,unknown:[]};
  const p=userPreferences(user),unknown=[];
  const requirements=(job.qualifications||[]).length?job.qualifications:(job.qualification?[job.qualification]:[]);
  const qualification=qualificationMatches(requirements,p);
  if(qualification===false)return {matched:false,level:'INCOMPATIBLE',reasons,unknown:[]};
  if(qualification===null)unknown.push('qualification could not be evaluated');
  const min=job.ageMin,max=job.ageMax;
  if(min!=null||max!=null){
    if(!p.dateOfBirth)unknown.push('date of birth is not in your profile');
    else {const dob=new Date(p.dateOfBirth),at=job.ageCutoffDate?new Date(job.ageCutoffDate):new Date();let age=at.getFullYear()-dob.getFullYear();if(at.getMonth()<dob.getMonth()||(at.getMonth()===dob.getMonth()&&at.getDate()<dob.getDate()))age--;if(age<(min??0)||age>(max??150))return {matched:false,level:'INCOMPATIBLE',reasons,unknown:[]};reasons.push('Your age is within the recorded range');}
  }
  if(job.genderEligibility)unknown.push('gender eligibility needs review');
  if(job.categoryEligibility?.length)unknown.push('category-based relaxation or reservation needs review');
  const posts=job.posts||[];
  if(posts.some(post=>(post.experienceRequirements||[]).length||(post.mandatoryCertifications||[]).length))unknown.push('experience or certification requirements need review');
  if(job.location&&!ALL_INDIA.test(job.location)&&!p.state)unknown.push('location could not be evaluated');
  if(unknown.length)return {matched:false,level:'PREFERENCE_MATCH',reasons,unknown};
  return {matched:true,level:'POTENTIAL_MATCH',reasons,unknown:[]};
}

module.exports={normal,userPreferences,preferenceReasons,qualificationMatches,locationConflicts,evaluateJobMatch};
