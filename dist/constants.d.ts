export declare const IOS_PACKET_LENGTH = 128;
export declare const ANDROID_PACKET_LENGTH = 192;
export declare const isChargerwalletDevice: (name: string | null, id?: string) => boolean;
export declare const getBluetoothServiceUuids: () => string[];
export declare const getInfosForServiceUuid: (serviceUuid: string, deviceType: 'classic') => {
    serviceUuid: string;
    writeUuid?: string | undefined;
    notifyUuid?: string | undefined;
} | null;
//# sourceMappingURL=constants.d.ts.map