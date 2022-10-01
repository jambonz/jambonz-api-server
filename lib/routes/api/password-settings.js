const router = require('express').Router();
const sysError = require('../error');
const {parseAccountSid} = require('./utils');
const PasswordSettings = require('../../models/password-settings');

router.post('/', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    const account_sid = parseAccountSid(req);
    const existing = (await PasswordSettings.retrieve(account_sid) || []).shift();
    let uuid;
    if (existing) {
      uuid = existing.password_settings_sid;
      await PasswordSettings.update(uuid, req.body);
    } else {
      uuid = await PasswordSettings.make({
        account_sid,
        ...req.body
      });
    }
    res.status(201).json({sid: uuid});
  }
  catch (err) {
    sysError(logger, res, err);
  }
});

router.get('/', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    const account_sid = parseAccountSid(req);
    const results = (await PasswordSettings.retrieve(account_sid) || []).shift();
    return res.status(200).json(results || {});
  }
  catch (err) {
    sysError(logger, res, err);
  }
});

router.delete('/', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    const account_sid = parseAccountSid(req);
    await PasswordSettings.delete(account_sid);
    res.status(204).end();
  }
  catch (err) {
    sysError(logger, res, err);
  }
});

module.exports = router;
