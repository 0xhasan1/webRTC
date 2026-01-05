import { error } from "console";
import express from "express";
import { createServer } from "http";
import { WebSocket, WebSocketServer } from "ws";
import cors from "cors";

const app = express();

app.use(
  cors({
    origin: "http://localhost:5173",
  })
);

app.use(express.json());

const server = createServer(app);

const wss = new WebSocketServer({ server });

type Room = {
  sender: WebSocket | null;
  receivers: Map<string, WebSocket>;
  createdAt: number;
};

const rooms = new Map<string, Room>();

function generateMeetStyleId(length: number = 10): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, length);
}

app.post("/rooms", (req, res) => {
  const roomId = generateMeetStyleId(10);

  rooms.set(roomId, {
    sender: null,
    receivers: new Map(),
    createdAt: Date.now(),
  });

  res.json({ roomId });
});

wss.on("connection", function connection(ws) {
  ws.on("error", console.error);

  ws.on("message", function message(data: any) {
    const message = JSON.parse(data.toString());
    const { roomId, type } = message;

    const room = rooms.get(roomId);
    if (!room) {
      ws.send(JSON.stringify({ error: "Invalid Room" }));
      return;
    }

    if (type === "sender") {
      console.log("Sender joined room:", roomId);
      room.sender = ws;
      return;
    }

    if (type === "receiver") {
      const receiverId = generateMeetStyleId(8);
      console.log("Receiver joined room:", roomId, "with ID:", receiverId);
      room.receivers.set(receiverId, ws);

      (ws as any).receiverId = receiverId;

      room.sender?.send(
        JSON.stringify({
          type: "receiverConnected",
          receiverId: receiverId,
        })
      );
      return;
    }
    if (type === "createOffer") {
      if (ws !== room.sender) return;

      const { receiverId } = message;
      if (!receiverId) {
        console.error("createOffer missing receiverId");
        return;
      }

      const receiver = room.receivers.get(receiverId);
      if (!receiver) {
        console.error("Receiver not found:", receiverId);
        return;
      }

      console.log("Forwarding offer to receiver:", receiverId);

      receiver.send(
        JSON.stringify({
          type: "createOffer",
          sdp: message.sdp,
        })
      );
      return;
    }
    if (type === "createAnswer") {
      const receiverId = (ws as any).receiverId;
      if (!receiverId || !room.receivers.has(receiverId)) return;

      console.log("Forwarding answer to sender from receiver:", receiverId);

      room.sender?.send(
        JSON.stringify({
          type: "createAnswer",
          sdp: message.sdp,
          receiverId: receiverId,
        })
      );
      return;
    }

    if (type === "iceCandidate") {
      if (ws === room.sender) {
        const { receiverId } = message;
        if (receiverId) {
          const receiver = room.receivers.get(receiverId);
          if (receiver) {
            receiver.send(
              JSON.stringify({
                type: "iceCandidate",
                candidate: message.candidate,
              })
            );
          }
        } else {
          room.receivers.forEach((receiver) => {
            receiver.send(
              JSON.stringify({
                type: "iceCandidate",
                candidate: message.candidate,
              })
            );
          });
        }
      } else {
        const receiverId = (ws as any).receiverId;
        if (receiverId && room.receivers.has(receiverId)) {
          room.sender?.send(
            JSON.stringify({
              type: "iceCandidate",
              candidate: message.candidate,
              receiverId: receiverId,
            })
          );
        }
      }
    }
  });

  ws.on("close", () => {
    for (const [roomId, room] of rooms.entries()) {
      if (room.sender === ws) {
        console.log("Sender left room:", roomId);
        room.sender = null;
      }

      const receiverId = (ws as any).receiverId;
      if (receiverId && room.receivers.has(receiverId)) {
        console.log("Receiver left room:", roomId, "receiverId:", receiverId);
        room.receivers.delete(receiverId);
      }

      if (!room.sender && room.receivers.size === 0) {
        console.log("Deleting empty room:", roomId);
        rooms.delete(roomId);
      }
    }
  });
});

server.listen(8080, () => {
  console.log("Server started at http://localhost:8080");
  console.log("WebSocket server ready");
});
