const router = require('express').Router();
const assert = require('assert');
const Account = require('../../models/account');
const SpeechCredential = require('../../models/speech-credential');
const sysError = require('../error');
const {decrypt, encrypt} = require('../../utils/encrypt-decrypt');
const {parseAccountSid, parseServiceProviderSid, parseSpeechCredentialSid} = require('./utils');
const {decryptCredential, testWhisper, testDeepgramTTS,
  getLanguagesAndVoicesForVendor,
  testPlayHT,
  testRimelabs,
  testVerbioTts,
  testVerbioStt,
  testSpeechmaticsStt,
  testCartesia,
  testVoxistStt,
  testOpenAiStt,
  testInworld,
  testResembleTTS,
  testHoundifyStt} = require('../../utils/speech-utils');
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
    role_arn,
    region,
    client_id,
    client_key,
    client_secret,
    secret,
    nuance_tts_uri,
    nuance_stt_uri,
    speechmatics_stt_uri,
    deepgram_stt_uri,
    deepgram_stt_use_tls,
    deepgram_tts_uri,
    playht_tts_uri,
    resemble_tts_uri,
    resemble_tts_use_tls,
    use_custom_tts,
    custom_tts_endpoint,
    custom_tts_endpoint_url,
    use_custom_stt,
    use_for_stt,
    use_for_tts,
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
    custom_tts_streaming_url,
    auth_token = '',
    cobalt_server_uri,
    // For most vendors, model_id is being used for both TTS and STT, or one of them.
    // for Cartesia, model_id is used for TTS only. introduce stt_model_id for STT
    model_id,
    stt_model_id,
    user_id,
    voice_engine,
    engine_version,
    service_version,
    options
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
      // AWS polly can work for 3 types of credentials:
      // 1/ access_key_id and secret_access_key
      // 2/ RoleArn Assume role
      // 3/ RoleArn assigned to instance profile where will run this application
      const awsData = JSON.stringify(
        {
          aws_region,
          ...(access_key_id && {access_key_id}),
          ...(secret_access_key && {secret_access_key}),
          ...(role_arn && {role_arn}),
        });
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
      // API key is optional if onprem
      if (!deepgram_stt_uri || !deepgram_tts_uri) {
        assert(api_key, 'invalid deepgram speech credential: api_key is required');
      }
      const deepgramData = JSON.stringify({api_key, deepgram_stt_uri,
        deepgram_stt_use_tls, deepgram_tts_uri, model_id});
      return encrypt(deepgramData);

    case 'resemble':
      assert(api_key, 'invalid resemble speech credential: api_key is required');
      const resembleData = JSON.stringify({
        api_key,
        ...(resemble_tts_uri && {resemble_tts_uri}),
        ...(resemble_tts_use_tls && {resemble_tts_use_tls})
      });
      return encrypt(resembleData);

    case 'deepgramriver':
      assert(api_key, 'invalid deepgram river speech credential: api_key is required');
      const deepgramriverData = JSON.stringify({api_key});
      return encrypt(deepgramriverData);

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
      const elevenlabsData = JSON.stringify({api_key, model_id, options});
      return encrypt(elevenlabsData);

    case 'speechmatics':
      assert(api_key, 'invalid speechmatics speech credential: api_key is required');
      assert(speechmatics_stt_uri, 'invalid speechmatics speech credential: speechmatics_stt_uri is required');
      const speechmaticsData = JSON.stringify({api_key, speechmatics_stt_uri, options});
      return encrypt(speechmaticsData);

    case 'playht':
      assert(api_key, 'invalid playht speech credential: api_key is required');
      assert(user_id, 'invalid playht speech credential: user_id is required');
      assert(voice_engine, 'invalid voice_engine speech credential: voice_engine is required');
      const playhtData = JSON.stringify({api_key, user_id, voice_engine, playht_tts_uri, options});
      return encrypt(playhtData);

    case 'cartesia':
      assert(api_key, 'invalid cartesia speech credential: api_key is required');
      if (use_for_tts) {
        assert(model_id, 'invalid cartesia speech credential: model_id is required');
      }
      if (use_for_stt) {
        assert(stt_model_id, 'invalid cartesia speech credential: stt_model_id is required');
      }
      const cartesiaData = JSON.stringify({
        api_key,
        ...(model_id && {model_id}),
        ...(stt_model_id && {stt_model_id}),
        options});
      return encrypt(cartesiaData);

    case 'rimelabs':
      assert(api_key, 'invalid rimelabs speech credential: api_key is required');
      assert(model_id, 'invalid rimelabs speech credential: model_id is required');
      const rimelabsData = JSON.stringify({api_key, model_id, options});
      return encrypt(rimelabsData);

    case 'inworld':
      assert(api_key, 'invalid inworld speech credential: api_key is required');
      assert(model_id, 'invalid inworld speech credential: model_id is required');
      const inworldData = JSON.stringify({api_key, model_id, options});
      return encrypt(inworldData);

    case 'assemblyai':
      assert(api_key, 'invalid assemblyai speech credential: api_key is required');
      const assemblyaiData = JSON.stringify({api_key, service_version});
      return encrypt(assemblyaiData);

    case 'houndify':
      assert(client_id, 'invalid houndify speech credential: client_id is required');
      assert(client_key, 'invalid houndify speech credential: client_key is required');
      assert(user_id, 'invalid houndify speech credential: user_id is required');
      const houndifyData = JSON.stringify({client_id, client_key, user_id});
      return encrypt(houndifyData);

    case 'voxist':
      assert(api_key, 'invalid voxist speech credential: api_key is required');
      const voxistData = JSON.stringify({api_key});
      return encrypt(voxistData);

    case 'whisper':
      assert(api_key, 'invalid whisper speech credential: api_key is required');
      assert(model_id, 'invalid whisper speech credential: model_id is required');
      const whisperData = JSON.stringify({api_key, model_id});
      return encrypt(whisperData);

    case 'openai':
      assert(api_key, 'invalid openai speech credential: api_key is required');
      assert(model_id, 'invalid openai speech credential: model_id is required');
      const openaiData = JSON.stringify({api_key, model_id});
      return encrypt(openaiData);

    case 'verbio':
      assert(engine_version, 'invalid verbio speech credential: client_id is required');
      assert(client_id, 'invalid verbio speech credential: client_id is required');
      assert(client_secret, 'invalid verbio speech credential: secret is required');
      const verbioData = JSON.stringify({client_id, client_secret, engine_version});
      return encrypt(verbioData);

    default:
      if (vendor.startsWith('custom:')) {
        const customData = JSON.stringify({auth_token, custom_stt_url, custom_tts_url, custom_tts_streaming_url});
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
          custom_tts_streaming_url,
          cobalt_server_uri,
          model_id,
          stt_model_id,
          voice_engine,
          options,
          deepgram_stt_uri,
          deepgram_stt_use_tls,
          deepgram_tts_uri,
          playht_tts_uri,
          engine_version,
          service_version,
          speechmatics_stt_uri,
          resemble_tts_use_tls,
          resemble_tts_uri
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
          custom_tts_streaming_url,
          cobalt_server_uri,
          model_id,
          stt_model_id,
          voice_engine,
          options,
          deepgram_stt_uri,
          deepgram_stt_use_tls,
          deepgram_tts_uri,
          playht_tts_uri,
          engine_version,
          service_version,
          speechmatics_stt_uri,
          resemble_tts_uri,
          resemble_tts_use_tls
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
  const {logger, synthAudio, getVerbioAccessToken} = req.app.locals;
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
      const {getTtsVoices, getAwsAuthToken} = req.app.locals;
      if (cred.use_for_tts) {
        try {
          await testAwsTts(logger, getTtsVoices, {
            accessKeyId: credential.access_key_id,
            secretAccessKey: credential.secret_access_key,
            roleArn: credential.role_arn,
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
          await testAwsStt(logger, getAwsAuthToken, {
            accessKeyId: credential.access_key_id,
            secretAccessKey: credential.secret_access_key,
            roleArn: credential.role_arn,
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
          await testMicrosoftStt(logger, {api_key, region, use_custom_stt, custom_stt_endpoint_url});
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
    } else if (cred.vendor === 'resemble') {
      if (cred.use_for_tts) {
        try {
          await testResembleTTS(logger, synthAudio, credential);
          results.tts.status = 'ok';
          SpeechCredential.ttsTestResult(sid, true);
        } catch (err) {
          results.tts = {status: 'fail', reason: err.message};
          SpeechCredential.ttsTestResult(sid, false);
        }
      }
    } else if (cred.vendor === 'deepgram') {
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
      if (cred.use_for_stt && api_key) {
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
    else if (cred.vendor === 'deepgramriver') {
      const {api_key} = credential;
      if (cred.use_for_stt && api_key) {
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
    } else if (cred.vendor === 'speechmatics') {
      const {api_key} = credential;
      if (cred.use_for_stt) {
        try {
          await testSpeechmaticsStt(logger, {api_key});
          results.stt.status = 'ok';
          SpeechCredential.ttsTestResult(sid, true);
        } catch (err) {
          results.stt = {status: 'fail', reason: err.message};
          SpeechCredential.ttsTestResult(sid, false);
        }
      }
    } else if (cred.vendor === 'playht') {
      if (cred.use_for_tts) {
        try {
          await testPlayHT(logger, synthAudio, credential);
          results.tts.status = 'ok';
          SpeechCredential.ttsTestResult(sid, true);
        } catch (err) {
          let reason = err.message;
          try {
            reason = await err.text();
          } catch {}
          results.tts = {status: 'fail', reason};
          SpeechCredential.ttsTestResult(sid, false);
        }
      }
    } else if (cred.vendor === 'cartesia') {
      if (cred.use_for_tts || cred.use_for_stt) {
        try {
          // Cartesia does not have API for testing STT, same key is used for both TTS and STT
          await testCartesia(logger, synthAudio, credential);
          if (cred.use_for_tts) {
            results.tts.status = 'ok';
          }
          if (cred.use_for_stt) {
            results.stt.status = 'ok';
          }
          SpeechCredential.ttsTestResult(sid, true);
        } catch (err) {
          let reason = err.message;
          try {
            reason = await err.text();
          } catch {}
          if (cred.use_for_tts) {
            results.tts = {status: 'fail', reason};
          }
          if (cred.use_for_stt) {
            results.stt = {status: 'fail', reason};
          }
          SpeechCredential.ttsTestResult(sid, false);
        }
      }
    } else if (cred.vendor === 'inworld') {
      if (cred.use_for_tts) {
        try {
          await testInworld(logger, synthAudio, credential);
          results.tts.status = 'ok';
          SpeechCredential.ttsTestResult(sid, true);
        } catch (err) {
          results.tts = {status: 'fail', reason: err.message};
          SpeechCredential.ttsTestResult(sid, false);
        }
      }
    } else if (cred.vendor === 'rimelabs') {
      if (cred.use_for_tts) {
        try {
          await testRimelabs(logger, synthAudio, credential);
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
    } else if (cred.vendor === 'houndify') {
      if (cred.use_for_stt) {
        try {
          await testHoundifyStt(logger, credential);
          results.stt.status = 'ok';
          SpeechCredential.sttTestResult(sid, true);
        } catch (err) {
          results.stt = {status: 'fail', reason: err.message};
          SpeechCredential.sttTestResult(sid, false);
        }
      }
    } else if (cred.vendor === 'voxist') {
      const {api_key} = credential;
      if (cred.use_for_stt) {
        try {
          await testVoxistStt(logger, {api_key});
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
    } else if (cred.vendor === 'openai') {
      if (cred.use_for_stt) {
        try {
          await testOpenAiStt(logger, credential);
          results.stt.status = 'ok';
          SpeechCredential.sttTestResult(sid, true);
        } catch (err) {
          results.stt = {status: 'fail', reason: err.message};
          SpeechCredential.sttTestResult(sid, false);
        }
      }
    } else if (cred.vendor === 'verbio') {
      if (cred.use_for_tts) {
        try {
          await testVerbioTts(logger, synthAudio, credential);
          results.tts.status = 'ok';
          SpeechCredential.ttsTestResult(sid, true);
        } catch (err) {
          results.tts = {status: 'fail', reason: err.message};
          SpeechCredential.ttsTestResult(sid, false);
        }
      }
      if (cred.use_for_stt) {
        try {
          await testVerbioStt(logger, getVerbioAccessToken, credential);
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

/**
 * Fetch speech voices and languages
 */

router.get('/speech/supportedLanguagesAndVoices', async(req, res) => {
  const {logger, getTtsVoices} = req.app.locals;
  try {
    const {vendor, label, create_new} = req.query;
    if (!vendor) {
      throw new DbErrorBadRequest('vendor is required');
    }
    const account_sid = req.user.account_sid || req.body.account_sid;
    const service_provider_sid = req.user.service_provider_sid ||
      req.body.service_provider_sid || parseServiceProviderSid(req);

    const credentials = create_new ? null : await SpeechCredential.getSpeechCredentialsByVendorAndLabel(
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
