const router = require('express').Router();
const SipGateway = require('../../models/sip-gateway');
const {DbErrorBadRequest, DbErrorForbidden} = require('../../utils/errors');
//const {parseSipGatewaySid} = require('./utils');
const decorate = require('./decorate');
const sysError = require('../error');

const checkUserScope = async(req, voip_carrier_sid) => {
  const {lookupCarrierBySid} = req.app.locals;
  if (!voip_carrier_sid) {
    throw new DbErrorBadRequest('missing voip_carrier_sid');
  }

  if (req.user.hasAdminAuth) return;
  if (req.user.hasAccountAuth) {
    const carrier = await lookupCarrierBySid(voip_carrier_sid);
    if (!carrier) throw new DbErrorBadRequest('invalid voip_carrier_sid');

    if ((!carrier.service_provider_sid || carrier.service_provider_sid === req.user.service_provider_sid) &&
      (!carrier.account_sid || carrier.account_sid === req.user.account_sid)) {

      if (req.method !== 'GET' && !carrier.account_sid) {
        throw new DbErrorForbidden('insufficient privileges');
      }

      return;
    }
  }
  if (req.user.hasServiceProviderAuth) {
    const carrier = await lookupCarrierBySid(voip_carrier_sid);
    if (!carrier) {
      throw new DbErrorBadRequest('invalid voip_carrier_sid');
    }

    if (carrier.service_provider_sid === req.user.service_provider_sid) {
      return;
    }
  }
  throw new DbErrorForbidden('insufficient privileges');
};

const validate = async(req, sid) => {
  const {lookupSipGatewayBySid} = req.app.locals;
  const {netmask} = req.body;
  let voip_carrier_sid;

  if (sid) {
    const gateway = await lookupSipGatewayBySid(sid);
    if (!gateway) throw new DbErrorBadRequest('invalid sip_gateway_sid');
    voip_carrier_sid = gateway.voip_carrier_sid;
  }
  else {
    voip_carrier_sid = req.body.voip_carrier_sid;
    if (!voip_carrier_sid) throw new DbErrorBadRequest('missing voip_carrier_sid');
  }
  if (netmask &&
    process.env.JAMBONZ_MIN_GATEWAY_NETMASK &&
    parseInt(netmask) < process.env.JAMBONZ_MIN_GATEWAY_NETMASK) {
    throw new DbErrorBadRequest(
      `netmask required to have value equal or greater than ${process.env.JAMBONZ_MIN_GATEWAY_NETMASK}`);
  }
  await checkUserScope(req, voip_carrier_sid);
};

const preconditions = {
  'add': validate,
  'update': validate,
  'delete': validate
};

decorate(router, SipGateway, ['add', 'retrieve', 'update', 'delete'], preconditions);

/* list */
router.get('/', async(req, res) => {
  const logger = req.app.locals.logger;
  const voip_carrier_sid = req.query.voip_carrier_sid;
  try {
    await checkUserScope(req, voip_carrier_sid);
    if (!voip_carrier_sid) {
      logger.info('GET /SipGateways missing voip_carrier_sid param');
      return res.status(400).json({message: 'missing voip_carrier_sid query param'});
    }
    const results = await SipGateway.retrieveForVoipCarrier(voip_carrier_sid);
    res.status(200).json(results);
  } catch (err) {
    sysError(logger, res, err);
  }
});

module.exports = router;
