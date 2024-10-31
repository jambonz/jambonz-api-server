const router = require('express').Router();
const GoogleCustomVoice = require('../../models/google-custom-voice');
const SpeechCredential = require('../../models/speech-credential');
const decorate = require('./decorate');
const {DbErrorBadRequest, DbErrorForbidden} = require('../../utils/errors');
const sysError = require('../error');
const multer = require('multer');
const upload = multer({ dest: '/tmp/csv/' });
const fs = require('fs');

const validateCredentialPermission = async(req) => {
  const credential = await SpeechCredential.retrieve(req.body.speech_credential_sid);
  if (!credential || credential.length === 0) {
    throw new DbErrorBadRequest('Invalid speech_credential_sid');
  }
  const cred = credential[0];

  if (req.user.hasServiceProviderAuth && cred.service_provider_sid !== req.user.service_provider_sid) {
    throw new DbErrorForbidden('Insufficient privileges');
  }
  if (req.user.hasAccountAuth && cred.account_sid !== req.user.account_sid) {
    throw new DbErrorForbidden('Insufficient privileges');
  }
};

const validateAdd = async(req) => {
  if (!req.body.speech_credential_sid) {
    throw new DbErrorBadRequest('missing speech_credential_sid');
  }

  await validateCredentialPermission(req);
};

const validateUpdate = async(req) => {
  if (req.body.speech_credential_sid) {
    await validateCredentialPermission(req);
  }
};

const preconditions = {
  add: validateAdd,
  update: validateUpdate,
};

decorate(router, GoogleCustomVoice, ['add', 'retrieve', 'update', 'delete'], preconditions);

const voiceCloningKeySubString = (voice_cloning_key) => {
  return voice_cloning_key ? voice_cloning_key.substring(0, 100) + '...' : undefined;
};

router.get('/: sid', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    const {sid} = req.params;
    const account_sid = req.user.account_sid;
    const service_provider_sid = req.user.service_provider_sid;

    const google_voice = await GoogleCustomVoice.retrieve(sid);
    google_voice.voice_cloning_key = voiceCloningKeySubString(google_voice.voice_cloning_key);
    if (!google_voice) {
      return res.sendStatus(404);
    }
    if (req.user.hasScope('service_provider') && google_voice.service_provider_sid !== service_provider_sid ||
      req.user.hasScope('account') && google_voice.account_sid !== account_sid) {
      throw new DbErrorForbidden('Insufficient privileges');
    }

    return res.status(200).json(google_voice);
  } catch (err) {
    sysError(logger, res, err);
  }
});

router.get('/', async(req, res) => {
  const logger = req.app.locals.logger;
  const account_sid = req.user.account_sid || req.query.account_sid;
  const service_provider_sid = req.user.service_provider_sid || req.query.service_provider_sid;
  const speech_credential_sid = req.query.speech_credential_sid;
  const label = req.query.label;
  try {
    let results = [];
    if (speech_credential_sid) {
      const [cred] = await SpeechCredential.retrieve(speech_credential_sid);
      if (!cred) {
        return res.sendStatus(404);
      }
      if (account_sid && cred.account_sid && cred.account_sid !== account_sid) {
        throw new DbErrorForbidden('Insufficient privileges');
      }
      if (service_provider_sid && cred.service_provider_sid && cred.service_provider_sid !== service_provider_sid) {
        throw new DbErrorForbidden('Insufficient privileges');
      }
      results = await GoogleCustomVoice.retrieveAllBySpeechCredentialSid(speech_credential_sid);
    } else {
      if (!account_sid && !service_provider_sid) {
        throw new DbErrorBadRequest('missing account_sid or service_provider_sid in query parameters');
      }
      results = await GoogleCustomVoice.retrieveAllByLabel(service_provider_sid, account_sid, label);
    }
    res.status(200).json(results.map((r) => {
      r.voice_cloning_key = voiceCloningKeySubString(r.voice_cloning_key);
      return r;
    }));
  } catch (err) {
    sysError(logger, res, err);
  }
});

router.post('/:sid/VoiceCloningKey', upload.single('file'), async(req, res) => {
  const {logger} = req.app.locals;
  const {sid} = req.params;
  const account_sid = req.user.account_sid;
  const service_provider_sid = req.user.service_provider_sid;
  try {
    const google_voice = await GoogleCustomVoice.retrieve(sid);
    if (!google_voice) {
      return res.sendStatus(404);
    }
    if (req.user.hasScope('service_provider') && google_voice.service_provider_sid !== service_provider_sid ||
      req.user.hasScope('account') && google_voice.account_sid !== account_sid) {
      throw new DbErrorForbidden('Insufficient privileges');
    }

    const voice_cloning_key = Buffer.from(fs.readFileSync(req.file.path)).toString();
    await GoogleCustomVoice.update(sid, {
      voice_cloning_key
    });
    fs.unlinkSync(req.file.path);
    return res.sendStatus(204);

  } catch (err) {
    sysError(logger, res, err);
  }
});


module.exports = router;
