const api = require('express').Router();

const isAdminScope = (req, res, next) => {
  if (req.user.hasScope('admin')) return next();
  res.status(403).json({
    status: 'fail',
    message: 'insufficient privileges'
  });
};
const isAdminOrSPScope = (req, res, next) => {
  if (req.user.hasScope('admin') || req.user.hasScope('service_provider')) return next();
  res.status(403).json({
    status: 'fail',
    message: 'insufficient privileges'
  });
};

api.use('/BetaInviteCodes', isAdminScope, require('./beta-invite-codes'));
api.use('/ServiceProviders', isAdminOrSPScope, require('./service-providers'));
api.use('/VoipCarriers', require('./voip-carriers'));
api.use('/Webhooks', require('./webhooks'));
api.use('/SipGateways', require('./sip-gateways'));
api.use('/SmppGateways', require('./smpp-gateways'));
api.use('/PhoneNumbers', require('./phone-numbers'));
api.use('/ApiKeys', require('./api-keys'));
api.use('/Accounts', require('./accounts'));
api.use('/Applications', require('./applications'));
api.use('/MicrosoftTeamsTenants', require('./tenants'));
api.use('/Sbcs', require('./sbcs'));
api.use('/Users', require('./users'));
api.use('/register', require('./register'));
api.use('/signin', require('./signin'));
api.use('/login', require('./login'));
api.use('/logout', require('./logout'));
api.use('/forgot-password', require('./forgot-password'));
api.use('/change-password', require('./change-password'));
api.use('/ActivationCode', require('./activation-code'));
api.use('/Availability', require('./availability'));
api.use('/AccountTest', require('./account-test'));
//api.use('/Products', require('./products'));
api.use('/Prices', require('./prices'));
api.use('/StripeCustomerId', require('./stripe-customer-id'));
api.use('/Subscriptions', require('./subscriptions'));
api.use('/Invoices', require('./invoices'));
api.use('/InviteCodes', require('./invite-codes'));
api.use('/PredefinedCarriers', require('./predefined-carriers'));
api.use('/PasswordSettings', require('./password-settings'));

// messaging
api.use('/Smpps', require('./smpps'));   // our smpp server info
api.use('/messaging', require('./sms-inbound'));      // inbound SMS from carrier
api.use('/outboundSMS', require('./sms-outbound'));   // outbound SMS from feature server

module.exports = api;
