import Peer from "../core/Peer";
import { PeerDescription, Sdp, Signal } from "../types/types";
import {
  onChildAdded,
  push,
  ref,
  remove,
  set,
} from "firebase/database";
import { database } from "../firebase/firebase";

async function processSignal(signal: Signal, hostPeer: Peer, addNodeToFlow : any) {
  //Discard signal from the same source

  if (signal.fromDesc.peerId === hostPeer.desc.peerId) return;
  switch (signal.type) {
    case "Offer":
      if (!hostPeer.hasRtcConnection(signal.fromDesc.peerId)) {
        hostPeer.addRtcDataConnection(signal.fromDesc);
      }

      await hostPeer.setRemoteDesc(signal.fromDesc, signal.sdp);
      await hostPeer.createAnswerAndSetLocalDesc(signal.fromDesc);
      await sendAnswer(signal.toDesc, signal.fromDesc, hostPeer);
      break;
    case "Answer":
      await hostPeer.setRemoteDesc(signal.fromDesc, signal.sdp);
      break;
    case "Candidate":
      await hostPeer.setIceCandidate(signal.fromDesc, signal.candidate || "");
      break;
    case "Syn":
      addNodeToFlow(signal.fromDesc,signal.srcOs,hostPeer);
      await sendAck(hostPeer);
      break;
    case "Ack":
      addNodeToFlow(signal.fromDesc,signal.srcOs,hostPeer);
      break;
  }
}

export async function subscribeToSignals(hostPeer: Peer,addNodeToFlow : any) {
  const signalRef = ref(database, "signals/" + hostPeer.ip);

  onChildAdded(signalRef, async (snapshot) => {
    const signal = snapshot.val();
    await processSignal(signal, hostPeer, addNodeToFlow);

    await remove(snapshot.ref);
  });
}

export async function sendOffer(
  fromDesc : PeerDescription,
  toDesc: PeerDescription,
  hostPeer: Peer
) {
  let localDesc = hostPeer.conns.find((conn) => conn.toDesc.peerId === toDesc.peerId)?.conn
    .localDescription;

  let signal: Signal = {
    type: "Offer",
    fromDesc: fromDesc,
    toDesc: toDesc,
    sdp: localDesc?.toJSON() as Sdp,
  };

  const signalRef = ref(database, "signals/" + hostPeer.ip);
  await set(push(signalRef), signal);
}

export async function sendAnswer(
  fromDesc : PeerDescription,
  toDesc: PeerDescription,
  hostPeer: Peer
) {
  let localDesc = hostPeer.conns.find((conn) => conn.toDesc.peerId === toDesc.peerId)?.conn
    .localDescription;

  let signal: Signal = {
    type: "Answer",
    fromDesc: fromDesc,
    toDesc: toDesc,
    sdp: localDesc?.toJSON() as Sdp,
  };

  const signalRef = ref(database, "signals/" + hostPeer.ip);
  await set(push(signalRef), signal);
}

export async function sendCandidate(
  fromDesc: PeerDescription,
  toDesc: PeerDescription,
  candidate: string,
  hostPeer: Peer
) {
  let signal: Signal = {
    type: "Candidate",
    fromDesc: fromDesc,
    toDesc: toDesc,
    candidate: candidate,
  };

  const signalRef = ref(database, "signals/" + hostPeer.ip);
  await set(push(signalRef), signal);
}

export async function sendSyn(
  hostPeer: Peer
) {
  let signal: Signal = {
    type: "Syn",
    fromDesc: hostPeer.desc,
    srcOs: hostPeer.os,
    toDesc: {peerId : "*", peerName : "*"},
  };

  const signalRef = ref(database, "signals/" + hostPeer.ip);
  await set(push(signalRef), signal);
}

export async function sendAck(
  hostPeer: Peer
) {
  let signal: Signal = {
    type: "Ack",
    fromDesc: hostPeer.desc,
    srcOs: hostPeer.os,
    toDesc: {peerId : "*", peerName : "*"},
  };

  const signalRef = ref(database, "signals/" + hostPeer.ip);
  await set(push(signalRef), signal);
}

