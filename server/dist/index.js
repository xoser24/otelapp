"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const socket_io_1 = require("socket.io");
// Prisma opsiyonel: client generate edilmemişse backend yine ayağa kalksın
let PrismaClient = null;
try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    PrismaClient = require('@prisma/client').PrismaClient;
}
catch { }
const RoomStatusController_1 = require("./controllers/RoomStatusController");
dotenv_1.default.config();
const PORT = Number(process.env.PORT || process.env.BACKEND_PORT || 4000);
const ORIGIN = process.env.CORS_ORIGIN || process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
let prisma = null;
if (PrismaClient) {
    try {
        prisma = new PrismaClient();
    }
    catch {
        prisma = null;
    }
}
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use((0, cors_1.default)({ origin: ORIGIN, credentials: true }));
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, { cors: { origin: ORIGIN } });
const controller = new RoomStatusController_1.RoomStatusController(io);
// Root route for quick service check
app.get('/', (_req, res) => {
    res.json({ ok: true, service: 'kent-otel-backend', health: '/health' });
});
// Health with DB ping
app.get('/health', async (_req, res) => {
    let dbOk = false;
    let error = null;
    try {
        if (prisma) {
            await prisma.$queryRaw `SELECT 1`;
            dbOk = true;
        }
    }
    catch (e) {
        error = e?.message || String(e);
    }
    res.json({ ok: true, env: { db: !!process.env.DATABASE_URL, origin: ORIGIN }, db: { ok: dbOk, error } });
});
// Check-in: set occupied and emit event
app.post('/api/rooms/:id/checkin', async (req, res) => {
    const roomNumber = req.params.id;
    const meta = { by: req.body?.by || 'reception', payload: req.body };
    const payload = await controller.setStatus(roomNumber, 'occupied', meta);
    res.json({ ok: true, event: payload });
});
// Check-out: set dirty and emit event
app.post('/api/rooms/:id/checkout', async (req, res) => {
    const roomNumber = req.params.id;
    const meta = { by: req.body?.by || 'reception', payload: req.body };
    const payload = await controller.setStatus(roomNumber, 'dirty', meta);
    res.json({ ok: true, event: payload });
});
// Housekeeping starts cleaning
app.post('/api/rooms/:id/cleaning/start', async (req, res) => {
    const roomNumber = req.params.id;
    const meta = { by: req.body?.by || 'housekeeping', payload: req.body };
    const payload = await controller.setStatus(roomNumber, 'cleaning', meta);
    res.json({ ok: true, event: payload });
});
// Housekeeping finishes cleaning
app.post('/api/rooms/:id/cleaning/finish', async (req, res) => {
    const roomNumber = req.params.id;
    const meta = { by: req.body?.by || 'housekeeping', payload: req.body };
    const payload = await controller.setStatus(roomNumber, 'clean', meta);
    res.json({ ok: true, event: payload });
});
// Alias endpoints to match external prompt (start-cleaning / finish-cleaning)
app.post('/api/rooms/:id/start-cleaning', async (req, res) => {
    const roomNumber = req.params.id;
    const meta = { by: req.body?.by || 'housekeeping', payload: req.body };
    const payload = await controller.setStatus(roomNumber, 'cleaning', meta);
    res.json({ ok: true, event: payload });
});
app.post('/api/rooms/:id/finish-cleaning', async (req, res) => {
    const roomNumber = req.params.id;
    const meta = { by: req.body?.by || 'housekeeping', payload: req.body };
    const payload = await controller.setStatus(roomNumber, 'clean', meta);
    res.json({ ok: true, event: payload });
});
io.on('connection', (socket) => {
    socket.emit('ready', { ok: true });
});
server.listen(PORT, '0.0.0.0', () => {
    // eslint-disable-next-line no-console
    console.log(`Backend listening on http://localhost:${PORT}`);
});
