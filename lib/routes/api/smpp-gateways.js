const router = require('express').Router();
const SmppGateway = require('../../models/smpp-gateway');
const {DbErrorBadRequest, DbErrorUnprocessableRequest} = require('../../utils/errors');
const decorate = require('./decorate');
const sysError = require('../error');

const checkUserScope = async(req, voip_carrier_sid) => {
  const {lookupCarrierBySid} = req.app.locals;
  if (req.hasAccountAuth) {
    const carrier = await lookupCarrierBySid(voip_carrier_sid);
    if (!carrier) throw new DbErrorBadRequest('invalid voip_carrier_sid');
    if (carrier.account_sid !== req.user.account_sid) {
      throw new DbErrorUnprocessableRequest('user can not add gateway for voip_carrier belonging to other account');
    }
  }
  if (req.hasServiceProviderAuth) {
    const carrier = await lookupCarrierBySid(voip_carrier_sid);
    if (!carrier) throw new DbErrorBadRequest('invalid voip_carrier_sid');
    if (carrier.service_provider_sid !== req.user.service_provider_sid) {
      throw new DbErrorUnprocessableRequest('user can not add gateway for voip_carrier belonging to other account');
    }
  }
  return;
};

const validate = async(req, sid) => {
  const {lookupSmppGatewayBySid} = req.app.locals;
  let voip_carrier_sid;

  if (sid) {
    const gateway = await lookupSmppGatewayBySid(sid);
    if (!gateway) throw new DbErrorBadRequest('invalid smpp_gateway_sid');
    voip_carrier_sid = gateway.voip_carrier_sid;
  }
  else {
    voip_carrier_sid = req.body.voip_carrier_sid;
    if (!voip_carrier_sid) throw new DbErrorBadRequest('missing voip_carrier_sid');
  }

  await checkUserScope(req, voip_carrier_sid);
};

const preconditions = {
  'add': validate,
  'update': validate,
  'delete': validate
};

decorate(router, SmppGateway, ['add', 'retrieve', 'update', 'delete'], preconditions);

/* list */
router.get('/', async(req, res) => {
  const logger = req.app.locals.logger;
  const voip_carrier_sid = req.query.voip_carrier_sid;
  try {
    await checkUserScope(req, voip_carrier_sid);
    if (!voip_carrier_sid) {
      logger.info('GET /SmppGateways missing voip_carrier_sid param');
      return res.status(400).json({message: 'missing voip_carrier_sid query param'});
    }
    const results = await SmppGateway.retrieveForVoipCarrier(voip_carrier_sid);
    res.status(200).json(results);
  } catch (err) {
    sysError(logger, res, err);
  }
});

module.exports = router;
