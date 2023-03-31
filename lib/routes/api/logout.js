const router = require('express').Router();
const debug = require('debug')('jambonz:api-server');
const {cacheClient} = require('../../helpers');
const sysError = require('../error');

router.post('/', async(req, res) => {
  const {logger} = req.app.locals;
  const {user_sid} = req.user;

  debug(`logout user and invalidate jwt token for user: ${user_sid}`);

  try {
    const redisKey = cacheClient.generateRedisKey('jwt', user_sid, 'v2');
    await cacheClient.delete(redisKey);

    res.sendStatus(204);
  } catch (err) {
    sysError(logger, res, err);
  }
});

module.exports = router;
