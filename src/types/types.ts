export type MessageType = "offer" | "answer" | "broadcast" | "signal" | "ice";

export type Peer = string

export type Message = {
  type: MessageType;
  srcId: string;
  dstId: string;
  offer?: string;
  answer?: string;
  ice?: string;
  peers?: string[];
};

