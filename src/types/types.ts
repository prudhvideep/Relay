import Peer from "../core/Peer";

export type SignalType = "Offer" | "Answer" | "Candidate";

export type IceCandidate = {
  candidate: string;
};

export type Sdp = {
  sdp: string;
  type: RTCSdpType;
};

export type PeerDescription = {
  peerId : string,
  peerName : string,
}

export type FileMetadata = {
  filename: string;
  type: string;
  size: string;
};

export type RTCConn = {
  fromDesc: PeerDescription;
  toDesc: PeerDescription;
  conn: RTCPeerConnection;
  srcDc?: RTCDataChannel;
  dstDc?: RTCDataChannel;
};

export type Signal = {
  type: "Offer" | "Answer" | "Candidate" | "Syn" | "Ack";
  fromDesc: PeerDescription;
  toDesc: PeerDescription;
  srcOs?: string,
  sdp?: Sdp | undefined;
  candidate?: string | undefined;
};


export type PeerNodeArg = {
  id: string;
  data: {
    os : string;
    desc: PeerDescription;
    label: string;
    hostPeer: Peer;
  };
};

export type LayoutOptions = {
  height : number;
  width : number;
}

