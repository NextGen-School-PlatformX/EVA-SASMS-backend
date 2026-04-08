import prisma from '../src/lib/prisma.js';
import bcrypt from 'bcryptjs';

async function setupSuperAdmin() {
    const args = process.argv.slice(2);
    const emailArg = args.find(a => a.startsWith('--email='))?.split('=')[1];
    const passwordArg = args.find(a => a.startsWith('--password='))?.split('=')[1];
    const nameArg = args.find(a => a.startsWith('--name='))?.split('=')[1];

    const email = emailArg || 'test-admin@sasms.edu.eg';
    const password = passwordArg || 'password123';
    const name = nameArg || 'Test SuperAdmin';

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.upsert({
            where: { email },
            update: {
                role: 'SUPER_ADMIN',
                password: hashedPassword,
                status: 'ACTIVE'
            },
            create: {
                email,
                password: hashedPassword,
                name,
                role: 'SUPER_ADMIN',
                status: 'ACTIVE'
            }
        });

        console.log(`Successfully setup SUPER_ADMIN: ${user.email}`);
    } catch (error: any) {
        console.error(`Error during admin setup: ${error.message}`);
    } finally {
        await prisma.$disconnect();
    }
}

setupSuperAdmin();
