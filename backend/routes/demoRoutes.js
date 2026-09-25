const express = require('express');
const router = express.Router();
const { getServerPublicKey, demoSend } = require('../controllers/demoController');

router.get('/server-key', getServerPublicKey);
router.post('/send',      demoSend);

module.exports = router;
