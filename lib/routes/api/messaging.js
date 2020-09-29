const router = require('express').Router();
const request = require('request');
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
      logger.info({partners}, 'Messaging partners configuration');
    } catch (err) {
      logger.error(err, `expected JSON for JAMBONES_MESSAGING : ${process.env.JAMBONES_MESSAGING}`);
    }
  }
}

router.post('/:partner', async(req, res) => {
  const partner = req.params.partner;
  const {retrieveSet, logger} = req.app.locals;
  const setName = `${(process.env.JAMBONES_CLUSTER_ID || 'default')}:active-fs`;

  // one time load of partner-specific filter and respond functions
  initPartners(logger);

  const partnerModule = partners[partner];
  if (!partnerModule) {
    logger.info(`rejecting incomingSms request from unknown partner ${partner}`);
    return res.sendStatus(404);
  }

  let filterFn, respondFn;
  try {
    const {filter, respond} = require(partnerModule);
    // must at least provide a filter function
    if (!filter) {
      logger.info(`missing filter function in module ${partnerModule} for partner ${partner}`);
      return res.sendStatus(404);
    }
    filterFn = filter;
    if (!respond) respondFn = res.sendStatus.bind(null, 200);
    else if (typeof respond === 'number' && respond >= 200 && respond < 299) {
      respondFn = res.sendStatus.bind(null, respond);
    }
    else respondFn;
  } catch (err) {
    logger.info(err, `failure loading module ${partnerModule} for partner ${partner}`);
    return res.sendStatus(500);
  }

  try {
    const fs = await retrieveSet(setName);
    if (0 === fs.length) {
      logger.info('No available feature servers to handle createCall API request');
      return res.json({msg: 'no available feature servers at this time'}).status(480);
    }
    const ip = fs[idx++ % fs.length];
    const serviceUrl = `http://${ip}:3000/v1/messaging/${partner}`;

    const payload = Promise.resolve(filterFn(req.body, req));
    logger.debug({payload, url: serviceUrl}, `sending incomingSms API request to FS at ${ip}`);
    request({
      url: serviceUrl,
      method: 'POST',
      json: true,
      body: payload
    }, async(err, response, body) => {
      if (err) {
        logger.error(err, `Error sending incomingSms POST to ${ip}`);
        return res.sendStatus(500);
      }
      if (201 === response.statusCode) {
        // success
        return doSendResponse(res, respondFn, body);
      }
      logger.error({statusCode: response.statusCode}, `Non-success response returned by createCall ${ip}`);
      return res.sendStatus(500);
    });
  } catch (err) {
    sysError(logger, res, err);
  }
});

async function doSendResponse(res, respondFn, body) {
  const payload = await respondFn(body);
  if (typeof payload === 'number') return res.sendStatus(payload);
  else if (typeof payload === 'string') return res.status(200).json(payload);
  else return res.sendStatus(200);
}
module.exports = router;
