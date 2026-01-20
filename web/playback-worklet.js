class PlaybackProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.queue = [];
    this.offset = 0;
    this.port.onmessage = (event) => {
      const buffer = event.data;
      if (buffer) {
        this.queue.push(new Int16Array(buffer));
      }
    };
  }

  process(inputs, outputs) {
    const output = outputs[0];
    if (!output || output.length === 0) return true;

    const channel = output[0];
    channel.fill(0);

    let index = 0;
    while (index < channel.length && this.queue.length > 0) {
      const current = this.queue[0];
      while (this.offset < current.length && index < channel.length) {
        channel[index] = current[this.offset] / 32768;
        this.offset += 1;
        index += 1;
      }

      if (this.offset >= current.length) {
        this.queue.shift();
        this.offset = 0;
      }
    }

    return true;
  }
}

registerProcessor("playback-processor", PlaybackProcessor);
