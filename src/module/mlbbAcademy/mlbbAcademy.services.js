const { getMlbbClient } = require('./mlbbAcademy.config');

const getHeroes = async (params = {}) => {
	const client = await getMlbbClient();
	const heroes = await client.mlbb.getHeroes(params);
	return heroes;
};

const getHeroByName = async (name) => {
	const client = await getMlbbClient();
	const hero = await client.mlbb.getHero(name);
	return hero;
};

const getHeroStatsById = async (id, params = {}) => {
	const client = await getMlbbClient();
	const stats = await client.mlbb.getHeroStats(Number(id), params);
	return stats;
};

const getHeroTrendsById = async (id, params = {}) => {
	const client = await getMlbbClient();
	const trends = await client.mlbb.getHeroTrends(Number(id), params);
	return trends;
};

const getTopHeroesByLane = async (role = 'mage', lane = 'mid') => {
	const client = await getMlbbClient();
	
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
	const posResponse = await client.mlbb.getHeroesByPosition({ role, lane });
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
		role,
		lane,
		topHeroes: heroesWithStats
	};
};

module.exports = {
	getHeroes,
	getHeroByName,
	getHeroStatsById,
	getHeroTrendsById,
	getTopHeroesByLane,
};

// Test execution when running the file directly
if (require.main === module) {
	(async () => {
		try {
			console.log('Fetching heroes...');
			const result = await getHeroes();
			
			// Optional chaining safely parses nested MLBB API shape
			const records = result?.data || result?.data?.records || [];
			const items = Array.isArray(records) ? records : (records.records || []);
			
			console.log('--- Fetch Successful ---');
			console.log('Code:', result?.code, '| Msg:', result?.message);
			console.log('Returned heroes count:', items.length);
			
			if (items.length > 0) {
				console.log('Preview of first 3 heroes:');
				console.log(items.slice(0, 3).map(r => ({
					id: r?.data?.hero?.hero_id || r?.hero_id,
					name: r?.data?.hero?.data?.name || r?.name || r?.hero_name
				})));
			}
		} catch (error) {
			console.error('--- Fetch Failed ---');
			console.error('Error message:', error?.message);
			if (error?.cause) console.error('Cause:', error.cause.code || error.cause.name);
		}
	})();
}
