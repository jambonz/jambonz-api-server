const logger = require('../logger');

const {
  client,
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
  listConferences
} = require('@jambonz/realtimedb-helpers')({}, logger);

module.exports = {
  client,
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
  incrKey,
  listConferences
};
