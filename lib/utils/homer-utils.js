const debug = require('debug')('jambonz:api-server');
const { Pool } = require('pg');
const basicAuth = (apiKey) => {
  const header = `Bearer ${apiKey}`;
  return {Authorization: header};
};
const { Readable } = require('stream');
const SEVEN_DAYS_IN_MS = (1000 * 3600 * 24 * 7);
const HOMER_BASE_URL = process.env.HOMER_BASE_URL || 'http://127.0.0.1';

let homerPool = null;
const getHomerPool = () => {
  if (!homerPool && process.env.HOMER_DB_HOST) {
    homerPool = new Pool({
      host: process.env.HOMER_DB_HOST,
      port: parseInt(process.env.HOMER_DB_PORT || '5432', 10),
      user: process.env.HOMER_DB_USER,
      password: process.env.HOMER_DB_PASSWORD,
      database: process.env.HOMER_DB_NAME || 'homer_data',
      ssl: process.env.HOMER_DB_SSLMODE === 'disable' ? false : undefined,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return homerPool;
};

/**
 * Expand a single Call-ID to include all correlated Call-IDs found in Homer.
 * Looks for rows in hep_proto_1_call where:
 *   - the row's callid matches the requested id, OR
 *   - the row's X-CID correlation_id matches the requested id
 * Returns an array of unique Call-IDs (always includes the original).
 */
const expandHomerCallIds = async(logger, callId) => {
  const pool = getHomerPool();
  if (!pool) {
    logger.debug('expandHomerCallIds: Homer DB not configured, using single callId');
    return [callId];
  }
  try {
    /*
     * Two-hop expansion:
     *   Hop 1 — direct: rows whose callid OR correlation_id equals the requested id.
     *   Hop 2 — sibling: rows that share a correlation_id with any hop-1 row
     *            (but whose correlation_id differs from the requested id, avoiding
     *             the self-referential "correlation_id = callid" rows that heplify writes).
     * This is needed because the jambonz call chain uses a common original carrier
     * call-id as the correlation_id on both the SBC-FS leg and the FS-carrier leg,
     * so the two legs are siblings rather than parent/child.
     */
    const result = await pool.query(
      `SELECT DISTINCT data_header->>'callid' AS callid
       FROM hep_proto_1_call
       WHERE data_header->>'callid' = $1
          OR protocol_header->>'correlation_id' = $1
          OR protocol_header->>'correlation_id' IN (
               SELECT DISTINCT protocol_header->>'correlation_id'
               FROM hep_proto_1_call
               WHERE data_header->>'callid' = $1
                 AND protocol_header->>'correlation_id' != $1
             )`,
      [callId]
    );
    const ids = result.rows
      .map((r) => r.callid)
      .filter(Boolean);
    const expanded = [...new Set([callId, ...ids])];
    if (expanded.length > 1) {
      logger.info({callId, expanded}, 'expandHomerCallIds: found correlated Call-IDs');
    }
    return expanded;
  } catch (err) {
    logger.warn({err, callId}, 'expandHomerCallIds: DB query failed, falling back to single callId');
    return [callId];
  }
};

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
    const callIds = await expandHomerCallIds(logger, callId);
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
              callid: callIds
            },
            '1_registration': {
              callid: callIds
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
    const baseCallId = Array.isArray(callIds) ? callIds[0] : callIds;
    const inputIds = Array.isArray(callIds) ? callIds : [callIds];
    const expandedSets = await Promise.all(inputIds.map((id) => expandHomerCallIds(logger, id)));
    const allIds = [...new Set(expandedSets.flat())];
    if (allIds.length > inputIds.length) {
      logger.info({baseCallId, allIds}, 'getHomerPcap: expanded to correlated Call-IDs');
    }
    const resolvedCallIds = allIds;
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
                callid: resolvedCallIds
              }
            }),
            ...(method === 'register' && {
              '1_registration': {
                callid: resolvedCallIds
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
    return Readable.fromWeb(response.body);
  } catch (err) {
    logger.info({err}, `getHomerPcap: Error retrieving messages for callid ${baseCallId}`);
  }
};

module.exports = {
  expandHomerCallIds,
  getHomerApiKey,
  getHomerSipTrace,
  getHomerPcap
};
