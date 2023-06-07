const logger = require('../logger');

const JAMBONES_REDIS_SENTINELS = process.env.JAMBONES_REDIS_SENTINELS ? {
  sentinels: process.env.JAMBONES_REDIS_SENTINELS.split(',').map((sentinel) => {
    let host, port = 26379;
    if (sentinel.includes(':')) {
      const arr = sentinel.split(':');
      host = arr[0];
      port = parseInt(arr[1], 10);
    } else {
      host = sentinel;
    }
    return {host, port};
  }),
  name: process.env.JAMBONES_REDIS_SENTINEL_MASTER_NAME,
  ...(process.env.JAMBONES_REDIS_SENTINEL_PASSWORD && {
    password: process.env.JAMBONES_REDIS_SENTINEL_PASSWORD
  }),
  ...(process.env.JAMBONES_REDIS_SENTINEL_USERNAME && {
    username: process.env.JAMBONES_REDIS_SENTINEL_USERNAME
  })
} : null;

const {
  retrieveCall,
  deleteCall,
  listCalls,
  listSortedSets,
  purgeCalls,
  retrieveSet,
  addKey,
  retrieveKey,
  deleteKey,
  incrKey,
  client: redisClient,
} = require('@jambonz/realtimedb-helpers')(JAMBONES_REDIS_SENTINELS || {
  host: process.env.JAMBONES_REDIS_HOST || 'localhost',
  port: process.env.JAMBONES_REDIS_PORT || 6379
}, logger);

module.exports = {
  retrieveCall,
  deleteCall,
  listCalls,
  listSortedSets,
  purgeCalls,
  retrieveSet,
  addKey,
  retrieveKey,
  deleteKey,
  redisClient,
  incrKey
};
