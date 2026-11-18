const logger = require('./logger');
const {UserPermissionError} = require('./utils/errors');

function delayLoginMiddleware(req, res, next) {
  if (req.path.includes('/login') || req.path.includes('/signin')) {
    const min = 200;
    const max = 1000;
    /* Random delay between 200 - 1000ms */
    const sendStatusDelay = Math.floor(Math.random() * (max - min + 1)) + min;

    /* the res.json take longer, we decrease the max delay slightly to 0-800ms */
    const jsonDelay = Math.floor(Math.random() * 800);
    logger.debug(`delayLoginMiddleware: sendStatus ${sendStatusDelay} - json ${jsonDelay}`);
    const sendStatus = res.sendStatus;
    const json = res.json;

    res.sendStatus = function(status) {
      setTimeout(() => {
        sendStatus.call(res, status);
      }, sendStatusDelay);
    };
    res.json = function(body) {
      setTimeout(() => {
        json.call(res, body);
      }, jsonDelay);
    };
  }
  next();
}

/* The only write a view-only user is allowed: changing their OWN password.
 *
 * The previous test was just `req.body.old_password && req.body.new_password`,
 * evaluated before the view-only check and against ANY request. A view-only
 * principal could therefore attach those two fields as decoys to any
 * privileged write -- POST /Applications, PUT /Accounts/:sid,
 * DELETE /PhoneNumbers/:sid -- and sail past the restriction.
 *
 * Narrowed to: a password change, carrying nothing but a password change,
 * against the caller's own record.
 */
const PASSWORD_CHANGE_KEYS = new Set(['old_password', 'new_password']);

function isOwnPasswordChange(req) {
  const body = req.body;
  if (!body?.old_password || !body?.new_password) return false;

  /* no other mutation may ride along on the exemption */
  if (Object.keys(body).some((k) => !PASSWORD_CHANGE_KEYS.has(k))) return false;

  const path = req.originalUrl.split('?')[0];

  /* POST /v1/change-password acts on req.user, so it is self by construction */
  if (/\/change-password\/?$/.test(path)) return true;

  /* PUT /v1/Users/<the caller's own user_sid> */
  const m = /\/Users\/([^/?]+)/.exec(path);
  return !!(m && req.user?.user_sid && m[1] === req.user.user_sid);
}

function verifyViewOnlyUser(req, res, next) {
  // Skip check for GET requests
  if (req.method === 'GET') {
    return next();
  }
  // a view-only user may still change their own password, and nothing else
  if (isOwnPasswordChange(req)) {
    return next();
  }
  // Check if user is read-only
  if (req.user && !!req.user.is_view_only) {
    const upError = new UserPermissionError('User has view-only access');
    upError.status = 403;
    throw upError;
  }

  next();
}

module.exports = {
  delayLoginMiddleware,
  verifyViewOnlyUser
};
