const api = require('express').Router();

function isAdmin(req, res, next) {
  if (req.authInfo.scope.includes('admin')) return next();
  res.status(403).json({
    status: 'fail',
    message: 'insufficient privileges'
  });
}

function isUser(req, res, next) {
  if (req.authInfo.scope.includes('user')) return next();
  res.status(403).json({
    status: 'fail',
    message: 'end-user data can not be modified with admin privileges'
  });
}

api.use('/ServiceProviders', isAdmin, require('./service-providers'));

module.exports = api;
