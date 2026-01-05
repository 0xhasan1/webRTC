import { error } from "console";
import express from "express";
import { createServer } from "http";
import { WebSocket, WebSocketServer } from "ws";
import cors from "cors";

// Create Express app
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
  receivers: Set<WebSocket>;
  createdAt: number;
};

const rooms = new Map<string, Room>();

// Generate room ID function
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
    receivers: new Set(),
    createdAt: Date.now(),
  });

  res.json({ roomId });
});

// let senderSocket: null | WebSocket = null;
// let receiverSocket: null | WebSocket = null;

// wss.on("connection", function connection(ws) {
//   ws.on("error", console.error);

//   ws.on("message", function message(data: any) {
//     const message = JSON.parse(data);

//     const room = rooms.get(message.roomId);

//     if (!room) {
//       ws.send(JSON.stringify({ error: "Invalid Room" }));
//       return;
//     }

//     if (message.type === "sender") {
//       console.log("sender added");
//       // senderSocket = ws;
//       room.sender = ws;
//     } else if (message.type === "receiver") {
//       console.log("receiver added");
//       // receiverSocket = ws;
//       room.receivers.add(ws);
//       if (room.sender && room.sender.readyState === WebSocket.OPEN) {
//         console.log("Notifying sender about new receiver");
//         room.sender.send(JSON.stringify({ type: "receiverConnected" }));
//       }
//     } else if (message.type === "createOffer") {
//       if (ws !== room.sender) {
//         return;
//       }
//       console.log("sending offer");
//       receiverSocket?.send(
//         JSON.stringify({ type: "createOffer", sdp: message.sdp })
//       );
//     } else if (message.type === "createAnswer") {
//       if (ws !== receiverSocket) {
//         return;
//       }
//       console.log("sending answer");
//       room.sender?.send(
//         JSON.stringify({ type: "createAnswer", sdp: message.sdp })
//       );
//     } else if (message.type === "iceCandidate") {
//       console.log("sending ice candidate");
//       if (ws === room.sender) {
//         receiverSocket?.send(
//           JSON.stringify({ type: "iceCandidate", candidate: message.candidate })
//         );
//       } else if (ws === receiverSocket) {
//         room.sender?.send(
//           JSON.stringify({ type: "iceCandidate", candidate: message.candidate })
//         );
//       }
//     }
//   });

//   ws.on("close", () => {
//     if (ws === room.send) {
//       console.log("Sender disconnected");
//       senderSocket = null;
//     } else if (ws === receiverSocket) {
//       console.log("Receiver disconnected");
//       receiverSocket = null;
//     }
//   });
// });

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
      console.log("Receiver joined room:", roomId);
      room.receivers.add(ws);

      room.sender?.send(
        JSON.stringify({
          type: "receiverConnected",
        })
      );
      return;
    }
    if (type === "createOffer") {
      if (ws !== room.sender) return;

      console.log("Forwarding offer to receivers");

      room.receivers.forEach((receiver) => {
        receiver.send(
          JSON.stringify({
            type: "createOffer",
            sdp: message.sdp,
          })
        );
      });
      return;
    }
    if (type === "createAnswer") {
      if (!room.receivers.has(ws)) return;

      console.log("Forwarding answer to sender");

      room.sender?.send(
        JSON.stringify({
          type: "createAnswer",
          sdp: message.sdp,
        })
      );
      return;
    }

    if (type === "iceCandidate") {
      if (ws === room.sender) {
        // Sender ICE → all receivers
        room.receivers.forEach((receiver) => {
          receiver.send(
            JSON.stringify({
              type: "iceCandidate",
              candidate: message.candidate,
            })
          );
        });
      } else if (room.receivers.has(ws)) {
        // Receiver ICE → sender
        room.sender?.send(
          JSON.stringify({
            type: "iceCandidate",
            candidate: message.candidate,
          })
        );
      }
    }
  });

  ws.on("close", () => {
    for (const [roomId, room] of rooms.entries()) {
      if (room.sender === ws) {
        console.log("Sender left room:", roomId);
        room.sender = null;
      }

      if (room.receivers.has(ws)) {
        console.log("Receiver left room:", roomId);
        room.receivers.delete(ws);
      }

      // Delete empty room
      if (!room.sender && room.receivers.size === 0) {
        console.log("Deleting empty room:", roomId);
        rooms.delete(roomId);
      }
    }
  });
});

// Start the server
server.listen(8080, () => {
  console.log("Server started at http://localhost:8080");
  console.log("WebSocket server ready");
});
