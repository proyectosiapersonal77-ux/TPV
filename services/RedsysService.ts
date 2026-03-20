export interface RedsysConfig {
    enabled: boolean;
    ipAddress: string;
    port: number;
}

class RedsysService {
    private config: RedsysConfig = {
        enabled: false,
        ipAddress: '192.168.1.100',
        port: 8888
    };

    constructor() {
        this.loadConfig();
    }

    private loadConfig() {
        const stored = localStorage.getItem('redsys_config');
        if (stored) {
            try {
                this.config = JSON.parse(stored);
            } catch (e) {
                console.error("Error parsing Redsys config", e);
            }
        }
    }

    getConfig(): RedsysConfig {
        return this.config;
    }

    saveConfig(config: RedsysConfig) {
        this.config = config;
        localStorage.setItem('redsys_config', JSON.stringify(config));
    }

    async sendPayment(amount: number, orderId: string): Promise<{ success: boolean; message: string; authCode?: string }> {
        if (!this.config.enabled) {
            return { success: true, message: 'Redsys disabled, simulating success.' };
        }

        console.log(`Sending payment of ${amount} to Redsys terminal at ${this.config.ipAddress}:${this.config.port} for order ${orderId}`);
        
        // Simulate network delay and terminal interaction
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                // Simulate 90% success rate
                if (Math.random() > 0.1) {
                    resolve({ 
                        success: true, 
                        message: 'Pago aprobado', 
                        authCode: Math.floor(100000 + Math.random() * 900000).toString() 
                    });
                } else {
                    reject(new Error('Pago denegado o cancelado por el usuario en el datáfono.'));
                }
            }, 3000); // 3 seconds to simulate user tapping card
        });
    }
}

export const redsysService = new RedsysService();
