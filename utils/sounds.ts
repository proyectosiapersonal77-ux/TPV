import { useAuthStore } from '../stores/useAuthStore';
import { SETTINGS_KEYS } from '../services/configService';

class SoundService {
    private audioCtx: AudioContext | null = null;

    private getContext() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
        return this.audioCtx;
    }

    private isSoundEnabled(): boolean {
        const globalEnabled = localStorage.getItem(SETTINGS_KEYS.GLOBAL_SOUNDS_ENABLED) !== 'false';
        if (!globalEnabled) return false;

        const user = useAuthStore.getState().user;
        if (user && user.preferences && user.preferences.soundsEnabled === false) {
            return false;
        }

        return true;
    }

    private isHapticEnabled(): boolean {
        const globalEnabled = localStorage.getItem(SETTINGS_KEYS.GLOBAL_HAPTICS_ENABLED) !== 'false';
        if (!globalEnabled) return false;

        const user = useAuthStore.getState().user;
        if (user && user.preferences && user.preferences.hapticsEnabled === false) {
            return false;
        }

        return 'vibrate' in navigator;
    }

    playSuccess() {
        if (this.isHapticEnabled()) {
            navigator.vibrate([30, 50, 100]);
        }
        
        if (!this.isSoundEnabled()) return;
        
        // "Email sent" / Whoosh/Pop sound
        try {
            const ctx = this.getContext();
            const osc = ctx.createOscillator();
            const gainNode = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(300, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.15);

            gainNode.gain.setValueAtTime(0, ctx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.05);
            gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);

            osc.connect(gainNode);
            gainNode.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + 0.2);
        } catch (e) {
            console.error("Audio play failed", e);
        }
    }

    playDelete() {
        if (this.isHapticEnabled()) {
            navigator.vibrate([40, 30, 40]);
        }
        
        if (!this.isSoundEnabled()) return;
        
        // "Crumple" / Noise effect
        try {
            const ctx = this.getContext();
            
            const bufferSize = ctx.sampleRate * 0.15; // 150ms
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            
            const noise = ctx.createBufferSource();
            noise.buffer = buffer;
            
            const filter = ctx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.value = 1000;
            
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
            
            noise.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);
            
            noise.start();
        } catch (e) {
            console.error("Audio play failed", e);
        }
    }

    playError() {
        if (this.isHapticEnabled()) {
            navigator.vibrate([50, 50, 50]);
        }
        
        if (!this.isSoundEnabled()) return;
        try {
            const ctx = this.getContext();
            const osc = ctx.createOscillator();
            const gainNode = ctx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(300, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.2);

            gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

            osc.connect(gainNode);
            gainNode.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + 0.2);
        } catch (e) {
            console.error("Audio play failed", e);
        }
    }
    
    playClick() {
        if (this.isHapticEnabled()) {
            navigator.vibrate(50);
        }
        
        if (!this.isSoundEnabled()) return;
        try {
            const ctx = this.getContext();
            const osc = ctx.createOscillator();
            const gainNode = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.05);

            gainNode.gain.setValueAtTime(0.05, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

            osc.connect(gainNode);
            gainNode.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + 0.05);
        } catch (e) {
            console.error("Audio play failed", e);
        }
    }
}

export const soundService = new SoundService();
