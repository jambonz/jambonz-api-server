const router = require('express').Router();
const SystemInformation = require('../../models/system-information');

router.post('/', async(req, res) => {
  const sysInfo = await SystemInformation.add(req.body);
  res.status(201).json(sysInfo);
});

router.get('/', async(req, res) => {
  const [sysInfo] = await SystemInformation.retrieveAll();
  res.status(200).json(sysInfo);
});

module.exports = router;
