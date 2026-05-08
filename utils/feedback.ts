import { useAuthStore } from '../stores/useAuthStore';
import { SETTINGS_KEYS } from '../services/configService';

// Simple AudioContext cache to avoid recreating
let audioCtx: AudioContext | null = null;
const getAudioContext = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
};

// --- AUDIO GENERATORS ---
const playTone = (frequency: number, type: OscillatorType, duration: number, volume: number = 0.1) => {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    
    // Envelope
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    console.error("Audio generation error", e);
  }
};

const playClick = () => {
  playTone(600, 'sine', 0.05, 0.2);
};

const playCrumple = () => {
    // Noise generation for "crumple" effect
    try {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') ctx.resume();
        
        const bufferSize = ctx.sampleRate * 0.15; // 150ms
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        
        // Filter to make it sound more like paper
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
        console.error("Noise generation error", e);
    }
};

const playWhoosh = () => {
    try {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') ctx.resume();
        
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.15);
        
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.05);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
    } catch(e) {}
};


// --- FEEDBACK PROVIDERS ---

export const useFeedback = () => {
  const { user } = useAuthStore();

  const isSoundAllowed = () => {
    const globalSound = localStorage.getItem(SETTINGS_KEYS.GLOBAL_SOUNDS_ENABLED) !== 'false';
    const userSound = user?.preferences?.soundsEnabled !== false;
    return globalSound && userSound;
  };

  const isHapticAllowed = () => {
    const globalHaptic = localStorage.getItem(SETTINGS_KEYS.GLOBAL_HAPTICS_ENABLED) !== 'false';
    const userHaptic = user?.preferences?.hapticsEnabled !== false;
    return globalHaptic && userHaptic && 'vibrate' in navigator;
  };

  const triggerClick = () => {
    if (isSoundAllowed()) playClick();
    if (isHapticAllowed()) navigator.vibrate(50);
  };

  const triggerDelete = () => {
    if (isSoundAllowed()) playCrumple();
    if (isHapticAllowed()) navigator.vibrate([40, 30, 40]);
  };

  const triggerSuccess = () => {
    if (isSoundAllowed()) playWhoosh();
    if (isHapticAllowed()) navigator.vibrate([30, 50, 100]);
  };

  return { triggerClick, triggerDelete, triggerSuccess };
};
