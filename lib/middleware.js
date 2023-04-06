const logger = require('./logger');

function delayLoginMiddleware(req, res, next) {
  if (req.path.includes('/login') || req.path.includes('/signin')) {
    const randomDelay = Math.floor(Math.random() * 1000); // Generate a random delay between 0 and 1000 milliseconds
    const sendStatus = res.sendStatus;
    const json = res.json;
    const randomDelayJson = randomDelay / 2;

    logger.debug(`delayLoginMiddleware: sendStatus ${randomDelay} - json ${randomDelayJson}`);
    res.sendStatus = function(status) {
      setTimeout(() => {
        sendStatus.call(res, status);
      }, randomDelay);
    };
    res.json = function(body) {
      setTimeout(() => {
        json.call(res, body);
      }, randomDelayJson);
    };
  }
  next();
}

module.exports = {
  delayLoginMiddleware
};
