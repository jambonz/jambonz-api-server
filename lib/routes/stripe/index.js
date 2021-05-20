const router = require('express').Router();

router.use('/webhook', require('./webhook'));

module.exports = router;
