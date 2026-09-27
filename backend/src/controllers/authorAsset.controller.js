const { AuthorAsset, Board, AuditLog } = require('../models');
const { AppError, success } = require('../utils/http');
const mongoose = require('mongoose');

function validateTemplateBoard(data) {
  if (!data || !Object.prototype.hasOwnProperty.call(data, 'defaultBoardId')) return;
  const id = data.defaultBoardId;
  if (id === '' || id === null) { data.defaultBoardId = ''; return; }
  if (!mongoose.isValidObjectId(id)) throw new AppError(400, 'INVALID_TEMPLATE_BOARD', 'Choose a valid default board.');
  return Board.findOne({ _id: id, active: true }).then(board => {
    if (!board) throw new AppError(400, 'INVALID_TEMPLATE_BOARD', 'The default board must exist and be active.');
  });
}

const list = async (req, res) => {
  const filter=req.assetType==='TEMPLATE'?{type:req.assetType}:{author:req.user._id,type:req.assetType};
  const data = await AuthorAsset.find(filter).populate('author','name role').sort({ updatedAt: -1 });
  success(res, data);
};
const create = async (req, res) => {
  if(req.assetType==='TEMPLATE') await validateTemplateBoard(req.body.data);
  const item=await AuthorAsset.create({ ...req.body, author: req.user._id, type: req.assetType });
  if(req.assetType==='TEMPLATE')await AuditLog.create({actor:req.user._id,actorRole:req.user.role,action:'TEMPLATE_CREATED',targetType:'AuthorAsset',targetId:String(item._id),summary:`Created template ${item.name}`});
  success(res, item, 201);
};
const update = async (req, res) => {
  const filter={_id:req.params.id,type:req.assetType};if(req.user.role==='AUTHOR')filter.author=req.user._id;
  const item = await AuthorAsset.findOne(filter);
  if (!item) throw new AppError(404, 'AUTHOR_ASSET_NOT_FOUND', 'Saved item not found.');
  if(req.assetType==='TEMPLATE') await validateTemplateBoard(req.body.data);
  item.name = req.body.name;
  item.description = req.body.description;
  item.data = req.body.data || {};
  await item.save();
  if(req.assetType==='TEMPLATE')await AuditLog.create({actor:req.user._id,actorRole:req.user.role,action:'TEMPLATE_UPDATED',targetType:'AuthorAsset',targetId:String(item._id),summary:`Updated template ${item.name}`});
  success(res, item);
};
const remove = async (req, res) => {
  const filter={_id:req.params.id,type:req.assetType};if(req.user.role==='AUTHOR')filter.author=req.user._id;
  const result = await AuthorAsset.deleteOne(filter);
  if (!result.deletedCount) throw new AppError(404, 'AUTHOR_ASSET_NOT_FOUND', 'Saved item not found.');
  if(req.assetType==='TEMPLATE')await AuditLog.create({actor:req.user._id,actorRole:req.user.role,action:'TEMPLATE_DELETED',targetType:'AuthorAsset',targetId:String(req.params.id),summary:'Deleted template; jobs created from it are independent.'});
  success(res, { deleted: true });
};
module.exports = { list, create, update, remove };
