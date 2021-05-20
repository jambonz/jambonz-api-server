const router = require('express').Router();
const {DbErrorBadRequest} = require('../../utils/errors');
const PredefinedCarrier = require('../../models/predefined-carrier');
const VoipCarrier = require('../../models/voip-carrier');
const SipGateway = require('../../models/sip-gateway');
const {promisePool} = require('../../db');
const sysError = require('../error');

const sqlSelectCarrierByName = `SELECT * FROM voip_carriers 
WHERE account_sid = ? 
AND name = ?`;
const sqlSelectTemplateGateways = `SELECT * FROM predefined_sip_gateways 
WHERE predefined_carrier_sid = ?`;


router.post('/:sid', async(req, res) => {
  const logger = req.app.locals.logger;
  const {sid } = req.params;
  const {account_sid} = req.user;
  try {
    const [template] = await PredefinedCarrier.retrieve(sid);
    logger.debug({template}, `Retrieved template carrier for sid ${sid}`);
    if (!template) return res.sendStatus(404);

    /* make sure not to add the same carrier twice */
    const [r2] = await promisePool.query(sqlSelectCarrierByName, [account_sid, template.name]);
    if (r2.length > 0) {
      logger.info({account_sid}, `Failed to add carrier with name ${template.name}, carrier of that name exists`);
      throw new DbErrorBadRequest(`A carrier with name ${template.name} already exists`);
    }

    /* retrieve all the gateways */
    const [r3] = await promisePool.query(sqlSelectTemplateGateways, template.predefined_carrier_sid);
    logger.debug({r3}, `retrieved template gateways for ${template.name}`);

    /* add a voip_carrier */
    // eslint-disable-next-line no-unused-vars
    const {requires_static_ip, predefined_carrier_sid, ...obj} = template;
    const uuid = await VoipCarrier.make({...obj, account_sid});

    /* add all the gateways */
    for (const gw of r3) {
      // eslint-disable-next-line no-unused-vars
      const {predefined_carrier_sid, predefined_sip_gateway_sid, ...obj} = gw;
      logger.debug({obj}, 'adding gateway');
      await SipGateway.make({...obj, voip_carrier_sid: uuid});
    }
    res.status(201).json({sid: uuid});
  } catch (err) {
    logger.error({err}, 'Error adding voip_carrier from template');
    sysError(logger, res, err);
  }
});

module.exports = router;
