import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const apps = await prisma.application.findMany({
        take: 5,
        select: {
            id: true,
            birthCertificateUrl: true,
            idCardUrl: true
        }
    });

    console.log('Sample Application Paths:');
    console.log(JSON.stringify(apps, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
