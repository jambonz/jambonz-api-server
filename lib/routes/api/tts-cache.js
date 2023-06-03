const router = require('express').Router();
const {
  parseAccountSid
} = require('./utils');

router.delete('/', async(req, res) => {
  const {purgeTtsCache} = req.app.locals;
  const account_sid = parseAccountSid(req);
  if (account_sid) {
    await purgeTtsCache({account_sid});
  } else {
    await purgeTtsCache();
  }
  res.sendStatus(204);
});

router.get('/', async(req, res) => {
  const {getTtsSize} = req.app.locals;
  const account_sid = parseAccountSid(req);
  let size = 0;
  if (account_sid) {
    size = await getTtsSize(`tts:${account_sid}:*`);
  } else {
    size = await getTtsSize();
  }
  res.status(200).json({size});
});

module.exports = router;
