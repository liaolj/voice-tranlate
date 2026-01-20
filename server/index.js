import http from "http";
import { WebSocketServer } from "ws";
import { AstClient } from "./astClient.js";
import { config } from "./config.js";
import {
  CLIENT_TYPES,
  SERVER_TYPES,
  parseJsonMessage,
  toServerError,
} from "./protocol.js";
import { createLogger } from "./logger.js";

const logger = createLogger();

const server = http.createServer((req, res) => {
  if (req.url === "/healthz") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server });

wss.on("connection", (socket) => {
  logger.info("client connected");

  let astClient = null;
  let requestId = null;
  let pendingAudioHeader = null;

  const sendJson = (payload) => {
    if (socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify(payload));
    }
  };

  const teardown = () => {
    if (astClient) {
      astClient.close();
      astClient = null;
    }
  };

  socket.on("message", (data, isBinary) => {
    if (isBinary) {
      if (!pendingAudioHeader) {
        sendJson(
          toServerError(
            requestId,
            "AUDIO_HEADER_MISSING",
            "Binary audio frame received without header."
          )
        );
        return;
      }

      if (astClient) {
        astClient.send(data);
      }

      pendingAudioHeader = null;
      return;
    }

    const message = parseJsonMessage(data);
    if (!message?.type) {
      sendJson(toServerError(requestId, "BAD_JSON", "Invalid JSON."));
      return;
    }

    switch (message.type) {
      case CLIENT_TYPES.START: {
        requestId = message.requestId;
        try {
          astClient = new AstClient({ logger });
          astClient.connect();
          astClient.onMessage((payload, astBinary) => {
            if (astBinary) {
              socket.send(payload, { binary: true });
              return;
            }

            const astEvent = parseJsonMessage(payload);
            if (!astEvent) {
              sendJson({
                type: SERVER_TYPES.AST_EVENT,
                requestId,
                payload: payload.toString(),
              });
              return;
            }

            sendJson({
              type: SERVER_TYPES.AST_EVENT,
              requestId,
              payload: astEvent,
            });
          });
        } catch (error) {
          sendJson(
            toServerError(
              requestId,
              "AST_CONNECT_FAILED",
              error?.message ?? "AST connect failed."
            )
          );
        }
        break;
      }
      case CLIENT_TYPES.AUDIO: {
        pendingAudioHeader = message;
        if (astClient) {
          astClient.send(
            JSON.stringify({
              type: "client.audio",
              requestId,
              seq: message.seq,
              timestamp: message.timestamp,
            })
          );
        }
        break;
      }
      case CLIENT_TYPES.END: {
        if (astClient) {
          astClient.send(JSON.stringify(message));
        }
        sendJson({ type: "server.ended", requestId });
        break;
      }
      default:
        sendJson(toServerError(requestId, "UNKNOWN_TYPE", message.type));
    }
  });

  socket.on("close", () => {
    logger.info("client disconnected");
    teardown();
  });

  socket.on("error", (error) => {
    logger.error("client socket error", error);
    teardown();
  });
});

server.listen(config.port, () => {
  logger.info(`Gateway listening on :${config.port}`);
});
