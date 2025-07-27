import Peer from "./core/Peer";
import { useState } from "react";
import "@xyflow/react/dist/style.css";
import PeerNode from "./nodes/PeerNode";
import { database } from "./firebase/firebase";
import { useQuery } from "@tanstack/react-query";
import { subscribeToSignals } from "./core/signal";
import { ReactFlow, Background, useNodesState, Node } from "@xyflow/react";
import { Database, onChildAdded, onChildRemoved, ref } from "firebase/database";

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

    onChildAdded(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (data?.uid !== peer.uid) {
        addNodeToFlow(data.uid, peer);
      }
    });

    onChildRemoved(roomRef, (snapshot) => {
      const data = snapshot.val();

      removeNodeFromFlow(data?.uid);
      peer.removeRtcConnection(data?.uid);
    });
  }

  const { refetch: refetchPeer } = useQuery({
    queryKey: ["curPeerQuery", currentPeer?.uid],
    queryFn: async () => {
      const hostPeer = new Peer();

      // Resolve the peer ip, os etc
      await hostPeer.resolvePeerData();

      // Get any peers assosiated with the peer
      const peers = await hostPeer.getPeers();
      for (const val of peers) {
        addNodeToFlow(val, hostPeer);
      }

      // Add peer to the realtime database
      await hostPeer.addPeerToDb();

      // Subscribe to the updates in the room
      await subscribeRoomUpdates(database, hostPeer);

      // Subscribe to signals
      await subscribeToSignals(hostPeer);

      setCurrentPeer(hostPeer);
      return hostPeer;
    },
    refetchOnWindowFocus: false,
  });

  return (
    <div className="min-h-screen h-screen flex flex-row bg-[#252423]">
      <div className="w-full h-full bg-[#2f2e2d]">
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
