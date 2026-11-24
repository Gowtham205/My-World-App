import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export interface NativeStepStatus {
  sensorAvailable: boolean;
  permissionGranted: boolean;
  todaySteps: number;
  date: string;
}

interface SanctuaryStepsPluginContract {
  getStepStatus(): Promise<NativeStepStatus>;
  requestPermissionAndStart(): Promise<NativeStepStatus>;
  addListener(
    eventName: 'stepsUpdated',
    listenerFunc: (event: { todaySteps: number; date: string; sensorAvailable: boolean }) => void
  ): Promise<PluginListenerHandle>;
}

const SanctuarySteps = registerPlugin<SanctuaryStepsPluginContract>('SanctuarySteps');

export async function getNativeStepStatus(): Promise<NativeStepStatus> {
  if (!Capacitor.isNativePlatform()) {
    return {
      sensorAvailable: false,
      permissionGranted: false,
      todaySteps: 0,
      date: '',
    };
  }
  try {
    return await SanctuarySteps.getStepStatus();
  } catch {
    return {
      sensorAvailable: false,
      permissionGranted: false,
      todaySteps: 0,
      date: '',
    };
  }
}

export async function requestNativeStepTracking(): Promise<NativeStepStatus> {
  if (!Capacitor.isNativePlatform()) {
    return {
      sensorAvailable: false,
      permissionGranted: false,
      todaySteps: 0,
      date: '',
    };
  }
  try {
    return await SanctuarySteps.requestPermissionAndStart();
  } catch {
    return {
      sensorAvailable: false,
      permissionGranted: false,
      todaySteps: 0,
      date: '',
    };
  }
}

export function attachNativeStepsListener(
  onUpdate: (payload: { todaySteps: number; date: string; sensorAvailable: boolean }) => void
): () => void {
  if (!Capacitor.isNativePlatform()) return () => {};
  let removed = false;
  const handlePromise = SanctuarySteps.addListener('stepsUpdated', (ev) => {
    if (!removed) onUpdate(ev);
  }).catch(() => null);

  return () => {
    removed = true;
    void handlePromise.then((h) => h?.remove());
  };
}
