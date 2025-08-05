import Peer from "./core/Peer";
import { useEffect, useState } from "react";
import "@xyflow/react/dist/style.css";
import PeerNode from "./nodes/PeerNode";
import { database } from "./firebase/firebase";
import { sendSyn, subscribeToSignals } from "./util/signal";
import { ReactFlow, Background, useNodesState, Node, BackgroundVariant } from "@xyflow/react";
import { Database, onChildRemoved, ref } from "firebase/database";
import { MdOutlineAdd } from "react-icons/md";
import { layoutNodes } from "./util/laytout";
import { LayoutOptions, PeerDescription } from "./types/types";

const nodeTypes = { peerNode: PeerNode };
function App() {
  const [currentPeer, setCurrentPeer] = useState<Peer | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);

  function addNodeToFlow(desc: PeerDescription, os: string, peer: Peer) {
    // console.log("Inside add node to flow");
    // console.log("Desc ", desc);
    if (!desc) return;

    const newNode = {
      id: desc.peerId,
      type: "peerNode",
      position: { x: 0, y: 0 },
      data: {
        os: os,
        desc: desc,
        label: desc.peerName,
        hostPeer: peer,
      },
    };

    setNodes((nodes) => {
      const nodeExists = nodes.some((node) => node.id === desc.peerId);
      if (nodeExists) {
        return nodes.map((node) => {
          if (node.id === desc.peerId) {
            return {
              ...node,
              data: {
                ...node.data,
                label: desc.peerName,
              },
            };
          }
          return node;
        });
      }

      let modifiedNodes = [...nodes, newNode];

      const reactFlow = document.querySelector(".react-flow")
      let layoutOptions : LayoutOptions = {height : 1200, width: 500};
      if(reactFlow) {
        const {height,width} = reactFlow.getBoundingClientRect();
        layoutOptions.height = height;
        layoutOptions.width =width;
      }

      return layoutNodes(modifiedNodes, peer.desc.peerId,layoutOptions);
    });
  }

  async function removeNodeFromFlow(uid: string | undefined) {
    if (!uid) return;

    setNodes((nodes) => {
      return nodes.filter((node) => node.id !== uid);
    });

    if (uid === currentPeer?.desc.peerId) await setUpPeer();
  }

  async function subscribeRoomUpdates(database: Database, peer: Peer) {
    const roomRef = ref(database, "rooms/" + peer.ip + "room/");

    onChildRemoved(roomRef, (snapshot) => {
      const data = snapshot.val();

      removeNodeFromFlow(data?.uid);
      peer.removeRtcConnection(data?.uid);
    });
  }

  async function setUpPeer() {
    const hostPeer = new Peer();

    // Resolve the peer ip, os etc
    await hostPeer.resolvePeerData();

    // Add the node to the canvas
    addNodeToFlow(hostPeer.desc, hostPeer.os, hostPeer);

    // Add peer to the realtime database
    await hostPeer.addPeerToDb();

    // Singnal that a peer got added
    await sendSyn(hostPeer);

    // Subscribe to the updates in the room
    await subscribeRoomUpdates(database, hostPeer);

    // Subscribe to signals
    await subscribeToSignals(hostPeer, addNodeToFlow);

    setCurrentPeer(hostPeer);
  }

  useEffect(() => {
    setUpPeer();
  }, []);

  return (
    <div className="min-h-screen h-screen flex flex-row bg-[#252423]">
      <div className="absolute w-full h-full bg-[#2f2e2d]">
        <div className="absolute bg-[#413422] top-4 left-1/2 transform -translate-x-1/2 z-50 text-white text-xl font-semibold p-2 rounded-xl">
          <p className="text-[#ffa828]">LAN Room</p>
        </div>
        <div
          className="absolute bg-[#413422] top-4 right-10 transform -translate-x-1/2 z-50 text-white text-xl font-semibold p-2 rounded-full hover:scale-110 hov
er:cursor-pointer"
        >
          <MdOutlineAdd className="text-2xl font-bold text-[#ffa828]" />
        </div>
        <ReactFlow
          nodes={nodes}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          proOptions={{ hideAttribution: true }}
          fitView
        >
          <Background color="#ffa828" variant={BackgroundVariant.Dots}/>
        </ReactFlow>
      </div>
    </div>
  );
}

export default App;
