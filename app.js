const config = require('config');
const opts = Object.assign({
  timestamp: () => {return `, "time": "${new Date().toISOString()}"`;}
}, config.get('logging'));
const logger = require('pino')(opts);
const express = require('express');
const app = express();
const cors = require('cors');
const bodyParser = require('body-parser');
const passport = require('passport');
const authStrategy = require('./lib/auth')(logger);
const routes = require('./lib/routes');
const PORT = process.env.HTTP_PORT || 3000;

passport.use(authStrategy);

app.locals.logger = logger;

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use('/v1', passport.authenticate('bearer', { session: false }));
app.use('/', routes);
app.use((err, req, res, next) => {
  logger.error(err, 'burped error');
  res.status(err.status || 500).json({msg: err.message});
});
app.listen(PORT);

module.exports = app;
