import { useEffect, useRef, useState } from "react";

export const Receiver = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidate[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const roomId = new URLSearchParams(window.location.search).get("roomId");

  useEffect(() => {
    console.log("first use effect 1::");

    if (!roomId) {
      console.error("Missing roomId");
      return;
    }

    if (pcRef.current || socketRef.current) {
      console.log("Already initialized, skipping");
      return;
    }

    const socket = new WebSocket("ws://localhost:8080");
    socketRef.current = socket;

    const pc = new RTCPeerConnection();
    pcRef.current = pc;

    pc.ontrack = (event) => {
      console.log("pc.ontrack", event);
      setStream(event.streams[0]);
    };

    pc.onicecandidate = (event) => {
      console.log("pc.onicecandidate", event);
      if (event.candidate) {
        socket.send(
          JSON.stringify({
            type: "iceCandidate",
            candidate: event.candidate,
            roomId,
          })
        );
      }
    };

    socket.onopen = () => {
      console.log("socket.onopen");
      socket.send(
        JSON.stringify({
          type: "receiver",
          roomId,
        })
      );
    };

    socket.onmessage = async (event) => {
      const message = JSON.parse(event.data);
      console.log("socket.onmessage", message);

      if (message.type === "createOffer") {
        await pc.setRemoteDescription(message.sdp);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.send(
          JSON.stringify({
            type: "createAnswer",
            sdp: answer,
            roomId,
          })
        );

        for (const c of pendingCandidatesRef.current) {
          await pc.addIceCandidate(c);
        }
        pendingCandidatesRef.current = [];
      }

      if (message.type === "iceCandidate") {
        const candidate = new RTCIceCandidate(message.candidate);
        if (pc.remoteDescription) {
          await pc.addIceCandidate(candidate);
        } else {
          pendingCandidatesRef.current.push(candidate);
        }
      }
    };

    return () => {
      pc.close();
      socket.close();
      pcRef.current = null;
      socketRef.current = null;
    };
  }, [roomId]);

  useEffect(() => {
    console.log("second use effect 2::");
    if (videoRef.current && stream) {
      console.log("Attaching stream to video element");
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div>
      <h2>Receiver</h2>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          maxWidth: "500px",
          border: "2px solid blue",
          display: "block",
        }}
      />
      <p>{stream ? "Stream active" : "Waiting for stream..."}</p>
    </div>
  );
};
