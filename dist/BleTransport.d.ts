import { Device, Characteristic } from '@chargerwallet/react-native-ble-plx';
export default class BleTransport {
    id: string;
    device: Device;
    mtuSize: number;
    writeCharacteristic: Characteristic;
    notifyCharacteristic: Characteristic;
    nofitySubscription?: () => void;
    constructor(device: Device, writeCharacteristic: Characteristic, notifyCharacteristic: Characteristic);
}
//# sourceMappingURL=BleTransport.d.ts.map