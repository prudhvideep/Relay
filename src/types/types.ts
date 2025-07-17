import Peer from "../core/Peer";

export type MessageType = "offer" | "answer" | "broadcast" | "signal" | "ice";

export type Message = {
  type: MessageType;
  srcId: string;
  dstId: string;
  offer?: string;
  answer?: string;
  ice?: string;
  peers?: string[];
};

export type FileMetadata = {
  filename: string;
  type: string;
  size: string;
};

export type RTCConn = {
  srcId: string;
  dstId: string;
  conn: RTCPeerConnection;
  srcDc?: RTCDataChannel;
  dstDc?: RTCDataChannel;
};

export type Signal = {
  type: "Offer" | "Answer" | "Candidate";
  srcId: string;
  dstId: string;
  sdp?: Sdp | undefined;
  candidate?: string | undefined;
};

export type IceCandidate = {
  candidate: string;
};

export type Sdp = {
  sdp: string;
  type: RTCSdpType;
};

export type PeerNodeArg = {
  id: string;
  data: {
    uid: string;
    label: string;
    hostPeer: Peer;
  };
};

export type AddNodeFnType = (uid: string, peer: Peer) => void;
