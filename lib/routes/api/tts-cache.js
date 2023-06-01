const router = require('express').Router();

router.delete('/', async(req, res) => {
  const {purgeTtsCache} = req.app.locals;
  await purgeTtsCache();
  res.sendStatus(204);
});

router.get('/', async(req, res) => {
  const {getTtsSize} = req.app.locals;
  const size = await getTtsSize();
  res.status(200).json({size});
});

module.exports = router;
