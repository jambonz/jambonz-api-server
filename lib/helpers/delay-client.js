const logger = require('../logger');

/**
 * Send response with delay
 */
class DelayClient {
  constructor(params) {
    const { min, max } = params || {};
    this.min = min ?? 0;
    this.max = max ?? 75;
  }

  async send({ type, data, delay, res }) {
    const delayP = this.delayPromise(delay);
    await delayP();

    switch (type) {
      case 'json':
        return res.json(data);
      case 'status':
      default:
        return res.sendStatus(data);
    }
  }

  delayPromise(delay) {
    const randomDelayInRangeOfMinMax = Math.floor(Math.random() * (this.max - this.min + 1)) + this.min;
    logger.debug(`delayClient.delayPromise delay: ${delay} + ${randomDelayInRangeOfMinMax}`);
    delay = delay + randomDelayInRangeOfMinMax;
    return () => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve();
        }, delay);
      });
    };
  }
}

const delayClient = new DelayClient();

module.exports = { delayClient };
