const partners = new Map();

function initPartners(logger) {
  if (process.env.JAMBONES_MESSAGING) {
    try {
      const obj = JSON.parse(process.env.JAMBONES_MESSAGING);
      for (const [key, value] of Object.entries(obj)) {
        logger.debug({config: value}, `Adding SMS provider ${key}`);
        partners.set(key, value);
      }
      logger.info(`Configured ${partners.size} SMS partners`);
    } catch (err) {
      logger.error(err, `expected JSON for JAMBONES_MESSAGING : ${process.env.JAMBONES_MESSAGING}`);
    }
  }
  else {
    logger.info('no JAMBONES_MESSAGING env var, messaging is disabled');
  }
}

function getPartner(logger, partner) {
  if (typeof partner === 'string') {
    const config = partners.get(partner);
    const arr = [partner, config];
    logger.debug({arr}, 'getPartner by name');
    return arr;
  }
  else if (partners.size) {
    const arr = partners.entries().next().value;
    logger.debug({arr}, 'getPartner by first available');
    return arr;
  }
}

module.exports = (logger) => {
  initPartners(logger);
  return getPartner.bind(null, logger);
};
