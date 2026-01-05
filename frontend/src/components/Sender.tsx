import { useEffect, useState } from "react";

export const Sender = () => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [pc, setPC] = useState<RTCPeerConnection | null>(null);

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:8080");
    setSocket(socket);

    socket.onopen = () => {
      console.log("Socket connected");
      socket.send(JSON.stringify({ type: "sender" }));
    };

    return () => {
      socket.close();
    };
  }, []);

  const initiateConn = async () => {
    if (!socket) {
      alert("Socket not found");
      return;
    }

    const pc = new RTCPeerConnection();
    setPC(pc);

    console.log("Initiating connection");

    // Set up message handler
    socket.onmessage = async (event) => {
      console.log("Received message:", event.data);
      const message = JSON.parse(event.data);

      if (message.type === "createAnswer") {
        console.log("Received answer");
        await pc.setRemoteDescription(message.sdp);
      } else if (message.type === "iceCandidate") {
        console.log("Received ICE candidate");
        await pc.addIceCandidate(new RTCIceCandidate(message.candidate));
      }
    };

    pc.onicecandidate = (event) => {
      console.log("ICE candidate event:", event.candidate);

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

    pc.onnegotiationneeded = async () => {
      console.log("Negotiation needed");

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.send(
          JSON.stringify({
            type: "createOffer",
            sdp: pc.localDescription,
          })
        );
      } catch (error) {
        console.error("Error during negotiation:", error);
      }
    };

    getCameraStreamAndSend(pc);
  };

  const getCameraStreamAndSend = async (pc: RTCPeerConnection) => {
    console.log("Getting camera stream");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });

      const video = document.createElement("video");
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;

      document.body.appendChild(video);
      video.srcObject = stream;

      stream.getTracks().forEach((track) => {
        console.log("Adding track:", track.kind);
        pc.addTrack(track, stream);
      });

      console.log("Stream added to peer connection");
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
