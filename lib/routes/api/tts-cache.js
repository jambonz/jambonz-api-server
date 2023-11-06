const router = require('express').Router();
const {
  parseAccountSid
} = require('./utils');
const SpeechCredential = require('../../models/speech-credential');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const {DbErrorBadRequest} = require('../../utils/errors');
const Account = require('../../models/account');
const sysError = require('../error');
const { getSpeechCredential, decryptCredential } = require('../../utils/speech-utils');

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

router.post('/Synthesize', async(req, res) => {
  const {logger, synthAudio} = req.app.locals;
  try {
    const accountSid = parseAccountSid(req);
    const body = req.body;
    if (!body.speech_credential_sid || !body.text || !body.language || !body.voice) {
      throw new DbErrorBadRequest('speech_credential_sid, text, language, voice are all required');
    }

    const result = await Account.retrieve(accountSid);
    if (!result || result.length === 0 || !result[0].is_active) {
      throw new DbErrorBadRequest(`Account not found for sid ${accountSid}`);
    }
    const credentials = await SpeechCredential.retrieve(body.speech_credential_sid);
    if (!credentials || credentials.length === 0) {
      throw new
      DbErrorBadRequest(`There is no available speech credential for ${body.speech_credential_sid}`);
    }
    const {credential, ...obj} = credentials[0];

    decryptCredential(obj, credential, logger, false);
    const cred = getSpeechCredential(obj, logger);

    const { text, language, engine = 'standard' } = body;
    const salt = uuidv4();
    /* parse Nuance voices into name and model */
    let voice = body.voice;
    let model;
    if (cred.vendor === 'nuance' && voice) {
      const arr = /([A-Za-z-]*)\s+-\s+(enhanced|standard)/.exec(voice);
      if (arr) {
        voice = arr[1];
        model = arr[2];
      }
    }
    const stats = {
      histogram: () => {},
      increment: () => {},
    };
    const { filePath } = await synthAudio(stats, {
      account_sid: accountSid,
      text,
      vendor: cred,
      language,
      voice,
      engine,
      model,
      salt,
      credentials: cred,
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
