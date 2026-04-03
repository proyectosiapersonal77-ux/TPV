import { useAuthStore } from '../stores/useAuthStore';

class SoundService {
    private audioCtx: AudioContext | null = null;

    private getContext() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        return this.audioCtx;
    }

    private isEnabled(): boolean {
        // Global setting (default true)
        const globalEnabled = localStorage.getItem('globalSoundsEnabled') !== 'false';
        if (!globalEnabled) return false;

        // User setting (default true)
        const user = useAuthStore.getState().user;
        if (user && user.preferences && user.preferences.soundsEnabled === false) {
            return false;
        }

        return true;
    }

    playSuccess() {
        if (!this.isEnabled()) return;
        try {
            const ctx = this.getContext();
            const osc = ctx.createOscillator();
            const gainNode = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
            osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1); // A6

            gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

            osc.connect(gainNode);
            gainNode.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + 0.1);
        } catch (e) {
            console.error("Audio play failed", e);
        }
    }

    playError() {
        if (!this.isEnabled()) return;
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
        if (!this.isEnabled()) return;
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
