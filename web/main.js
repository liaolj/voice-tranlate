const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const statusEl = document.getElementById("status");
const sourceText = document.getElementById("sourceText");
const translationText = document.getElementById("translationText");
const logEl = document.getElementById("log");
const directionSelect = document.getElementById("direction");
const vadThreshold = document.getElementById("vadThreshold");
const vadValue = document.getElementById("vadValue");

const state = {
  socket: null,
  context: null,
  captureNode: null,
  playbackNode: null,
  speaking: false,
  speechMs: 0,
  silenceMs: 0,
  requestId: null,
  lastSeq: 0,
};

const VAD_CONFIG = {
  speechMs: 100,
  silenceMs: 650,
  energyThreshold: Number(vadThreshold.value),
  minChunkMs: 20,
};

const logLine = (message) => {
  const line = document.createElement("p");
  line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  logEl.prepend(line);
};

const setStatus = (text) => {
  statusEl.textContent = text;
};

const resetSubtitles = () => {
  sourceText.textContent = "";
  translationText.textContent = "";
};

const updateVADValue = () => {
  VAD_CONFIG.energyThreshold = Number(vadThreshold.value);
  vadValue.textContent = `${vadThreshold.value} dBFS`;
};

vadThreshold.addEventListener("input", updateVADValue);
updateVADValue();

const floatToDb = (value) => 20 * Math.log10(Math.max(value, 1e-8));

const handleVad = ({ energyDb, durationMs }) => {
  if (energyDb > VAD_CONFIG.energyThreshold) {
    state.speechMs += durationMs;
    state.silenceMs = 0;
  } else {
    state.silenceMs += durationMs;
    state.speechMs = 0;
  }

  if (!state.speaking && state.speechMs >= VAD_CONFIG.speechMs) {
    state.speaking = true;
    setStatus("正在听…");
    logLine("检测到用户开始说话");
  }

  if (state.speaking && state.silenceMs >= VAD_CONFIG.silenceMs) {
    state.speaking = false;
    setStatus("处理中…");
    logLine("检测到用户停顿，发送句末");
    sendJson({ type: "client.end", requestId: state.requestId });
  }
};

const createSocket = () => {
  const socket = new WebSocket(`ws://${location.hostname}:8787`);
  socket.binaryType = "arraybuffer";

  socket.addEventListener("open", () => {
    logLine("WebSocket 已连接");
    sendJson({
      type: "client.start",
      requestId: state.requestId,
      direction: directionSelect.value,
      vad: {
        speechMs: VAD_CONFIG.speechMs,
        silenceMs: VAD_CONFIG.silenceMs,
      },
      audio: {
        sampleRate: 16000,
        format: "pcm_s16le",
        channels: 1,
      },
    });
    setStatus("正在听…");
  });

  socket.addEventListener("message", (event) => {
    if (typeof event.data === "string") {
      const message = JSON.parse(event.data);
      handleServerMessage(message);
      return;
    }

    if (event.data instanceof ArrayBuffer) {
      if (state.playbackNode) {
        state.playbackNode.port.postMessage(event.data, [event.data]);
      }
    }
  });

  socket.addEventListener("close", () => {
    setStatus("已断开");
    logLine("WebSocket 已断开");
  });

  socket.addEventListener("error", () => {
    logLine("WebSocket 错误");
  });

  return socket;
};

const handleServerMessage = (message) => {
  switch (message.type) {
    case "server.source_subtitle":
      sourceText.textContent = message.text ?? "";
      break;
    case "server.translation_subtitle":
      translationText.textContent = message.text ?? "";
      break;
    case "server.tts_start":
      setStatus("播报中…");
      break;
    case "server.tts_end":
      setStatus("正在听…");
      break;
    case "server.error":
      setStatus("错误");
      logLine(`${message.code}: ${message.message}`);
      break;
    case "server.ast_event":
      if (message.payload?.type?.includes("Subtitle")) {
        const payload = message.payload;
        if (payload.type?.includes("Source")) {
          sourceText.textContent = payload.text ?? sourceText.textContent;
        }
        if (payload.type?.includes("Translation")) {
          translationText.textContent = payload.text ?? translationText.textContent;
        }
      }
      break;
    default:
      break;
  }
};

const sendJson = (payload) => {
  if (!state.socket || state.socket.readyState !== WebSocket.OPEN) return;
  state.socket.send(JSON.stringify(payload));
};

const sendAudio = (pcmBuffer) => {
  state.lastSeq += 1;
  sendJson({
    type: "client.audio",
    requestId: state.requestId,
    seq: state.lastSeq,
    timestamp: Date.now(),
  });
  state.socket.send(pcmBuffer);
};

const setupAudio = async () => {
  state.context = new AudioContext({ latencyHint: "interactive" });
  await state.context.audioWorklet.addModule("audio-worklet.js");
  await state.context.audioWorklet.addModule("playback-worklet.js");

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      channelCount: 1,
    },
  });

  const source = state.context.createMediaStreamSource(stream);
  state.captureNode = new AudioWorkletNode(state.context, "capture-processor");
  state.playbackNode = new AudioWorkletNode(state.context, "playback-processor");

  state.captureNode.port.onmessage = (event) => {
    const { pcm, energy } = event.data;
    if (!pcm) return;

    const energyDb = floatToDb(energy);
    handleVad({ energyDb, durationMs: VAD_CONFIG.minChunkMs });

    if (state.socket?.readyState === WebSocket.OPEN) {
      sendAudio(pcm);
    }
  };

  source.connect(state.captureNode);
  state.playbackNode.connect(state.context.destination);
};

const start = async () => {
  if (state.socket) return;
  resetSubtitles();
  state.requestId = crypto.randomUUID();
  state.socket = createSocket();
  await setupAudio();
  startBtn.disabled = true;
  stopBtn.disabled = false;
};

const stop = async () => {
  if (!state.socket) return;
  sendJson({ type: "client.end", requestId: state.requestId });
  state.socket.close();
  state.socket = null;
  state.captureNode?.disconnect();
  state.playbackNode?.disconnect();
  await state.context?.close();
  state.context = null;
  setStatus("待机中");
  startBtn.disabled = false;
  stopBtn.disabled = true;
};

startBtn.addEventListener("click", () => {
  start().catch((error) => {
    logLine(`启动失败: ${error.message}`);
  });
});

stopBtn.addEventListener("click", () => {
  stop().catch((error) => {
    logLine(`停止失败: ${error.message}`);
  });
});
