const { getMlbbClient } = require('./mlbbAcademy.config');

const toPositiveInteger = (value, fieldName) => {
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed <= 0) {
		throw new Error(`${fieldName} must be a positive integer`);
	}
	return parsed;
};

const getHeroes = async (params = {}) => {
	if(Object.keys(params).length === 0) {
		params = { limit: 132 }; // default to fetching 132 heroes if no params provided
	}
	const client = await getMlbbClient();
	const heroes = await client.mlbb.getHeroes(params);
	return heroes;
};

const getHeroByName = async (name) => {
	if(name === undefined || String(name).trim() === '') {
		throw new Error('Hero name parameter is required');
	}
	const client = await getMlbbClient();
	const hero = await client.mlbb.getHero(String(name).trim());
	return hero;
};

const getHeroStatsById = async (id, params = {}) => {
	if(id === undefined) {
		throw new Error('Hero ID parameter is required');
	}
	const heroId = toPositiveInteger(id, 'Hero ID');
	const client = await getMlbbClient();
	const stats = await client.mlbb.getHeroStats(heroId, params);
	return stats;
};

const getHeroTrendsById = async (id, params = {}) => {
	if(id === undefined) {
		throw new Error('Hero ID parameter is required');
	}
	const heroId = toPositiveInteger(id, 'Hero ID');
	const client = await getMlbbClient();
	const trends = await client.mlbb.getHeroTrends(heroId, params);
	return trends;
};

const getTopHeroesByLane = async (role, lane) => {
	const client = await getMlbbClient();
	if(role === undefined || lane === undefined) {
		throw new Error('Role and lane query parameters are required');
	}

	const normalizedRole = String(role).trim().toLowerCase();
	const normalizedLane = String(lane).trim().toLowerCase();
	if (!normalizedRole || !normalizedLane) {
		throw new Error('Role and lane query parameters are required');
	}
	
	// Fetch mythic winrates sorted by win_rate
	const ranksResponse = await client.mlbb.getHeroRanks({ rank: 'mythic', days: 7, sortField: 'win_rate' });
	const mythicStats = ranksResponse?.data?.records || [];
	
	const statsMap = new Map();
	mythicStats.forEach(record => {
		const heroId = record?.data?.main_heroid;
		if (heroId) {
			statsMap.set(heroId, {
				winRate: record?.data?.main_hero_win_rate || 0,
				totalMatches: record?.data?.main_hero_appearance_rate || 0,
			});
		}
	});

	// Get heroes by lane
	const posResponse = await client.mlbb.getHeroesByPosition({ role: normalizedRole, lane: normalizedLane });
	const heroesInPos = posResponse?.data?.records || [];
	
	// Map to combined array and sort
	let heroesWithStats = heroesInPos.map(h => {
		const hId = h?.data?.hero_id;
		const name = h?.data?.hero?.data?.name || 'Unknown';
		const stats = statsMap.get(hId) || { winRate: 0, totalMatches: 0 };
		
		return {
			id: hId,
			name,
			winRate: (stats.winRate * 100).toFixed(1), // format as percentage
			totalMatches: (stats.totalMatches * 100).toFixed(1)
		};
	}).filter(h => h.id).sort((a, b) => b.winRate - a.winRate).slice(0, 3);

	// Get trends for top 3
	for (let i = 0; i < heroesWithStats.length; i++) {
		const hero = heroesWithStats[i];
		const trends = await client.mlbb.getHeroTrends(hero.id, { pastDays: 30 });
		hero.trends = trends?.data?.records || [];
	}

	return {
		role: normalizedRole,
		lane: normalizedLane,
		topHeroes: heroesWithStats
	};
};

const getGlobalTopHero = async (params = {}) => {
	const client = await getMlbbClient();

	const rank = params?.rank || 'mythic';
	const days = params?.days === undefined ? 7 : toPositiveInteger(params.days, 'Days');
	if (days > 30) {
		throw new Error('Days must be 30 or less');
	}
	const sortField = params?.sortField || 'win_rate';

	const ranksResponse = await client.mlbb.getHeroRanks({ rank, days, sortField });
	const records = ranksResponse?.data?.records || [];

	if(!Array.isArray(records) || records.length === 0) {
		throw new Error('No hero ranking data found');
	}

	const topRecord = records.reduce((best, current) => {
		const bestRate = Number(best?.data?.main_hero_win_rate || 0);
		const currentRate = Number(current?.data?.main_hero_win_rate || 0);
		return currentRate > bestRate ? current : best;
	}, records[0]);

	const heroId = topRecord?.data?.main_heroid;
	if(!heroId) {
		throw new Error('Top hero data is unavailable');
	}

	return {
		id: heroId,
		name: topRecord?.data?.main_hero?.data?.name || 'Unknown',
		role: topRecord?.data?.main_hero?.data?.role || null,
		winRate: (Number(topRecord?.data?.main_hero_win_rate || 0) * 100).toFixed(1),
		appearanceRate: (Number(topRecord?.data?.main_hero_appearance_rate || 0) * 100).toFixed(1),
		rank,
		days,
	};
};

module.exports = {
	getHeroes,
	getHeroByName,
	getHeroStatsById,
	getHeroTrendsById,
	getTopHeroesByLane,
	getGlobalTopHero,
};