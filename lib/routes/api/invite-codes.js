const router = require('express').Router();
const sysError = require('../error');
const {promisePool} = require('../../db');
const sqlClaim = `UPDATE beta_invite_codes 
SET in_use = 1 
WHERE invite_code = ? 
AND in_use = 0`;
const sqlTest = `SELECT * FROM beta_invite_codes 
WHERE invite_code = ? 
AND in_use = 0`;
router.post('/', async(req, res) => {
  const {logger} = req.app.locals;
  try {
    const {code, test} = req.body;
    logger.debug({code}, 'POST /InviteCodes');
    if ('test' === process.env.NODE_ENV) {
      if (code.endsWith('0')) return res.sendStatus(404);
      res.sendStatus(204);
      return;
    }
    if (test) {
      const [r] = await promisePool.execute(sqlTest, [code]);
      res.sendStatus(1 === r.length ? 204 : 404);
    }
    else {
      const [r] = await promisePool.execute(sqlClaim, [code]);
      res.sendStatus(1 === r.affectedRows ? 204 : 404);
    }
  } catch (err) {
    sysError(logger, res, err);
  }
});

module.exports = router;
