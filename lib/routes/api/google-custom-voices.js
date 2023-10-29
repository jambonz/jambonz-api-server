const router = require('express').Router();
const GoogleCustomVoice = require('../../models/google-custom-voice');
const SpeechCredential = require('../../models/speech-credential');
const decorate = require('./decorate');
const {DbErrorBadRequest, DbErrorForbidden} = require('../../utils/errors');
const sysError = require('../error');

const validateCredentialPermission = async(req) => {
  const credential = SpeechCredential.retrieve(req.body.speech_credential_sid);
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

router.get('/', async(req, res) => {
  const logger = req.app.locals.logger;
  const speech_credential_sid = req.query.speech_credential_sid;
  if (!speech_credential_sid) {
    throw new DbErrorBadRequest('Missing query parameter speech_credential_sid');
  }
  try {
    const results = await GoogleCustomVoice.retrieveAllBySpeechCredentialSid(speech_credential_sid);
    res.status(200).json(results);
  } catch (err) {
    sysError(logger, res, err);
  }
});


module.exports = router;
