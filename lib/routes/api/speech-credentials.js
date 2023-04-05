const router = require('express').Router();
const assert = require('assert');
const Account = require('../../models/account');
const SpeechCredential = require('../../models/speech-credential');
const sysError = require('../error');
const {decrypt, encrypt} = require('../../utils/encrypt-decrypt');
const {parseAccountSid, parseServiceProviderSid, parseSpeechCredentialSid} = require('./utils');
const {DbErrorUnprocessableRequest, DbErrorForbidden} = require('../../utils/errors');
const {
  testGoogleTts,
  testGoogleStt,
  testAwsTts,
  testAwsStt,
  testMicrosoftStt,
  testMicrosoftTts,
  testWellSaidTts,
  testNuanceStt,
  testNuanceTts,
  testDeepgramStt,
  testSonioxStt,
  testIbmTts,
  testIbmStt
} = require('../../utils/speech-utils');
const {promisePool} = require('../../db');

const validateAdd = async(req) => {
  const account_sid = parseAccountSid(req) ? parseAccountSid(req) : req.user.account_sid;
  const service_provider_sid = parseServiceProviderSid(req);

  if (service_provider_sid) {
    if (req.user.hasServiceProviderAuth && service_provider_sid !== req.user.service_provider_sid) {
      throw new DbErrorForbidden('Insufficient privileges');
    }
    if (req.user.hasAccountAuth && service_provider_sid !== req.user.service_provider_sid &&
      req.body.account_sid !== req.user.account_sid) {
      throw new DbErrorForbidden('Insufficient privileges');
    }
  }

  if (account_sid) {
    if (req.user.hasAccountAuth && account_sid !== req.user.account_sid) {
      throw new DbErrorForbidden('Insufficient privileges');
    }

    const [r] = await promisePool.execute(
      'SELECT service_provider_sid from accounts WHERE account_sid = ?', [account_sid]
    );

    if (req.user.hasServiceProviderAuth && r[0].service_provider_sid !== req.user.service_provider_sid) {
      throw new DbErrorForbidden('Insufficient privileges');
    }
  }
  return;
};

const validateRetrieveUpdateDelete = async(req, speech_credentials) => {
  if (req.user.hasServiceProviderAuth && speech_credentials[0].service_provider_sid !== req.user.service_provider_sid) {
    throw new DbErrorForbidden('Insufficient privileges');
  }

  if (req.user.hasAccountAuth && speech_credentials[0].account_sid !== req.user.account_sid) {
    throw new DbErrorForbidden('Insufficient privileges');
  }
  return;
};

const validateRetrieveList = async(req) => {
  return;
};

const obscureKey = (key) => {
  const key_spoiler_length = 6;
  const key_spoiler_char = 'X';

  if (key.length <= key_spoiler_length) {
    return key;
  }

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
    region,
    client_id,
    secret,
    nuance_tts_uri,
    nuance_stt_uri,
    use_custom_tts,
    custom_tts_endpoint,
    use_custom_stt,
    custom_stt_endpoint,
    tts_api_key,
    tts_region,
    stt_api_key,
    stt_region,
    riva_server_uri,
    instance_id,
    custom_stt_url,
    custom_tts_url,
    auth_token = ''
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
      const azureData = JSON.stringify({
        region,
        api_key,
        use_custom_tts,
        custom_tts_endpoint,
        use_custom_stt,
        custom_stt_endpoint
      });
      return encrypt(azureData);

    case 'wellsaid':
      assert(api_key, 'invalid wellsaid speech credential: api_key is required');
      const wsData = JSON.stringify({api_key});
      return encrypt(wsData);

    case 'nuance':
      const checked = (client_id && secret) || (nuance_tts_uri || nuance_stt_uri);
      assert(checked, 'invalid nuance speech credential: either entered client id and\
        secret or entered a nuance_tts_uri or nuance_stt_uri');
      const nuanceData = JSON.stringify({client_id, secret, nuance_tts_uri, nuance_stt_uri});
      return encrypt(nuanceData);

    case 'deepgram':
      assert(api_key, 'invalid deepgram speech credential: api_key is required');
      const deepgramData = JSON.stringify({api_key});
      return encrypt(deepgramData);

    case 'ibm':
      const ibmData = JSON.stringify({tts_api_key, tts_region, stt_api_key, stt_region, instance_id});
      return encrypt(ibmData);

    case 'nvidia':
      assert(riva_server_uri, 'invalid riva server uri: riva_server_uri is required');
      const nvidiaData = JSON.stringify({ riva_server_uri });
      return encrypt(nvidiaData);

    case 'soniox':
      assert(api_key, 'invalid soniox speech credential: api_key is required');
      const sonioxData = JSON.stringify({api_key});
      return encrypt(sonioxData);

    default:
      if (vendor.startsWith('custom:')) {
        const customData = JSON.stringify({auth_token, custom_stt_url, custom_tts_url});
        return encrypt(customData);
      }
      else assert(false, `invalid or missing vendor: ${vendor}`);
  }
};

