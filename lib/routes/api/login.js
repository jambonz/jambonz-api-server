const router = require('express').Router();
const jwt = require('jsonwebtoken');
const {verifyPassword} = require('../../utils/password-utils');
const {promisePool} = require('../../db');
const sysError = require('../error');
const retrievePemissionsSql = `
SELECT p.name 
FROM permissions p, user_permissions up 
WHERE up.permission_sid = p.permission_sid 
AND up.user_sid = ? 
`;
const retrieveSql = 'SELECT * from users where name = ?';
const tokenSql = 'SELECT token from api_keys where account_sid IS NULL AND service_provider_sid IS NULL';


router.post('/', async(req, res) => {
  const logger = req.app.locals.logger;
  const {username, password} = req.body;
  if (!username || !password) {
    logger.info('Bad POST to /login is missing username or password');
    return res.sendStatus(400);
  }

  try {
    const [r] = await promisePool.query(retrieveSql, username);
    if (r.length === 0) {
      logger.info(`Failed login attempt for user ${username}`);
      return res.sendStatus(403);
    }
    logger.info({r}, 'successfully retrieved user account');
    const isCorrect = await verifyPassword(r[0].hashed_password, password);
    if (!isCorrect) return res.sendStatus(403);
    const force_change = !!r[0].force_change;
    const [t] = await promisePool.query(tokenSql);
    if (t.length === 0) {
      logger.error('Database has no admin token provisioned...run reset_admin_password');
      return res.sendStatus(500);
    }

    if (process.env.JAMBONES_AUTH_USE_JWT) {
      const [p] = await promisePool.query(retrievePemissionsSql, r[0].user_sid);
      const permissions = p.map((x) => x.name);
      const obj = {user_sid: r[0].user_sid, scope: 'admin', force_change, permissions};
      if (r[0].service_provider_sid) {
        obj.scope = 'service-provider';
        obj.service_provider_sid = r[0].service_provider_sid;
      }
      else if (r[0].account_sid) {
        obj.scope = 'account';
        obj.account_sid = r[0].account_sid;
      }
      const token = jwt.sign(
        obj,
        process.env.JWT_SECRET,
        { expiresIn: parseInt(process.env.JWT_EXPIRES_IN || 60) * 60 }
      );
      res.json({...obj, token});
    }
    else {
      res.json({user_sid: r[0].user_sid, force_change, token: t[0].token});
    }
  } catch (err) {
    sysError(logger, res, err);
  }
});


module.exports = router;
