const api = require('express').Router();
const {isAdmin} = require('../../utils/scopes');

function isAdminScope(req, res, next) {
  if (isAdmin(req)) return next();
  res.status(403).json({
    status: 'fail',
    message: 'insufficient privileges'
  });
}

api.use('/ServiceProviders', isAdminScope, require('./service-providers'));
api.use('/ApiKeys', require('./api-keys'));

module.exports = api;
