const express = require('express');
const { authenticate } = require('../auth/middleware/auth.middleware');
const { 
	getHeroes,
	getHeroByName,
	getHeroStatsById,
	getHeroTrendsById,
	getTopHeroesByLane 
} = require('./mlbbAcademy.controller');

const router = express.Router();

router.get('/heroes', authenticate, getHeroes);
router.get('/hero/:name', authenticate, getHeroByName);
router.get('/hero/:id/stats', authenticate, getHeroStatsById);
router.get('/hero/:id/trends', authenticate, getHeroTrendsById);
router.get('/lanes/top-heroes', authenticate, getTopHeroesByLane);

module.exports = router;