import Peer from "./core/Peer";
import { useState } from "react";
import "@xyflow/react/dist/style.css";
import PeerNode from "./nodes/PeerNode";
import { database } from "./firebase/firebase";
import { useQuery } from "@tanstack/react-query";
import { sendSyn, subscribeToSignals } from "./core/signal";
import { ReactFlow, Background, useNodesState, Node } from "@xyflow/react";
import { Database, onChildRemoved, ref } from "firebase/database";
import { MdOutlineAdd } from "react-icons/md";

const nodeTypes = { peerNode: PeerNode };
function App() {
  const [currentPeer, setCurrentPeer] = useState<Peer | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);

  function addNodeToFlow(uid: string, peer: Peer) {
    if (!uid) return;

    const newNode = {
      id: uid,
      type: "peerNode",
      position: { x: Math.random() * 250, y: Math.random() * 250 },
      data: {
        uid: uid,
        label: uid,
        hostPeer: peer,
      },
    };

    setNodes((nodes) => {
      const exists = nodes.some((node) => node.id === uid);

      if (exists) return nodes;

      return [...nodes, newNode];
    });
  }

  async function removeNodeFromFlow(uid: string | undefined) {
    if (!uid) return;

    setNodes((nodes) => {
      return nodes.filter((node) => node.id !== uid);
    });

    console.log("Removing the node ", uid);

    if (uid === currentPeer?.uid) await refetchPeer();
  }

  async function subscribeRoomUpdates(database: Database, peer: Peer) {
    const roomRef = ref(database, "rooms/" + peer.ip + "room/");

    onChildRemoved(roomRef, (snapshot) => {
      const data = snapshot.val();

      removeNodeFromFlow(data?.uid);
      peer.removeRtcConnection(data?.uid);
    });
  }

  const { refetch: refetchPeer } = useQuery({
    queryKey: ["curPeerQuery", currentPeer?.uid],
    queryFn: async () => {
      console.log("Inside the new peer query");

      const hostPeer = new Peer();

      // Add the node to the canvas
      addNodeToFlow(hostPeer.uid, hostPeer);

      // Resolve the peer ip, os etc
      await hostPeer.resolvePeerData();

      // Add peer to the realtime database
      await hostPeer.addPeerToDb();

      // Singnal that a peer got added
      await sendSyn(hostPeer);

      // Subscribe to the updates in the room
      await subscribeRoomUpdates(database, hostPeer);

      // Subscribe to signals
      await subscribeToSignals(hostPeer, addNodeToFlow);

      setCurrentPeer(hostPeer);
      return hostPeer;
    },
    refetchOnWindowFocus: false,
  });

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
          <Background color="#ffa828" />
        </ReactFlow>
      </div>
    </div>
  );
}

export default App;
