import * as transport from '@chargerwallet/hd-transport';
import transport__default from '@chargerwallet/hd-transport';
import { BleManager, Device, Characteristic } from '@chargerwallet/react-native-ble-plx';
import { Deferred } from '@chargerwallet/hd-shared';
import EventEmitter from 'events';

type TransportOptions = {
    scanTimeout?: number;
};
type BleAcquireInput = {
    uuid: string;
    forceCleanRunPromise?: boolean;
};

declare class ReactNativeBleTransport {
    blePlxManager: BleManager | undefined;
    _messages: ReturnType<typeof transport__default.parseConfigure> | undefined;
    configured: boolean;
    stopped: boolean;
    scanTimeout: number;
    runPromise: Deferred<any> | null;
    Log?: any;
    emitter?: EventEmitter;
    constructor(options: TransportOptions);
    init(logger: any, emitter: EventEmitter): void;
    configure(signedData: any): void;
    listen(): void;
    getPlxManager(): Promise<BleManager>;
    enumerate(): Promise<Device[]>;
    acquire(input: BleAcquireInput): Promise<{
        uuid: string;
    }>;
    _monitorCharacteristic(characteristic: Characteristic): () => void;
    release(uuid: string): Promise<boolean>;
    call(uuid: string, name: string, data: Record<string, unknown>): Promise<transport.MessageFromChargerWallet | undefined>;
    stop(): void;
    cancel(): void;
}

export { ReactNativeBleTransport as default };
