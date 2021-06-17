const router = require('express').Router();
const sysError = require('../error');
const {promisePool} = require('../../db');
const short = require('short-uuid');
const translator = short('0123456789ABCXZ');

router.post('/', async(req, res) => {
  const {logger} = req.app.locals;
  logger.debug({payload: req.body}, 'POST /BetaInviteCodes');
  try {
    const {count} = req.body || {};
    const total = Math.max(count || 1, 1);
    const codes = [];
    let added = 0;
    while (added < total) {
      const code = translator.new().substring(0, 6);
      if (!codes.find((c) => c === code)) {
        codes.push(code);
        added++;
      }
    }

    const values = codes.map((c) => `('${c}')`).join(',');
    const sql = `INSERT INTO beta_invite_codes (invite_code) VALUES ${values}`;
    const [r] = await promisePool.query(sql);
    res.status(200).json({status: 'ok', added: r.affectedRows, codes});
  } catch (err) {
    sysError(logger, res, err);
  }
});

module.exports = router;
