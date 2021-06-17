const router = require('express').Router();
const debug = require('debug')('jambonz:api-server');
const {hashString} = require('../../utils/password-utils');
const sysError = require('../error');

router.post('/', async(req, res) => {
  const {logger, addKey} = req.app.locals;
  const {jwt} = req.user;

  debug(`adding jwt to blacklist: ${jwt}`);

  try {
    /* add key to blacklist */
    const s = `jwt:${hashString(jwt)}`;
    const result = await addKey(s, '1', 3600);
    debug(`result from adding ${s}: ${result}`);
    res.sendStatus(204);
  } catch (err) {
    sysError(logger, res, err);
  }
});

module.exports = router;
