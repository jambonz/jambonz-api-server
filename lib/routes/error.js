const {
  BadRequestError,
  DbErrorBadRequest,
  DbErrorUnprocessableRequest,
  DbErrorForbidden
} = require('../utils/errors');

function sysError(logger, res, err) {
  if (err instanceof BadRequestError) {
    logger.info(err, err.message);
    return res.status(400).json({msg: 'Bad request'});
  }
  if (err instanceof DbErrorBadRequest) {
    logger.info(err, 'invalid client request');
    return res.status(400).json({msg: err.message});
  }
  if (err instanceof DbErrorUnprocessableRequest) {
    logger.info(err, 'unprocessable request');
    return res.status(422).json({msg: err.message});
  }
  if (err instanceof DbErrorForbidden) {
    logger.info(err, 'forbidden');
    return res.status(403).json({msg: err.message});
  }
  if (err.code === 'ER_DUP_ENTRY') {
    logger.info(err, 'duplicate entry on insert');
    return res.status(422).json({msg: err.message});
  }
  logger.error(err, 'Database error');
  res.status(500).json({msg: err.message});
}

module.exports = sysError;
