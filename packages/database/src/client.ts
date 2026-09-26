import { PrismaClient as PrismaClientType } from '@prisma/client';

let _prisma: any = null;

function getPrismaClass(): any {
  // 1. Try standard @prisma/client
  try {
    const standard = require('@prisma/client');
    if (standard && standard.PrismaClient) {
      try {
        new standard.PrismaClient();
        return standard.PrismaClient;
      } catch (err: any) {
        if (!err.message || !err.message.includes('did not initialize yet')) {
          return standard.PrismaClient;
        }
        console.warn('[Database] @prisma/client is an uninitialized stub. Searching fallback generated clients...');
      }
    }
  } catch (e) {}

  // 2. Search alternative generated paths in monorepo
  const path = require('path');
  const fs = require('fs');
  const candidates = [
    path.resolve(__dirname, '../client'),
    path.resolve(__dirname, '../../packages/database/client'),
    path.resolve(__dirname, '../node_modules/.prisma/client'),
    path.resolve(__dirname, '../../node_modules/.prisma/client'),
    path.resolve(__dirname, '../../../node_modules/.prisma/client'),
    path.resolve(__dirname, '../../../../node_modules/.prisma/client'),
  ];

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        const mod = require(candidate);
        if (mod && mod.PrismaClient) {
          console.log(`[Database] Successfully loaded initialized PrismaClient from: ${candidate}`);
          return mod.PrismaClient;
        }
      }
    } catch {}
  }

  // 3. Fallback to standard @prisma/client
  return require('@prisma/client').PrismaClient;
}

function getPrisma(): PrismaClientType {
  if (!_prisma) {
    if (globalThis.prisma) {
      _prisma = globalThis.prisma;
    } else {
      const PrismaClass = getPrismaClass();
      _prisma = new PrismaClass();
      if (process.env.NODE_ENV !== 'production') {
        globalThis.prisma = _prisma;
      }
    }
  }
  return _prisma;
}

export const prisma = new Proxy({} as PrismaClientType, {
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

