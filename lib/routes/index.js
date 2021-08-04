const express = require('express');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');
const swaggerDocument = YAML.load(path.resolve(__dirname, '../swagger/swagger.yaml'));
const api = require('./api');
const stripe = require('./stripe');
const {checkLimits} = require('./api/utils');

const routes = express.Router();

routes.post([
  '/v1/Applications',
  '/v1/VoipCarriers',
  '/v1/SipGateways',
  '/v1/PhoneNumbers',
  '/v1/Accounts'
], checkLimits);
routes.use('/v1', api);
routes.use('/stripe', stripe);
routes.use('/swagger', swaggerUi.serve);
routes.get('/swagger', swaggerUi.setup(swaggerDocument));

// health checks
routes.get('/', (req, res) => {
  res.sendStatus(200);
});

routes.get('/health', (req, res) => {
  res.sendStatus(200);
});

module.exports = routes;
