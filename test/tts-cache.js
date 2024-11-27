const test = require('tape') ;
const jwt = require('jsonwebtoken');
const ADMIN_TOKEN = '38700987-c7a4-4685-a5bb-af378f9734de';
const authAdmin = {bearer: ADMIN_TOKEN};
const request = require('request-promise-native').defaults({
  baseUrl: 'http://127.0.0.1:3000/v1'
});
const crypto = require('crypto');
const logger = require('../lib/logger');

const {
  client,
} = require('@jambonz/speech-utils')({
  host: process.env.JAMBONES_REDIS_HOST,
  port: process.env.JAMBONES_REDIS_PORT || 6379
}, logger);

function makeSynthKey({account_sid = '', vendor, language, voice, engine = '', text}) {
  const hash = crypto.createHash('sha1');
  hash.update(`${language}:${vendor}:${voice}:${engine}:${text}`);
  return `tts${account_sid ? (':' + account_sid) : ''}:${hash.digest('hex')}`;
}

test('tts-cache', async(t) => {
  const app = require('../app');
  try {
    // clear cache to start
    let result = await request.delete('/TtsCache', {
      auth: authAdmin,
      resolveWithFullResponse: true,
    });
    t.ok(result.statusCode === 204, 'successfully purged cache for start of test');

    // create caches
    const minRecords = 8;
    for (const i in Array(minRecords).fill(0)) {
      await client.set(makeSynthKey({vendor: i, language: i, voice: i, engine: i, text: i}), i);
    }

    result = await request.get('/TtsCache', {
      auth: authAdmin,
      json: true,
    });
    //console.log(result);

    t.ok(result.size === minRecords, 'get cache correctly');

    result = await request.delete('/TtsCache', {
      auth: authAdmin,
      resolveWithFullResponse: true,
    });
    t.ok(result.statusCode === 204, 'successfully purged cache');

    result = await request.get('/TtsCache', {
      auth: authAdmin,
      json: true,
    });

    t.ok(result.size === 0, 'deleted cache successfully');
  } catch(err) {
    console.error(err);
    t.end(err);
  }
});