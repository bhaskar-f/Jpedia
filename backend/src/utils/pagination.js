function pagination(query = {}) { const page = Math.max(1, Number(query.page) || 1); const limit = Math.min(100, Math.max(1, Number(query.limit) || 20)); return { page, limit, skip: (page - 1) * limit }; }
function pageMeta(page, limit, total) { return { page, limit, total, hasNextPage: page * limit < total }; }
module.exports = { pagination, pageMeta };
