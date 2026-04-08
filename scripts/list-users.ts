import prisma from '../src/lib/prisma.js';

async function listUsers() {
    try {
        const users = await prisma.user.findMany({
            select: { email: true, role: true }
        });
        console.log('Current Users:', JSON.stringify(users, null, 2));
    } catch (error: any) {
        console.error(`Error: ${error.message}`);
    } finally {
        await prisma.$disconnect();
    }
}

listUsers();
