const router = require('express').Router();
const decorate = require('./decorate');
const sysError = require('../error');
const Client = require('../../models/client');
const Account = require('../../models/account');
const { DbErrorBadRequest, DbErrorForbidden } = require('../../utils/errors');
const { encrypt, decrypt, obscureKey } = require('../../utils/encrypt-decrypt');

const commonCheck = async(req) => {
  if (req.user.hasAccountAuth) {
    req.body.account_sid = req.user.account_sid;
  } else if (req.user.hasServiceProviderAuth && req.body.account_sid) {
    const accounts = await Account.retrieve(req.body.account_sid, req.user.service_provider_sid);
    if (accounts.length === 0) {
      throw new DbErrorForbidden('insufficient permissions');
    }
  }

  if (req.body.password) {
    req.body.password = encrypt(req.body.password);
  }
};

const validateAdd = async(req) => {
  await commonCheck(req);

  const clients = await Client.retrieveByAccountSidAndUserName(req.body.account_sid, req.body.username);
  if (clients.length) {
    throw new DbErrorBadRequest('the client\'s username already exists');
  }
};

const validateUpdate = async(req, sid) => {
  await commonCheck(req);

  const clients = await Client.retrieveByAccountSidAndUserName(req.body.account_sid, req.body.username);
  if (clients.length && clients[0].client_sid !== sid) {
    throw new DbErrorBadRequest('the client\'s username already exists');
  }
};


const preconditions = {
  add: validateAdd,
  update: validateUpdate,
};

decorate(router, Client, ['add', 'update', 'delete'], preconditions);

router.get('/', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    const results = req.user.hasAdminAuth ?
      await Client.retrieveAll() : req.user.hasAccountAuth ?
        await Client.retrieveAllByAccountSid(req.user.hasAccountAuth ? req.user.account_sid : null) :
        await Client.retrieveAllByServiceProviderSid(req.user.service_provider_sid);
    const ret = results.map((c) => {
      c.password = obscureKey(decrypt(c.password), 1);
      return c;
    });
    res.status(200).json(ret);
  } catch (err) {
    sysError(logger, res, err);
  }
});

router.get('/:sid', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    const results = await Client.retrieve(req.params.sid);
    if (results.length === 0) return res.sendStatus(404);
    const client = results[0];
    client.password = obscureKey(decrypt(client.password), 1);
    if (req.user.hasAccountAuth && client.account_sid !== req.user.account_sid) {
      return res.sendStatus(404);
    } else if (req.user.hasServiceProviderAuth) {
      const accounts = await Account.retrieve(client.account_sid, req.user.service_provider_sid);
      if (!accounts.length) {
        return res.sendStatus(404);
      }
    }
    return res.status(200).json(client);
  } catch (err) {
    sysError(logger, res, err);
  }
});

module.exports = router;
