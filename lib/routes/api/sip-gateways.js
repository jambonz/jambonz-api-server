const router = require('express').Router();
const SipGateway = require('../../models/sip-gateway');
const decorate = require('./decorate');
const preconditions = {};

decorate(router, SipGateway, ['*'], preconditions);

module.exports = router;
