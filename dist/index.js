'use strict';

var reactNative = require('react-native');
var buffer = require('buffer');
var reactNativeBlePlx = require('@chargerwallet/react-native-ble-plx');
var ByteBuffer = require('bytebuffer');
var transport = require('@chargerwallet/hd-transport');
var hdShared = require('@chargerwallet/hd-shared');
var BleManager = require('react-native-ble-manager');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var ByteBuffer__default = /*#__PURE__*/_interopDefaultLegacy(ByteBuffer);
var transport__default = /*#__PURE__*/_interopDefaultLegacy(transport);
var BleManager__default = /*#__PURE__*/_interopDefaultLegacy(BleManager);

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */

function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};

const initializeBleManager = () => {
    BleManager__default["default"].start({ showAlert: false });
};
const getConnectedDeviceIds = (serviceUuids) => __awaiter(void 0, void 0, void 0, function* () {
    const connectedPeripherals = yield BleManager__default["default"].getConnectedPeripherals(serviceUuids);
    return connectedPeripherals.map(peripheral => {
        const { id, name, advertising = {} } = peripheral;
        return Object.assign({ id, name }, advertising);
    });
});
const getBondedDevices = () => __awaiter(void 0, void 0, void 0, function* () {
    const peripherals = yield BleManager__default["default"].getBondedPeripherals();
    return peripherals.map(peripheral => {
        const { id, name, advertising = {} } = peripheral;
        return Object.assign({ id, name }, advertising);
    });
});

const timer = process.env.NODE_ENV === 'development'
    ? {
        timeout: (fn, ms) => {
            const startTime = Date.now();
            const interval = setInterval(() => {
                if (Date.now() - startTime >= ms) {
                    clearInterval(interval);
                    fn();
                }
            }, 100);
            return () => {
                clearInterval(interval);
            };
        },
    }
    : {
        timeout: (fn, ms) => {
            const timeout = setTimeout(fn, ms);
            return () => clearTimeout(timeout);
        },
    };

const subscribeBleOn = (bleManager, ms = 1000) => new Promise((resolve, reject) => {
    let done = false;
    const subscription = bleManager.onStateChange(state => {
        console.log('ble state -> ', state);
        if (state === 'PoweredOn') {
            if (done)
                return;
            clearTimeout();
            done = true;
            subscription.remove();
            resolve();
        }
    }, true);
    const clearTimeout = timer.timeout(() => {
        if (done)
            return;
        subscription.remove();
        reject(hdShared.ERRORS.TypedError(hdShared.HardwareErrorCode.BlePermissionError));
    }, ms);
});

const IOS_PACKET_LENGTH = 128;
const ANDROID_PACKET_LENGTH = 192;
const isChargerwalletDevice = (name, id) => {
    var _a;
    if ((_a = id === null || id === void 0 ? void 0 : id.startsWith) === null || _a === void 0 ? void 0 : _a.call(id, 'MI')) {
        return true;
    }
    const re = /(BixinKey\d{10})|(K\d{4})|(T\d{4})|(Touch\s\w{4})|(Pro\s\w{4})/i;
    if (name && re.exec(name)) {
        return true;
    }
    return false;
};
const ClassicServiceUUID = '00000001-0000-1000-8000-00805f9b34fb';
const ChargerWalletServices = {
    classic: {
        [ClassicServiceUUID]: {
            serviceUuid: ClassicServiceUUID,
            writeUuid: '00000002-0000-1000-8000-00805f9b34fb',
            notifyUuid: '00000003-0000-1000-8000-00805f9b34fb',
        },
    },
};
const bluetoothServices = [];
for (const deviceType of Object.keys(ChargerWalletServices)) {
    const services = ChargerWalletServices[deviceType];
    bluetoothServices.push(...Object.keys(services));
}
const getBluetoothServiceUuids = () => bluetoothServices;
const getInfosForServiceUuid = (serviceUuid, deviceType) => {
    const services = ChargerWalletServices[deviceType];
    if (!services) {
        return null;
    }
    const service = services[serviceUuid];
    if (!service) {
        return null;
    }
    return service;
};

