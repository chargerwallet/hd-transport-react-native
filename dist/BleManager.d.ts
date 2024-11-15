export declare const initializeBleManager: () => void;
export declare const getConnectedDeviceIds: (serviceUuids: string[]) => Promise<{
    isConnectable?: boolean | undefined;
    localName?: string | undefined;
    manufacturerData?: any;
    serviceUUIDs?: string[] | undefined;
    txPowerLevel?: number | undefined;
    id: string;
    name: string | undefined;
}[]>;
export declare const getBondedDevices: () => Promise<{
    isConnectable?: boolean | undefined;
    localName?: string | undefined;
    manufacturerData?: any;
    serviceUUIDs?: string[] | undefined;
    txPowerLevel?: number | undefined;
    id: string;
    name: string | undefined;
}[]>;
export declare const refreshCache: (peripheralId: string) => Promise<void>;
//# sourceMappingURL=BleManager.d.ts.map