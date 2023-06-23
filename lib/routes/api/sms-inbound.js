const router = require('express').Router();
const request = require('request');
const getProvider = require('../../utils/sms-provider');
const { v4: uuidv4 } = require('uuid');
const sysError = require('../error');
let idx = 0;

const getFsUrl = async(logger, retrieveSet, setName, provider) => {
  if (process.env.K8S) return `http://${process.env.K8S_FEATURE_SERVER_SERVICE_NAME}:3000/v1/messaging/${provider}`;

  try {
    const fs = await retrieveSet(setName);
    if (0 === fs.length) {
      logger.info('No available feature servers to handle createCall API request');
      return ;
    }
    const f = fs[idx++ % fs.length];
    logger.info({fs}, `feature servers available for createCall API request, selecting ${f}`);
    return `${f}/v1/messaging/${provider}`;
  } catch (err) {
    logger.error({err}, 'getFsUrl: error retreving feature servers from redis');
  }
};

const doSendResponse = async(res, respondFn, body) => {
  if (typeof respondFn === 'number') res.sendStatus(respondFn);
  else if (typeof respondFn !== 'function') res.sendStatus(200);
  else {
    const payload = await respondFn(body);
    res.status(200).json(payload);
  }
};

router.post('/:provider', async(req, res) => {
  const provider = req.params.provider;
  const {
    retrieveSet,
    lookupAppByPhoneNumber,
    logger
  } = req.app.locals;
  const setName = `${process.env.JAMBONES_CLUSTER_ID || 'default'}:fs-service-url`;
  logger.debug({path: req.path, body: req.body}, 'incomingSMS from carrier');

  // search for provider module
  const arr = getProvider(logger, provider);
  if (!arr) {
    logger.info({body: req.body, params: req.params},
      `rejecting incomingSms request from unknown provider ${provider}`
    );
    return res.sendStatus(404);
  }

  const providerData = arr[1];
  if (!providerData || !providerData.module) {
    logger.info({body: req.body, params: req.params},
      `rejecting incomingSms request from badly configured provider ${provider}`
    );
    return res.sendStatus(404);
  }

  // load provider module
  let filterFn, respondFn;
  try {
    const {
      fromProviderFormat,
      formatProviderResponse
    } = require(providerData.module);
    // must at least provide a filter function
    if (!fromProviderFormat) {
      logger.info(
        `missing fromProviderFormat function in module ${providerData.module} for provider ${provider}`
      );
      return res.sendStatus(404);
    }
    filterFn = fromProviderFormat;
    respondFn = formatProviderResponse;
  } catch (err) {
    logger.info(
      err,
      `failure loading module ${providerData.module} for provider ${provider}`
    );
    return res.sendStatus(500);
  }

  try {
    const serviceUrl = await getFsUrl(logger, retrieveSet, setName, provider);
    if (!serviceUrl) res.json({msg: 'no available feature servers at this time'}).status(480);
    const messageSid = uuidv4();
    const payload = await Promise.resolve(filterFn({messageSid}, req.body));

    /**
     * lookup the application associated with the number in the To field
     * since there could be multiple Tos, we have to search through (and cc also)
     */
    let app;
    const to = Array.isArray(payload.to) ? payload.to : [payload.to];
    const cc = Array.isArray(payload.cc) ? payload.cc : (payload.cc ? [payload.cc] : []);
    const dids = to.concat(cc).filter((n) => n.length);
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
    payload.app = app;

    logger.debug({body: req.body, payload}, 'filtered incoming SMS');

    logger.info({payload, url: serviceUrl}, `sending incomingSms API request to FS at ${serviceUrl}`);

    request({
      url: serviceUrl,
      method: 'POST',
      json: true,
      body: payload,
    },
    async(err, response, body) => {
      if (err) {
        logger.error(err, `Error sending incomingSms POST to ${serviceUrl}`);
        return res.sendStatus(500);
      }
      if (200 === response.statusCode) {
        // success
        logger.info({body}, 'sending response to provider for incomingSMS');
        return doSendResponse(res, respondFn, body);
      }
      logger.error({statusCode: response.statusCode}, `Non-success response returned by incomingSms ${serviceUrl}`);
      return res.sendStatus(500);
    });
  } catch (err) {
    sysError(logger, res, err);
  }
});

module.exports = router;
