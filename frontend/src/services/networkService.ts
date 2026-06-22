import { Network } from '@capacitor/network';
import { Capacitor } from '@capacitor/core';

let currentOnlineStatus = typeof navigator !== 'undefined' ? navigator.onLine : true;
// Promise that resolves once we have the real network status
let _readyResolve: () => void;
const _ready = new Promise<void>((resolve) => { _readyResolve = resolve; });

async function initNetwork() {
  // Always attach window listeners as the main webview container triggers these reliably
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      currentOnlineStatus = true;
      console.log('[Network] Browser window went online');
    });
    window.addEventListener('offline', () => {
      currentOnlineStatus = false;
      console.log('[Network] Browser window went offline');
    });
  }

  if (Capacitor.isNativePlatform()) {
    try {
      const status = await Network.getStatus();
      // Use both native status and browser navigator status to avoid false negatives
      currentOnlineStatus = navigator.onLine && status.connected;
      console.log('[Network] Initial native network status:', status.connected, 'navigator.onLine:', navigator.onLine);
    } catch (e) {
      console.warn('[Network] Failed to get initial native status, falling back to browser state:', currentOnlineStatus);
    }
    try {
      Network.addListener('networkStatusChange', (status) => {
        currentOnlineStatus = status.connected;
        console.log('[Network] Native network status changed:', status.connected);
      });
    } catch (err) {
      console.warn('[Network] Failed to add native listener:', err);
    }
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
