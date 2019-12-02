function isAdmin(req) {
  return req.authInfo.scope.includes('admin');
}

function isServiceProvider(req) {
  return req.authInfo.scope.includes('service_provider');
}

function isUser(req) {
  return req.authInfo.scope.includes('user');
}

module.exports = {
  isAdmin,
  isServiceProvider,
  isUser
};
