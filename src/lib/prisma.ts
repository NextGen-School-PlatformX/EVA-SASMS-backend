import { PrismaLibSql } from '@prisma/adapter-libsql';
import { PrismaClient } from '@prisma/client';
import path from 'path';

// Singleton pattern - prevent multiple connections on hot-reload
declare global {
    // eslint-disable-next-line no-var
    var __prisma: PrismaClient | undefined;
}

function createPrismaClient() {
    const rawUrl = process.env.DATABASE_URL || 'file:dev.db';

    // @libsql/client on Windows needs absolute file:// URLs
    let url = rawUrl;
    if (rawUrl.startsWith('file:') && !rawUrl.startsWith('file:///')) {
        const filePart = rawUrl.replace(/^file:(\.\/)?/, '');
        const absolutePath = path.resolve(process.cwd(), filePart);
        url = 'file:///' + absolutePath.replace(/\\/g, '/');
    }

    const isRemote = url.startsWith('libsql://') || url.startsWith('https://');
    const authToken = process.env.DATABASE_AUTH_TOKEN;

    const adapterConfig = isRemote && authToken
        ? { url, authToken }
        : { url };

    const adapter = new PrismaLibSql(adapterConfig);

    const client = new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === 'development'
            ? ['error', 'warn']
            : ['error'],
    });

    return client;
}

const prisma = global.__prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
    global.__prisma = prisma;
}

// Graceful shutdown
process.on('beforeExit', async () => { await prisma.$disconnect(); });
process.on('SIGINT', async () => { await prisma.$disconnect(); process.exit(0); });
process.on('SIGTERM', async () => { await prisma.$disconnect(); process.exit(0); });

export default prisma;