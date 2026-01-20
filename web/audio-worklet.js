class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = [];
    this.sampleRateIn = sampleRate;
    this.sampleRateOut = 16000;
    this.ratio = this.sampleRateIn / this.sampleRateOut;
    this.frameSize = Math.round(this.sampleRateOut * 0.02);
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;

    const channel = input[0];
    if (!channel) return true;

    for (let i = 0; i < channel.length; i += 1) {
      this.buffer.push(channel[i]);
    }

    const targetLength = Math.floor(this.buffer.length / this.ratio);
    if (targetLength >= this.frameSize) {
      const downsampled = new Float32Array(targetLength);
      for (let i = 0; i < targetLength; i += 1) {
        const index = i * this.ratio;
        const left = Math.floor(index);
        const right = Math.min(Math.ceil(index), this.buffer.length - 1);
        const frac = index - left;
        downsampled[i] =
          this.buffer[left] * (1 - frac) + this.buffer[right] * frac;
      }

      const pcm = new Int16Array(downsampled.length);
      let energy = 0;
      for (let i = 0; i < downsampled.length; i += 1) {
        const sample = Math.max(-1, Math.min(1, downsampled[i]));
        pcm[i] = sample * 32767;
        energy += sample * sample;
      }

      this.port.postMessage({
        pcm: pcm.buffer,
        energy: Math.sqrt(energy / downsampled.length),
      });

      this.buffer = [];
    }

    return true;
  }
}

registerProcessor("capture-processor", CaptureProcessor);
