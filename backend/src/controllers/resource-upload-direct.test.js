const test = require('node:test');
const assert = require('node:assert/strict');
const { verifyUploadReceipt, validateCloudinaryAsset, MAX_BYTES } = require('./resource-upload-direct');

test('direct Cloudinary upload receipts require an authentic signed asset response', () => {
  const sign = ({ public_id, version }, secret) => `${secret}:${public_id}:${version}`;
  verifyUploadReceipt({ version: 42, signature: 'key:j-info/resources/123e4567-e89b-12d3-a456-426614174000:42' }, 'j-info/resources/123e4567-e89b-12d3-a456-426614174000', 'key', sign);
  assert.throws(() => verifyUploadReceipt({ version: 42, signature: 'bad' }, 'j-info/resources/123e4567-e89b-12d3-a456-426614174000', 'key', sign), { code: 'INVALID_UPLOAD_SIGNATURE' });
});

test('direct Cloudinary uploads retain the 15 MB file/type validation', () => {
  assert.equal(validateCloudinaryAsset({ public_id: 'resource', format: 'pdf', secure_url: 'https://cloudinary.test/file.pdf', bytes: MAX_BYTES }, 'resource'), 'pdf');
  assert.throws(() => validateCloudinaryAsset({ public_id: 'resource', format: 'pdf', secure_url: 'https://cloudinary.test/file.pdf', bytes: MAX_BYTES + 1 }, 'resource'), { code: 'INVALID_FILE_CONTENT' });
  assert.throws(() => validateCloudinaryAsset({ public_id: 'resource', format: 'html', secure_url: 'https://cloudinary.test/file.html', bytes: 4 }, 'resource'), { code: 'INVALID_FILE_CONTENT' });
});
