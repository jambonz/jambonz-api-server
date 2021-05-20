const express = require('express');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');
const swaggerDocument = YAML.load(path.resolve(__dirname, '../swagger/swagger.yaml'));
const api = require('./api');
const stripe = require('./stripe');

const routes = express.Router();

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
