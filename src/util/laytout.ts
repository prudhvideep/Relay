import { Node } from "@xyflow/react";
import Peer from "../core/Peer";
import { LayoutOptions } from "../types/types";

const INIT_RADIUS = 60;
const LOCAL_PEER_NAME_OFFSET = 20;
const SINGLE_LOCAL_PEER_OFFSET = 100;

export function layoutNodes(
  nodes: Node[],
  parentId: string,
  layoutOptions: LayoutOptions
): Node[] {
  console.log("Layout Options ", layoutOptions);

  const hostNode = nodes.find(
    (node) => (node.data.hostPeer as Peer)?.desc.peerId === parentId
  );
  if (!hostNode) return [] as Node[];

  const cx = layoutOptions.width / 2;
  const cy = layoutOptions.height / 2;

  hostNode.position.x = cx;
  hostNode.position.y = cy;

  const localPeers = nodes.filter((node) => node.id !== parentId);

  if (localPeers.length === 1) {
    localPeers[0].position.x = cx + SINGLE_LOCAL_PEER_OFFSET;
    localPeers[0].position.y = cy - LOCAL_PEER_NAME_OFFSET;
  } else {
    const radius = INIT_RADIUS + (localPeers.length - 1) * 20;
    const angle = (2 * Math.PI) / localPeers.length;
    let idx = 0;
    for (const peer of localPeers) {
      peer.position.x = cx + radius * Math.cos(angle * idx);
      peer.position.y = (cy + radius * Math.sin(angle * idx)) - LOCAL_PEER_NAME_OFFSET;

      idx++;
    }
  }

  return nodes;
}
