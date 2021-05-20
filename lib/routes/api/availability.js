const router = require('express').Router();
const {DbErrorBadRequest} = require('../../utils/errors');
const {promisePool} = require('../../db');
const sysError = require('../error');


router.get('/', async(req, res) => {
  const logger = req.app.locals.logger;
  const {type, value} = req.query;

  try {

    if (['email', 'phone'].includes(type)) {
      const field = type === 'email' ? 'email' : 'phone';
      const sql = `SELECT * from users WHERE ${field} = ?`;
      const [r] = await promisePool.execute(sql, [value]);
      res.json({available: 0 === r.length});
    }
    else if (type === 'subdomain') {
      const sql = 'SELECT * from accounts WHERE sip_realm = ?';
      const [r] = await promisePool.execute(sql, [value]);
      res.json({available: 0 === r.length});
    }
    else throw new DbErrorBadRequest(`invalid type: ${type}`);
  } catch (err) {
    sysError(logger, res, err);
  }
});


module.exports = router;
