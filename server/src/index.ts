import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import { RoomStatusController } from './controllers/RoomStatusController';

dotenv.config();

const PORT = Number(process.env.PORT || process.env.BACKEND_PORT || 4000);
const ORIGIN = process.env.CORS_ORIGIN || process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
const prisma = new PrismaClient();

const app = express();
app.use(express.json());
app.use(cors({ origin: ORIGIN, credentials: true }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: ORIGIN } });
const controller = new RoomStatusController(io);

// Health with DB ping
app.get('/health', async (_req, res) => {
  let dbOk = false;
  let error: string | null = null;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch (e: any) {
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

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on http://localhost:${PORT}`);
});