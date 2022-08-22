const router = require('express').Router();
const assert = require('assert');
const SpeechCredential = require('../../models/speech-credential');
const sysError = require('../error');
const {decrypt, encrypt} = require('../../utils/encrypt-decrypt');
const {parseAccountSid, parseServiceProviderSid} = require('./utils');
const {DbErrorUnprocessableRequest} = require('../../utils/errors');
const {
  testGoogleTts,
  testGoogleStt,
  testAwsTts,
  testAwsStt,
  testMicrosoftStt,
  testMicrosoftTts,
  testWellSaidTts
} = require('../../utils/speech-utils');

const obscureKey = (key) => {
  const key_spoiler_length = 6;
  const key_spoiler_char = 'X';

  return `${key.slice(0, key_spoiler_length)}${key_spoiler_char.repeat(key.length - key_spoiler_length)}`;
};

const encryptCredential = (obj) => {
  const {
    vendor,
    service_key,
    access_key_id,
    secret_access_key,
    aws_region,
    api_key,
    region
  } = obj;

  switch (vendor) {
    case 'google':
      assert(service_key, 'invalid json key: service_key is required');
      try {
        const o = JSON.parse(service_key);
        assert(o.client_email && o.private_key, 'invalid google service account key');
      }
      catch (err) {
        assert(false, 'invalid google service account key - not JSON');
      }
      return encrypt(service_key);

    case 'aws':
      assert(access_key_id, 'invalid aws speech credential: access_key_id is required');
      assert(secret_access_key, 'invalid aws speech credential: secret_access_key is required');
      assert(aws_region, 'invalid aws speech credential: aws_region is required');
      const awsData = JSON.stringify({aws_region, access_key_id, secret_access_key});
      return encrypt(awsData);

    case 'microsoft':
      assert(region, 'invalid azure speech credential: region is required');
      assert(api_key, 'invalid azure speech credential: api_key is required');
      const azureData = JSON.stringify({region, api_key});
      return encrypt(azureData);

    case 'wellsaid':
      assert(api_key, 'invalid wellsaid speech credential: api_key is required');
      const wsData = JSON.stringify({api_key});
      return encrypt(wsData);

    default:
      assert(false, `invalid or missing vendor: ${vendor}`);
  }
};

router.post('/', async(req, res) => {
  const logger = req.app.locals.logger;
  const {
    use_for_stt,
    use_for_tts,
    vendor,
  } = req.body;
  const account_sid = req.user.account_sid || req.body.account_sid;
  let service_provider_sid;
  if (!account_sid) {
    if (!req.user.hasServiceProviderAuth) {
      logger.error('POST /SpeechCredentials invalid credentials');
      return res.send(403);
    }
    service_provider_sid = parseServiceProviderSid(req);
  }
  try {
    const encrypted_credential = encryptCredential(req.body);
    const uuid = await SpeechCredential.make({
      account_sid,
      service_provider_sid,
      vendor,
      use_for_tts,
      use_for_stt,
      credential: encrypted_credential
    });
    res.status(201).json({sid: uuid});
  } catch (err) {
    sysError(logger, res, err);
  }
});

/**
 * retrieve all speech credentials for an account
 */
router.get('/', async(req, res) => {
  let service_provider_sid;
  const account_sid = parseAccountSid(req);
  if (!account_sid) service_provider_sid = parseServiceProviderSid(req);
  const logger = req.app.locals.logger;
  try {
    const creds = account_sid ?
      await SpeechCredential.retrieveAll(account_sid) :
      await SpeechCredential.retrieveAllForSP(service_provider_sid);

    res.status(200).json(creds.map((c) => {
      const {credential, ...obj} = c;
      if ('google' === obj.vendor) {
        const o = JSON.parse(decrypt(credential));
        const key_header = '-----BEGIN PRIVATE KEY-----\n';
        const obscured = {
          ...o,
          private_key: `${key_header}${obscureKey(o.private_key.slice(key_header.length, o.private_key.length))}`
        };
        obj.service_key = obscured;
      }
      else if ('aws' === obj.vendor) {
        const o = JSON.parse(decrypt(credential));
        obj.access_key_id = o.access_key_id;
        obj.secret_access_key = obscureKey(o.secret_access_key);
        obj.aws_region = o.aws_region;
        logger.info({obj, o}, 'retrieving aws speech credential');
      }
      else if ('microsoft' === obj.vendor) {
        const o = JSON.parse(decrypt(credential));
        obj.api_key = obscureKey(o.api_key);
        obj.region = o.region;
        logger.info({obj, o}, 'retrieving azure speech credential');
      }
      else if ('wellsaid' === obj.vendor) {
        const o = JSON.parse(decrypt(credential));
        obj.api_key = obscureKey(o.api_key);
      }
      return obj;
    }));
  } catch (err) {
    sysError(logger, res, err);
  }
});

/**
 * retrieve a specific speech credential
 */
router.get('/:sid', async(req, res) => {
  const sid = req.params.sid;
  const logger = req.app.locals.logger;
  try {
    const cred = await SpeechCredential.retrieve(sid);
    if (0 === cred.length) return res.sendStatus(404);
    const {credential, ...obj} = cred[0];
    if ('google' === obj.vendor) {
      const o = JSON.parse(decrypt(credential));
      const key_header = '-----BEGIN PRIVATE KEY-----\n';
      const obscured = {
        ...o,
        private_key: `${key_header}${obscureKey(o.private_key.slice(key_header.length, o.private_key.length))}`
      };
      obj.service_key = JSON.stringify(obscured);
    }
    else if ('aws' === obj.vendor) {
      const o = JSON.parse(decrypt(credential));
      obj.access_key_id = o.access_key_id;
      obj.secret_access_key = obscureKey(o.secret_access_key);
      obj.aws_region = o.aws_region;
    }
    else if ('microsoft' === obj.vendor) {
      const o = JSON.parse(decrypt(credential));
      obj.api_key = obscureKey(o.api_key);
      obj.region = o.region;
    }
    else if ('wellsaid' === obj.vendor) {
      const o = JSON.parse(decrypt(credential));
      obj.api_key = obscureKey(o.api_key);
    }
    res.status(200).json(obj);
  } catch (err) {
    sysError(logger, res, err);
  }
});

