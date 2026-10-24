const KEY = 'bunkercoin.notify.v1';

export const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window;

/** Opted in here and still granted by the browser. */
export function notifyEnabled(): boolean {
  try {
    return notificationsSupported() && Notification.permission === 'granted' && localStorage.getItem(KEY) === 'on';
  } catch {
    return false;
  }
}

export function saveNotify(on: boolean): void {
  try {
    if (on) localStorage.setItem(KEY, 'on');
    else localStorage.removeItem(KEY);
  } catch {
    // Not persisted: stays off after a reload.
  }
}

/** Asks the browser only from an explicit tap in settings. */
export async function enableNotify(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  const granted = Notification.permission === 'granted' || (await Notification.requestPermission()) === 'granted';
  saveNotify(granted);
  return granted;
}

export function notify(body: string): void {
  if (!notifyEnabled()) return;
  try {
    new Notification('BunkerCoin wallet', { body, tag: body });
  } catch {
    // Some browsers allow notifications only from a service worker.
  }
}
