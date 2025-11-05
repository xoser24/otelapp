"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomStatusController = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
let PrismaClient = null;
try {
    // Lazy require to allow running without prisma setup
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    PrismaClient = require('@prisma/client').PrismaClient;
}
catch { }
class RoomStatusController {
    constructor(io) {
        this.rooms = new Map();
        this.prisma = null;
        this.io = io;
        if (PrismaClient && process.env.DATABASE_URL) {
            try {
                this.prisma = new PrismaClient();
            }
            catch {
                this.prisma = null;
            }
        }
    }
    async setStatus(roomNumber, status, meta) {
        const rec = { number: roomNumber, status };
        this.rooms.set(roomNumber, rec);
        // Persist if prisma available
        if (this.prisma) {
            try {
                // Upsert Room by number
                await this.prisma.room.upsert({
                    where: { number: roomNumber },
                    update: this.mapStatusToRoomUpdate(status),
                    create: {
                        number: roomNumber,
                        type: 'SINGLE',
                        floor: Number(roomNumber[0]) || 1,
                        ...this.mapStatusToRoomUpdate(status),
                    },
                });
                await this.prisma.roomStatusHistory.create({
                    data: {
                        roomNumber,
                        status,
                        meta: meta ? JSON.stringify(meta) : undefined,
                    },
                });
            }
            catch (e) {
                // swallow DB errors to not block realtime
            }
        }
        const payload = {
            roomNumber,
            status,
            at: new Date().toISOString(),
            meta,
        };
        this.io.emit('roomStatusChanged', payload);
        return payload;
    }
    mapStatusToRoomUpdate(status) {
        // Map requested statuses to schema fields
        // Room.status: AVAILABLE | OCCUPIED | MAINTENANCE | OUT_OF_SERVICE
        // Room.cleaningStatus: CLEAN | DIRTY | CLEANING_IN_PROGRESS | NEEDS_INSPECTION
        switch (status) {
            case 'occupied':
                return { status: 'OCCUPIED', cleaningStatus: 'NEEDS_INSPECTION' };
            case 'empty':
                return { status: 'AVAILABLE', cleaningStatus: 'CLEAN' };
            case 'dirty':
                return { status: 'AVAILABLE', cleaningStatus: 'DIRTY' };
            case 'cleaning':
                return { status: 'AVAILABLE', cleaningStatus: 'CLEANING_IN_PROGRESS' };
            case 'clean':
                return { status: 'AVAILABLE', cleaningStatus: 'CLEAN' };
            default:
                return { status: 'AVAILABLE', cleaningStatus: 'CLEAN' };
        }
    }
}
exports.RoomStatusController = RoomStatusController;
