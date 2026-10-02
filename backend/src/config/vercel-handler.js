function createVercelHandler({ application, initialize }) {
  let initialization;
  return async function vercelHandler(req, res) {
    try {
      if (!initialization) {
        initialization = Promise.resolve().then(initialize).catch(error => {
          initialization = undefined;
          throw error;
        });
      }
      await initialization;
      return application(req, res);
    } catch (error) {
      console.error({ event: 'vercel_function_initialization_failure', errorType: error.name || 'Error', code: error.code || 'STARTUP_ERROR' });
      if (res.headersSent) return;
      res.statusCode = 503;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'Service is temporarily unavailable.' } }));
    }
  };
}

module.exports = { createVercelHandler };
