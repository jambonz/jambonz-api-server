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

/* check for required fields when adding */
async function validateAdd(req) {
  try {
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
  if (phoneNumber.account_sid) {
    throw new DbErrorUnprocessableRequest('cannot delete phone number that is assigned to an account');  
  }
}

/* can not change number or voip carrier */
async function validateUpdate(req, sid) {
  const result = await PhoneNumber.retrieve(sid);
  if (req.body.voip_carrier_sid) throw new DbErrorBadRequest('voip_carrier_sid may not be modified');
  if (req.body.number) throw new DbErrorBadRequest('number may not be modified');

  // TODO: if we are assigning to an account, verify it exists

  // TODO: if we are assigning to an application, verify it is associated to the same account

  // TODO: if we are removing from an account, verify we are also removing from application.
}

decorate(router, PhoneNumber, ['*'], preconditions);

module.exports = router;