router.post('/', async(req, res) => {
  const logger = req.app.locals.logger;

  try {
    const {
      use_for_stt,
      use_for_tts,
      vendor,
    } = req.body;
    const account_sid = req.user.account_sid || req.body.account_sid;
    const service_provider_sid = req.user.service_provider_sid ||
    req.body.service_provider_sid || parseServiceProviderSid(req);

    await validateAdd(req);

    if (!account_sid) {
      if (!req.user.hasServiceProviderAuth && !req.user.hasAdminAuth) {
        logger.error('POST /SpeechCredentials invalid credentials');
        return res.sendStatus(403);
      }
    }

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
  const logger = req.app.locals.logger;

  try {
    const account_sid = parseAccountSid(req) ? parseAccountSid(req) : req.user.account_sid;
    const service_provider_sid = parseServiceProviderSid(req);

    await validateRetrieveList(req);

    const credsAccount = account_sid ? await SpeechCredential.retrieveAll(account_sid) : [];
    const credsSP = service_provider_sid ?
      await SpeechCredential.retrieveAllForSP(service_provider_sid) :
      await SpeechCredential.retrieveAllForSP((await Account.retrieve(account_sid))[0].service_provider_sid);

    // filter out duplicates and discard those from other non-matching accounts
    let creds = [...new Set([...credsAccount, ...credsSP].map((c) => JSON.stringify(c)))].map((c) => JSON.parse(c));
    if (req.user.hasScope('account')) {
      creds = creds.filter((c) => c.account_sid === req.user.account_sid || !c.account_sid);
    }

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
        obj.use_custom_tts = o.use_custom_tts;
        obj.custom_tts_endpoint = o.custom_tts_endpoint;
        obj.use_custom_stt = o.use_custom_stt;
        obj.custom_stt_endpoint = o.custom_stt_endpoint;
        logger.info({obj, o}, 'retrieving azure speech credential');
      }
      else if ('wellsaid' === obj.vendor) {
        const o = JSON.parse(decrypt(credential));
        obj.api_key = obscureKey(o.api_key);
      }
      else if ('nuance' === obj.vendor) {
        const o = JSON.parse(decrypt(credential));
        obj.client_id = o.client_id;
        obj.secret = o.secret ? obscureKey(o.secret) : null;
      }
      else if ('deepgram' === obj.vendor) {
        const o = JSON.parse(decrypt(credential));
        obj.api_key = obscureKey(o.api_key);
      }
      else if ('ibm' === obj.vendor) {
        const o = JSON.parse(decrypt(credential));
        obj.tts_api_key = obscureKey(o.tts_api_key);
        obj.tts_region = o.tts_region;
        obj.stt_api_key = obscureKey(o.stt_api_key);
        obj.stt_region = o.stt_region;
        obj.instance_id = o.instance_id;
      } else if ('nvidia' == obj.vendor) {
        const o = JSON.parse(decrypt(credential));
        obj.riva_server_uri = o.riva_server_uri;
      }
      else if ('soniox' === obj.vendor) {
        const o = JSON.parse(decrypt(credential));
        obj.api_key = obscureKey(o.api_key);
      }
      else if (obj.vendor.startsWith('custom:')) {
        const o = JSON.parse(decrypt(credential));
        obj.auth_token = obscureKey(o.auth_token);
        obj.custom_stt_url = o.custom_stt_url;
        obj.custom_tts_url = o.custom_tts_url;
      }

      if (req.user.hasAccountAuth && obj.account_sid === null) {
        delete obj.api_key;
        delete obj.secret_access_key;
        delete obj.secret;
        delete obj.auth_token;
        delete obj.stt_api_key;
        delete obj.tts_api_key;
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
  const logger = req.app.locals.logger;
  try {
    const sid = parseSpeechCredentialSid(req);
    const cred = await SpeechCredential.retrieve(sid);
    if (0 === cred.length) return res.sendStatus(404);

    await validateRetrieveUpdateDelete(req, cred);

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
      obj.use_custom_tts = o.use_custom_tts;
      obj.custom_tts_endpoint = o.custom_tts_endpoint;
      obj.use_custom_stt = o.use_custom_stt;
      obj.custom_stt_endpoint = o.custom_stt_endpoint;
    }
    else if ('wellsaid' === obj.vendor) {
      const o = JSON.parse(decrypt(credential));
      obj.api_key = obscureKey(o.api_key);
    }
    else if ('nuance' === obj.vendor) {
      const o = JSON.parse(decrypt(credential));
      obj.client_id = o.client_id;
      obj.secret = o.secret ? obscureKey(o.secret) : null;
      obj.nuance_tts_uri = o.nuance_tts_uri;
      obj.nuance_stt_uri = o.nuance_stt_uri;
    }
    else if ('deepgram' === obj.vendor) {
      const o = JSON.parse(decrypt(credential));
      obj.api_key = obscureKey(o.api_key);
    }
    else if ('ibm' === obj.vendor) {
      const o = JSON.parse(decrypt(credential));
      obj.tts_api_key = obscureKey(o.tts_api_key);
      obj.tts_region = o.tts_region;
      obj.stt_api_key = obscureKey(o.stt_api_key);
      obj.stt_region = o.stt_region;
      obj.instance_id = o.instance_id;
    } else if ('nvidia' == obj.vendor) {
      const o = JSON.parse(decrypt(credential));
      obj.riva_server_uri = o.riva_server_uri;
    }
    else if ('soniox' === obj.vendor) {
      const o = JSON.parse(decrypt(credential));
      obj.api_key = obscureKey(o.api_key);
    }
    else if (obj.vendor.startsWith('custom:')) {
      const o = JSON.parse(decrypt(credential));
      obj.auth_token = obscureKey(o.auth_token);
      obj.custom_stt_url = o.custom_stt_url;
      obj.custom_tts_url = o.custom_tts_url;
    }

    if (req.user.hasAccountAuth && obj.account_sid === null) {
      delete obj.api_key;
      delete obj.secret_access_key;
      delete obj.secret;
      delete obj.auth_token;
      delete obj.stt_api_key;
      delete obj.tts_api_key;
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
  const logger = req.app.locals.logger;
  try {
    const sid = parseSpeechCredentialSid(req);
    const cred = await SpeechCredential.retrieve(sid);
    await validateRetrieveUpdateDelete(req, cred);
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
  const logger = req.app.locals.logger;
  try {
    const sid = parseSpeechCredentialSid(req);
    const {use_for_tts, use_for_stt, region, aws_region, stt_region, tts_region,
      riva_server_uri, nuance_tts_uri, nuance_stt_uri} = req.body;
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
      const cred = await SpeechCredential.retrieve(sid);

      await validateRetrieveUpdateDelete(req, cred);

      if (1 === cred.length) {
        const {credential, vendor} = cred[0];
        const o = JSON.parse(decrypt(credential));
        const {
          use_custom_tts,
          custom_tts_endpoint,
          use_custom_stt,
          custom_stt_endpoint
        } = req.body;

        const newCred = {
          ...o,
          region,
          vendor,
          aws_region,
          use_custom_tts,
          custom_tts_endpoint,
          use_custom_stt,
          custom_stt_endpoint,
          stt_region,
          tts_region,
          riva_server_uri,
          nuance_stt_uri,
          nuance_tts_uri
        };
        logger.info({o, newCred}, 'updating speech credential with this new credential');
        obj.credential = encryptCredential(newCred);
        obj.vendor = vendor;
      }
      else {
        logger.info({sid}, 'speech credential not found!!');
      }
    } catch (err) {
      logger.error({err}, 'error updating speech credential');
    }

    logger.info({obj}, 'updating speech credential with changes');
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
  const logger = req.app.locals.logger;
  try {
    const sid = parseSpeechCredentialSid(req);
    const creds = await SpeechCredential.retrieve(sid);
    await validateRetrieveUpdateDelete(req, creds);
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
          const {getTtsVoices} = req.app.locals;
          await testGoogleTts(logger, getTtsVoices, credential);
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
        const {getTtsVoices} = req.app.locals;
        try {
          await testAwsTts(logger, getTtsVoices, {
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
      const {
        api_key,
        region,
        use_custom_tts,
        custom_tts_endpoint,
        use_custom_stt,
        custom_stt_endpoint
      } = credential;
      if (cred.use_for_tts) {
        try {
          await testMicrosoftTts(logger, {
            api_key,
            region,
            use_custom_tts,
            custom_tts_endpoint,
            use_custom_stt,
            custom_stt_endpoint
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
    else if (cred.vendor === 'nuance') {
      const {getTtsVoices} = req.app.locals;

      const {
        client_id,
        secret,
        nuance_tts_uri,
        nuance_stt_uri
      } = credential;
      if (cred.use_for_tts) {
        try {
          await testNuanceTts(logger, getTtsVoices, {
            client_id,
            secret,
            nuance_tts_uri
          });
          results.tts.status = 'ok';
          SpeechCredential.ttsTestResult(sid, true);
        } catch (err) {
          logger.error({err}, 'error testing nuance tts');
          const reason = err.statusCode === 401 ?
            'invalid client_id or secret' :
            (err.message || 'error accessing nuance tts service with provided credentials');
          results.tts = {status: 'fail', reason};
          SpeechCredential.ttsTestResult(sid, false);
        }
      }
      if (cred.use_for_stt) {
        try {
          await testNuanceStt(logger, {client_id, secret, nuance_stt_uri});
          results.stt.status = 'ok';
          SpeechCredential.sttTestResult(sid, true);
        } catch (err) {
          results.stt = {status: 'fail', reason: err.message};
          SpeechCredential.sttTestResult(sid, false);
        }
      }
    }
    else if (cred.vendor === 'deepgram') {
      const {api_key} = credential;
      if (cred.use_for_stt) {
        try {
          await testDeepgramStt(logger, {api_key});
          results.stt.status = 'ok';
          SpeechCredential.sttTestResult(sid, true);
        } catch (err) {
          results.stt = {status: 'fail', reason: err.message};
          SpeechCredential.sttTestResult(sid, false);
        }
      }
    }
    else if (cred.vendor === 'ibm') {
      const {getTtsVoices} = req.app.locals;

      if (cred.use_for_tts) {
        const {tts_api_key, tts_region} = credential;
        try {
          await testIbmTts(logger, getTtsVoices, {
            tts_api_key,
            tts_region
          });
          results.tts.status = 'ok';
          SpeechCredential.ttsTestResult(sid, true);
        } catch (err) {
          logger.error({err}, 'error testing ibm tts');
          const reason = err.statusCode === 401 ?
            'invalid api_key or region' :
            (err.message || 'error accessing ibm tts service with provided credentials');
          results.tts = {status: 'fail', reason};
          SpeechCredential.ttsTestResult(sid, false);
        }
      }
      if (cred.use_for_stt) {
        const {stt_api_key, stt_region, instance_id} = credential;
        try {
          await testIbmStt(logger, {stt_region, stt_api_key, instance_id});
          results.stt.status = 'ok';
          SpeechCredential.sttTestResult(sid, true);
        } catch (err) {
          results.stt = {status: 'fail', reason: err.message};
          SpeechCredential.sttTestResult(sid, false);
        }
      }
    }
    else if (cred.vendor === 'soniox') {
      const {api_key} = credential;
      if (cred.use_for_stt) {
        try {
          await testSonioxStt(logger, {api_key});
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
