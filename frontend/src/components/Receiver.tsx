import { useEffect, useRef, useState } from "react";

export const Receiver = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidate[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:8080");
    socketRef.current = socket;

    const pc = new RTCPeerConnection();
    pcRef.current = pc;

    pc.ontrack = (event) => {
      console.log("Received track:", event.track.kind);
      console.log("Setting stream:", event.streams[0]);
      setStream(event.streams[0]);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.send(
          JSON.stringify({
            type: "iceCandidate",
            candidate: event.candidate,
          })
        );
      } else {
        console.log("ICE gathering complete");
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("Connection state:", pc.connectionState);
    };

    pc.oniceconnectionstatechange = () => {
      console.log("ICE connection state:", pc.iceConnectionState);
    };

    socket.onopen = () => {
      console.log("Socket connected");
      socket.send(JSON.stringify({ type: "receiver" }));
    };

    socket.onmessage = async (event) => {
      const message = JSON.parse(event.data);

      if (message.type === "createOffer") {
        console.log("Received offer");

        try {
          await pc.setRemoteDescription(message.sdp);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          socket.send(
            JSON.stringify({
              type: "createAnswer",
              sdp: answer,
            })
          );

          console.log(
            "Adding pending candidates:",
            pendingCandidatesRef.current.length
          );
          for (const c of pendingCandidatesRef.current) {
            await pc.addIceCandidate(c);
          }
          pendingCandidatesRef.current = [];
        } catch (error) {
          console.error("Error handling offer:", error);
        }
      } else if (message.type === "iceCandidate") {
        const candidate = new RTCIceCandidate(message.candidate);

        if (pc.remoteDescription) {
          try {
            await pc.addIceCandidate(candidate);
          } catch (error) {
            console.error("Error adding ICE candidate:", error);
          }
        } else {
          pendingCandidatesRef.current.push(candidate);
        }
      }
    };

    return () => {
      console.log("Cleaning up");
      pc.close();
      socket.close();
    };
  }, []);

  useEffect(() => {
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
