import { PrismaClient } from '@prisma/client';

let _prisma: PrismaClient | null = null;
function getPrisma(): PrismaClient {
  if (!_prisma) {
    if (globalThis.prisma) {
      _prisma = globalThis.prisma;
    } else {
      _prisma = new PrismaClient();
      if (process.env.NODE_ENV !== 'production') {
        globalThis.prisma = _prisma;
      }
    }
  }
  return _prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrisma();
    const val = (client as any)[prop];
    return typeof val === 'function' ? val.bind(client) : val;
  },
});

if (typeof module !== 'undefined' && module.exports) {
  module.exports.prisma = prisma;
}

export * from '@prisma/client';
