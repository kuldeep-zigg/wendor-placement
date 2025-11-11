import WebSocket from 'ws';

const VMC_WS_URL = process.env.VMC_WS_URL || 'ws://localhost:3002';

let vmcClient: WebSocket | null = null;
let reconnectTimeout: NodeJS.Timeout | null = null;

export function connectToVMC(onMessage?: (data: any) => void) {
  if (vmcClient?.readyState === WebSocket.OPEN) {
    return vmcClient;
  }

  try {
    vmcClient = new WebSocket(VMC_WS_URL);

    vmcClient.on('open', () => {
      console.log('✅ Connected to VMC WebSocket server');
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
    });

    vmcClient.on('message', (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('📨 Received from VMC:', message);
        if (onMessage) {
          onMessage(message);
        }
      } catch (error) {
        console.error('Error parsing VMC message:', error);
      }
    });

    vmcClient.on('error', (error) => {
      console.error('❌ VMC WebSocket error:', error);
    });

    vmcClient.on('close', () => {
      console.log('⚠️  Disconnected from VMC WebSocket server');
      vmcClient = null;
      
      // Attempt to reconnect after 3 seconds
      if (!reconnectTimeout) {
        reconnectTimeout = setTimeout(() => {
          console.log('🔄 Attempting to reconnect to VMC...');
          connectToVMC(onMessage);
        }, 3000);
      }
    });

    return vmcClient;
  } catch (error) {
    console.error('Error connecting to VMC:', error);
    return null;
  }
}

export function sendToVMC(message: any): boolean {
  if (vmcClient?.readyState === WebSocket.OPEN) {
    vmcClient.send(JSON.stringify(message));
    return true;
  } else {
    console.warn('⚠️  VMC WebSocket not connected. Attempting to connect...');
    connectToVMC();
    return false;
  }
}

export function getVMCClient(): WebSocket | null {
  return vmcClient;
}

