const {DbErrorBadRequest, DbErrorUnprocessableRequest} = require('../../utils/errors');

function sysError(logger, res, err) {
  if (err instanceof DbErrorBadRequest) {
    logger.error(err, 'invalid client request');
    return res.status(400).json({msg: err.message});
  }
  if (err instanceof DbErrorUnprocessableRequest) {
    logger.error(err, 'unprocessable request');
    return res.status(422).json({msg: err.message});
  }
  if (err.message.includes('ER_DUP_ENTRY')) {
    logger.error(err, 'duplicate entry on insert');
    return res.status(422).json({msg: err.message});
  }
  logger.error(err, 'Database error');
  res.status(500).json({msg: err.message});
}

module.exports = sysError;
