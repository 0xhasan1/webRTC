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
  receivers: Map<string, WebSocket>; // Map receiverId to WebSocket
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
    receivers: new Map(),
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
      // Generate a unique receiver ID
      const receiverId = generateMeetStyleId(8);
      console.log("Receiver joined room:", roomId, "with ID:", receiverId);
      room.receivers.set(receiverId, ws);

      // Store receiverId on the WebSocket for later lookup
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
        // Sender ICE → specific receiver
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
          // Broadcast to all if no receiverId specified (backward compatibility)
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
        // Receiver ICE → sender
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
