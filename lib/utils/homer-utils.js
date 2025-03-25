const debug = require('debug')('jambonz:api-server');
const basicAuth = (apiKey) => {
  const header = `Bearer ${apiKey}`;
  return {Authorization: header};
};

const SEVEN_DAYS_IN_MS = (1000 * 3600 * 24 * 7);
const HOMER_BASE_URL = process.env.HOMER_BASE_URL || 'http://127.0.0.1';

const getHomerApiKey = async(logger) => {
  if (!process.env.HOMER_BASE_URL || !process.env.HOMER_USERNAME || !process.env.HOMER_PASSWORD) {
    logger.debug('getHomerApiKey: Homer integration not installed');
  }

  try {
    const response = await fetch(`${HOMER_BASE_URL}/api/v3/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: process.env.HOMER_USERNAME,
        password: process.env.HOMER_PASSWORD
      })
    });
    if (!response.ok) {
      logger.error({response}, 'Error retrieving apikey');
      return;
    }
    const obj = await response.json();
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
    const response = await fetch(`${HOMER_BASE_URL}/api/v3/call/transaction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...basicAuth(apiKey)
      },
      body: JSON.stringify({
        param: {
          transaction: {
            call: true,
            registration: true,
            rest: false
          },
          orlogic: true,
          search: {
            '1_call': {
              callid: [callId]
            },
            '1_registration': {
              callid: [callId]
            }
          },
        },
        timestamp: {
          from: now - SEVEN_DAYS_IN_MS,
          to: now
        }
      })
    });
    if (!response.ok) {
      logger.error({response}, 'Error retrieving messages');
      return;
    }
    const obj = await response.json();
    return obj;
  } catch (err) {
    logger.info({err}, `getHomerSipTrace: Error retrieving messages for callid ${callId}`);
  }
};

const getHomerPcap = async(logger, apiKey, callIds, method) => {
  if (!process.env.HOMER_BASE_URL || !process.env.HOMER_USERNAME || !process.env.HOMER_PASSWORD) {
    logger.debug('getHomerPcap: Homer integration not installed');
  }
  try {
    const now = Date.now();
    const response = await fetch(`${HOMER_BASE_URL}/api/v3/export/call/messages/pcap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...basicAuth(apiKey)
      },
      body: JSON.stringify({
        param: {
          transaction: {
            call: method === 'invite',
            registration: method === 'register',
            rest: false
          },
          orlogic: true,
          search: {
            ...(method === 'invite' && {
              '1_call': {
                callid: callIds
              }
            })
            ,
            ...(method === 'register' && {
              '1_registration': {
                callid: callIds
              }
            })
          },
        },
        timestamp: {
          from: now - SEVEN_DAYS_IN_MS,
          to: now
        }
      })
    });
    if (!response.ok) {
      logger.error({response}, 'Error retrieving messages');
      return;
    }
    return response.body;
  } catch (err) {
    logger.info({err}, `getHomerPcap: Error retrieving messages for callid ${callIds}`);
  }
};

module.exports = {
  getHomerApiKey,
  getHomerSipTrace,
  getHomerPcap
};
