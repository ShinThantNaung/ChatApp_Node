const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const prisma = require('./config/prisma');

async function testPrismaConnection() {
    try {
        await prisma.$connect();

        const users = await prisma.user.findMany({
            take: 5,
            select: {
                id: true,
                username: true,
                email: true,
                createdAt: true,
            },
        });

        console.log(`Prisma connection OK. Found ${users.length} user(s).`);
        console.table(users);
    } catch (error) {
        console.error('Prisma test failed:', error.message);
        process.exitCode = 1;
    } finally {
        await prisma.$disconnect();
    }
}

testPrismaConnection();