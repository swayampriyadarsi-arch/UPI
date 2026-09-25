const express = require('express');
const router = express.Router();
const { ingest } = require('../controllers/bridgeController');

router.post('/ingest', ingest);

module.exports = router;
