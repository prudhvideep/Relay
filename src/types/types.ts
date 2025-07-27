import Peer from "../core/Peer";

export type SignalType = "Offer" | "Answer" | "Candidate";

export type IceCandidate = {
  candidate: string;
};

export type Sdp = {
  sdp: string;
  type: RTCSdpType;
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

export type PeerNodeArg = {
  id: string;
  data: {
    uid: string;
    label: string;
    hostPeer: Peer;
  };
};

export type Message = {
  type: "Ping" | "Pong" | "Fin" | "Data";
  data?: ArrayBuffer | Blob | string;
};
