const {
  addKey: addKeyRedis,
  deleteKey: deleteKeyRedis,
  retrieveKey: retrieveKeyRedis,
} = require('./realtimedb-helpers');
const { hashString } = require('../utils/password-utils');
const logger = require('../logger');

class CacheClient {
  constructor() { }

  async set(params) {
    const {
      redisKey,
      value = '1',
      time = 3600,
    } = params || {};

    try {
      await addKeyRedis(redisKey, value, time);

    } catch (err) {
      logger.error('CacheClient.get set', {
        error: {
          message: err.message,
          name: err.name
        },
        ...params
      });
    }
  }

  async get(redisKey) {
    try {
      const result = await retrieveKeyRedis(redisKey);
      return result;
    } catch (err) {
      logger.error('CacheClient.get error', {
        error: {
          message: err.message,
          name: err.name
        },
        redisKey
      });
    }
  }


  async delete(key) {
    try {
      await deleteKeyRedis(key);
      logger.debug('CacheClient.delete key from redis', { key });
    } catch (err) {
      logger.error('CacheClient.delete error', {
        error: {
          message: err.message,
          name: err.name
        },
        key
      });
    }
  }

  generateRedisKey(type, key, version) {
    let suffix = '';
    if (version) {
      suffix = `:version:${version}`;
    }

    switch (type) {
      case 'jwt':
        return `jwt:${hashString(key)}${suffix}`;

      case 'reset-link':
        return `reset-link:${key}`;
      default:
        break;
    }
  }
}

const cacheClient = new CacheClient();

module.exports = { cacheClient };
