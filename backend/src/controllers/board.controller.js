const { Board, Job, Resource, Community, RecruitmentSource, AuditLog } = require('../models');
const mongoose = require('mongoose');
const { success, AppError } = require('../utils/http');
const { pagination, pageMeta } = require('../utils/pagination');
const { slugify } = require('../services/source.service');

const PUBLIC_FIELDS = 'name slug shortDescription description about organization category officialWebsite officialNotificationWebsite location icon active createdAt updatedAt';
const publicBoard = board => Object.fromEntries(PUBLIC_FIELDS.split(' ').filter(key => board[key] !== undefined).map(key => [key, board[key]]));
const searchFilter = query => {
  const q = String(query.q || '').trim();
  if (!q) return {};
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const expression = new RegExp(escaped, 'i');
  return { $or: [{ name: expression }, { organization: expression }, { category: expression }] };
};
const normalizedSlug = input => slugify(input || '').slice(0, 120);
async function ensureUniqueSlug(slug, exceptId) {
  if (!slug) throw new AppError(400, 'INVALID_BOARD_SLUG', 'Enter a name that can form a valid board slug.');
  const filter = { slug };
  if (exceptId) filter._id = { $ne: exceptId };
  if (await Board.exists(filter)) throw new AppError(409, 'BOARD_SLUG_TAKEN', 'A board with this slug already exists.');
}

const list = async (req, res) => {
  const { page, limit, skip } = pagination(req.query);
  const filter = { active: true, ...searchFilter(req.query) };
  const [rows, total] = await Promise.all([
    Board.find(filter).select(PUBLIC_FIELDS).sort({ name: 1 }).skip(skip).limit(limit).lean(),
    Board.countDocuments(filter),
  ]);
    success(res, rows.map(board => ({ _id: board._id, ...publicBoard(board) })), 200, { pagination: pageMeta(page, limit, total) });
};

const get = async (req, res) => {
  const slug = req.params.slug.toLowerCase();
  const board = await Board.findOne({ active: true, $or: [{ slug }, { _id: /^[a-f\d]{24}$/i.test(slug) ? slug : null }] }).select(PUBLIC_FIELDS).lean();
  if (!board) throw new AppError(404, 'BOARD_NOT_FOUND', 'Board not found.');
  const { page, limit, skip } = pagination(req.query);
  const filter = { board: board._id, status: 'PUBLISHED' };
  const now = new Date();
  const [jobs, total, upcomingJobs, resources] = await Promise.all([
    Job.find(filter).select('title slug organization category tags applicationDeadline createdAt board').sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    Job.countDocuments(filter),
    Job.find({ ...filter, applicationDeadline: { $gte: now } }).select('title slug organization applicationDeadline').sort({ applicationDeadline: 1, _id: 1 }).limit(6).lean(),
    Resource.find({ board: board._id, active: true, type: { $in: ['SYLLABUS', 'PYQ', 'MOCK_TEST', 'STUDY_MATERIAL'] } }).select('title type description url youtubeUrl cloudinaryUrl exam createdAt').sort({ createdAt: -1 }).limit(100).lean(),
  ]);
  success(res, { board: publicBoard(board), jobs, upcomingJobs, resources }, 200, { pagination: pageMeta(page, limit, total) });
};

const listAdmin = async (req, res) => {
  const { page, limit, skip } = pagination(req.query);
  const filter = searchFilter(req.query);
  if (req.query.active === 'true') filter.active = true;
  if (req.query.active === 'false') filter.active = false;
  const [rows, total] = await Promise.all([
    Board.aggregate([
      { $match: filter },
      { $sort: { name: 1, _id: 1 } },
      { $skip: skip },
      { $limit: limit },
      { $lookup: { from: Job.collection.name, let: { boardId: '$_id' }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$board', '$$boardId'] }, { $eq: ['$status', 'PUBLISHED'] }] } } }, { $count: 'count' }], as: 'publishedCount' } },
      { $addFields: { publishedJobs: { $ifNull: [{ $arrayElemAt: ['$publishedCount.count', 0] }, 0] } } },
      { $project: { publishedCount: 0 } },
    ]),
    Board.countDocuments(filter),
  ]);
  success(res, rows, 200, { pagination: pageMeta(page, limit, total) });
};

const getAdmin = async (req, res) => {
  const board = await Board.findById(req.params.id).lean();
  if (!board) throw new AppError(404, 'BOARD_NOT_FOUND', 'Board not found.');
  success(res, board);
};

const create = async (req, res) => {
  const slug = normalizedSlug(req.body.slug || req.body.name);
  await ensureUniqueSlug(slug);
  const board = await Board.create({ ...req.body, slug });
  success(res, board, 201);
};

const update = async (req, res) => {
  const board = await Board.findById(req.params.id);
  if (!board) throw new AppError(404, 'BOARD_NOT_FOUND', 'Board not found.');
  const changes = { ...req.body };
  if (changes.slug !== undefined) {
    changes.slug = normalizedSlug(changes.slug);
    await ensureUniqueSlug(changes.slug, board._id);
  }
  Object.assign(board, changes);
  await board.save();
  success(res, board);
};

const remove = async (req, res) => {
  const board = await Board.findByIdAndUpdate(req.params.id, { active: false }, { new: true });
  if (!board) throw new AppError(404, 'BOARD_NOT_FOUND', 'Board not found.');
  success(res, { archived: true });
};

const removeSafe = async(req,res)=>{
  if(!mongoose.isValidObjectId(req.params.id))throw new AppError(400,'INVALID_ID','Invalid record id.');
  const board=await Board.findById(req.params.id);if(!board)throw new AppError(404,'BOARD_NOT_FOUND','Board not found.');
  const [jobs,communities,resources,sources]=await Promise.all([Job.exists({board:board._id}),Community.exists({board:board._id}),Resource.exists({board:board._id}),RecruitmentSource.exists({board:board._id})]);
  if(jobs||communities||resources||sources)throw new AppError(409,'BOARD_IN_USE','This board is referenced by jobs, communities, resources, or recruitment sources. Deactivate it instead.');
  await Board.deleteOne({_id:board._id});await AuditLog.create({actor:req.user._id,actorRole:req.user.role,action:'BOARD_DELETED',targetType:'Board',targetId:String(board._id),summary:`Permanently deleted unused board ${board.name}`});success(res,{deleted:true});
};

module.exports = { list, get, listAdmin, getAdmin, create, update, remove, removeSafe };
