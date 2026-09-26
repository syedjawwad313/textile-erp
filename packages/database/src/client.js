"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;

let _prisma = null;

function getPrismaClass() {
    // 1. Try standard @prisma/client
    try {
        const standard = require("@prisma/client");
        if (standard && standard.PrismaClient) {
            try {
                new standard.PrismaClient();
                return standard.PrismaClient;
            } catch (err) {
                if (!err.message || !err.message.includes("did not initialize yet")) {
                    return standard.PrismaClient;
                }
                console.warn("[Database] @prisma/client is an uninitialized stub. Searching fallback generated clients...");
            }
        }
    } catch (e) {}

    // 2. Search alternative generated paths in monorepo
    const path = require("path");
    const fs = require("fs");
    const candidates = [
        path.resolve(__dirname, "../client"),
        path.resolve(__dirname, "../../packages/database/client"),
        path.resolve(__dirname, "../node_modules/.prisma/client"),
        path.resolve(__dirname, "../../node_modules/.prisma/client"),
        path.resolve(__dirname, "../../../node_modules/.prisma/client"),
        path.resolve(__dirname, "../../../../node_modules/.prisma/client"),
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
        } catch (e) {}
    }

    return require("@prisma/client").PrismaClient;
}

function getPrisma() {
    if (!_prisma) {
        if (globalThis.prisma) {
            _prisma = globalThis.prisma;
        } else {
            const PrismaClass = getPrismaClass();
            _prisma = new PrismaClass();
            if (process.env.NODE_ENV !== "production") {
                globalThis.prisma = _prisma;
            }
        }
    }
    return _prisma;
}

exports.prisma = new Proxy({}, {
    get(_target, prop) {
        const client = getPrisma();
        const val = client[prop];
        return typeof val === "function" ? val.bind(client) : val;
    }
});

if (typeof module !== "undefined" && module.exports) {
    module.exports.prisma = exports.prisma;
}

try {
    __exportStar(require("@prisma/client"), exports);
} catch (e) {}

