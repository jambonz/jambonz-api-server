const debug = require('debug')('jambonz:api-server');
const bent = require('bent');
const basicAuth = (apiKey) => {
  const header = `Bearer ${apiKey}`;
  return {Authorization: header};
};
const postJSON = bent(process.env.HOMER_BASE_URL || 'http://127.0.0.1', 'POST', 'json', 200, 201);
const postPcap = bent(process.env.HOMER_BASE_URL || 'http://127.0.0.1', 'POST', 200, {
  'Content-Type': 'application/json',
  'Accept': 'application/json, text/plain, */*',
});
const SEVEN_DAYS_IN_MS = (1000 * 3600 * 24 * 7);

const getHomerApiKey = async(logger) => {
  if (!process.env.HOMER_BASE_URL || !process.env.HOMER_USERNAME || !process.env.HOMER_PASSWORD) {
    logger.debug('getHomerApiKey: Homer integration not installed');
  }

  try {
    const obj = await postJSON('/api/v3/auth', {
      username: process.env.HOMER_USERNAME,
      password: process.env.HOMER_PASSWORD
    });
    debug(obj);
    logger.debug({obj}, `getHomerApiKey for user ${process.env.HOMER_USERNAME}`);
    return obj.token;
  } catch (err) {
    debug(err);
    logger.info({err}, `getHomerApiKey: Error retrieving apikey for user ${process.env.HOMER_USERNAME}`);
  }
};

const getHomerSipTrace = async(logger, apiKey, callId) => {
  if (!process.env.HOMER_BASE_URL || !process.env.HOMER_USERNAME || !process.env.HOMER_PASSWORD) {
    logger.debug('getHomerSipTrace: Homer integration not installed');
  }
  try {
    const now = Date.now();
    const obj = await postJSON('/api/v3/call/transaction', {
      param: {
        transaction: {
          call: true
        },
        search: {
          '1_call': {
            callid: [callId]
          }
        },
      },
      timestamp: {
        from: now - SEVEN_DAYS_IN_MS,
        to: now
      }
    }, basicAuth(apiKey));
    return obj;
  } catch (err) {
    logger.info({err}, `getHomerSipTrace: Error retrieving messages for callid ${callId}`);
  }
};

const getHomerPcap = async(logger, apiKey, callIds) => {
  if (!process.env.HOMER_BASE_URL || !process.env.HOMER_USERNAME || !process.env.HOMER_PASSWORD) {
    logger.debug('getHomerPcap: Homer integration not installed');
  }
  try {
    const now = Date.now();
    const stream = await postPcap('/api/v3/export/call/messages/pcap', {
      param: {
        transaction: {
          call: true
        },
        search: {
          '1_call': {
            callid: callIds
          }
        },
      },
      timestamp: {
        from: now - SEVEN_DAYS_IN_MS,
        to: now
      }
    }, basicAuth(apiKey));
    return stream;
  } catch (err) {
    logger.info({err}, `getHomerPcap: Error retrieving messages for callid ${callIds}`);
  }
};

module.exports = {
  getHomerApiKey,
  getHomerSipTrace,
  getHomerPcap
};
