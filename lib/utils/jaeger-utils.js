const JAEGER_BASE_URL = process.env.JAEGER_BASE_URL || 'http://127.0.0.1';

const getJaegerTrace = async(logger, traceId) => {
  if (!process.env.JAEGER_BASE_URL) {
    logger.debug('getJaegerTrace: jaeger integration not installed');
    return null;
  }
  try {
    const response = await fetch(`${JAEGER_BASE_URL}/api/traces/${traceId}`);
    if (!response.ok) {
      logger.error({response}, 'Error retrieving spans');
      return;
    }
    return await response.json();
  } catch (err) {
    const url = `${process.env.JAEGER_BASE_URL}/api/traces/${traceId}`;
    logger.error({err, traceId}, `getJaegerTrace: Error retrieving spans from ${url}`);
  }
};

module.exports = {
  getJaegerTrace
};
