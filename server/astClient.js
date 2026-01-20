import WebSocket from "ws";
import { config, hasAstCredentials } from "./config.js";

const AST_HEADERS = {
  "X-Api-App-Key": config.appKey,
  "X-Api-Access-Key": config.accessKey,
  "X-Api-Resource-Id": config.resourceId,
};

export class AstClient {
  constructor({ logger }) {
    this.logger = logger;
    this.ws = null;
    this.queue = [];
    this.ready = false;
  }

  connect() {
    if (!hasAstCredentials()) {
      throw new Error("Missing AST credentials. Set AST_APP_KEY/AST_ACCESS_KEY.");
    }

    this.ws = new WebSocket(config.astUrl, { headers: AST_HEADERS });

    this.ws.on("open", () => {
      this.ready = true;
      this.logger.info("AST ws connected");
      this.queue.forEach((payload) => this.ws.send(payload));
      this.queue = [];
    });

    this.ws.on("close", (code, reason) => {
      this.ready = false;
      this.logger.warn(`AST ws closed ${code} ${reason}`);
    });

    this.ws.on("error", (error) => {
      this.ready = false;
      this.logger.error("AST ws error", error);
    });
  }

  onMessage(handler) {
    if (!this.ws) return;
    this.ws.on("message", handler);
  }

  send(payload) {
    if (!this.ws) return;
    if (this.ready) {
      this.ws.send(payload);
    } else {
      this.queue.push(payload);
    }
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}
