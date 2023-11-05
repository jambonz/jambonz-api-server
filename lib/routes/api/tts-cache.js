const router = require('express').Router();
const {
  parseAccountSid
} = require('./utils');
const { validate } = require('@jambonz/verb-specifications');
const SpeechCredential = require('../../models/speech-credential');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const {DbErrorBadRequest} = require('../../utils/errors');
const Account = require('../../models/account');
const sysError = require('../error');

router.delete('/', async(req, res) => {
  const {purgeTtsCache} = req.app.locals;
  const account_sid = parseAccountSid(req);
  if (account_sid) {
    await purgeTtsCache({account_sid});
  } else {
    await purgeTtsCache();
  }
  res.sendStatus(204);
});

router.get('/', async(req, res) => {
  const {getTtsSize} = req.app.locals;
  const account_sid = parseAccountSid(req);
  let size = 0;
  if (account_sid) {
    size = await getTtsSize(`tts:${account_sid}:*`);
  } else {
    size = await getTtsSize();
  }
  res.status(200).json({size});
});

// Tts
const validateTtsRequestBody = async(body, logger) => {
  let copiedBody = {...body};
  if (typeof copiedBody !== 'object') {
    throw new DbErrorBadRequest('Invalid tts request body, it should be say verb object');
  }
  copiedBody.verb = 'say';
  copiedBody = [copiedBody];
  try {
    validate(logger, copiedBody);
  } catch (err) {
    throw new DbErrorBadRequest(err);
  }
};


const getSpeechCredential = (credentials, vendor, label) => {
  for (const credential of credentials) {
    if (credential.use_for_tts && credential.tts_tested_ok &&
      credential.vendor === vendor && credential.label === label) {
      const { vendor } = credential;
      if ('google' === vendor) {
        const cred = JSON.parse(credential.service_key.replace(/\n/g, '\\n'));
        return {
          speech_credential_sid: credential.speech_credential_sid,
          credentials: cred
        };
      }
      else if (['aws', 'polly'].includes(vendor)) {
        return {
          speech_credential_sid: credential.speech_credential_sid,
          accessKeyId: credential.access_key_id,
          secretAccessKey: credential.secret_access_key,
          region: credential.aws_region
        };
      }
      else if ('microsoft' === vendor) {
        return {
          speech_credential_sid: credential.speech_credential_sid,
          api_key: credential.api_key,
          region: credential.region,
          use_custom_stt: credential.use_custom_stt,
          custom_stt_endpoint: credential.custom_stt_endpoint,
          custom_stt_endpoint_url: credential.custom_stt_endpoint_url,
          use_custom_tts: credential.use_custom_tts,
          custom_tts_endpoint: credential.custom_tts_endpoint,
          custom_tts_endpoint_url: credential.custom_tts_endpoint_url
        };
      }
      else if ('wellsaid' === vendor) {
        return {
          speech_credential_sid: credential.speech_credential_sid,
          api_key: credential.api_key
        };
      }
      else if ('nuance' === vendor) {
        return {
          speech_credential_sid: credential.speech_credential_sid,
          client_id: credential.client_id,
          secret: credential.secret,
          nuance_tts_uri: credential.nuance_tts_uri,
          nuance_stt_uri: credential.nuance_stt_uri
        };
      }
      else if ('deepgram' === vendor) {
        return {
          speech_credential_sid: credential.speech_credential_sid,
          api_key: credential.api_key
        };
      }
      else if ('soniox' === vendor) {
        return {
          speech_credential_sid: credential.speech_credential_sid,
          api_key: credential.api_key
        };
      }
      else if ('ibm' === vendor) {
        return {
          speech_credential_sid: credential.speech_credential_sid,
          tts_api_key: credential.tts_api_key,
          tts_region: credential.tts_region,
          stt_api_key: credential.stt_api_key,
          stt_region: credential.stt_region
        };
      }
      else if ('nvidia' === vendor) {
        return {
          speech_credential_sid: credential.speech_credential_sid,
          riva_server_uri: credential.riva_server_uri
        };
      }
      else if ('cobalt' === vendor) {
        return {
          speech_credential_sid: credential.speech_credential_sid,
          cobalt_server_uri: credential.cobalt_server_uri
        };
      } else if ('elevenlabs' === vendor) {
        return {
          api_key: credential.api_key,
          model_id: credential.model_id
        };
      } else if ('assemblyai' === vendor) {
        return {
          speech_credential_sid: credential.speech_credential_sid,
          api_key: credential.api_key
        };
      } else if (vendor.startsWith('custom:')) {
        return {
          speech_credential_sid: credential.speech_credential_sid,
          auth_token: credential.auth_token,
          custom_stt_url: credential.custom_stt_url,
          custom_tts_url: credential.custom_tts_url
        };
      }
    }
  }
};


router.post('/Synthesize', async(req, res) => {
  const {logger, synthAudio} = req.app.locals;
  try {
    const accountSid = parseAccountSid(req);
    const body = req.body;
    await validateTtsRequestBody(body, logger);
    const { text, synthesizer } = body;
    const { vendor, label, language } = synthesizer;
    const engine = synthesizer.engine || 'standard';
    const options = synthesizer.options || {};
    const salt = uuidv4();
    /* parse Nuance voices into name and model */
    let voice = synthesizer.voice;
    let model;
    if (vendor === 'nuance' && voice) {
      const arr = /([A-Za-z-]*)\s+-\s+(enhanced|standard)/.exec(voice);
      if (arr) {
        voice = arr[1];
        model = arr[2];
      }
    }

    const result = await Account.retrieve(accountSid);
    if (!result || result.length === 0) {
      throw new DbErrorBadRequest(`Account not found for sid ${accountSid}`);
    }
    if (!result[0].is_active) {
      throw new DbErrorBadRequest(`Account not active for sid ${accountSid}`);
    }

    const speechCreds = await SpeechCredential.getSPeechCredentialsForAccount(accountSid);
    if (!speechCreds || speechCreds.length === 0) {
      throw new
      DbErrorBadRequest(`There is no available speech credential for ${vendor}${label ? ` and ${label}` : ''}`);
    }

    let credentials = getSpeechCredential(speechCreds);
    if (!credentials) {
      throw new
      DbErrorBadRequest(`There is no available speech credential for ${vendor}${label ? ` and ${label}` : ''}`);
    }
    /* allow for microsoft custom region voice and api_key to be specified as an override */
    if (vendor === 'microsoft' && options.deploymentId) {
      credentials = credentials || {};
      credentials.use_custom_tts = true;
      credentials.custom_tts_endpoint = options.deploymentId;
      credentials.api_key = options.apiKey || credentials.apiKey;
      credentials.region = options.region || credentials.region;
      voice = options.voice || voice;
    }
    const stats = {
      histogram: () => {},
      increment: () => {},
    };
    const { filePath } = await synthAudio(stats, {
      account_sid: accountSid,
      text,
      vendor,
      language,
      voice,
      engine,
      model,
      salt,
      credentials,
      disableTtsCache: false
    });

    const stat = fs.statSync(filePath);
    res.writeHead(200, {
      'Content-Type': 'audio/mpeg',
      'Content-Length': stat.size,
    });

    const readStream = fs.createReadStream(filePath);
    // We replaced all the event handlers with a simple call to readStream.pipe()
    readStream.pipe(res);

    readStream.on('end', () => {
      // Delete the file after it's been read
      fs.unlink(filePath, (err) => {
        if (err) throw err;
        logger.error(`${filePath} was deleted`);
      });
    });

  } catch (err) {
    sysError(logger, res, err);
  }
});

module.exports = router;
