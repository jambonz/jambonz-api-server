const router = require('express').Router();
const SipGateway = require('../../models/sip-gateway');
const {DbErrorBadRequest, DbErrorUnprocessableRequest} = require('../../utils/errors');
const decorate = require('./decorate');
const sysError = require('../error');

const validate = async(req, sid) => {
  const {lookupCarrierBySid, lookupSipGatewayBySid} = req.app.locals;
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
  if (req.hasAccountAuth) {
    const carrier = await lookupCarrierBySid(voip_carrier_sid);
    if (!carrier) throw new DbErrorBadRequest('invalid voip_carrier_sid');
    if (carrier.account_sid !== req.user.account_sid) {
      throw new DbErrorUnprocessableRequest('user can not add gateway for voip_carrier belonging to other account');
    }
  }
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