/**
 * delete a speech credential
 */
router.delete('/:sid', async(req, res) => {
  const sid = req.params.sid;
  const logger = req.app.locals.logger;
  try {
    const count = await SpeechCredential.remove(sid);
    if (0 === count) return res.sendStatus(404);
    res.sendStatus(204);
  } catch (err) {
    sysError(logger, res, err);
  }
});


/**
 * update a speech credential -- we only allow use_for_tts and use_for_stt to be updated
 */
router.put('/:sid', async(req, res) => {
  const sid = req.params.sid;
  const logger = req.app.locals.logger;
  try {
    const {use_for_tts, use_for_stt} = req.body;
    if (typeof use_for_tts === 'undefined' && typeof use_for_stt === 'undefined') {
      throw new DbErrorUnprocessableRequest('use_for_tts and use_for_stt are the only updateable fields');
    }
    const obj = {};
    if (typeof use_for_tts !== 'undefined') {
      obj.use_for_tts = use_for_tts;
    }
    if (typeof use_for_stt !== 'undefined') {
      obj.use_for_stt = use_for_stt;
    }

    /* update the credential if provided */
    try {
      obj.credential = encryptCredential(req.body);
    } catch (err) {}

    const rowsAffected = await SpeechCredential.update(sid, obj);
    if (rowsAffected === 0) {
      return res.sendStatus(404);
    }
    res.status(204).end();
  } catch (err) {
    sysError(logger, res, err);
  }
});


/**
 * Test a credential
 */
router.get('/:sid/test', async(req, res) => {
  const sid = req.params.sid;
  const logger = req.app.locals.logger;
  try {
    const creds = await SpeechCredential.retrieve(sid);
    if (!creds || 0 === creds.length) return res.sendStatus(404);

    const cred = creds[0];
    const credential = JSON.parse(decrypt(cred.credential));
    const results = {
      tts: {
        status: 'not tested'
      },
      stt: {
        status: 'not tested'
      }
    };
    if (cred.vendor === 'google') {
      if (!credential.client_email || !credential.private_key) {
        throw new DbErrorUnprocessableRequest('uploaded file is not a google service key');
      }

      if (cred.use_for_tts) {
        try {
          await testGoogleTts(logger, credential);
          results.tts.status = 'ok';
          SpeechCredential.ttsTestResult(sid, true);
        } catch (err) {
          results.tts = {status: 'fail', reason: err.message};
          SpeechCredential.ttsTestResult(sid, false);
        }
      }

      if (cred.use_for_stt) {
        try {
          await testGoogleStt(logger, credential);
          results.stt.status = 'ok';
          SpeechCredential.sttTestResult(sid, true);
        } catch (err) {
          results.stt = {status: 'fail', reason: err.message};
          SpeechCredential.sttTestResult(sid, false);
        }
      }
    }
    else if (cred.vendor === 'aws') {
      if (cred.use_for_tts) {
        try {
          await testAwsTts(logger, {
            accessKeyId: credential.access_key_id,
            secretAccessKey: credential.secret_access_key,
            region: credential.aws_region || process.env.AWS_REGION
          });
          results.tts.status = 'ok';
          SpeechCredential.ttsTestResult(sid, true);
        } catch (err) {
          results.tts = {status: 'fail', reason: err.message};
          SpeechCredential.ttsTestResult(sid, false);
        }
      }
      if (cred.use_for_stt) {
        try {
          await testAwsStt(logger, {
            accessKeyId: credential.access_key_id,
            secretAccessKey: credential.secret_access_key,
            region: credential.aws_region || process.env.AWS_REGION
          });
          results.stt.status = 'ok';
          SpeechCredential.sttTestResult(sid, true);
        } catch (err) {
          results.stt = {status: 'fail', reason: err.message};
          SpeechCredential.sttTestResult(sid, false);
        }
      }
    }
    else if (cred.vendor === 'microsoft') {
      const {api_key, region} = credential;
      if (cred.use_for_tts) {
        try {
          await testMicrosoftTts(logger, {api_key, region});
          results.tts.status = 'ok';
          SpeechCredential.ttsTestResult(sid, true);
        } catch (err) {
          results.tts = {status: 'fail', reason: err.message};
          SpeechCredential.ttsTestResult(sid, false);
        }
      }
      if (cred.use_for_stt) {
        try {
          await testMicrosoftStt(logger, {api_key, region});
          results.stt.status = 'ok';
          SpeechCredential.sttTestResult(sid, true);
        } catch (err) {
          results.stt = {status: 'fail', reason: err.message};
          SpeechCredential.sttTestResult(sid, false);
        }
      }
    }
    else if (cred.vendor === 'wellsaid') {
      const {api_key} = credential;
      if (cred.use_for_tts) {
        try {
          await testWellSaidTts(logger, {api_key});
          results.tts.status = 'ok';
          SpeechCredential.ttsTestResult(sid, true);
        } catch (err) {
          results.tts = {status: 'fail', reason: err.message};
          SpeechCredential.ttsTestResult(sid, false);
        }
      }
    }
    res.status(200).json(results);
  } catch (err) {
    sysError(logger, res, err);
  }
});

module.exports = router;
