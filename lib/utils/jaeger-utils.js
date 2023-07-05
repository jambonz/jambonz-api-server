const bent = require('bent');
const getJSON = bent(process.env.JAEGER_BASE_URL || 'http://127.0.0.1', 'GET', 'json', 200);

const getJaegerTrace = async(logger, traceId) => {
  if (!process.env.JAEGER_BASE_URL) {
    logger.debug('getJaegerTrace: jaeger integration not installed');
    return null;
  }
  try {
    return await getJSON(`/api/v3/traces/${traceId}`);
  } catch (err) {
    const url = `${process.env.JAEGER_BASE_URL}/api/traces/${traceId}`;
    logger.error({err, traceId}, `getJaegerTrace: Error retrieving spans from ${url}`);
  }
};

module.exports = {
  getJaegerTrace
};