const isHeaderChunk = (chunk) => {
    if (chunk.length < 9)
        return false;
    const [MagicQuestionMark, sharp1, sharp2] = chunk;
    if (String.fromCharCode(MagicQuestionMark) === String.fromCharCode(transport.MESSAGE_TOP_CHAR) &&
        String.fromCharCode(sharp1) === String.fromCharCode(transport.MESSAGE_HEADER_BYTE) &&
        String.fromCharCode(sharp2) === String.fromCharCode(transport.MESSAGE_HEADER_BYTE)) {
        return true;
    }
    return false;
};

class BleTransport {
    constructor(device, writeCharacteristic, notifyCharacteristic) {
        this.mtuSize = 20;
        this.id = device.id;
        this.device = device;
        this.writeCharacteristic = writeCharacteristic;
        this.notifyCharacteristic = notifyCharacteristic;
        console.log(`BleTransport(${String(this.id)}) new instance`);
    }
}

const { check, buildBuffers, receiveOne, parseConfigure } = transport__default["default"];
const transportCache = {};
let connectOptions = {
    requestMTU: 256,
    timeout: 3000,
    refreshGatt: 'OnConnected',
};
const tryToGetConfiguration = (device) => {
    if (!device || !device.serviceUUIDs)
        return null;
    const [serviceUUID] = device.serviceUUIDs;
    const infos = getInfosForServiceUuid(serviceUUID, 'classic');
    if (!infos)
        return null;
    return infos;
};
class ReactNativeBleTransport {
    constructor(options) {
        var _a;
        this.configured = false;
        this.stopped = false;
        this.scanTimeout = 3000;
        this.runPromise = null;
        this.scanTimeout = (_a = options.scanTimeout) !== null && _a !== void 0 ? _a : 3000;
    }
    init(logger, emitter) {
        this.Log = logger;
        this.emitter = emitter;
    }
    configure(signedData) {
        const messages = parseConfigure(signedData);
        this.configured = true;
        this._messages = messages;
    }
    listen() {
    }
    getPlxManager() {
        if (this.blePlxManager)
            return Promise.resolve(this.blePlxManager);
        this.blePlxManager = new reactNativeBlePlx.BleManager();
        initializeBleManager();
        return Promise.resolve(this.blePlxManager);
    }
    enumerate() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                const deviceList = [];
                const blePlxManager = yield this.getPlxManager();
                try {
                    yield subscribeBleOn(blePlxManager);
                }
                catch (error) {
                    this.Log.debug('subscribeBleOn error: ', error);
                    reject(error);
                    return;
                }
                if (reactNative.Platform.OS === 'android' && reactNative.Platform.Version >= 31) {
                    this.Log.debug('requesting permissions, please wait...');
                    const resultConnect = yield reactNative.PermissionsAndroid.requestMultiple([
                        reactNative.PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
                        reactNative.PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                    ]);
                    this.Log.debug('requesting permissions, result: ', resultConnect);
                    if (resultConnect[reactNative.PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] !== 'granted' ||
                        resultConnect[reactNative.PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] !== 'granted') {
                        reject(hdShared.ERRORS.TypedError(hdShared.HardwareErrorCode.BlePermissionError));
                        return;
                    }
                }
                blePlxManager.startDeviceScan(null, {
                    scanMode: reactNativeBlePlx.ScanMode.LowLatency,
                }, (error, device) => {
                    var _a, _b;
                    if (error) {
                        this.Log.debug('ble scan manager: ', blePlxManager);
                        this.Log.debug('ble scan error: ', error);
                        if ([reactNativeBlePlx.BleErrorCode.BluetoothPoweredOff, reactNativeBlePlx.BleErrorCode.BluetoothInUnknownState].includes(error.errorCode)) {
                            reject(hdShared.ERRORS.TypedError(hdShared.HardwareErrorCode.BlePermissionError));
                        }
                        else if (error.errorCode === reactNativeBlePlx.BleErrorCode.BluetoothUnauthorized) {
                            reject(hdShared.ERRORS.TypedError(hdShared.HardwareErrorCode.BleLocationError));
                        }
                        else if (error.errorCode === reactNativeBlePlx.BleErrorCode.LocationServicesDisabled) {
                            reject(hdShared.ERRORS.TypedError(hdShared.HardwareErrorCode.BleLocationServicesDisabled));
                        }
                        else if (error.errorCode === reactNativeBlePlx.BleErrorCode.ScanStartFailed) {
                            timer.timeout(() => { }, this.scanTimeout);
                        }
                        else {
                            reject(hdShared.ERRORS.TypedError(hdShared.HardwareErrorCode.BleScanError, (_a = error.reason) !== null && _a !== void 0 ? _a : ''));
                        }
                        return;
                    }
                    if (isChargerwalletDevice((_b = device === null || device === void 0 ? void 0 : device.name) !== null && _b !== void 0 ? _b : null, device === null || device === void 0 ? void 0 : device.id)) {
                        this.Log.debug('search device start ======================');
                        const { name, localName, id } = device !== null && device !== void 0 ? device : {};
                        this.Log.debug(`device name: ${name !== null && name !== void 0 ? name : ''}\nlocalName: ${localName !== null && localName !== void 0 ? localName : ''}\nid: ${id !== null && id !== void 0 ? id : ''}`);
                        addDevice(device);
                        this.Log.debug('search device end ======================\n');
                    }
                });
                getConnectedDeviceIds(getBluetoothServiceUuids()).then(devices => {
                    for (const device of devices) {
                        this.Log.debug('search connected peripheral: ', device.id);
                        addDevice(device);
                    }
                });
                const addDevice = (device) => {
                    if (deviceList.every(d => d.id !== device.id)) {
                        deviceList.push(device);
                    }
                };
                timer.timeout(() => {
                    blePlxManager.stopDeviceScan();
                    resolve(deviceList);
                }, this.scanTimeout);
            }));
        });
    }
    acquire(input) {
        var _a, _b, _c;
        return __awaiter(this, void 0, void 0, function* () {
            const { uuid, forceCleanRunPromise } = input;
            if (!uuid) {
                throw hdShared.ERRORS.TypedError(hdShared.HardwareErrorCode.BleRequiredUUID);
            }
            let device = null;
            if (transportCache[uuid]) {
                this.Log.debug('transport not be released, will release: ', uuid);
                yield this.release(uuid);
            }
            if (forceCleanRunPromise && this.runPromise) {
                this.runPromise.reject(hdShared.ERRORS.TypedError(hdShared.HardwareErrorCode.BleForceCleanRunPromise));
                this.Log.debug('Force clean Bluetooth run promise, forceCleanRunPromise: ', forceCleanRunPromise);
            }
            const blePlxManager = yield this.getPlxManager();
            try {
                yield subscribeBleOn(blePlxManager);
            }
            catch (error) {
                this.Log.debug('subscribeBleOn error: ', error);
                throw error;
            }
            if (!device) {
                const devices = yield blePlxManager.devices([uuid]);
                [device] = devices;
            }
            if (!device) {
                const connectedDevice = yield blePlxManager.connectedDevices(getBluetoothServiceUuids());
                const deviceFilter = connectedDevice.filter(device => device.id === uuid);
                this.Log.debug(`found connected device count: ${deviceFilter.length}`);
                [device] = deviceFilter;
            }
            if (!device) {
                this.Log.debug('try to connect to device: ', uuid);
                try {
                    device = yield blePlxManager.connectToDevice(uuid, connectOptions);
                }
                catch (e) {
                    this.Log.debug('try to connect to device has error: ', e);
                    if (e.errorCode === reactNativeBlePlx.BleErrorCode.DeviceMTUChangeFailed ||
                        e.errorCode === reactNativeBlePlx.BleErrorCode.OperationCancelled) {
                        connectOptions = {};
                        this.Log.debug('first try to reconnect without params');
                        device = yield blePlxManager.connectToDevice(uuid);
                    }
                    else if (e.errorCode === reactNativeBlePlx.BleErrorCode.DeviceAlreadyConnected) {
                        this.Log.debug('device already connected');
                        throw hdShared.ERRORS.TypedError(hdShared.HardwareErrorCode.BleAlreadyConnected);
                    }
                    else {
                        throw hdShared.ERRORS.TypedError(hdShared.HardwareErrorCode.BleConnectedError, (_a = e.reason) !== null && _a !== void 0 ? _a : e);
                    }
                }
            }
            if (!device) {
                throw hdShared.ERRORS.TypedError(hdShared.HardwareErrorCode.BleConnectedError, 'unable to connect to device');
            }
            if (!(yield device.isConnected())) {
                this.Log.debug('not connected, try to connect to device: ', uuid);
                try {
                    yield device.connect(connectOptions);
                }
                catch (e) {
                    this.Log.debug('not connected, try to connect to device has error: ', e);
                    if (e.errorCode === reactNativeBlePlx.BleErrorCode.DeviceMTUChangeFailed ||
                        e.errorCode === reactNativeBlePlx.BleErrorCode.OperationCancelled) {
                        connectOptions = {};
                        this.Log.debug('second try to reconnect without params');
                        try {
                            yield device.connect();
                        }
                        catch (e) {
                            this.Log.debug('last try to reconnect error: ', e);
                            if (e.errorCode === reactNativeBlePlx.BleErrorCode.OperationCancelled) {
                                this.Log.debug('last try to reconnect');
                                yield device.cancelConnection();
                                yield device.connect();
                            }
                        }
                    }
                    else {
                        throw hdShared.ERRORS.TypedError(hdShared.HardwareErrorCode.BleConnectedError, (_b = e.reason) !== null && _b !== void 0 ? _b : e);
                    }
                }
            }
            if (reactNative.Platform.OS === 'android') {
                const bondedDevices = yield getBondedDevices();
                const hasBonded = !!bondedDevices.find(bondedDevice => bondedDevice.id === (device === null || device === void 0 ? void 0 : device.id));
                if (!hasBonded) {
                    throw hdShared.ERRORS.TypedError(hdShared.HardwareErrorCode.BleDeviceNotBonded, 'device is not bonded');
                }
            }
            yield device.discoverAllServicesAndCharacteristics();
            let infos = tryToGetConfiguration(device);
            let characteristics;
            if (!infos) {
                for (const serviceUuid of getBluetoothServiceUuids()) {
                    try {
                        characteristics = yield device.characteristicsForService(serviceUuid);
                        infos = getInfosForServiceUuid(serviceUuid, 'classic');
                        break;
                    }
                    catch (e) {
                        this.Log.error(e);
                    }
                }
            }
            if (!infos) {
                try {
                    this.Log.debug('cancel connection when service not found');
                    yield device.cancelConnection();
                }
                catch (e) {
                    this.Log.debug('cancel connection error when service not found: ', e.message || e.reason);
                }
                throw hdShared.ERRORS.TypedError(hdShared.HardwareErrorCode.BleServiceNotFound);
            }
            const { serviceUuid, writeUuid, notifyUuid } = infos;
            if (!characteristics) {
                characteristics = yield device.characteristicsForService(serviceUuid);
            }
            if (!characteristics) {
                throw hdShared.ERRORS.TypedError(hdShared.HardwareErrorCode.BleCharacteristicNotFound);
            }
            let writeCharacteristic;
            let notifyCharacteristic;
            for (const c of characteristics) {
                if (c.uuid === writeUuid) {
                    writeCharacteristic = c;
                }
                else if (c.uuid === notifyUuid) {
                    notifyCharacteristic = c;
                }
            }
            if (!writeCharacteristic) {
                throw hdShared.ERRORS.TypedError('BLECharacteristicNotFound: write characteristic not found');
            }
            if (!notifyCharacteristic) {
                throw hdShared.ERRORS.TypedError('BLECharacteristicNotFound: notify characteristic not found');
            }
            if (!writeCharacteristic.isWritableWithResponse) {
                throw hdShared.ERRORS.TypedError('BLECharacteristicNotWritable: write characteristic not writable');
            }
            if (!notifyCharacteristic.isNotifiable) {
                throw hdShared.ERRORS.TypedError('BLECharacteristicNotNotifiable: notify characteristic not notifiable');
            }
            const transport = new BleTransport(device, writeCharacteristic, notifyCharacteristic);
            transport.nofitySubscription = this._monitorCharacteristic(transport.notifyCharacteristic);
            transportCache[uuid] = transport;
            (_c = this.emitter) === null || _c === void 0 ? void 0 : _c.emit('device-connect', {
                name: device.name,
                id: device.id,
                connectId: device.id,
            });
            const disconnectSubscription = device.onDisconnected(() => {
                var _a;
                this.Log.debug('device disconnect: ', device === null || device === void 0 ? void 0 : device.id);
                (_a = this.emitter) === null || _a === void 0 ? void 0 : _a.emit('device-disconnect', {
                    name: device === null || device === void 0 ? void 0 : device.name,
                    id: device === null || device === void 0 ? void 0 : device.id,
                    connectId: device === null || device === void 0 ? void 0 : device.id,
                });
                this.release(uuid);
                disconnectSubscription === null || disconnectSubscription === void 0 ? void 0 : disconnectSubscription.remove();
            });
            return { uuid };
        });
    }
    _monitorCharacteristic(characteristic) {
        let bufferLength = 0;
        let buffer$1 = [];
        const subscription = characteristic.monitor((error, c) => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j;
            if (error) {
                this.Log.debug(`error monitor ${characteristic.uuid}, deviceId: ${characteristic.deviceID}: ${error}`);
                if (this.runPromise) {
                    let ERROR = hdShared.HardwareErrorCode.BleCharacteristicNotifyError;
                    if ((_a = error.reason) === null || _a === void 0 ? void 0 : _a.includes('The connection has timed out unexpectedly')) {
                        ERROR = hdShared.HardwareErrorCode.BleTimeoutError;
                    }
                    if ((_b = error.reason) === null || _b === void 0 ? void 0 : _b.includes('Encryption is insufficient')) {
                        ERROR = hdShared.HardwareErrorCode.BleDeviceBondError;
                    }
                    if (((_c = error.reason) === null || _c === void 0 ? void 0 : _c.includes('Cannot write client characteristic config descriptor')) ||
                        ((_d = error.reason) === null || _d === void 0 ? void 0 : _d.includes('Cannot find client characteristic config descriptor')) ||
                        ((_e = error.reason) === null || _e === void 0 ? void 0 : _e.includes('The handle is invalid'))) {
                        this.runPromise.reject(hdShared.ERRORS.TypedError(hdShared.HardwareErrorCode.BleCharacteristicNotifyChangeFailure, (_f = error.message) !== null && _f !== void 0 ? _f : error.reason));
                        this.Log.debug(`${hdShared.HardwareErrorCode.BleCharacteristicNotifyChangeFailure} ${error.message}    ${error.reason}`);
                        return;
                    }
                    this.runPromise.reject(hdShared.ERRORS.TypedError(ERROR, (_g = error.reason) !== null && _g !== void 0 ? _g : error.message));
                    this.Log.debug(': monitor notify error, and has unreleased Promise');
                }
                return;
            }
            if (!c) {
                throw hdShared.ERRORS.TypedError(hdShared.HardwareErrorCode.BleMonitorError);
            }
            try {
                const data = buffer.Buffer.from(c.value, 'base64');
                if (isHeaderChunk(data)) {
                    bufferLength = data.readInt32BE(5);
                    buffer$1 = [...data.subarray(3)];
                }
                else {
                    buffer$1 = buffer$1.concat([...data]);
                }
                if (buffer$1.length - transport.COMMON_HEADER_SIZE >= bufferLength) {
                    const value = buffer.Buffer.from(buffer$1);
                    bufferLength = 0;
                    buffer$1 = [];
                    (_h = this.runPromise) === null || _h === void 0 ? void 0 : _h.resolve(value.toString('hex'));
                }
            }
            catch (error) {
                this.Log.debug('monitor data error: ', error);
                (_j = this.runPromise) === null || _j === void 0 ? void 0 : _j.reject(error);
            }
        });
        return () => {
            this.Log.debug('remove characteristic monitor: ', characteristic.uuid);
            subscription.remove();
        };
    }
    release(uuid) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const transport = transportCache[uuid];
            if (transport) {
                delete transportCache[uuid];
                (_a = transport.nofitySubscription) === null || _a === void 0 ? void 0 : _a.call(transport);
                if (reactNative.Platform.OS === 'android') ;
            }
            return Promise.resolve(true);
        });
    }
    call(uuid, name, data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.stopped) {
                return Promise.reject(hdShared.ERRORS.TypedError('Transport stopped.'));
            }
            if (this._messages == null) {
                throw hdShared.ERRORS.TypedError(hdShared.HardwareErrorCode.TransportNotConfigured);
            }
            if (this.runPromise) {
                throw hdShared.ERRORS.TypedError(hdShared.HardwareErrorCode.TransportCallInProgress);
            }
            const transport$1 = transportCache[uuid];
            if (!transport$1) {
                throw hdShared.ERRORS.TypedError(hdShared.HardwareErrorCode.TransportNotFound);
            }
            this.runPromise = hdShared.createDeferred();
            const messages = this._messages;
            if (name === 'ResourceUpdate' || name === 'ResourceAck') {
                this.Log.debug('transport-react-native', 'call-', ' name: ', name, ' data: ', {
                    file_name: data === null || data === void 0 ? void 0 : data.file_name,
                    hash: data === null || data === void 0 ? void 0 : data.hash,
                });
            }
            else if (transport.LogBlockCommand.has(name)) {
                this.Log.debug('transport-react-native', 'call-', ' name: ', name);
            }
            else {
                this.Log.debug('transport-react-native', 'call-', ' name: ', name, ' data: ', data);
            }
            const buffers = buildBuffers(messages, name, data);
            if (name === 'FirmwareUpload' || name === 'EmmcFileWrite') {
                const packetCapacity = reactNative.Platform.OS === 'ios' ? IOS_PACKET_LENGTH : ANDROID_PACKET_LENGTH;
                let index = 0;
                let chunk = ByteBuffer__default["default"].allocate(packetCapacity);
                while (index < buffers.length) {
                    const buffer = buffers[index].toBuffer();
                    chunk.append(buffer);
                    index += 1;
                    if (chunk.offset === packetCapacity || index >= buffers.length) {
                        chunk.reset();
                        try {
                            yield transport$1.writeCharacteristic.writeWithoutResponse(chunk.toString('base64'));
                            chunk = ByteBuffer__default["default"].allocate(packetCapacity);
                        }
                        catch (e) {
                            this.runPromise = null;
                            this.Log.error('writeCharacteristic write error: ', e);
                            return;
                        }
                    }
                }
            }
            else {
                for (const o of buffers) {
                    const outData = o.toString('base64');
                    try {
                        yield transport$1.writeCharacteristic.writeWithoutResponse(outData);
                    }
                    catch (e) {
                        this.Log.debug('writeCharacteristic write error: ', e);
                        this.runPromise = null;
                        if (e.errorCode === reactNativeBlePlx.BleErrorCode.DeviceDisconnected) {
                            throw hdShared.ERRORS.TypedError(hdShared.HardwareErrorCode.BleDeviceNotBonded);
                        }
                        if (e.errorCode === reactNativeBlePlx.BleErrorCode.OperationStartFailed) {
                            throw hdShared.ERRORS.TypedError(hdShared.HardwareErrorCode.BleWriteCharacteristicError, e.reason);
                        }
                        return;
                    }
                }
            }
            try {
                const response = yield this.runPromise.promise;
                if (typeof response !== 'string') {
                    throw new Error('Returning data is not string.');
                }
                this.Log.debug('receive data: ', response);
                const jsonData = receiveOne(messages, response);
                return check.call(jsonData);
            }
            catch (e) {
                this.Log.error('call error: ', e);
                throw e;
            }
            finally {
                this.runPromise = null;
            }
        });
    }
    stop() {
        this.stopped = true;
    }
    cancel() {
        this.Log.debug('transport-react-native canceled');
        if (this.runPromise) ;
        this.runPromise = null;
    }
}

module.exports = ReactNativeBleTransport;
