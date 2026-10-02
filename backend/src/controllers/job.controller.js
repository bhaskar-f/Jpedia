const { Job, SavedJob, Application, AuditLog } = require('../models');
const { JOB_STATUSES } = require('../constants');
const jobs = require('../services/job.service');
const { success, AppError } = require('../utils/http');
const { pagination, pageMeta } = require('../utils/pagination');
const mongoose = require('mongoose');
const { evaluateJobMatch } = require('../services/jobMatch.service');
const PUBLIC_JOB_FIELDS=['_id','title','slug','organization','board','boardName','category','tags','description','vacancyCount','applicationStartDate','applicationDeadline','examDate','qualification','ageMin','ageMax','ageRelaxation','location','salary','selectionProcess','applicationFee','categoryEligibility','genderEligibility','officialWebsite','officialNotificationUrl','officialApplyUrl','howToApplyYoutubeUrl','source','sourceUrl','syllabusResources','pyqResources','studyResources','mockTestResources','otherResources','importantDates','vacancyBreakdown','ageCutoffDate','ageDescription','ageRelaxations','applicationFees','qualifications','selectionStages','salaryInfo','howToApplySteps','importantLinks','contentDocument','contentBlocks','contentSections','conditionalFields','documentsRequired','importantInstructions','posts','postGroups','status'];
const publicJob=job=>{const value=typeof job.toObject==='function'?job.toObject():job;return Object.fromEntries(PUBLIC_JOB_FIELDS.filter(key=>value[key]!==undefined).map(key=>[key,value[key]]));};
const list = async (req,res) => { const privileged=['ADMIN','SUPER_ADMIN'].includes(req.user?.role);const result = await jobs.list(req.query, privileged?req.user.role:undefined);const data=privileged?result.data:result.data.map(publicJob);success(res, data, 200, { pagination: result.pagination }); };
const listMine = async (req,res) => { const {page,limit,skip}=pagination(req.query);const filter=req.user.role==='AUTHOR'?{author:req.user._id}:{};if(req.query.status){if(!JOB_STATUSES.includes(req.query.status))throw new AppError(400,'INVALID_STATUS','Choose a valid job status.');filter.status=req.query.status;}if(req.query.category)filter.category=new RegExp(String(req.query.category).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i');if(req.query.q){const q=new RegExp(String(req.query.q).trim().replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i');filter.$or=[{title:q},{organization:q},{boardName:q},{category:q}];}const [data,total]=await Promise.all([Job.find(filter).populate('board','name slug').populate('source','name').sort({updatedAt:-1}).skip(skip).limit(limit),Job.countDocuments(filter)]);success(res,data,200,{pagination:pageMeta(page,limit,total)}); };
const mineSummary = async (req,res) => { const filter=req.user.role==='AUTHOR'?{author:req.user._id}:{};const statuses=['DRAFT','PENDING_REVIEW','REJECTED','PUBLISHED'];const counts=await Promise.all(statuses.map(status=>Job.countDocuments({...filter,status})));const recent=await Job.find(filter).populate('board','name slug').sort({updatedAt:-1}).limit(5).select('title organization board boardName status applicationDeadline createdAt updatedAt');success(res,{counts:Object.fromEntries(statuses.map((status,index)=>[status,counts[index]])),recent}); };
const get = async (req,res) => {
  const job = await Job.findOne({ $or: [{ _id: req.params.id.match(/^[a-f\d]{24}$/i) ? req.params.id : null }, { slug: req.params.id }] })
    .populate('board','name slug description officialWebsite')
    .populate('source','name organization websiteUrl')
    .populate('syllabusResources pyqResources studyResources mockTestResources otherResources','title type description url externalUrl sourceType accessMode fileName mimeType youtubeUrl cloudinaryUrl exam');
  const isOwner=Boolean(req.user?._id&&job?.author&&String(job.author)===String(req.user._id));
  const canSeePrivate = ['ADMIN','SUPER_ADMIN'].includes(req.user?.role) || isOwner;
  if (!job || (!canSeePrivate && !['PUBLISHED','EXPIRED'].includes(job.status))) throw new AppError(404,'JOB_NOT_FOUND','Job not found.');
  if (canSeePrivate) return success(res,job);
  success(res,publicJob(job));
};
const getPublic = async (req,res) => {
  const id=req.params.id;
  const job=await Job.findOne({status:{$in:['PUBLISHED','EXPIRED']},$or:[{_id:id.match(/^[a-f\d]{24}$/i)?id:null},{slug:id}]})
    .populate('board','name slug description officialWebsite')
    .populate('source','name organization websiteUrl')
    .populate('syllabusResources pyqResources studyResources mockTestResources otherResources','title type description url externalUrl sourceType accessMode fileName mimeType youtubeUrl cloudinaryUrl exam');
  if(!job)throw new AppError(404,'JOB_NOT_FOUND','Job not found.');
  success(res,publicJob(job));
};
const related = async (req,res) => success(res, await jobs.related(req.params.id));
const recommended = async (req,res) => {
  const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 10));
  const [candidates, applications] = await Promise.all([
    Job.find({ status: 'PUBLISHED', $or: [{ applicationDeadline: null }, { applicationDeadline: { $gte: new Date() } }] }).populate('board','name slug').sort({ applicationDeadline: 1 }).limit(1000).lean(),
    Application.find({ user: req.user._id }).select('job status').lean(),
  ]);
  const tracked = new Map(applications.map(item => [String(item.job), item]));
  const matches = candidates.map(job => ({ job, match: evaluateJobMatch(job, req.user, tracked.get(String(job._id))) }))
    .filter(item => item.match.matched || item.match.level === 'PREFERENCE_MATCH')
    .slice(0, limit)
    .map(({ job, match }) => ({ ...publicJob(job), match }));
  success(res, matches);
};
const create = async (req,res) => success(res, await jobs.create(req.body,req.user),201);
const update = async (req,res) => success(res, await jobs.update(req.params.id,req.body,req.user));
const remove = async (req,res) => { if(!mongoose.isValidObjectId(req.params.id))throw new AppError(400,'INVALID_ID','Invalid record id.');const job = await Job.findById(req.params.id); if (!job) throw new AppError(404,'JOB_NOT_FOUND','Job not found.'); if (req.user.role === 'AUTHOR' && String(job.author) !== String(req.user._id)) throw new AppError(403,'FORBIDDEN','Cannot delete another author’s job.'); if(req.user.role==='ADMIN')throw new AppError(403,'SUPER_ADMIN_REQUIRED','Admins should archive jobs to preserve history.'); if(req.user.role==='AUTHOR'&&!['DRAFT','REJECTED'].includes(job.status))throw new AppError(409,'JOB_LOCKED','Only draft or rejected jobs can be deleted.'); const {Notification,JobDiscovery,Resource}=require('../models');const [saved,applications,notifications,discoveries,resources]=await Promise.all([SavedJob.exists({job:job._id}),Application.exists({job:job._id}),Notification.exists({relatedJob:job._id}),JobDiscovery.exists({matchedJob:job._id}),Resource.exists({job:job._id})]);if(saved||applications||notifications||discoveries||resources)throw new AppError(409,'JOB_IN_USE','This job has saved-job, application, notification, discovery, or resource history and cannot be permanently deleted. Archive it instead.');await Job.findByIdAndDelete(job.id);await AuditLog.create({actor:req.user._id,actorRole:req.user.role,action:'job.deleted',targetType:'Job',targetId:String(job._id),summary:`Deleted ${job.title}`});success(res,{ deleted:true }); };
const submit = async (req,res) => success(res,await jobs.submitReview(req.params.id,req.user));
const publish = async (req,res) => {const published=await jobs.review(req.params.id,req.user,'publish');setImmediate(()=>require('../services/jobAnnouncement.service').announcePublishedJob(published).catch(error=>console.error({event:'job_announcement_failure',errorType:error.name||'Error',code:error.code})));success(res,published);};
const reject = async (req,res) => success(res,await jobs.review(req.params.id,req.user,'reject',req.body.reason));
module.exports = { list,listMine,mineSummary,get,getPublic,related,recommended,create,update,remove,submit,publish,reject };
