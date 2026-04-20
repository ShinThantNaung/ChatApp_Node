const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const servicePath = path.resolve(__dirname, './mlbbAcademy.services.js');
const configPath = path.resolve(__dirname, './mlbbAcademy.config.js');

const loadServiceWithClientMock = (clientMock) => {
    delete require.cache[servicePath];
    require.cache[configPath] = {
        id: configPath,
        filename: configPath,
        loaded: true,
        exports: {
            getMlbbClient: async () => clientMock,
        },
    };
    return require(servicePath);
};

test('getGlobalTopHero returns hero with highest win rate and defaults rank params', async () => {
    const capturedArgs = [];
    const clientMock = {
        mlbb: {
            getHeroRanks: async (args) => {
                capturedArgs.push(args);
                return {
                    data: {
                        records: [
                            {
                                data: {
                                    main_heroid: 10,
                                    main_hero_win_rate: 0.54,
                                    main_hero_appearance_rate: 0.20,
                                    main_hero: { data: { name: 'Alpha', role: 'Fighter' } },
                                },
                            },
                            {
                                data: {
                                    main_heroid: 20,
                                    main_hero_win_rate: 0.61,
                                    main_hero_appearance_rate: 0.11,
                                    main_hero: { data: { name: 'Lylia', role: 'Mage' } },
                                },
                            },
                            {
                                data: {
                                    main_heroid: 30,
                                    main_hero_win_rate: 0.58,
                                    main_hero_appearance_rate: 0.15,
                                    main_hero: { data: { name: 'Bane', role: 'Fighter' } },
                                },
                            },
                        ],
                    },
                };
            },
        },
    };

    const service = loadServiceWithClientMock(clientMock);

    const topHero = await service.getGlobalTopHero();

    assert.equal(capturedArgs.length, 1);
    assert.deepEqual(capturedArgs[0], { rank: 'mythic', days: 7, sortField: 'win_rate' });
    assert.equal(topHero.id, 20);
    assert.equal(topHero.name, 'Lylia');
    assert.equal(topHero.role, 'Mage');
    assert.equal(topHero.winRate, '61.0');
    assert.equal(topHero.appearanceRate, '11.0');
    assert.equal(topHero.rank, 'mythic');
    assert.equal(topHero.days, 7);
});

test('getGlobalTopHero respects provided query params', async () => {
    const capturedArgs = [];
    const clientMock = {
        mlbb: {
            getHeroRanks: async (args) => {
                capturedArgs.push(args);
                return {
                    data: {
                        records: [
                            {
                                data: {
                                    main_heroid: 1,
                                    main_hero_win_rate: 0.5,
                                    main_hero_appearance_rate: 0.3,
                                    main_hero: { data: { name: 'Hero1', role: 'Tank' } },
                                },
                            },
                        ],
                    },
                };
            },
        },
    };

    const service = loadServiceWithClientMock(clientMock);
    await service.getGlobalTopHero({ rank: 'legend', days: '14', sortField: 'pick_rate' });

    assert.equal(capturedArgs.length, 1);
    assert.deepEqual(capturedArgs[0], { rank: 'legend', days: 14, sortField: 'pick_rate' });
});

test('getGlobalTopHero throws when rank records are empty', async () => {
    const clientMock = {
        mlbb: {
            getHeroRanks: async () => ({ data: { records: [] } }),
        },
    };
    const service = loadServiceWithClientMock(clientMock);

    await assert.rejects(
        () => service.getGlobalTopHero(),
        /No hero ranking data found/
    );
});

test('getGlobalTopHero throws when top hero id is missing', async () => {
    const clientMock = {
        mlbb: {
            getHeroRanks: async () => ({
                data: {
                    records: [
                        {
                            data: {
                                main_hero_win_rate: 0.63,
                                main_hero_appearance_rate: 0.1,
                                main_hero: { data: { name: 'Unknown', role: 'Mage' } },
                            },
                        },
                    ],
                },
            }),
        },
    };
    const service = loadServiceWithClientMock(clientMock);

    await assert.rejects(
        () => service.getGlobalTopHero(),
        /Top hero data is unavailable/
    );
});
