import { Network } from '@capacitor/network';
import { Capacitor } from '@capacitor/core';

let currentOnlineStatus = true;
// Promise that resolves once we have the real network status on native
let _readyResolve: () => void;
const _ready = new Promise<void>((resolve) => { _readyResolve = resolve; });

async function initNetwork() {
  if (Capacitor.isNativePlatform()) {
    try {
      const status = await Network.getStatus();
      currentOnlineStatus = status.connected;
    } catch (e) {
      // Fallback: assume online
      currentOnlineStatus = true;
    }
    Network.addListener('networkStatusChange', (status) => {
      currentOnlineStatus = status.connected;
      console.log('[Network] Native network status changed:', status.connected);
    });
  } else {
    currentOnlineStatus = navigator.onLine;
    window.addEventListener('online', () => {
      currentOnlineStatus = true;
      console.log('[Network] Browser went online');
    });
    window.addEventListener('offline', () => {
      currentOnlineStatus = false;
      console.log('[Network] Browser went offline');
    });
  }
  _readyResolve();
}

// Start initialization immediately
initNetwork();

export const networkService = {
  isOnline(): boolean {
    return currentOnlineStatus;
  },
  /** Wait until the initial network status has been determined */
  ready(): Promise<void> {
    return _ready;
  }
};
