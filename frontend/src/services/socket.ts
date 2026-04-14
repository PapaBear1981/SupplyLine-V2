import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect(token?: string): Socket {
    // Don't create multiple connections
    if (this.socket?.connected) {
      return this.socket;
    }

    // Disconnect existing socket if any
    if (this.socket) {
      this.socket.disconnect();
    }

    const accessToken = token || localStorage.getItem('access_token');
    if (!accessToken) {
      console.warn('No access token available for WebSocket connection');
      throw new Error('No access token available');
    }

    // Use the same origin for WebSocket (nginx will proxy it)
    const url = import.meta.env.VITE_SOCKET_URL || '';

    this.socket = io(url, {
      query: {
        token: accessToken,
      },
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.socket.on('connect', () => {
      this.reconnectAttempts = 0;
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket.IO connection error:', error.message);
      this.reconnectAttempts++;

      // If token expired, don't keep trying
      if (error.message.includes('Token expired') || error.message.includes('Invalid token')) {
        this.socket?.disconnect();
      }
    });

    this.socket.on('error', (error) => {
      console.error('Socket.IO error:', error);
    });

    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  emit(event: string, data: unknown): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('Socket not connected, cannot emit:', event);
    }
  }

  on(event: string, callback: (data: unknown) => void): void {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event: string): void {
    if (this.socket) {
      this.socket.off(event);
    }
  }
}

export const socketService = new SocketService();
