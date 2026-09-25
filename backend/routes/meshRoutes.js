const express = require('express');
const router = express.Router();
const { meshState, meshGossip, meshFlush, meshReset } = require('../controllers/meshController');

router.get('/state',    meshState);
router.post('/gossip',  meshGossip);
router.post('/flush',   meshFlush);
router.post('/reset',   meshReset);

module.exports = router;
