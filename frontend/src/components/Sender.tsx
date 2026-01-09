import { useEffect, useRef, useState } from "react";

export const Sender = () => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const roomIdRef = useRef<string | null>(null);
  const initializedRef = useRef(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  useEffect(() => {
    let ws: WebSocket | null = null;

    if (initializedRef.current) return;
    initializedRef.current = true;
    async function setup() {
      const res = await fetch("http://localhost:8080/rooms", {
        method: "POST",
      });

      const { roomId } = await res.json();
      roomIdRef.current = roomId;
      console.log("Room created:", roomId);

      ws = new WebSocket("ws://localhost:8080");
      setSocket(ws);

      ws.onmessage = async (event) => {
        const message = JSON.parse(event.data);
        console.log("Received message:", message);

        if (message.type === "receiverConnected") {
          const receiverId = message.receiverId;
          if (!receiverId) {
            console.error("receiverConnected missing receiverId");
            return;
          }

          console.log(
            "Receiver joined — creating new peer connection for:",
            receiverId
          );

          const pc = new RTCPeerConnection();
          peerConnectionsRef.current.set(receiverId, pc);

          if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach((track) => {
              pc.addTrack(track, mediaStreamRef.current!);
            });
          }

          pc.onicecandidate = (event) => {
            if (event.candidate && ws) {
              ws.send(
                JSON.stringify({
                  type: "iceCandidate",
                  candidate: event.candidate,
                  roomId: roomIdRef.current,
                  receiverId: receiverId,
                })
              );
            }
          };

          pc.onconnectionstatechange = () => {
            console.log(
              `Connection state for ${receiverId}:`,
              pc.connectionState
            );
          };

          pc.oniceconnectionstatechange = () => {
            console.log(
              `ICE connection state for ${receiverId}:`,
              pc.iceConnectionState
            );
          };

          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            if (ws) {
              ws.send(
                JSON.stringify({
                  type: "createOffer",
                  sdp: offer,
                  roomId: roomIdRef.current,
                  receiverId: receiverId,
                })
              );
            }
            console.log(`Created offer for receiver ${receiverId}`);
          } catch (error) {
            console.error("Error creating offer:", error);
          }
        } else if (message.type === "createAnswer") {
          const receiverId = message.receiverId;
          if (!receiverId) {
            console.error("createAnswer missing receiverId");
            return;
          }

          console.log("Received answer from receiver:", receiverId);

          const pc = peerConnectionsRef.current.get(receiverId);

          if (pc) {
            await pc.setRemoteDescription(message.sdp);
            console.log(`Answer processed for receiver ${receiverId}`);
          } else {
            console.error(
              `No matching peer connection found for receiver ${receiverId}`
            );
          }
        } else if (message.type === "iceCandidate") {
          const receiverId = message.receiverId;
          if (!receiverId) {
            console.error("iceCandidate missing receiverId");
            return;
          }

          console.log("Received ICE candidate from receiver:", receiverId);

          const pc = peerConnectionsRef.current.get(receiverId);
          if (pc && pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(message.candidate));
          }
        } else {
          console.log("Unknown message type:", message.type);
        }
      };

      ws.onopen = () => {
        console.log("Socket connected");

        ws!.send(
          JSON.stringify({
            type: "sender",
            roomId: roomIdRef.current,
          })
        );
      };
    }

    setup();

    return () => {
      ws?.close();
      for (const [receiverId, pc] of peerConnectionsRef.current.entries()) {
        pc.close();
        console.log(`Closed peer connection for receiver ${receiverId}`);
      }
      peerConnectionsRef.current.clear();

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
    };
  }, []);

  const initiateConn = async () => {
    if (!socket) {
      alert("Socket not found");
      return;
    }

    console.log("Getting camera stream");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });

      mediaStreamRef.current = stream;

      const video = document.createElement("video");
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;

      document.body.appendChild(video);
      video.srcObject = stream;

      console.log("Camera stream ready. Waiting for receivers to connect...");

      for (const [receiverId, pc] of peerConnectionsRef.current.entries()) {
        stream.getTracks().forEach((track) => {
          if (pc.getSenders().find((sender) => sender.track === track)) {
            return;
          }
          pc.addTrack(track, stream);
          console.log(
            `Added track to existing peer connection for receiver ${receiverId}`
          );
        });
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
    }
  };

  return (
    <div>
      Sender
      <button onClick={initiateConn}>Send data</button>
    </div>
  );
};
