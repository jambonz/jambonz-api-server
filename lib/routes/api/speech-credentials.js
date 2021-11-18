const router = require('express').Router();
const SpeechCredential = require('../../models/speech-credential');
const sysError = require('../error');
const {decrypt, encrypt} = require('../../utils/encrypt-decrypt');
const {parseAccountSid, parseServiceProviderSid} = require('./utils');
const {DbErrorUnprocessableRequest, DbErrorBadRequest} = require('../../utils/errors');
const {
  testGoogleTts,
  testGoogleStt,
  testAwsTts,
  testAwsStt,
  testMicrosoftStt,
  testMicrosoftTts
} = require('../../utils/speech-utils');

router.post('/', async(req, res) => {
  const logger = req.app.locals.logger;
  const {
    use_for_stt,
    use_for_tts,
    vendor,
    service_key,
    access_key_id,
    secret_access_key,
    aws_region,
    api_key,
    region
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
    let encrypted_credential;
    if (vendor === 'google') {
      let obj;
      if (!service_key) throw new DbErrorBadRequest('invalid json key: service_key is required');
      try {
        obj = JSON.parse(service_key);
        if (!obj.client_email || !obj.private_key) {
          throw new DbErrorBadRequest('invalid google service account key');
        }
      }
      catch (err) {
        throw new DbErrorBadRequest('invalid google service account key - not JSON');
      }
      encrypted_credential = encrypt(service_key);
    }
    else if (vendor === 'aws') {
      const data = JSON.stringify({
        aws_region: aws_region || 'us-east-1',
        access_key_id,
        secret_access_key
      });
      encrypted_credential = encrypt(data);
    }
    else if (vendor === 'microsoft') {
      const data = JSON.stringify({
        region,
        api_key
      });
      encrypted_credential = encrypt(data);
    }
    else throw new DbErrorBadRequest(`invalid speech vendor ${vendor}`);
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
        obj.service_key = decrypt(credential);
      }
      else if ('aws' === obj.vendor) {
        const o = decrypt(credential);
        obj.access_key_id = o.access_key_id;
        obj.secret_access_key = o.secret_access_key;
      }
      else if ('microsoft' === obj.vendor) {
        const o = decrypt(credential);
        obj.api_key = o.api_key;
        obj.region = o.region;
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
      obj.service_key = decrypt(credential);
    }
    else if ('aws' === obj.vendor) {
      const o = JSON.parse(decrypt(credential));
      obj.access_key_id = o.access_key_id;
      obj.secret_access_key = o.secret_access_key;
    }
    else if ('microsoft' === obj.vendor) {
      const o = JSON.parse(decrypt(credential));
      obj.api_key = o.api_key;
      obj.region = o.region;
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
    res.status(200).json(results);
  } catch (err) {
    sysError(logger, res, err);
  }
});

module.exports = router;
