const { DbErrorBadRequest } = require('../utils/errors');

const validateQuery = (query) => {
  const { page = 1, limit = 25 } = query || {};

  query.page = Number(page);
  query.limit = Number(limit);

  if (query.page < 1) {
    throw new DbErrorBadRequest('invalid "page" query parameter');
  }

  switch (query.limit) {
    case 25:
    case 50:
    case 100:
      break;
    default:
      throw new DbErrorBadRequest('invalid "limit" query parameter');
  }

  return true;
};

module.exports = {
  validateQuery
};
