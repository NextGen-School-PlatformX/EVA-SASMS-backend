import prisma from '../src/lib/prisma.js';

async function main() {
    try {
        const depts = await prisma.department.findMany({
            take: 10
        });
        console.log('Recent Departments:', JSON.stringify(depts, null, 2));

        const logs = await prisma.auditLog.findMany({
            include: {
                user: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: 20
        });
        console.log('Recent Audit Logs:', JSON.stringify(logs, null, 2));
    } catch (e: any) {
        console.error('Error querying database:', e.message);
    }
}

main()
    .finally(async () => {
        await prisma.$disconnect();
    });
