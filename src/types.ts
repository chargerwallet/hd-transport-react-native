export type { BleManager as BlePlxManager } from '@chargerwallet/react-native-ble-plx';

export type TransportOptions = {
  scanTimeout?: number;
};

export type BleAcquireInput = {
  uuid: string;
  forceCleanRunPromise?: boolean;
};
