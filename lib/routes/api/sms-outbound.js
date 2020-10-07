const router = require('express').Router();
const getProvider = require('../../utils/sms-provider');
const sysError = require('./error');

router.post('/', async(req, res) => {
  const { logger } = req.app.locals;

  try {
    // if provider specified use it, otherwise use first in list
    const arr = getProvider(logger, req.body.provider);
    if (!Array.isArray(arr)) {
      throw new Error('outboundSMS - unable to locate sms provider to use to send message');
    }

    const providerData = arr[1];
    if (!providerData || !providerData.module) {
      throw new Error(`rejecting outgoingSms request for unknown or badly configured provider ${req.body.provider}`);
    }

    const provider = arr[0];
    const opts = providerData.options;
    if (!opts || !opts.url) {
      throw new Error(`rejecting outgoingSms request -- no HTTP url for ${req.body.provider}`);
    }

    // load provider module
    const { sendSms } = require(providerData.module);
    if (!sendSms) {
      throw new Error(`missing sendSms function in module ${providerData.module} for provider ${provider}`);
    }

    // send the SMS
    const payload = req.body;
    delete payload.provider;
    logger.debug({opts, payload}, `outboundSMS - sending to ${opts.url}`);
    const response = await sendSms(opts, payload);
    logger.info({response, payload: req.body}, `outboundSMS - sent to ${opts.url}`);
    res.status(200).json(response);
  } catch (err) {
    sysError(logger, res, err);
  }
});

module.exports = router;
