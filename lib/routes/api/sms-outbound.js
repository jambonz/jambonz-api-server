const router = require('express').Router();
const smsPartnerFn = require('../../utils/sms-partner');
const sysError = require('./error');

router.post('/', async(req, res) => {
  const { logger } = req.app.locals;
  const getPartner = smsPartnerFn(logger);

  try {
    // if partner specified use it, otherwise use first in list
    const arr = getPartner(req.body.partner);
    if (!Array.isArray(arr)) {
      throw new Error('outboundSMS - unable to locate sms provider to use to send message');
    }

    const partnerData = arr[1];
    if (!partnerData || !partnerData.module) {
      throw new Error(`rejecting outgoingSms request for unknown or badly configured partner ${req.body.partner}`);
    }

    const partnerName = arr[0];
    const opts = partnerData.options;
    if (!opts || !opts.url) {
      throw new Error(`rejecting outgoingSms request -- no HTTP url for ${req.body.partner}`);
    }

    // load partner module
    const { sendSms } = require(partnerData.module);
    if (!sendSms) {
      throw new Error(`missing sendSms function in module ${partnerData.module} for partner ${partnerName}`);
    }

    // send the SMS
    const response = await sendSms(opts, req.body);
    logger.info({response, payload: req.body}, `outboundSMS - sent to ${opts.url}`);
    res.status(200).json({'status': 'ok'});
  } catch (err) {
    sysError(logger, res, err);
  }
});

module.exports = router;
