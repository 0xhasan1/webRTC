import { WebSocket, WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 8080 });

let senderSocket: WebSocket | null = null;
// let receiverSocket: WebSocket | null = null;
const receivers = new Set<WebSocket>();

wss.on("connection", function connection(ws) {
  ws.on("error", console.error);

  ws.on("message", (data: Buffer) => {
    const message = JSON.parse(data.toString());
    if (message.type === "sender") {
      console.log("sender added");
      senderSocket = ws;
    } else if (message.type === "receiver") {
      console.log("receiver added");
      receivers.add(ws);
      // receiverSocket = ws;
      ws.on("close", () => receivers.delete(ws));
    } else if (message.type === "createOffer" && ws === senderSocket) {
      if (ws !== senderSocket) {
        return;
      }
      console.log("sending offer");
      receivers.forEach((r) =>
        r.send(JSON.stringify({ type: "createOffer", sdp: message.sdp }))
      );
    } else if (message.type === "createAnswer") {
      // if (ws !== receiverSocket) {
      //   return;
      // }

      if (receivers.size > 0 && receivers.values().next().value !== ws)
        console.log("sending answer");
      senderSocket?.send(
        JSON.stringify({ type: "createAnswer", sdp: message.sdp, from: ws })
      );
    } else if (message.type === "iceCandidate") {
      console.log("sending ice candidate");
      if (ws === senderSocket) {
        receivers.forEach((r) =>
          r.send(
            JSON.stringify({
              type: "iceCandidate",
              candidate: message.candidate,
            })
          )
        );
      } else {
        senderSocket?.send(
          JSON.stringify({
            type: "iceCandidate",
            candidate: message.candidate,
          })
        );
      }
    }
  });
});
