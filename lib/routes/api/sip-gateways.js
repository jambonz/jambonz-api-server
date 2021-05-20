const router = require('express').Router();
const SipGateway = require('../../models/sip-gateway');
const {DbErrorBadRequest, DbErrorUnprocessableRequest} = require('../../utils/errors');
const decorate = require('./decorate');

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

decorate(router, SipGateway, ['*'], preconditions);

module.exports = router;
