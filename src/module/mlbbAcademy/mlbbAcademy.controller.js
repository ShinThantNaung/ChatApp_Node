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

const getHeroes = async (req, res) => {
	try {
		const heroes = await mlbbAcademyService.getHeroes(req.query);
		return res.status(200).json(heroes);
	} catch (err) {
		if (isUpstreamTimeout(err)) return res.status(504).json({ message: 'Upstream timed out', error: err?.message });
		return res.status(500).json({ message: 'Failed to fetch MLBB heroes', error: err?.message });
	}
};

const getHeroByName = async (req, res) => {
	try {
		const { name } = req.params;
		const hero = await mlbbAcademyService.getHeroByName(name);
		return res.status(200).json(hero);
	} catch (err) {
		if (isUpstreamTimeout(err)) return res.status(504).json({ message: 'Upstream timed out', error: err?.message });
		return res.status(500).json({ message: 'Failed to fetch Hero', error: err?.message });
	}
};

const getHeroStatsById = async (req, res) => {
	try {
		const { id } = req.params;
		const stats = await mlbbAcademyService.getHeroStatsById(id, req.query);
		return res.status(200).json(stats);
	} catch (err) {
		if (isUpstreamTimeout(err)) return res.status(504).json({ message: 'Upstream timed out', error: err?.message });
		return res.status(500).json({ message: 'Failed to fetch Hero stats', error: err?.message });
	}
};

const getHeroTrendsById = async (req, res) => {
	try {
		const { id } = req.params;
		const trends = await mlbbAcademyService.getHeroTrendsById(id, req.query);
		return res.status(200).json(trends);
	} catch (err) {
		if (isUpstreamTimeout(err)) return res.status(504).json({ message: 'Upstream timed out', error: err?.message });
		return res.status(500).json({ message: 'Failed to fetch Hero trends', error: err?.message });
	}
};

const getTopHeroesByLane = async (req, res) => {
	try {
		const { role, lane } = req.query;
		const defaultRole = role || 'mage';
		const defaultLane = lane || 'mid';
		const topHeroes = await mlbbAcademyService.getTopHeroesByLane(defaultRole, defaultLane);
		return res.status(200).json(topHeroes);
	} catch (err) {
		if (isUpstreamTimeout(err)) return res.status(504).json({ message: 'Upstream timed out', error: err?.message });
		return res.status(500).json({ message: 'Failed to fetch Top Heroes by Lane', error: err?.message });
	}
};

module.exports = {
	getHeroes,
	getHeroByName,
	getHeroStatsById,
	getHeroTrendsById,
	getTopHeroesByLane,
};
