function isOriginAllowed(origin, origins) {
  return !origin || origins.includes(origin);
}

function createCorsOptions(origins) {
  return {
    origin(origin, callback) {
      if (isOriginAllowed(origin, origins)) return callback(null, true);
      return callback(Object.assign(new Error('Origin is not allowed by CORS.'), { status: 403, code: 'CORS_ORIGIN_DENIED' }));
    },
    credentials: true,
  };
}

module.exports = { isOriginAllowed, createCorsOptions };
