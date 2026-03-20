/// <reference types="web-bluetooth" />

export class BluetoothPrinterService {
    private device: BluetoothDevice | null = null;
    private server: BluetoothRemoteGATTServer | null = null;
    private characteristic: BluetoothRemoteGATTCharacteristic | null = null;
    private disconnectCallback: (() => void) | null = null;

    setDisconnectCallback(callback: () => void) {
        this.disconnectCallback = callback;
    }

    // Standard ESC/POS commands
    private ESC = '\x1B';
    private GS = '\x1D';
    private INIT = '\x1B\x40'; // Initialize printer
    private BOLD_ON = '\x1B\x45\x01';
    private BOLD_OFF = '\x1B\x45\x00';
    private CENTER = '\x1B\x61\x01';
    private LEFT = '\x1B\x61\x00';
    private FEED = '\x0A';
    private CUT = '\x1D\x56\x41\x10'; // Partial cut

    async connect(): Promise<boolean> {
        try {
            if (!navigator.bluetooth) {
                throw new Error('La API Web Bluetooth no está disponible en este navegador.');
            }

            this.device = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', '0000180a-0000-1000-8000-00805f9b34fb']
            });

            this.device.addEventListener('gattserverdisconnected', this.onDisconnected.bind(this));

            this.server = await this.device.gatt?.connect() || null;
            if (!this.server) throw new Error('No se pudo conectar al servidor GATT.');

            // Try to find the right service and characteristic
            const services = await this.server.getPrimaryServices();
            for (const service of services) {
                const characteristics = await service.getCharacteristics();
                for (const char of characteristics) {
                    if (char.properties.write || char.properties.writeWithoutResponse) {
                        this.characteristic = char;
                        return true;
                    }
                }
            }

            throw new Error('No se encontró una característica de escritura en la impresora.');
        } catch (error) {
            console.error('Error de conexión Bluetooth:', error);
            this.disconnect();
            throw error;
        }
    }

    disconnect() {
        if (this.device && this.device.gatt?.connected) {
            this.device.gatt.disconnect();
        }
        this.onDisconnected();
    }

    private onDisconnected() {
        console.log('Dispositivo Bluetooth desconectado');
        this.device = null;
        this.server = null;
        this.characteristic = null;
        if (this.disconnectCallback) {
            this.disconnectCallback();
        }
    }

    isConnected(): boolean {
        return this.device !== null && this.device.gatt?.connected === true && this.characteristic !== null;
    }

    async printReceipt(content: string) {
        if (!this.isConnected()) {
            throw new Error('La impresora no está conectada.');
        }

        try {
            // Remove accents and special characters to avoid encoding issues with basic ESC/POS
            const cleanContent = content.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            
            const encoder = new TextEncoder();
            let printData = this.INIT;
            printData += this.CENTER;
            printData += "TICKET DE VENTA\n";
            printData += "--------------------------------\n";
            printData += this.LEFT;
            printData += cleanContent;
            printData += "\n--------------------------------\n";
            printData += this.CENTER;
            printData += "Gracias por su visita\n";
            printData += this.FEED.repeat(4);
            printData += this.CUT;

            const data = encoder.encode(printData);
            
            // Send data in chunks if it's too large (BLE MTU limits)
            const chunkSize = 512;
            for (let i = 0; i < data.length; i += chunkSize) {
                const chunk = data.slice(i, i + chunkSize);
                if (this.characteristic?.properties.writeWithoutResponse) {
                    await this.characteristic.writeValueWithoutResponse(chunk);
                } else {
                    await this.characteristic?.writeValue(chunk);
                }
            }
            
            return true;
        } catch (error) {
            console.error('Error de impresión:', error);
            throw error;
        }
    }
}

export const bluetoothPrinter = new BluetoothPrinterService();
