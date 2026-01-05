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
      console.log("onicecandidate : ", event);
      if (event.candidate) {
        console.log("sending event to iceCandidate");
        socket.send(
          JSON.stringify({
            type: "iceCandidate",
            candidate: event.candidate,
          })
        );
      } else {
        console.log("no ice candidate found");
      }
    };

    socket.onopen = () => {
      console.log("on open connection:: ");
      socket.send(JSON.stringify({ type: "receiver" }));
    };

    socket.onmessage = async (event) => {
      console.log("onmessage : ", event);

      const message = JSON.parse(event.data);

      if (message.type === "createOffer") {
        console.log("create offer ::");
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
      } else if (message.type === "iceCandidate") {
        console.log("iceCandidateFOund ::");
        if (pc.remoteDescription) {
          console.log("pc.remoteDescription::");
          await pc.addIceCandidate(message.candidate);
        } else {
          console.log("pc.otherDescription::");
          pendingCandidates.push(message.candidate);
        }
      } else {
        console.log("no matching event found");
      }
    };
  }, []);

  return <div>Receiver</div>;
};
