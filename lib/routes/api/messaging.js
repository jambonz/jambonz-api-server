const router = require('express').Router();
const request = require('request');
const uuidv4 = require('uuid/v4');
const sysError = require('./error');
const partners = {};
let initialized = false;
let idx = 0;

function initPartners(logger) {
  if (initialized) return;
  initialized = true;

  if (process.env.JAMBONES_MESSAGING) {
    try {
      const obj = JSON.parse(process.env.JAMBONES_MESSAGING);
      Object.assign(partners, obj);
      logger.info({
        partners
      }, 'Messaging partners configuration');
    } catch (err) {
      logger.error(err, `expected JSON for JAMBONES_MESSAGING : ${process.env.JAMBONES_MESSAGING}`);
    }
  }
  else {
    logger.info('no JAMBONES_MESSAGING env var, messaging is disabled');
  }
}

async function doSendResponse(res, respondFn, body) {
  if (typeof respondFn === 'number') res.sendStatus(respondFn);
  else if (typeof respondFn !== 'function') res.sendStatus(200);
  else {
    const payload = await respondFn(body);
    res.status(200).json(payload);
  }
}

router.post('/:partner', async(req, res) => {
  const partner = req.params.partner;
  const {
    retrieveSet,
    lookupAppByPhoneNumber,
    logger
  } = req.app.locals;
  const setName = `${process.env.JAMBONES_CLUSTER_ID || 'default'}:active-fs`;

  // search for partner module
  initPartners(logger);

  const partnerData = partners[partner];
  if (!partnerData || !partnerData.module || !partnerData.options) {
    logger.info(
      `rejecting incomingSms request from unknown or badly configured partner ${partner}`
    );
    return res.sendStatus(404);
  }

  // load partner module
  let filterFn, respondFn;
  try {
    const {
      fromProviderFormat,
      formatProviderResponse
    } = require(partnerData.module);
    // must at least provide a filter function
    if (!fromProviderFormat) {
      logger.info(
        `missing fromProviderFormat function in module ${partnerData.module} for partner ${partner}`
      );
      return res.sendStatus(404);
    }
    filterFn = fromProviderFormat;
    respondFn = formatProviderResponse;
  } catch (err) {
    logger.info(
      err,
      `failure loading module ${partnerData.module} for partner ${partner}`
    );
    return res.sendStatus(500);
  }

  try {
    const fs = await retrieveSet(setName);
    if (0 === fs.length) {
      logger.info('No available feature servers to handle createCall API request');
      return res
        .json({
          msg: 'no available feature servers at this time'
        })
        .status(480);
    }
    const ip = fs[idx++ % fs.length];
    const serviceUrl = `http://${ip}:3000/v1/messaging/${partner}`;
    const messageSid = uuidv4();
    const payload = await Promise.resolve(filterFn({messageSid}, req.body));

    /**
     * lookup the application associated with the number in the To field
     * since there could be multiple Tos, we have to search through (and cc also)
     */
    let app;
    const dids = [payload.to].concat([payload.cc]).filter((n) => n.length);
    for (let did of dids) {
      const regex = /^\+(\d+)$/;
      const arr = regex.exec(did);
      did = arr ? arr[1] : did;
      const obj = await lookupAppByPhoneNumber(did);
      logger.info({obj}, `lookup app for phone number ${did}`);
      if (obj) {
        logger.info({did, obj}, 'Found app for DID');
        app = obj;
        break;
      }
    }
    if (!app) {
      logger.info({payload}, 'No application found for incoming SMS');
      return res.sendStatus(404);
    }
    if (!app.messaging_hook) {
      logger.info({payload}, `app "${app.name}" found for incoming SMS does not have an associated messaging hook`);
      return res.sendStatus(404);
    }

    payload.applicationSid = app.application_sid;
    payload.accountSid = app.account_sid;
    payload.messaging_hook = app.messaging_hook;

    logger.debug({body: req.body, payload}, 'filtered incoming SMS');

    logger.info({payload, url: serviceUrl}, `sending incomingSms API request to FS at ${ip}`);

    request({
      url: serviceUrl,
      method: 'POST',
      json: true,
      body: payload,
    },
    async(err, response, body) => {
      if (err) {
        logger.error(err, `Error sending incomingSms POST to ${ip}`);
        return res.sendStatus(500);
      }
      if (201 === response.statusCode) {
        // success
        return doSendResponse(res, respondFn, body);
      }
      logger.error({statusCode: response.statusCode}, `Non-success response returned by incomingSms ${ip}`);
      return res.sendStatus(500);
    });
  } catch (err) {
    sysError(logger, res, err);
  }
});

module.exports = router;
