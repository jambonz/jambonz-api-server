const router = require('express').Router();
const sysError = require('../error');
const PasswordSettings = require('../../models/password-settings');

router.post('/', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    const existing = (await PasswordSettings.retrieve() || []).shift();
    if (existing) {
      await PasswordSettings.update(req.body);
    }
    await PasswordSettings.make(req.body);
    res.status(201).end();
  }
  catch (err) {
    sysError(logger, res, err);
  }
});

router.get('/', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    const results = (await PasswordSettings.retrieve() || []).shift();
    return res.status(200).json(results || {min_password_length: 8});
  }
  catch (err) {
    sysError(logger, res, err);
  }
});
module.exports = router;
