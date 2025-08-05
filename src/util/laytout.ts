import { Node } from "@xyflow/react";
import Peer from "../core/Peer";

const INIT_RADIUS = 50;

export function layoutNodes(nodes: Node[], parentId: string): Node[] {
  const hostNode = nodes.find(
    (node) => (node.data.hostPeer as Peer)?.desc.peerId === parentId
  );
  if (!hostNode) return [] as Node[];

  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;

  hostNode.position.x = cx;
  hostNode.position.y = cy;

  const localPeers = nodes.filter((node) => node.id !== parentId);

  console.log("local peers", localPeers);

  const radius = INIT_RADIUS + (localPeers.length - 1) * 20;
  const angle = (2 * Math.PI) / localPeers.length;
  console.log(angle);
  let idx = 0;
  for (const peer of localPeers) {
    console.log("index ", idx);
    peer.position.x = cx + radius * Math.cos(angle * idx);
    peer.position.y = cy + radius * Math.sin(angle * idx);

    idx++;
  }

  return nodes;
}
