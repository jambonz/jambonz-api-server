const router = require('express').Router();
const Tenant = require('../../models/tenant');
const decorate = require('./decorate');
const preconditions = {};

decorate(router, Tenant, ['*'], preconditions);

module.exports = router;
