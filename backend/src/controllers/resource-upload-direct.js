const crypto = require('crypto');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const { Resource } = require('../models');
const { env } = require('../config/env');
const { AppError, success } = require('../utils/http');

const FILES = Object.freeze({ pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' });
const TYPES = new Set(['SYLLABUS','PYQ','MOCK_TEST','STUDY_MATERIAL','HOW_TO_APPLY','OTHER']);
const MAX_BYTES = 15 * 1024 * 1024;

function verifyUploadReceipt(supplied, publicId, secret, sign = cloudinary.utils.api_sign_request) {
  if (!supplied.version) throw new AppError(400, 'INVALID_UPLOAD_SIGNATURE', 'Cloudinary did not verify the uploaded file.');
  const expected = sign({ public_id: publicId, version: supplied.version }, secret);
  const actual = String(supplied.signature || '');
  if (actual.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected)))
    throw new AppError(400, 'INVALID_UPLOAD_SIGNATURE', 'Cloudinary did not verify the uploaded file.');
}

function validateCloudinaryAsset(uploaded, publicId) {
  const ext = String(uploaded?.format || '').toLowerCase();
  if (uploaded?.public_id !== publicId || !FILES[ext] || !uploaded.secure_url || !Number.isFinite(uploaded.bytes) || uploaded.bytes < 1 || uploaded.bytes > MAX_BYTES)
    throw new AppError(400, 'INVALID_FILE_CONTENT', 'The uploaded file does not meet the file type or 15 MB size requirements.');
  return ext;
}

function configure() {
  cloudinary.config({ cloud_name: env.cloudinaryName, api_key: env.cloudinaryKey, api_secret: env.cloudinarySecret, secure: true });
}
function settings(req) {
  if (!env.cloudinaryName || !env.cloudinaryKey || !env.cloudinarySecret) throw new AppError(503, 'UPLOAD_PROVIDER_NOT_CONFIGURED', 'Cloudinary is not fully configured on the server.');
  const ext = path.extname(String(req.body.fileName || '')).toLowerCase().slice(1);
  if (!FILES[ext]) throw new AppError(400, 'INVALID_FILE_TYPE', 'Only PDF and image files are allowed.');
  if (!req.body.title || !TYPES.has(req.body.type)) throw new AppError(400, 'RESOURCE_METADATA_REQUIRED', 'Provide a title and valid resource type.');
  if (req.body.accessMode && !['INLINE','DOWNLOAD'].includes(req.body.accessMode)) throw new AppError(400, 'INVALID_ACCESS_MODE', 'Choose a valid resource access mode.');
  return { ext, mimeType: FILES[ext] };
}
async function ownedResource(req) {
  if (!req.body.resourceId) return null;
  const existing = await Resource.findById(req.body.resourceId);
  if (!existing) throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Resource not found.');
  if (req.user.role === 'AUTHOR' && String(existing.author) !== String(req.user._id)) throw new AppError(403, 'FORBIDDEN', 'Authors can edit only their own resources.');
  return existing;
}
async function createSignature(req, res) {
  const { ext } = settings(req);
  await ownedResource(req);
  configure();
  const timestamp = Math.floor(Date.now() / 1000);
  const params = {
    timestamp,
    public_id: `j-info/resources/${crypto.randomUUID()}`,
    allowed_formats: 'pdf,png,jpg,jpeg,webp',
    ...(req.body.accessMode === 'DOWNLOAD' ? { flags: 'attachment' } : {}),
  };
  const signature = cloudinary.utils.api_sign_request(params, env.cloudinarySecret);
  const intents = require('mongoose').connection.db.collection('resource_upload_intents');
  await intents.deleteMany({ expiresAt: { $lte: new Date() } });
  const publicId = params.public_id;
  await intents.insertOne({
    _id: publicId,
    userId: req.user._id,
    resourceId: req.body.resourceId || null,
    title: String(req.body.title).trim(),
    type: req.body.type,
    description: req.body.description || '',
    accessMode: req.body.accessMode === 'DOWNLOAD' ? 'DOWNLOAD' : 'INLINE',
    fileName: path.basename(String(req.body.fileName)).slice(0, 255),
    mimeType: FILES[ext],
    board: req.body.board || null,
    job: req.body.job || null,
    exam: req.body.exam || '',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    status: 'PENDING',
  });
  success(res, {
    cloudName: env.cloudinaryName,
    apiKey: env.cloudinaryKey,
    uploadUrl: `https://api.cloudinary.com/v1_1/${encodeURIComponent(env.cloudinaryName)}/auto/upload`,
    params,
    signature,
  });
}

