const parseServiceProviderSid = (req) => {
  const arr = /ServiceProviders\/([^\/]*)/.exec(req.originalUrl);
  if (arr) return arr[1];
};

const parseAccountSid = (req) => {
  const arr = /Accounts\/([^\/]*)/.exec(req.originalUrl);
  if (arr) return arr[1];
};

const hasAccountPermissions = (req, res, next) => {
  if (req.user.hasScope('admin')) return next();
  if (req.user.hasScope('account')) {
    const account_sid = parseAccountSid(req);
    if (account_sid === req.user.account_sid) return next();
  }
  res.status(403).json({
    status: 'fail',
    message: 'insufficient privileges'
  });
};

const hasServiceProviderPermissions = (req, res, next) => {
  if (req.user.hasScope('admin')) return next();
  if (req.user.hasScope('service_provider')) {
    const service_provider_sid = parseServiceProviderSid(req);
    if (service_provider_sid === req.user.service_provider_sid) return next();
  }
  res.status(403).json({
    status: 'fail',
    message: 'insufficient privileges'
  });
};

module.exports = {
  parseAccountSid,
  parseServiceProviderSid,
  hasAccountPermissions,
  hasServiceProviderPermissions
};
