const router = require('express').Router();
const {DbErrorUnprocessableRequest, DbErrorBadRequest} = require('../../utils/errors');
const PhoneNumber = require('../../models/phone-number');
const VoipCarrier = require('../../models/voip-carrier');
const decorate = require('./decorate');
const validateNumber = require('../../utils/phone-number-syntax');
const preconditions = {
  'add': validateAdd,
  'delete': checkInUse,
  'update': validateUpdate
};
const sysError = require('./error');

/* check for required fields when adding */
async function validateAdd(req) {
  try {
    /* account level user can only act on carriers associated to his/her account */
    if (req.user.hasAccountAuth) {
      req.body.account_sid = req.user.account_sid;
    }

    if (!req.body.voip_carrier_sid) throw new DbErrorBadRequest('voip_carrier_sid is required');
    if (!req.body.number) throw new DbErrorBadRequest('number is required');
    validateNumber(req.body.number);
  } catch (err) {
    throw new DbErrorBadRequest(err.message);
  }

  /* check that voip carrier exists */
  const result = await VoipCarrier.retrieve(req.body.voip_carrier_sid);
  if (!result || result.length === 0) {
    throw new DbErrorBadRequest(`voip_carrier not found for sid ${req.body.voip_carrier_sid}`);
  }
}

/* can not delete a phone number if it in use */
async function checkInUse(req, sid) {
  const phoneNumber = await PhoneNumber.retrieve(sid);
  if (req.user.hasAccountAuth) {
    if (phoneNumber.account_sid !== req.user.account_sid) {
      throw new DbErrorUnprocessableRequest('cannot delete a phone number that belongs to another account');
    }
  }
  if (!req.user.hasAccountAuth && phoneNumber.account_sid) {
    throw new DbErrorUnprocessableRequest('cannot delete phone number that is assigned to an account');
  }
}

/* can not change number or voip carrier */
async function validateUpdate(req, sid) {
  if (req.body.voip_carrier_sid) throw new DbErrorBadRequest('voip_carrier_sid may not be modified');
  if (req.body.number) throw new DbErrorBadRequest('number may not be modified');

  const phoneNumber = await PhoneNumber.retrieve(sid);
  if (req.user.hasAccountAuth) {
    if (phoneNumber.account_sid !== req.user.account_sid) {
      throw new DbErrorUnprocessableRequest('cannot delete a phone number that belongs to another account');
    }
  }
}

decorate(router, PhoneNumber, ['add', 'update', 'delete'], preconditions);

/* list */
router.get('/', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    const results = await PhoneNumber.retrieveAll(req.user.hasAccountAuth ? req.user.account_sid : null);
    res.status(200).json(results);
  } catch (err) {
    sysError(logger, res, err);
  }
});

/* retrieve */
router.get('/:sid', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    const account_sid = req.user.hasAccountAuth ? req.user.account_sid : null;
    const results = await PhoneNumber.retrieve(req.params.sid, account_sid);
    if (results.length === 0) return res.status(404).end();
    return res.status(200).json(results[0]);
  }
  catch (err) {
    sysError(logger, res, err);
  }
});


module.exports = router;
