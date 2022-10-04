const router = require('express').Router();
const sysError = require('../error');
const PasswordSettings = require('../../models/password-settings');
const { DbErrorBadRequest } = require('../../utils/errors');

const validate = (obj) => {
  if (obj.min_password_length && (
    obj.min_password_length < 8 ||
    obj.min_password_length > 20
  )) {
    throw new DbErrorBadRequest('invalid min_password_length property: should be between 8-20');
  }
};

router.post('/', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    validate(req.body);
    const [existing] = (await PasswordSettings.retrieve() || []);
    if (existing) {
      await PasswordSettings.update(req.body);
    } else {
      await PasswordSettings.make(req.body);
    }
    res.status(201).json({});
  }
  catch (err) {
    sysError(logger, res, err);
  }
});

router.get('/', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    const [results] = (await PasswordSettings.retrieve() || []);
    return res.status(200).json(results || {min_password_length: 8});
  }
  catch (err) {
    sysError(logger, res, err);
  }
});
module.exports = router;
