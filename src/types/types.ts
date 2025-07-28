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
  type: "Offer" | "Answer" | "Candidate" | "Syn" | "Ack";
  srcId: string;
  srcOs?: string,
  dstId: string;
  sdp?: Sdp | undefined;
  candidate?: string | undefined;
};


export type PeerNodeArg = {
  id: string;
  data: {
    uid: string;
    os : string
    label: string;
    hostPeer: Peer;
  };
};

