const logger = require('../logger');

/**
 * Send response with delay
 */
class DelayClient {
  constructor() {
    this.min = 0;
    this.max = 150;
    this.desiredDelayInMS = 300;
  }

  async send({ type, data, res, start }) {
    const delayP = this.delayPromise(start, type);
    await delayP();

    switch (type) {
      case 'json':
        return res.json(data);
      case 'status':
      default:
        return res.sendStatus(data);
    }
  }

  delayPromise(start, type) {
    // Sending a json response requires more time, therefore we decrease the max delay
    const max = type === 'json' ? this.max / 4 : this.max;
    const randomDelayInRangeOfMinMax = Math.floor(Math.random() * (max - this.min + 1)) + this.min;

    /* Calculate the process time */
    const end = performance.now();
    const processTime = end - start;

    /* Calculate the diff to the desired delay  */
    const diff = this.desiredDelayInMS - processTime;

    /* Add delay, diff and the random delay */
    const delay = diff + processTime + randomDelayInRangeOfMinMax;

    logger.debug(`delayClient.delayPromise ${delay} = ${processTime} + ${diff} + ${randomDelayInRangeOfMinMax}`);
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
