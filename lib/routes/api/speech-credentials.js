const router = require('express').Router();
const assert = require('assert');
const Account = require('../../models/account');
const SpeechCredential = require('../../models/speech-credential');
const sysError = require('../error');
const {decrypt, encrypt} = require('../../utils/encrypt-decrypt');
const {parseAccountSid, parseServiceProviderSid, parseSpeechCredentialSid} = require('./utils');
const {decryptCredential, testWhisper, testDeepgramTTS,
  getLanguagesAndVoicesForVendor} = require('../../utils/speech-utils');
const {DbErrorUnprocessableRequest, DbErrorForbidden, DbErrorBadRequest} = require('../../utils/errors');
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
  testIbmStt,
  testElevenlabs,
  testAssemblyStt
} = require('../../utils/speech-utils');
const {promisePool} = require('../../db');

const validateAdd = async(req) => {
  const account_sid = parseAccountSid(req);
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
  const service_provider_sid = parseServiceProviderSid(req);

  if (service_provider_sid) {
    if ((req.user.hasServiceProviderAuth || req.user.hasAccountAuth) &&
     service_provider_sid !== req.user.service_provider_sid) {
      throw new DbErrorForbidden('Insufficient privileges');
    }
  }
  return;
};

const validateTest = async(req, speech_credentials) => {
  if (req.user.hasAdminAuth) {
    return;
  }

  if (!req.user.hasAdminAuth && speech_credentials.service_provider_sid !== req.user.service_provider_sid) {
    throw new DbErrorForbidden('Insufficient privileges');
  }

  if (speech_credentials.service_provider_sid === req.user.service_provider_sid) {
    if (req.user.hasServiceProviderAuth) {
      return;
    }

    if (req.user.hasAccountAuth && (!speech_credentials.account_sid ||
       speech_credentials.account_sid === req.user.account_sid)) {
      return;
    }

    throw new DbErrorForbidden('Insufficient privileges');
  }
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
    deepgram_uri,
    deepgram_use_tls,
    use_custom_tts,
    custom_tts_endpoint,
    custom_tts_endpoint_url,
    use_custom_stt,
    custom_stt_endpoint,
    custom_stt_endpoint_url,
    tts_api_key,
    tts_region,
    stt_api_key,
    stt_region,
    riva_server_uri,
    instance_id,
    custom_stt_url,
    custom_tts_url,
    auth_token = '',
    cobalt_server_uri,
    model_id,
    options,
    use_streaming
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
      if (!custom_tts_endpoint_url && !custom_stt_endpoint_url) {
        assert(region, 'invalid azure speech credential: region is required');
        assert(api_key, 'invalid azure speech credential: api_key is required');
      }
      const azureData = JSON.stringify({
        ...(region && {region}),
        ...(api_key && {api_key}),
        use_custom_tts,
        custom_tts_endpoint,
        custom_tts_endpoint_url,
        use_custom_stt,
        custom_stt_endpoint,
        custom_stt_endpoint_url
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
      const deepgramData = JSON.stringify({api_key, deepgram_uri, deepgram_use_tls});
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

    case 'cobalt':
      assert(cobalt_server_uri, 'invalid cobalt speech credential: cobalt_server_uri is required');
      const cobaltData = JSON.stringify({cobalt_server_uri});
      return encrypt(cobaltData);

    case 'elevenlabs':
      assert(api_key, 'invalid elevenLabs speech credential: api_key is required');
      assert(model_id, 'invalid elevenLabs speech credential: model_id is required');
      const elevenlabsData = JSON.stringify({api_key, model_id, options, use_streaming});
      return encrypt(elevenlabsData);

    case 'assemblyai':
      assert(api_key, 'invalid assemblyai speech credential: api_key is required');
      const assemblyaiData = JSON.stringify({api_key});
      return encrypt(assemblyaiData);

    case 'whisper':
      assert(api_key, 'invalid whisper speech credential: api_key is required');
      assert(model_id, 'invalid whisper speech credential: model_id is required');
      const whisperData = JSON.stringify({api_key, model_id});
      return encrypt(whisperData);

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
      label
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

    // Check if vendor and label is already used for account or SP
    if (label) {
      const existingSpeech = await SpeechCredential.getSpeechCredentialsByVendorAndLabel(
        service_provider_sid, account_sid, vendor, label);
      if (existingSpeech.length > 0) {
        throw new DbErrorUnprocessableRequest(`Label ${label} is already in use for another speech credential`);
      }
    }

    const encrypted_credential = encryptCredential(req.body);
    const uuid = await SpeechCredential.make({
      account_sid,
      service_provider_sid,
      vendor,
      label,
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

      decryptCredential(obj, credential, logger);

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
    decryptCredential(obj, credential, logger);

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
          custom_tts_endpoint_url,
          use_custom_stt,
          custom_stt_endpoint,
          custom_stt_endpoint_url,
          custom_stt_url,
          custom_tts_url,
          cobalt_server_uri,
          model_id,
          options,
          use_streaming,
          deepgram_uri,
          deepgram_use_tls,
        } = req.body;

        const newCred = {
          ...o,
          region,
          vendor,
          aws_region,
          use_custom_tts,
          custom_tts_endpoint,
          custom_tts_endpoint_url,
          use_custom_stt,
          custom_stt_endpoint,
          custom_stt_endpoint_url,
          stt_region,
          tts_region,
          riva_server_uri,
          nuance_stt_uri,
          nuance_tts_uri,
          custom_stt_url,
          custom_tts_url,
          cobalt_server_uri,
          model_id,
          options,
          use_streaming,
          deepgram_uri,
          deepgram_use_tls,
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
  const {logger, synthAudio} = req.app.locals;
  try {
    const sid = parseSpeechCredentialSid(req);
    const creds = await SpeechCredential.retrieve(sid);

    if (!creds || 0 === creds.length) return res.sendStatus(404);

    await validateTest(req, creds[0]);

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
        custom_tts_endpoint_url,
        use_custom_stt,
        custom_stt_endpoint,
        custom_stt_endpoint_url
      } = credential;
      if (cred.use_for_tts) {
        try {
          await testMicrosoftTts(logger, synthAudio, {
            api_key,
            region,
            use_custom_tts,
            custom_tts_endpoint,
            custom_tts_endpoint_url,
            use_custom_stt,
            custom_stt_endpoint,
            custom_stt_endpoint_url
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
      if (cred.use_for_tts) {
        try {
          await testDeepgramTTS(logger, synthAudio, credential);
          results.tts.status = 'ok';
          SpeechCredential.ttsTestResult(sid, true);
        } catch (err) {
          results.tts = {status: 'fail', reason: err.message};
          SpeechCredential.ttsTestResult(sid, false);
        }
      }
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
    } else if (cred.vendor === 'elevenlabs') {
      const {api_key, model_id} = credential;
      if (cred.use_for_tts) {
        try {
          await testElevenlabs(logger, {api_key, model_id});
          results.tts.status = 'ok';
          SpeechCredential.ttsTestResult(sid, true);
        } catch (err) {
          results.tts = {status: 'fail', reason: err.message};
          SpeechCredential.ttsTestResult(sid, false);
        }
      }
    } else if (cred.vendor === 'assemblyai') {
      const {api_key} = credential;
      if (cred.use_for_stt) {
        try {
          await testAssemblyStt(logger, {api_key});
          results.stt.status = 'ok';
          SpeechCredential.sttTestResult(sid, true);
        } catch (err) {
          results.stt = {status: 'fail', reason: err.message};
          SpeechCredential.sttTestResult(sid, false);
        }
      }
    } else if (cred.vendor === 'whisper') {
      if (cred.use_for_tts) {
        try {
          await testWhisper(logger, synthAudio, credential);
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

/**
 * Fetch speech voices and languages
 */

router.get('/speech/supportedLanguagesAndVoices', async(req, res) => {
  const {logger, getTtsVoices} = req.app.locals;
  try {
    const {vendor, label} = req.query;
    if (!vendor) {
      throw new DbErrorBadRequest('vendor is required');
    }
    const account_sid = req.user.account_sid || req.body.account_sid;
    const service_provider_sid = req.user.service_provider_sid ||
      req.body.service_provider_sid || parseServiceProviderSid(req);

    const credentials = await SpeechCredential.getSpeechCredentialsByVendorAndLabel(
      service_provider_sid, account_sid, vendor, label);
    const tmp = credentials && credentials.length > 0 ? credentials[0] : null;
    const cred = tmp ? JSON.parse(decrypt(tmp.credential)) : null;
    try {
      const data = await getLanguagesAndVoicesForVendor(logger, vendor, cred, getTtsVoices);
      res.status(200).json(data);
    } catch (err) {
      throw new DbErrorUnprocessableRequest(err.message);
    }
  } catch (err) {
    sysError(logger, res, err);
  }
});

module.exports = router;
