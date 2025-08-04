const sysError = require('../error');
const { parseAccountSid, parseServiceProviderSid, parseLlmCredentialSid } = require('./utils');

const router = require('express').Router();
const assert = require('assert');
const {promisePool} = require('../../db');
const { DbErrorForbidden, DbErrorUnprocessableRequest } = require('../../utils/errors');
const LlmCredential = require('../../models/llm-credentials');
const { encrypt, decrypt } = require('../../utils/encrypt-decrypt');
const Account = require('../../models/account');
const { decryptLlmCredential, testOpenAiStt } = require('../../utils/speech-utils');

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

const validateRetrieveUpdateDelete = async(req, llm_credentials) => {
  if (req.user.hasServiceProviderAuth && llm_credentials[0].service_provider_sid !== req.user.service_provider_sid) {
    throw new DbErrorForbidden('Insufficient privileges');
  }

  if (req.user.hasAccountAuth && llm_credentials[0].account_sid !== req.user.account_sid) {
    throw new DbErrorForbidden('Insufficient privileges');
  }
  return;
};

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

const encryptCredential = (obj) => {
  const {
    vendor,
    api_key
  } = obj;
  switch (vendor) {
    case 'openai':
      assert(api_key, 'invalid openai llm credential: api_key is required');
      const openaiData = JSON.stringify({api_key});
      return encrypt(openaiData);
    case 'anthropic':
      assert(api_key, 'invalid anthropic llm credential: api_key is required');
      const anthropicData = JSON.stringify({api_key});
      return encrypt(anthropicData);
  }
};

router.post('/', async(req, res) => {
  const logger = req.app.locals.logger;

  try {
    const account_sid = parseAccountSid(req) || req.user.account_sid;
    const service_provider_sid = req.user.service_provider_sid ||
    req.body.service_provider_sid || parseServiceProviderSid(req);

    const {
      vendor,
      label
    } = req.body;

    await validateAdd(req);

    if (!account_sid) {
      if (!req.user.hasServiceProviderAuth && !req.user.hasAdminAuth) {
        logger.error('POST /llmCredentials invalid credentials');
        return res.sendStatus(403);
      }
    }

    // Check if vendor and label is already used for account or SP
    if (label) {
      const existingllm = await LlmCredential.getLlmCredentialsByVendorAndLabel(
        service_provider_sid, account_sid, vendor, label);
      if (existingllm.length > 0) {
        throw new DbErrorUnprocessableRequest(`Label ${label} is already in use for another llm credential`);
      }
    }

    const encrypted_credential = encryptCredential(req.body);

    const uuid = await LlmCredential.make({
      account_sid,
      service_provider_sid,
      vendor,
      label,
      credential: encrypted_credential
    });
    res.status(201).json({sid: uuid});
  } catch (err) {
    sysError(logger, res, err);
  }
});


/**
 * retrieve all llm credentials for an account
 */
router.get('/', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    const account_sid = parseAccountSid(req) ? parseAccountSid(req) : req.user.account_sid;
    const service_provider_sid = parseServiceProviderSid(req);

    await validateRetrieveList(req);

    const credsAccount = account_sid ? await LlmCredential.retrieveAll(account_sid) : [];
    const credsSP = service_provider_sid ?
      await LlmCredential.retrieveAllForSP(service_provider_sid) :
      await LlmCredential.retrieveAllForSP((await Account.retrieve(account_sid))[0].service_provider_sid);

    // filter out duplicates and discard those from other non-matching accounts
    let creds = [...new Set([...credsAccount, ...credsSP].map((c) => JSON.stringify(c)))].map((c) => JSON.parse(c));
    if (req.user.hasScope('account')) {
      creds = creds.filter((c) => c.account_sid === req.user.account_sid || !c.account_sid);
    }

    res.status(200).json(creds.map((c) => {
      const {credential, ...obj} = c;

      decryptLlmCredential(obj, credential, logger);

      if (req.user.hasAccountAuth && obj.account_sid === null) {
        delete obj.api_key;
      }
      return obj;
    }));

  } catch (err) {
    sysError(logger, res, err);
  }
});

router.get('/:sid', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    const sid = parseLlmCredentialSid(req);
    const cred = await LlmCredential.retrieve(sid);
    if (0 === cred.length) return res.sendStatus(404);

    await validateRetrieveUpdateDelete(req, cred);

    const {credential, ...obj} = cred[0];
    decryptLlmCredential(obj, credential, logger);

    if (req.user.hasAccountAuth && obj.account_sid === null) {
      delete obj.api_key;
    }

    res.status(200).json(obj);
  } catch (err) {
    sysError(logger, res, err);
  }
});

router.delete('/:sid', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    const sid = parseLlmCredentialSid(req);
    const cred = await LlmCredential.retrieve(sid);
    await validateRetrieveUpdateDelete(req, cred);
    const count = await LlmCredential.remove(sid);
    if (0 === count) return res.sendStatus(404);
    res.sendStatus(204);
  } catch (err) {
    sysError(logger, res, err);
  }
});

router.put('/:sid', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    const sid = parseLlmCredentialSid(req);

    const cred = await LlmCredential.retrieve(sid);
    await validateRetrieveUpdateDelete(req, cred);
    const obj = {};
    if (1 === cred.length) {
      const {credential, vendor} = cred[0];
      const o = JSON.parse(decrypt(credential));
      const {
      } = o;
      const newCred = {
        ...o,
      };
      logger.info({o, newCred}, 'updating llm credential with this new credential');
      obj.credential = encryptCredential(newCred);
      obj.vendor = vendor;
    } else {
      logger.info({sid}, 'llm credential not found!!');
    }

    logger.info({obj}, 'updating llm credential with changes');
    const rowsAffected = await LlmCredential.update(sid, obj);
    if (rowsAffected === 0) {
      return res.sendStatus(404);
    }
    res.status(204).end();

  } catch (err) {
    sysError(logger, res, err);
  }
});

router.get('/:sid/test', async(req, res) => {
  const {logger} = req.app.locals;
  try {
    const sid = parseLlmCredentialSid(req);
    const creds = await LlmCredential.retrieve(sid);

    if (!creds || 0 === creds.length) return res.sendStatus(404);

    await validateTest(req, creds[0]);

    const cred = creds[0];
    const credential = JSON.parse(decrypt(cred.credential));
    const result = {
      status: 'not tested'
    };

    switch (cred.vendor) {
      case 'openai':
        try {
          await testOpenAiStt(logger, credential);
          result.status = 'ok';
          await LlmCredential.testResult(sid, true);
        } catch (err) {
          logger.error({err}, 'failed to test llm credential');
          result.status = 'fail';
          result.reason = err.message || 'unknown error';
          await LlmCredential.testResult(sid, false);
        }
        result.status = 'ok';
        break;
      case 'anthropic':
        result.status = 'ok';
        break;
      default:
        logger.error({vendor: cred.vendor}, 'unsupported vendor for llm credential test');
        return res.status(400).json({error: `unsupported vendor ${cred.vendor} for llm credential test`});
    }
    res.status(200).json(result);
  } catch (err) {
    sysError(logger, res, err);
  }
});

module.exports = router;
