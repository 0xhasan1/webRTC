import { useEffect } from "react";

export const Receiver = () => {
  useEffect(() => {
    const socket = new WebSocket("ws://localhost:8080");
    const pc = new RTCPeerConnection();
    const video = document.createElement("video");

    video.autoplay = true;
    document.body.appendChild(video);

    const pendingCandidates: RTCIceCandidate[] = [];

    pc.ontrack = (event) => {
      video.srcObject = event.streams[0];
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.send(
          JSON.stringify({
            type: "iceCandidate",
            candidate: event.candidate,
          })
        );
      }
    };

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: "receiver" }));
    };

    socket.onmessage = async (event) => {
      const message = JSON.parse(event.data);

      if (message.type === "createOffer") {
        await pc.setRemoteDescription(message.sdp);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.send(
          JSON.stringify({
            type: "createAnswer",
            sdp: answer,
          })
        );

        pendingCandidates.forEach((c) => pc.addIceCandidate(c));
        pendingCandidates.length = 0;
      }

      if (message.type === "iceCandidate") {
        if (pc.remoteDescription) {
          await pc.addIceCandidate(message.candidate);
        } else {
          pendingCandidates.push(message.candidate);
        }
      }
    };
  }, []);

  return <div>Receiver</div>;
};
