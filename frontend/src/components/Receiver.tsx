import { useEffect, useRef } from "react"


export const Receiver = () => {
    const videoRef = useRef<HTMLVideoElement>(null);
    
    useEffect(() => {
        console.log("Receiver: Initializing WebSocket connection...");
        const socket = new WebSocket('ws://localhost:8080');
        
        socket.onopen = () => {
            console.log("Receiver: WebSocket connected");
            socket.send(JSON.stringify({
                type: 'receiver'
            }));
            console.log("Receiver: Registration message sent");
        };
        
        socket.onerror = (error) => {
            console.error("Receiver: WebSocket error:", error);
        };
        
        socket.onclose = () => {
            console.log("Receiver: WebSocket closed");
        };
        
        startReceiving(socket);
    }, []);

    function startReceiving(socket: WebSocket) {
        console.log("Receiver: Setting up RTCPeerConnection...");
        const pc = new RTCPeerConnection();
        
        // Handle ICE candidates - CRITICAL: Send them back to sender
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                console.log("Receiver: ICE candidate generated");
                socket.send(JSON.stringify({
                    type: 'iceCandidate',
                    candidate: event.candidate
                }));
            }
        }

        pc.ontrack = (event) => {
            console.log("Receiver: Track received!");
            if (videoRef.current) {
                videoRef.current.srcObject = new MediaStream([event.track]);
                videoRef.current.play().catch(console.error);
            }
        }

        socket.onmessage = async (event) => {
            const message = JSON.parse(event.data);
            console.log("Receiver: Received message type:", message.type);
            if (message.type === 'createOffer') {
                try {
                    console.log("Receiver: Setting remote description (offer)");
                    await pc.setRemoteDescription(message.sdp);
                    console.log("Receiver: Creating answer...");
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    console.log("Receiver: Sending answer");
                    socket.send(JSON.stringify({
                        type: 'createAnswer',
                        sdp: answer
                    }));
                } catch (error) {
                    console.error('Receiver: Error handling offer:', error);
                }
            } else if (message.type === 'iceCandidate') {
                try {
                    console.log("Receiver: Adding ICE candidate");
                    await pc.addIceCandidate(message.candidate);
                } catch (error) {
                    console.error('Receiver: Error adding ICE candidate:', error);
                }
            }
        }
    }

    return <div>
        <h2>Receiver</h2>
        <video ref={videoRef} autoPlay playsInline style={{ width: '100%', maxWidth: '800px' }} />
    </div>
}