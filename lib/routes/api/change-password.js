const router = require('express').Router();
//const debug = require('debug')('jambonz:api-server');
const {DbErrorBadRequest} = require('../../utils/errors');
const {generateHashedPassword, verifyPassword} = require('../../utils/password-utils');
const {promisePool} = require('../../db');
const sysError = require('../error');
const sqlUpdatePassword = `UPDATE users 
SET hashed_password= ? 
WHERE user_sid = ?`;

router.post('/', async(req, res) => {
  const {logger, retrieveKey, deleteKey} = req.app.locals;
  const {user_sid} = req.user;
  const {old_password, new_password} = req.body;
  try {
    if (!old_password || !new_password) throw new DbErrorBadRequest('missing old_password or new_password');

    /* validate existing password */
    {
      const [r] = await promisePool.query('SELECT * from users where user_sid = ?', user_sid);
      logger.debug({user: [r[0]]}, 'change password for user');

      if (r[0].provider !== 'local') {
        throw new DbErrorBadRequest('user is using oauth authentication');
      }

      const isCorrect = await verifyPassword(r[0].hashed_password, old_password);
      if (!isCorrect) {
        const key = `reset-link:${old_password}`;
        const user_sid = await retrieveKey(key);
        if (!user_sid) throw new DbErrorBadRequest('old_password is incorrect');
        await deleteKey(key);
      }
    }

    /* store new password */
    const passwordHash = await generateHashedPassword(new_password);
    const [r] = await promisePool.execute(sqlUpdatePassword, [passwordHash, user_sid]);
    if (r.affectedRows !== 1) throw new Error('failed to update user with new password');
    res.sendStatus(204);
  } catch (err) {
    sysError(logger, res, err);
    return;
  }
});

module.exports = router;
