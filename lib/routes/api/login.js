const router = require('express').Router();
const jwt = require('jsonwebtoken');
const {verifyPassword} = require('../../utils/password-utils');
const {promisePool} = require('../../db');
const {cacheClient} = require('../../helpers');
const Account = require('../../models/account');
const ServiceProvider = require('../../models/service-provider');
const sysError = require('../error');
const { delayClient } = require('../../helpers/delay-client');
const retrievePemissionsSql = `
SELECT p.name 
FROM permissions p, user_permissions up 
WHERE up.permission_sid = p.permission_sid 
AND up.user_sid = ? 
`;
const retrieveSql = 'SELECT * from users where name = ?';
const tokenSql = 'SELECT token from api_keys where account_sid IS NULL AND service_provider_sid IS NULL';


router.post('/', async(req, res) => {
  const start = performance.now();
  const logger = req.app.locals.logger;
  const {username, password} = req.body;
  if (!username || !password) {
    logger.info('Bad POST to /login is missing username or password');

    return await delayClient.send({
      type: 'status',
      data: 400,
      start,
      res
    });
  }

  try {
    const [r] = await promisePool.query(retrieveSql, username);
    if (r.length === 0) {
      logger.info(`Failed login attempt for user ${username}`);
      return await delayClient.send({
        type: 'status',
        data: 403,
        start,
        res
      });
    }
    logger.info({r}, 'successfully retrieved user account');
    const isCorrect = await verifyPassword(r[0].hashed_password, password);
    if (!isCorrect) {

      return await delayClient.send({
        type: 'status',
        data: 403,
        start,
        res
      });
    }
    const force_change = !!r[0].force_change;
    const [t] = await promisePool.query(tokenSql);
    if (t.length === 0) {
      logger.error('Database has no admin token provisioned...run reset_admin_password');

      return await delayClient.send({
        type: 'status',
        data: 500,
        start,
        res
      });
    }

    const [p] = await promisePool.query(retrievePemissionsSql, r[0].user_sid);
    const permissions = p.map((x) => x.name);
    const obj = {user_sid: r[0].user_sid, scope: 'admin', force_change, permissions};
    if (r[0].service_provider_sid && r[0].account_sid) {
      const account = await Account.retrieve(r[0].account_sid);
      const service_provider = await ServiceProvider.retrieve(r[0].service_provider_sid);
      obj.scope = 'account';
      obj.service_provider_sid = r[0].service_provider_sid;
      obj.account_sid = r[0].account_sid;
      obj.account_name = account[0].name;
      obj.service_provider_name = service_provider[0].name;
    }
    else if (r[0].service_provider_sid) {
      const service_provider = await ServiceProvider.retrieve(r[0].service_provider_sid);
      obj.scope = 'service_provider';
      obj.service_provider_sid = r[0].service_provider_sid;
      obj.service_provider_name = service_provider[0].name;
    }
    const payload = {
      scope: obj.scope,
      permissions,
      ...(obj.service_provider_sid && {
        service_provider_sid: obj.service_provider_sid,
        service_provider_name: obj.service_provider_name
      }),
      ...(obj.account_sid && {
        account_sid: obj.account_sid,
        account_name: obj.account_name,
        service_provider_name: obj.service_provider_name
      }),
      user_sid: obj.user_sid
    };

    const expiresIn = parseInt(process.env.JWT_EXPIRES_IN || 60) * 60;
    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn }
    );

    await delayClient.send({
      type: 'json',
      data: { token, ...obj },
      start,
      res
    });

    /* Store jwt based on user_id after successful login */
    await cacheClient.set({
      redisKey: cacheClient.generateRedisKey('jwt', obj.user_sid, 'v2'),
      value: token,
      time: expiresIn,
    });

  } catch (err) {
    sysError(logger, res, err);
  }
});


module.exports = router;
