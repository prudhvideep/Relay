import {
  ReactFlow,
  Background,
  useNodesState,
  Node,
  Controls,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";
import { Message } from "./types/types";
import { useState } from "react";
import PeerNode from "./nodes/PeerNode";
import { faker } from "@faker-js/faker";
import { FaBell, FaPaperPlane, FaVideo } from "react-icons/fa";
import { IoCall, IoChatbubble } from "react-icons/io5";

let peerId: string = "";
let incomingFileData: any = null;
const peerMap = new Map<string, RTCPeerConnection>();
const channelMap = new Map<string, RTCDataChannel>();

const nodeTypes = { peerNode: PeerNode };

const generatePeerName = () => faker.animal.type() + "-" + faker.color.human();

const handleFileTransfer = (file: File, id: string) => {
  // console.log("File transferring");
  // console.log("File ---> ", file);
  // console.log("id ----> ", id);
  // console.log("Channel map ", channelMap);

  const channel = channelMap.get(id);

  if (channel && channel.readyState === "open") {
    console.log("Channel is open, sending file");

    const metaData = {
      type: "file-meta",
      name: file.name,
      size: file.size,
      mimeType: file.type,
    };

    channel.send(JSON.stringify(metaData));
    file.arrayBuffer().then((buffer) => {
      channel.send(buffer);
    });
  } else {
    console.log("Channel not ready, cannot send file");
  }
};

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

if (!sessionStorage.getItem("peerId")) {
  peerId = generatePeerName();

  if (peerId) {
    sessionStorage.setItem("peerId", peerId);
  }
} else {
  peerId = sessionStorage.getItem("peerId") || "";
}

const ws = new WebSocket(
  `wss://${import.meta.env.VITE_BASE_SERVER}/ws?peerId=${peerId}`
);

ws.onopen = () => {
  console.log("Connected to the signal server");
};

function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [messages, setMessages] = useState<string[]>([]);
  const [inputMessage, setInputMessage] = useState("");

  function getRandomInt(min: number, max: number): number {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  if (!peerMap.has(peerId)) {
    peerMap.set(peerId, new RTCPeerConnection(peerConfig));

    setNodes((prev) => {
      const selfNodeExists = prev.some((node) => node.id === "self");

      if (!selfNodeExists) {
        return [
          ...prev,
          {
            id: `self`,
            position: { x: 300, y: 300 },
            data: { label: peerId, fileTransfer: handleFileTransfer },
            type: "peerNode",
          },
        ];
      }

      return prev;
    });
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

    const newNodes = [...peerSet.values()].map((pId: string) => {
      if (pId === peerId) {
        return {
          id: "self",
          position: { x: 300, y: 300 },
          data: { label: pId, fileTransfer: handleFileTransfer },
          type: "peerNode",
        };
      } else {
        return {
          id: `peer-${pId}`,
          position: { x: getRandomInt(100, 300), y: getRandomInt(100, 300) },
          data: { label: pId, fileTransfer: handleFileTransfer },
          type: "peerNode",
        };
      }
    });

    console.log("new nodes ---> ", newNodes);

    setNodes(newNodes);
  }

  function HandleSignalMessage(srcId: string) {
    if (!peerMap.has(srcId)) {
      const conn = new RTCPeerConnection();
      peerMap.set(srcId, conn);

      const dataChannel = conn.createDataChannel("chat");
      channelMap.set(srcId, dataChannel);

      dataChannel.onopen = () => console.log("data channel opened");

      dataChannel.onmessage = (event) => {
        if (typeof event.data === "string") {
          try {
            const metadata = JSON.parse(event.data);
            if (metadata.type === "file-meta") {
              incomingFileData = metadata;
            } else {
              console.log("Received text message:", metadata);
            }
          } catch (e) {
            console.error("Invalid JSON", e);
          }
        } else if (
          event.data instanceof ArrayBuffer ||
          event.data instanceof Blob
        ) {
          if (incomingFileData) {
            const blob = new Blob([event.data], {
              type: incomingFileData.mimeType,
            });

            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = incomingFileData.name || "received_file";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            URL.revokeObjectURL(url);
            incomingFileData = null;
          }
        } else {
          console.warn("Received file data before metadata");
        }
      };

      dataChannel.onclose = () => console.log("data channel closed");

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
          position: { x: getRandomInt(100, 300), y: getRandomInt(100, 300) },
          data: { label: srcId, fileTransfer: handleFileTransfer },
          type: "peerNode",
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
          if (typeof event.data === "string") {
            try {
              const metadata = JSON.parse(event.data);
              if (metadata.type === "file-meta") {
                incomingFileData = metadata;
              } else {
                console.log("Received text message:", metadata);
              }
            } catch (e) {
              console.error("Invalid JSON", e);
            }
          } else if (
            event.data instanceof ArrayBuffer ||
            event.data instanceof Blob
          ) {
            if (incomingFileData) {
              const blob = new Blob([event.data], {
                type: incomingFileData.mimeType,
              });

              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = incomingFileData.name || "received_file";
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);

              URL.revokeObjectURL(url);
              incomingFileData = null;
            }
          } else {
            console.warn("Received file data before metadata");
          }
        };

        dataChannel.onclose = () => console.log("data channel closed");
      };

      setNodes((prev) => [
        ...prev,
        {
          id: srcId,
          position: { x: 300, y: 300 },
          data: { label: srcId, fileTransfer: handleFileTransfer },
          type: "peerNode",
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
        channel.send(
          JSON.stringify({ type: "message", message: inputMessage })
        );
      }
    });

    setMessages((prev) => [...prev, `You: ${inputMessage}`]);
    setInputMessage("");
  };

  return (
    <div className="min-h-screen h-screen flex flex-row bg-[#252423]">
      <div className="w-full md:w-[70%] lg:w-[80%] h-full bg-[#2f2e2d]">
        <ReactFlow
          nodes={nodes}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          proOptions={{ hideAttribution: true }}
          fitView
        >
          <Background color="#ffa828" />
          <Controls />
        </ReactFlow>
      </div>

      <div className="hidden md:flex w-[30%] lg:w-[20%] p-4 bg-[#282928]">
        <div className="h-full w-full flex flex-col">
          <div className="flex flex-row justify-end items-center gap-2">
            <IoChatbubble className="p-1 rounded-md bg-[#413422] text-[#ffa828] text-2xl hover:cursor-pointer" />
            <FaBell className="p-1 rounded-md  text-[#ffa828] text-2xl hover:cursor-pointer" />
            <IoCall className="p-1 rounded-md  text-[#ffa828] text-2xl hover:cursor-pointer" />
            <FaVideo className="p-1 rounded-md  text-[#ffa828] text-2xl hover:cursor-pointer" />
          </div>
          <div className="mt-4 messages flex-1 overflow-y-auto mb-4 place-items-end">
            {messages.map((msg, i) =>
              msg.split(":")[0] === "You" ? (
                <div
                  key={i}
                  className="mb-2 p-1 pl-2 rounded-md w-[90%] bg-[#413422] text-[#ffa828] font-me text-pretty break-words"
                >
                  {msg}
                </div>
              ) : (
                <div
                  key={i}
                  className="mb-2 p-1 pl-2 rounded-md w-[90%] bg-[#384027] text-[#b7ff54] text-pretty break-words"
                >
                  {msg}
                </div>
              )
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              className="flex-1 bg-[#413422] p-2 rounded-md outline-none text-[#ffa828]"
              onKeyPress={(e) => e.key === "Enter" && sendMessage()}
            />
            <button
              onClick={sendMessage}
              className="bg-[#413422] text-white px-4 py-2 rounded-full hover:scale-110 hover:cursor-pointer"
            >
              <FaPaperPlane className="text-[#ffa828]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
