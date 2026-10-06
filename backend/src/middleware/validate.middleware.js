const { AppError } = require('../utils/http');
function validate(schema, source = 'body') { return (req, res, next) => { const result = schema.safeParse(req[source]); if (!result.success) return next(Object.assign(new Error('Request validation failed.'), { status: 400, code: 'VALIDATION_ERROR', details: { ...result.error.flatten(), issues: result.error.issues.map(issue => ({ path: issue.path, message: issue.message })) } })); req[source] = result.data; next(); }; }
module.exports = { validate };
