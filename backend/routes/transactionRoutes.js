const express = require('express');
const router = express.Router();
const { listTransactions } = require('../controllers/transactionController');

router.get('/', listTransactions);

module.exports = router;
