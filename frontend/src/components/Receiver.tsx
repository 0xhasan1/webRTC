// import { useEffect } from "react";

// export const Receiver = () => {
//   useEffect(() => {
//     const socket = new WebSocket("ws://localhost:8080");
//     const pc = new RTCPeerConnection();
//     const video = document.createElement("video");

//     video.autoplay = true;
//     document.body.appendChild(video);

//     const pendingCandidates: RTCIceCandidate[] = [];

//     pc.ontrack = (event) => {
//       video.srcObject = event.streams[0];
//     };

//     pc.onicecandidate = (event) => {
//       console.log("onicecandidate : ", event);
//       if (event.candidate) {
//         console.log("sending event to iceCandidate");
//         socket.send(
//           JSON.stringify({
//             type: "iceCandidate",
//             candidate: event.candidate,
//           })
//         );
//       } else {
//         console.log("no ice candidate found");
//       }
//     };

//     pc.onicecandidateerror = (event) => {
//       console.error("ICE candidate error:", event);
//     };

//     socket.onopen = () => {
//       console.log("on open connection:: ");
//       socket.send(JSON.stringify({ type: "receiver" }));
//     };

//     socket.onmessage = async (event) => {
//       console.log("onmessage : ", event);

//       const message = JSON.parse(event.data);

//       if (message.type === "createOffer") {
//         console.log("create offer ::");
//         await pc.setRemoteDescription(message.sdp);
//         const answer = await pc.createAnswer();
//         await pc.setLocalDescription(answer);

//         socket.send(
//           JSON.stringify({
//             type: "createAnswer",
//             sdp: answer,
//           })
//         );

//         pendingCandidates.forEach((c) => pc.addIceCandidate(c));
//         pendingCandidates.length = 0;
//       } else if (message.type === "iceCandidate") {
//         console.log("iceCandidateFOund ::");
//         if (pc.remoteDescription) {
//           console.log("pc.remoteDescription::");
//           // await pc.addIceCandidate(message.candidate);
//           await pc.addIceCandidate(new RTCIceCandidate(message.candidate));
//         } else {
//           console.log("pc.otherDescription::");
//           // pendingCandidates.push(message.candidate);
//           pendingCandidates.push(new RTCIceCandidate(message.candidate));
//         }
//       } else {
//         console.log("no matching event found");
//       }
//     };

//     return () => {
//       pc.close();
//       socket.close();
//       video.remove();
//     };
//   }, []);

//   // return <div>Receiver</div>;
// };

import { useEffect } from "react";

export const Receiver = () => {
  useEffect(() => {
    const socket = new WebSocket("ws://localhost:8080");
    const pc = new RTCPeerConnection();
    const video = document.createElement("video");

    video.autoplay = true;
    video.playsInline = true;
    document.body.appendChild(video);

    const pendingCandidates: RTCIceCandidate[] = [];

    pc.ontrack = (event) => {
      console.log("Received track:", event.track.kind);
      video.srcObject = event.streams[0];
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

    socket.onopen = () => {
      console.log("Socket connected");
      socket.send(JSON.stringify({ type: "receiver" }));
    };

    socket.onmessage = async (event) => {
      // console.log("Received message:", event.data);
      const message = JSON.parse(event.data);

      if (message.type === "createOffer") {
        console.log("Received offer");

        await pc.setRemoteDescription(message.sdp);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.send(
          JSON.stringify({
            type: "createAnswer",
            sdp: answer,
          })
        );

        // Add pending candidates
        console.log("Adding pending candidates:", pendingCandidates.length);
        for (const c of pendingCandidates) {
          await pc.addIceCandidate(c);
        }
        pendingCandidates.length = 0;
      } else if (message.type === "iceCandidate") {
        console.log("Received ICE candidate");
        const candidate = new RTCIceCandidate(message.candidate);

        if (pc.remoteDescription) {
          console.log("Adding candidate immediately");
          await pc.addIceCandidate(candidate);
        } else {
          console.log("Queuing candidate");
          pendingCandidates.push(candidate);
        }
      }
    };

    return () => {
      pc.close();
      socket.close();
      video.remove();
    };
  }, []);

  return <div>Receiver</div>;
};
