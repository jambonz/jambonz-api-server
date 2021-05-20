const router = require('express').Router();
const PredefinedCarrier = require('../../models/predefined-carrier');
const decorate = require('./decorate');

decorate(router, PredefinedCarrier, ['list']);

module.exports = router;
