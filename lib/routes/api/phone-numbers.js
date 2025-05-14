const router = require('express').Router();
const {DbErrorBadRequest, DbErrorForbidden} = require('../../utils/errors');
const PhoneNumber = require('../../models/phone-number');
const VoipCarrier = require('../../models/voip-carrier');
const Account = require('../../models/account');
const decorate = require('./decorate');
const {promisePool} = require('../../db');
const {e164} = require('../../utils/phone-number-utils');
const preconditions = {
  'add': validateAdd,
  'delete': checkInUse,
  'update': validateUpdate
};
const sysError = require('../error');
const { parsePhoneNumberSid } = require('./utils');


/* check for required fields when adding */
async function validateAdd(req) {
  try {
    /* account level user can only act on carriers associated to his/her account */
    if (req.user.hasAccountAuth) {
      req.body.account_sid = req.user.account_sid;
    }

    if (req.user.hasServiceProviderAuth) {
      req.body.service_provider_sid = req.user.service_provider_sid;
    }

    if (!req.body.number) throw new DbErrorBadRequest('number is required');
    const formattedNumber = e164(req.body.number);
    req.body.number = formattedNumber;
  } catch (err) {
    throw new DbErrorBadRequest(err.message);
  }

  /* check that voip carrier exists */
  if (req.body.voip_carrier_sid) {
    const result = await VoipCarrier.retrieve(req.body.voip_carrier_sid);
    if (!result || result.length === 0) {
      throw new DbErrorBadRequest(`voip_carrier not found for sid ${req.body.voip_carrier_sid}`);
    }
    const carrier = result[0];
    if (carrier.account_sid && req.body.account_sid && req.body.account_sid !== carrier.account_sid) {
      throw new DbErrorBadRequest('voip_carrier_sid does not belong to the account');
    }
  }
}

/* can not delete a phone number if it in use */
async function checkInUse(req, sid) {
  const phoneNumber = await PhoneNumber.retrieve(sid);
  if (req.user.hasAccountAuth) {
    if (phoneNumber && phoneNumber.length && phoneNumber[0].account_sid !== req.user.account_sid) {
      throw new DbErrorForbidden('insufficient privileges');
    }
  }
  if (!req.user.hasAccountAuth && phoneNumber.account_sid) {
    throw new DbErrorForbidden('insufficient privileges');
  }
}

/* can not change number or voip carrier */
async function validateUpdate(req, sid) {
  if (req.body.voip_carrier_sid) throw new DbErrorBadRequest('voip_carrier_sid may not be modified');
  if (req.body.number) throw new DbErrorBadRequest('number may not be modified');

  const phoneNumber = await PhoneNumber.retrieve(sid);
  if (req.user.hasAccountAuth) {
    if (phoneNumber && phoneNumber.length && phoneNumber[0].account_sid !== req.user.account_sid) {
      throw new DbErrorForbidden('insufficient privileges');
    }
  }
  if (req.user.hasServiceProviderAuth) {
    let service_provider_sid;

    if (!phoneNumber[0].service_provider_sid) {
      const [r] = await Account.retrieve(phoneNumber[0].account_sid);
      service_provider_sid = r.service_provider_sid;
    } else {
      service_provider_sid = phoneNumber[0].service_provider_sid;
    }

    if (phoneNumber && phoneNumber.length && service_provider_sid !== req.user.service_provider_sid) {
      throw new DbErrorForbidden('insufficient privileges');
    }
  }
  // TODO: if we are assigning to an account, verify it exists

  // TODO: if we are assigning to an application, verify it is associated to the same account

  // TODO: if we are removing from an account, verify we are also removing from application.
}

decorate(router, PhoneNumber, ['add', 'update', 'delete'], preconditions);

/* list */
router.get('/', async(req, res) => {
  const logger = req.app.locals.logger;
  const {account_sid, filter} = req.query;
  try {
    let results = [];
    if (req.user.hasAccountAuth) {
      results = await PhoneNumber.retrieveAllByCriteria({
        account_sid: req.user.account_sid,
        filter
      });
    } else if (req.user.hasServiceProviderAuth) {
      results = await PhoneNumber.retrieveAllByCriteria({
        service_provider_sid: req.user.service_provider_sid,
        account_sid,
        filter
      });
    } else if (req.user.hasAdminAuth) {
      results = await PhoneNumber.retrieveAllByCriteria({
        account_sid,
        filter
      });
    }

    res.status(200).json(results);
  } catch (err) {
    sysError(logger, res, err);
  }
});

/* retrieve */
router.get('/:sid', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    const sid = parsePhoneNumberSid(req);
    const account_sid = req.user.hasAccountAuth ? req.user.account_sid : null;
    const results = await PhoneNumber.retrieve(sid, account_sid);
    if (results.length === 0) return res.status(404).end();

    if (req.user.hasServiceProviderAuth && results.length === 1) {
      const account_sid = results[0].account_sid;
      const [r] = await promisePool.execute(
        'SELECT service_provider_sid from accounts WHERE account_sid = ?', [account_sid]);
      if (r.length === 1 && r[0].service_provider_sid !== req.user.service_provider_sid) {
        throw new DbErrorBadRequest('insufficient privileges');
      }
    }
    if (req.user.hasAccountAuth && results.length > 1) {
      return res.status(200).json(results.filter((r) => r.phone_number_sid === sid)[0]);
    }
    return res.status(200).json(results[0]);
  }
  catch (err) {
    sysError(logger, res, err);
  }
});

module.exports = router;
