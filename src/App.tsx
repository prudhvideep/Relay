import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  Node,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";
import { Message } from "./types/types";
import { useState } from "react";
import { faker } from "@faker-js/faker";

let peerId: string = "";
const peerMap = new Map<string, RTCPeerConnection>();
const channelMap = new Map<string, RTCDataChannel>();

const peerConfig: RTCConfiguration = {
  iceServers: [
    { urls: import.meta.env.VITE_STUN_SERVER },
    {
      urls: import.meta.env.VITE_TURN_URL,
      username: import.meta.env.VITE_TURN_USERNAME,
      credential: import.meta.env.VITE_TURN_CRED,
    },
  ],
};

const generatePeerName = () => faker.animal.type() + "-" + faker.color.human(); 

if (!sessionStorage.getItem("peerId")) {
  peerId = generatePeerName()

  if (peerId) {
    sessionStorage.setItem("peerId", peerId);
  }
} else {
  peerId = sessionStorage.getItem("peerId") || "";
}

const ws = new WebSocket(`ws://localhost:6969/ws?peerId=${peerId}`);

ws.onopen = () => {
  console.log("Connected to the signal server");
};

function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [messages, setMessages] = useState<string[]>([]);
  const [inputMessage, setInputMessage] = useState("");

  if (!peerMap.has(peerId)) {
    peerMap.set(peerId, new RTCPeerConnection(peerConfig));

    setNodes((prev) => [
      ...prev,
      {
        id: `self`,
        position: { x: 300, y: 300 },
        data: { label: peerId },
      },
    ]);
  }

  function UpdatePeerList(peers: string[]) {
    const peerSet = new Set<string>(peers);

    // Add new peers
    for (const peerId of peerSet.values()) {
      if (!peerMap.has(peerId)) {
        console.log("Adding new peer");
        peerMap.set(peerId, new RTCPeerConnection(peerConfig));
      }
    }

    //Remove disconnected peers
    for (const [key, _] of peerMap) {
      if (!peerSet.has(key)) {
        peerMap.delete(key);
      }
    }

    setNodes(() =>
      [...peerSet.values()].map((peerId: string, idx: number) => ({
        id: `peer-${idx}`,
        position: { x: Math.random() * 100, y: 300 },
        data: { label: peerId },
      }))
    );
  }

  function HandleSignalMessage(srcId: string) {
    if (!peerMap.has(srcId)) {
      const conn = new RTCPeerConnection();
      peerMap.set(srcId, conn);

      const dataChannel = conn.createDataChannel("chat");
      channelMap.set(srcId, dataChannel);

      dataChannel.onopen = () => console.log("data channel opened");

      dataChannel.onmessage = (event) => {
        setMessages((prev) => [...prev, `${srcId}: ${event.data}`]);
      };

      conn.onicecandidate = (event) => {
        if (event.candidate) {
          let iceMsg = {
            type: "ice",
            srcId: peerId,
            dstId: srcId,
            ice: JSON.stringify(event.candidate),
          };
          ws.send(JSON.stringify(iceMsg));
        }
      };

      setNodes((prev) => [
        ...prev,
        {
          id: srcId,
          position: { x: Math.random() * 100, y: 300 },
          data: { label: srcId },
        },
      ]);

      if (conn) {
        conn
          .createOffer()
          .then((offer) => conn.setLocalDescription(offer))
          .then(() => {
            let msg: Message = {
              type: "offer",
              srcId: peerId,
              dstId: srcId,
              offer: JSON.stringify(conn.localDescription),
            };

            ws.send(JSON.stringify(msg));
          });
      }
    }
  }

  function HandleOfferMessage(message: Message) {
    let { srcId, offer } = message;
    console.log("Inside handle offer message");
    if (!peerMap.has(srcId)) {
      const conn = new RTCPeerConnection();
      peerMap.set(srcId, conn);

      conn.ondatachannel = (event) => {
        const dataChannel = event.channel;
        channelMap.set(srcId, dataChannel);

        dataChannel.onopen = () => console.log("data channel opened");
        dataChannel.onmessage = (event) => {
          setMessages((prev) => [...prev, `${srcId}: ${event.data}`]);
        };
      };

      setNodes((prev) => [
        ...prev,
        {
          id: srcId,
          position: { x: 300, y: 300 },
          data: { label: srcId },
        },
      ]);
    }

    let conn = peerMap.get(srcId);

    if (conn) {
      let offerJson = JSON.parse(offer || "");
      if (Object.keys(offerJson).length !== 0) {
        conn.setRemoteDescription(offerJson);
      }

      conn
        .createAnswer()
        .then((answer) => conn.setLocalDescription(answer))
        .then(() => {
          let answerMsg: Message = {
            type: "answer",
            srcId: peerId,
            dstId: srcId,
            answer: JSON.stringify(conn.localDescription),
          };

          ws.send(JSON.stringify(answerMsg));
        });
    }
  }

  function HandleAnswerMessage(message: Message) {
    let { srcId, answer } = message;
    console.log("Answer from thr peer --> ", srcId);

    let conn = peerMap.get(srcId);
    if (conn) {
      console.log("Answer conn exists");

      let ansJson = JSON.parse(answer || "");
      if (Object.keys(ansJson).length !== 0) {
        conn.setRemoteDescription(ansJson);
      }
    }
  }

  ws.onmessage = (e: any) => {
    const message: Message = JSON.parse(e.data || {});
    console.log("Received Message ", message);

    switch (message.type) {
      case "broadcast":
        if (message.peers) UpdatePeerList(message.peers);
        break;
      case "signal":
        HandleSignalMessage(message.srcId);
        break;
      case "offer":
        HandleOfferMessage(message);
        break;
      case "answer":
        HandleAnswerMessage(message);
        break;
      case "ice":
        const { srcId, ice } = message;
        const conn = peerMap.get(srcId);
        if (conn) {
          const candidate = JSON.parse(ice || "");
          conn.addIceCandidate(new RTCIceCandidate(candidate));
        }
        break;
    }
  };

  const sendMessage = () => {
    if (!inputMessage.trim()) return;

    channelMap.forEach((channel, _) => {
      console.log("Channel state ", channel.readyState);

      if (channel.readyState === "open") {
        channel.send(inputMessage);
      }
    });

    setMessages((prev) => [...prev, `You: ${inputMessage}`]);
    setInputMessage("");
  };

  return (
    <div className="min-h-screen h-screen w-full flex flex-col">
      <div className="w-full h-[70%]">
        <ReactFlow
          nodes={nodes}
          onNodesChange={onNodesChange}
          proOptions={{ hideAttribution: true }}
          fitView
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>

      <div className="flex-1 p-4 border-t">
        <div className="h-full flex flex-col">
          <div className="flex-1 overflow-y-auto mb-4">
            {messages.map((msg, i) => (
              <div key={i} className="mb-2">
                {msg}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              className="flex-1 border p-2"
              onKeyPress={(e) => e.key === "Enter" && sendMessage()}
            />
            <button
              onClick={sendMessage}
              className="bg-blue-500 text-white px-4 py-2 rounded"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
