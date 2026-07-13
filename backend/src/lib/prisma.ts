import { PrismaClient } from '@prisma/client';

// Singleton para evitar múltiplas conexões em dev com hot-reload
const prisma = new PrismaClient();

export default prisma;
