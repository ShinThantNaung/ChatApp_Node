const mlbbAcademyService = require('./mlbbAcademy.services');

const isUpstreamTimeout = (err) => {
	const message = String(err?.message || '');
	const causeCode = String(err?.cause?.code || '');
	const causeName = String(err?.cause?.name || '');

	return (
		message.includes('TimeoutError') ||
		message.includes('fetch failed') ||
		causeCode === 'UND_ERR_CONNECT_TIMEOUT' ||
		causeName === 'ConnectTimeoutError'
	);
};

const isBadRequest = (err) => {
	const message = String(err?.message || '').toLowerCase();
	return message.includes('required') || message.includes('invalid');
};

const isNotFound = (err) => {
	const message = String(err?.message || '').toLowerCase();
	return message.includes('not found') || message.includes('no hero ranking data') || message.includes('unavailable');
};

const handleMlbbError = (res, err, fallbackMessage) => {
	if (isUpstreamTimeout(err)) {
		return res.status(504).json({ message: 'Upstream timed out' });
	}

	if (isBadRequest(err)) {
		return res.status(400).json({ message: err?.message || 'Bad request' });
	}

	if (isNotFound(err)) {
		return res.status(404).json({ message: err?.message || 'Resource not found' });
	}

	return res.status(500).json({ message: fallbackMessage });
};

const getHeroes = async (req, res) => {
	try {
		const heroes = await mlbbAcademyService.getHeroes(req.query);
		return res.status(200).json(heroes);
	} catch (err) {
		return handleMlbbError(res, err, 'Failed to fetch MLBB heroes');
	}
};

const getHeroByName = async (req, res) => {
	try {
		const { name } = req.params;
		const hero = await mlbbAcademyService.getHeroByName(name);
		return res.status(200).json(hero);
	} catch (err) {
		return handleMlbbError(res, err, 'Failed to fetch Hero');
	}
};

const getHeroStatsById = async (req, res) => {
	try {
		const { id } = req.params;
		const stats = await mlbbAcademyService.getHeroStatsById(id, req.query);
		return res.status(200).json(stats);
	} catch (err) {
		return handleMlbbError(res, err, 'Failed to fetch Hero stats');
	}
};

const getHeroTrendsById = async (req, res) => {
	try {
		const { id } = req.params;
		const trends = await mlbbAcademyService.getHeroTrendsById(id, req.query);
		return res.status(200).json(trends);
	} catch (err) {
		return handleMlbbError(res, err, 'Failed to fetch Hero trends');
	}
};

const getTopHeroesByLane = async (req, res) => {
	try {
		const { role, lane } = req.query;
		const topHeroes = await mlbbAcademyService.getTopHeroesByLane(role, lane);
		return res.status(200).json(topHeroes);
	} catch (err) {
		return handleMlbbError(res, err, 'Failed to fetch Top Heroes by Lane');
	}
};

const getGlobalTopHero = async (req, res) => {
	try {
		const topHero = await mlbbAcademyService.getGlobalTopHero(req.query);
		return res.status(200).json(topHero);
	} catch (err) {
		return handleMlbbError(res, err, 'Failed to fetch Global Top Hero');
	}
};

module.exports = {
	getHeroes,
	getHeroByName,
	getHeroStatsById,
	getHeroTrendsById,
	getTopHeroesByLane,
	getGlobalTopHero,
};
