import { useEffect, useRef, useState } from "react";

export const Sender = () => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [pc, setPC] = useState<RTCPeerConnection | null>(null);
  const roomIdRef = useRef<string | null>(null);
  const initializedRef = useRef(false);
  const pcRef = useRef<RTCPeerConnection | null>(null);

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
        console.log("Received message:", event.data);
        const message = JSON.parse(event.data);

        if (message.type === "receiverConnected") {
          console.log("Receiver joined — creating offer");

          if (!pcRef.current) {
            console.error("Peer connection not initialized");
            return;
          }

          const offer = await pcRef.current.createOffer();
          await pcRef.current.setLocalDescription(offer);
          if (ws) {
            ws.send(
              JSON.stringify({
                type: "createOffer",
                sdp: pcRef.current.localDescription,
                roomId: roomIdRef.current,
              })
            );
          }
          console.log("New receiver connected, reinitiating connection");
          //await initiateConn();
        } else if (message.type === "createAnswer") {
          console.log("Received answer");
          await pcRef.current!.setRemoteDescription(message.sdp);
          // await pc.setRemoteDescription(message.sdp);
        } else if (message.type === "iceCandidate") {
          console.log("Received ICE candidate");
          await pcRef.current!.addIceCandidate(
            new RTCIceCandidate(message.candidate)
          );
        } else {
          console.log("something went wrong :: pc::", pcRef.current);
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
    };
  }, []);

  const initiateConn = async () => {
    if (!socket) {
      alert("Socket not found");
      return;
    }

    const pc = new RTCPeerConnection();
    pcRef.current = pc;
    setPC(pc);

    console.log("Initiating connection");

    // socket.onmessage = async (event) => {
    //   console.log("Received message:", event.data);
    //   const message = JSON.parse(event.data);

    //   if (message.type === "receiverConnected") {
    //     console.log("Receiver joined — creating offer");

    //     const offer = await pc.createOffer();
    //     await pc.setLocalDescription(offer);
    //     socket.send(
    //       JSON.stringify({
    //         type: "createOffer",
    //         sdp: pc.localDescription,
    //         roomId: roomIdRef.current,
    //       })
    //     );
    //     console.log("New receiver connected, reinitiating connection");
    //     //await initiateConn();
    //   } else if (message.type === "createAnswer") {
    //     console.log("Received answer");
    //     await pcRef.current!.setRemoteDescription(message.sdp);
    //     // await pc.setRemoteDescription(message.sdp);
    //   } else if (message.type === "iceCandidate") {
    //     console.log("Received ICE candidate");
    //     await pcRef.current!.addIceCandidate(
    //       new RTCIceCandidate(message.candidate)
    //     );
    //   } else {
    //     console.log("something went wrong :: pc::", pc);
    //   }
    // };

    pc.onicecandidate = (event) => {
      console.log("ICE candidate event:", event.candidate);

      if (event.candidate) {
        socket.send(
          JSON.stringify({
            type: "iceCandidate",
            candidate: event.candidate,
            roomId: roomIdRef.current,
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

    // pc.onnegotiationneeded = async () => {
    //   console.log("Negotiation needed");

    //   try {
    //     const offer = await pc.createOffer();
    //     await pc.setLocalDescription(offer);

    //     socket.send(
    //       JSON.stringify({
    //         type: "createOffer",
    //         sdp: pc.localDescription,
    //         roomId: roomIdRef.current,
    //       })
    //     );
    //   } catch (error) {
    //     console.error("Error during negotiation:", error);
    //   }
    // };

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
