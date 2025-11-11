const VMC_WS_URL = import.meta.env.VITE_VMC_WS || 'ws://localhost:3002';

export interface VMCStatus {
  type: string;
  status: 'idle' | 'vending';
  items?: number[];
  elapsedTime?: number;
  estimatedTime?: number;
  message?: string;
  timestamp?: string;
  success?: boolean;
  vendedItems?: number[];
}

export class VMCWebSocket {
  private ws: WebSocket | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private listeners: Set<(data: VMCStatus) => void> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      this.ws = new WebSocket(VMC_WS_URL);

      this.ws.onopen = () => {
        console.log('✅ Connected to VMC WebSocket');
        this.reconnectAttempts = 0;
        if (this.reconnectTimeout) {
          clearTimeout(this.reconnectTimeout);
          this.reconnectTimeout = null;
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data: VMCStatus = JSON.parse(event.data);
          this.listeners.forEach((listener) => listener(data));
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ VMC WebSocket error:', error);
      };

      this.ws.onclose = () => {
        console.log('⚠️  Disconnected from VMC WebSocket');
        this.ws = null;
        this.attemptReconnect();
      };
    } catch (error) {
      console.error('Error connecting to VMC:', error);
      this.attemptReconnect();
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    if (!this.reconnectTimeout) {
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
      this.reconnectAttempts++;
      console.log(`🔄 Attempting to reconnect to VMC in ${delay}ms...`);
      
      this.reconnectTimeout = setTimeout(() => {
        this.reconnectTimeout = null;
        this.connect();
      }, delay);
    }
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.listeners.clear();
  }

  onMessage(callback: (data: VMCStatus) => void) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  sendStatusRequest() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'status' }));
    }
  }
}

// Singleton instance
export const vmcWebSocket = new VMCWebSocket();

