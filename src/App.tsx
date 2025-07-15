import {
  ReactFlow,
  Background,
  useNodesState,
  Node,
  Controls,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";
import { useState } from "react";
import PeerNode from "./nodes/PeerNode";
import { faker } from "@faker-js/faker";
import { FaBell, FaPaperPlane, FaVideo } from "react-icons/fa";
import { IoCall, IoChatbubble } from "react-icons/io5";

let peerId: string = "";
const nodeTypes = { peerNode: PeerNode };

const generatePeerName = () => faker.animal.type() + "-" + faker.color.human();

if (!sessionStorage.getItem("peerId")) {
  peerId = generatePeerName();

  if (peerId) {
    sessionStorage.setItem("peerId", peerId);
  }
} else {
  peerId = sessionStorage.getItem("peerId") || "";
}

function App() {
  const [nodes, _, onNodesChange] = useNodesState<Node>([]);
  const [messages] = useState<string[]>([]);
  const [inputMessage, setInputMessage] = useState("");


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

      <div className="hidden md:flex w-[30%] lg:w-[20%] bg-[#282928]">
        <div className="h-full w-full flex flex-col">
          <div className="p-4 flex flex-row justify-end items-center gap-2">
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
          <div className="flex flex-row justify-center gap-2 mb-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              className="pl-2 bg-[#413422] rounded-md outline-none text-[#ffa828]"
            />
            <button
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