async function completeUpload(req, res) {
  const supplied = req.body.cloudinaryUpload || {};
  const publicId = String(supplied.public_id || '');
  if (!/^j-info\/resources\/[a-f0-9-]{36}$/i.test(publicId)) throw new AppError(400, 'INVALID_UPLOAD_REFERENCE', 'The uploaded file reference is invalid.');
  const intents = require('mongoose').connection.db.collection('resource_upload_intents');
  const intent = await intents.findOneAndUpdate(
    { _id: publicId, userId: req.user._id, expiresAt: { $gt: new Date() }, status: 'PENDING' },
    { $set: { status: 'FINALIZING' } },
    { returnDocument: 'after' },
  );
  const uploadIntent = intent?.value || intent;
  if (!uploadIntent) throw new AppError(400, 'UPLOAD_INTENT_EXPIRED', 'The upload session expired or has already been used. Start the upload again.');
  configure();
  let uploaded;
  try {
    verifyUploadReceipt(supplied, publicId, env.cloudinarySecret);
    uploaded = await cloudinary.api.resource(publicId, { resource_type: supplied.resource_type });
    const ext = validateCloudinaryAsset(uploaded, publicId);
    const existing = uploadIntent.resourceId
      ? await Resource.findById(uploadIntent.resourceId)
      : null;
    if (uploadIntent.resourceId && !existing) throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Resource not found.');
    if (existing && req.user.role === 'AUTHOR' && String(existing.author) !== String(req.user._id)) throw new AppError(403, 'FORBIDDEN', 'Authors can edit only their own resources.');
    const values = {
      title: uploadIntent.title,
      type: uploadIntent.type,
      description: uploadIntent.description,
      sourceType: 'UPLOAD',
      externalUrl: undefined,
      url: undefined,
      accessMode: uploadIntent.accessMode,
      fileName: uploadIntent.fileName,
      board: uploadIntent.board || undefined,
      job: uploadIntent.job || undefined,
      exam: uploadIntent.exam || undefined,
      author: req.user._id,
      cloudinaryUrl: uploaded.secure_url,
      cloudinaryPublicId: publicId,
      cloudinaryResourceType: uploaded.resource_type,
      mimeType: FILES[ext],
      size: uploaded.bytes,
    };
    let resource;
    if (existing) {
      const oldId = existing.cloudinaryPublicId;
      const oldType = existing.cloudinaryResourceType;
      Object.assign(existing, values);
      resource = await existing.save();
      if (oldId) await cloudinary.uploader.destroy(oldId, { resource_type: oldType || 'raw' }).catch(() => {});
    } else {
      resource = await Resource.create(values);
    }
    await intents.deleteOne({ _id: publicId, userId: req.user._id });
    return success(res, resource, existing ? 200 : 201);
  } catch (error) {
    await cloudinary.uploader.destroy(publicId, { resource_type: supplied.resource_type || 'raw' }).catch(() => {});
    await intents.deleteOne({ _id: publicId, userId: req.user._id }).catch(() => {});
    if (error instanceof AppError) throw error;
    console.error({ event: 'cloudinary_upload_finalize_failure', code: error.http_code || error.code || 'PROVIDER_ERROR' });
    throw new AppError(502, 'CLOUDINARY_UPLOAD_FAILED', 'The uploaded file could not be verified or saved. Please try again.');
  }
}

async function abortUpload(req, res) {
  const supplied = req.body.cloudinaryUpload || {};
  const publicId = String(supplied.public_id || '');
  if (!/^j-info\/resources\/[a-f0-9-]{36}$/i.test(publicId)) throw new AppError(400, 'INVALID_UPLOAD_REFERENCE', 'The uploaded file reference is invalid.');
  const intents = require('mongoose').connection.db.collection('resource_upload_intents');
  const intent = await intents.findOne({ _id: publicId, userId: req.user._id, expiresAt: { $gt: new Date() } });
  if (!intent) return success(res, { aborted: false });
  configure();
  verifyUploadReceipt(supplied, publicId, env.cloudinarySecret);
  await cloudinary.uploader.destroy(publicId, { resource_type: supplied.resource_type || 'raw' });
  await intents.deleteOne({ _id: publicId, userId: req.user._id });
  return success(res, { aborted: true });
}

module.exports = { createSignature, completeUpload, abortUpload, verifyUploadReceipt, validateCloudinaryAsset, FILES, MAX_BYTES };
