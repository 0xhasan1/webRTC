import { useEffect, useState } from "react";

export const Sender = () => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [pc, setPC] = useState<RTCPeerConnection | null>(null);

  const pcs = new Map<string, RTCPeerConnection>();

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:8080");
    setSocket(socket);
    console.log("Sender socket ::", socket);
    socket.onopen = () => {
      socket.send(
        JSON.stringify({
          type: "sender",
        })
      );
    };
  }, []);

  const initiateConn = async () => {
    if (!socket) {
      alert("Socket not found");
      return;
    }

    const pc = new RTCPeerConnection();
    setPC(pc);

    console.log("initiareConn::");

    socket.onmessage = async (event) => {
      console.log("on message : ", event);
      const message = JSON.parse(event.data);
      if (message.type === "createAnswer") {
        console.log("createAnswer");
        await pc.setRemoteDescription(message.sdp);
      } else if (message.type === "iceCandidate") {
        console.log("iceCandidate");

        pc.addIceCandidate(message.candidate);
      } else {
        console.log("otherwise");
      }
    };

    pc.onicecandidate = (event) => {
      console.log("on ice candidate : ", event);

      if (event.candidate) {
        console.log("event.candidate");
        socket?.send(
          JSON.stringify({
            type: "iceCandidate",
            candidate: event.candidate,
          })
        );
      } else {
        console.log("event.candidate not found");
      }
    };

    pc.onnegotiationneeded = async () => {
      console.log("on negotiationneeded : ");

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket?.send(
        JSON.stringify({
          type: "createOffer",
          sdp: pc.localDescription,
        })
      );
    };

    getCameraStreamAndSend(pc);
  };

  const getCameraStreamAndSend = (pc: RTCPeerConnection) => {
    console.log("getCameraStreamAndSend ::");
    navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
      const video = document.createElement("video");
      document.body.appendChild(video);
      stream.getTracks().forEach((track) => {
        pc?.addTrack(track);
      });
      video.srcObject = stream;
      video.play();
    });
  };

  return (
    <div>
      Sender
      <button onClick={initiateConn}> Send data </button>
    </div>
  );
};
