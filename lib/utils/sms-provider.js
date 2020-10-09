const providers = new Map();
let init = false;

function initProviders(logger) {
  if (init) return;
  if (process.env.JAMBONES_MESSAGING) {
    try {
      const obj = JSON.parse(process.env.JAMBONES_MESSAGING);
      for (const [key, value] of Object.entries(obj)) {
        logger.debug({config: value}, `Adding SMS provider ${key}`);
        providers.set(key, value);
      }
      logger.info(`Configured ${providers.size} SMS providers`);
    } catch (err) {
      logger.error(err, `expected JSON for JAMBONES_MESSAGING : ${process.env.JAMBONES_MESSAGING}`);
    }
  }
  else {
    logger.info('no JAMBONES_MESSAGING env var, messaging is disabled');
  }
  init = true;
}

function getProvider(logger, partner) {
  initProviders(logger);
  if (typeof partner === 'string') {
    const config = providers.get(partner);
    const arr = [partner, config];
    logger.debug({arr}, 'getProvider by name');
    return arr;
  }
  else if (providers.size) {
    const arr = providers.entries().next().value;
    logger.debug({arr}, 'getProvider by first available');
    return arr;
  }
}

module.exports = getProvider;

