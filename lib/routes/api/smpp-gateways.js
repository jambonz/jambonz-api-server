const router = require('express').Router();
const SmppGateway = require('../../models/smpp_gateway');
const {DbErrorBadRequest, DbErrorUnprocessableRequest} = require('../../utils/errors');
const decorate = require('./decorate');

const validate = async(req, sid) => {
  const {lookupCarrierBySid, lookupSmppGatewayBySid} = req.app.locals;
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

decorate(router, SmppGateway, ['*'], preconditions);

module.exports = router;
