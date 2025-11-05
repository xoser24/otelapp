import { io, Socket } from 'socket.io-client';
import { emitRoomsUpdated } from './events';
import { ROOMS_KEY } from './reservations';

let socket: Socket | null = null;

const statusMap: Record<string, string> = {
  occupied: 'occupied',
  dirty: 'dirty',
  cleaning: 'changing', // UI already has 'changing' as in-progress
  clean: 'available',
  empty: 'available',
};

export function ensureSocketConnected() {
  if (socket) return socket;
  const url = process.env.REACT_APP_SOCKET_URL || 'http://localhost:4000';
  socket = io(url, { transports: ['websocket'], autoConnect: true });
  socket.on('connect', () => {
    // eslint-disable-next-line no-console
    console.log('Socket connected', socket?.id);
  });
  socket.on('roomStatusChanged', (payload: { roomNumber: string; status: string }) => {
    try {
      const raw = localStorage.getItem(ROOMS_KEY);
      const rooms = raw ? JSON.parse(raw) : [];
      const next = rooms.map((r: any) => r.number === payload.roomNumber ? { ...r, status: statusMap[payload.status] || r.status } : r);
      localStorage.setItem(ROOMS_KEY, JSON.stringify(next));
      emitRoomsUpdated({ source: 'socket' });
    } catch {}
  });
  return socket;
}

export function subscribeRoomStatusChanged(handler: (payload: { roomNumber: string; status: string }) => void) {
  ensureSocketConnected();
  const cb = (p: any) => handler(p);
  socket?.on('roomStatusChanged', cb);
  return () => { socket?.off('roomStatusChanged', cb); };
}