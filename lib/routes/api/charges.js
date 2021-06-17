const router = require('express').Router();
const sysError = require('../error');
//const {DbErrorUnprocessableRequest, DbErrorBadRequest} = require('../../utils/errors');


/**
 * retrieve charges for an account and/or call
 */
router.get('/', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    res.status(200).json([
      {
        charge_sid: 'f8d2a604-ed29-4eac-9efc-8f58b0e438ca',
        account_sid: req.user.account_sid,
        call_billing_record_sid: 'e4be80a4-6597-49cf-8605-6b94493fada1',
        billed_at: '2020-01-01 15:10:10',
        billed_activity: 'outbound-call',
        call_secs_billed: 392,
        amount_charged: 0.0200
      },
      {
        charge_sid: 'd9659f3f-3a94-455c-9e8e-3b36f250ffc8',
        account_sid: req.user.account_sid,
        call_billing_record_sid: 'e4be80a4-6597-49cf-8605-6b94493fada1',
        billed_at: '2020-01-01 15:10:10',
        billed_activity: 'tts',
        tts_chars_billed: 100,
        amount_charged: 0.0130
      },
      {
        charge_sid: 'adcc1e79-eb79-4370-ab74-4c2e9a41339a',
        account_sid: req.user.account_sid,
        call_billing_record_sid: 'e4be80a4-6597-49cf-8605-6b94493fada1',
        billed_at: '2020-01-01 15:10:10',
        billed_activity:  'stt',
        stt_secs_billed: 30,
        amount_charged: 0.0015
      }
    ]);
  } catch (err) {
    sysError(logger, res, err);
  }
});

module.exports = router;
