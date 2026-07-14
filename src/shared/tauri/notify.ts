import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import { invoke } from '@tauri-apps/api/core';
import { CMD } from './commands';

let granted: boolean | null = null;

/** Native notification when a service stops unexpectedly (crash / external stop). */
export async function notifyCrash(displayName: string): Promise<void> {
  try {
    if (granted === null) {
      granted = (await isPermissionGranted()) || (await requestPermission()) === 'granted';
    }
    if (granted) {
      sendNotification({ title: 'Service stopped', body: `${displayName} stopped unexpectedly.` });
    }
  } catch {
    /* notifications are best-effort */
  }
}

/** Push the running-count label into the menu-bar tray. */
export function setTrayTitle(title: string): void {
  void invoke(CMD.SET_TRAY_TITLE, { title }).catch(() => {});
}

/** Rebuild the tray menu's Active Services list (checkmark = running). */
export function setTrayServices(services: { name: string; running: boolean }[]): void {
  void invoke(CMD.SET_TRAY_SERVICES, { services }).catch(() => {});
}
