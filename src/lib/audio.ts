let audioCtx: AudioContext | null = null;

export function playAlertBeep() {
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.frequency.value = 880;
    oscillator.type = "square";
    gainNode.gain.value = 0.3;
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.2);
    setTimeout(() => {
      const osc2 = audioCtx!.createOscillator();
      const gain2 = audioCtx!.createGain();
      osc2.connect(gain2);
      gain2.connect(audioCtx!.destination);
      osc2.frequency.value = 1200;
      osc2.type = "square";
      gain2.gain.value = 0.3;
      osc2.start();
      osc2.stop(audioCtx!.currentTime + 0.3);
    }, 250);
  } catch {
    // Audio not available
  }
}
