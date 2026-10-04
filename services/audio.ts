// Audio utility to trigger synthesized 'ping' sound using Web Audio API with mp3 fallback

export function playNotificationSound() {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    
    // Primary Tone: Sine wave sweep for crystal clear "ping" chime
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now); // A5
    osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.15); // E6
    
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.82);

    // Harmonic Support: Triangle soft wave
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1760, now); // A6
    osc2.frequency.exponentialRampToValueAtTime(2640, now + 0.08); // E7
    
    gain2.gain.setValueAtTime(0.04, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now);
    osc2.stop(now + 0.42);

    // Standard mp3 asset fallback
    const fallbackAudio = new Audio('/notification.mp3');
    fallbackAudio.volume = 0.5;
    fallbackAudio.play().catch(() => {});
  } catch (error) {
    console.warn("Web Audio API not supported", error);
  }
}
