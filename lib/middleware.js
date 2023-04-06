const logger = require('./logger');

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

module.exports = {
  delayLoginMiddleware
};
