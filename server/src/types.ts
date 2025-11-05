export type RoomStatusEvent = 'occupied' | 'dirty' | 'cleaning' | 'clean' | 'empty';

export type RoomStatusChangedPayload = {
  roomNumber: string;
  status: RoomStatusEvent;
  by?: string;
  at?: string;
  meta?: Record<string, any>;
};