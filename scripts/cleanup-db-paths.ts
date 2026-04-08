import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log('Starting DB path cleanup...');

    const applications = await prisma.application.findMany({
        select: {
            id: true,
            birthCertificateUrl: true,
            idCardUrl: true,
            ministryResultUrl: true,
            receiptUrl: true
        }
    });

    let updatedCount = 0;

    for (const app of applications) {
        const updates: any = {};

        const fields = [
            'birthCertificateUrl',
            'idCardUrl',
            'ministryResultUrl',
            'receiptUrl'
        ] as const;

        for (const field of fields) {
            const val = app[field];
            if (val && (val.includes('/') || val.includes('\\'))) {
                // Extract just the filename from any path format
                const filename = val.split('/').pop()?.split('\\').pop();
                if (filename && filename !== val) {
                    updates[field] = filename;
                }
            }
        }

        if (Object.keys(updates).length > 0) {
            await prisma.application.update({
                where: { id: app.id },
                data: updates
            });
            updatedCount++;
        }
    }

    console.log(`Cleanup complete! Normalized ${updatedCount} applications.`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
