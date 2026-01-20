export const CLIENT_TYPES = {
  START: "client.start",
  AUDIO: "client.audio",
  END: "client.end",
};

export const SERVER_TYPES = {
  SOURCE_SUBTITLE: "server.source_subtitle",
  TRANSLATION_SUBTITLE: "server.translation_subtitle",
  TTS_START: "server.tts_start",
  TTS_AUDIO: "server.tts_audio",
  TTS_END: "server.tts_end",
  ERROR: "server.error",
  AST_EVENT: "server.ast_event",
};

export const parseJsonMessage = (data) => {
  try {
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
};

export const toServerError = (requestId, code, message) => ({
  type: SERVER_TYPES.ERROR,
  requestId,
  code,
  message,
});
