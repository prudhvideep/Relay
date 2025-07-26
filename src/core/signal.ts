import Peer from "./Peer";
import { Sdp, Signal } from "../types/types";
import {
  Database,
  onChildAdded,
  push,
  ref,
  remove,
  set,
} from "firebase/database";
import { database } from "../firebase/firebase";

async function processSignal(signal: Signal, hostPeer: Peer) {
  //Discard signal from the same source
  if (signal.srcId === hostPeer.uid) return;

  console.log("Processing signal from ", signal.srcId, " type ", signal.type);

  switch (signal.type) {
    case "Offer":
      if (!hostPeer.hasRtcConnection(signal.srcId)) {
        hostPeer.addRtcDataConnection(signal.srcId);
      }

      await hostPeer.setRemoteDesc(signal.srcId, signal.sdp);
      await hostPeer.createAnswerAndSetLocalDesc(signal.srcId);
      await sendAnswer(database, signal.dstId, signal.srcId, hostPeer);
      break;
    case "Answer":
      await hostPeer.setRemoteDesc(signal.srcId, signal.sdp);
      break;
    case "Candidate":
      await hostPeer.setIceCandidate(signal.srcId, signal.candidate || "");
      break;
  }
}

export async function subscribeToSignals(hostPeer: Peer) {
  const signalRef = ref(database, "signals/" + hostPeer.ip);

  onChildAdded(signalRef, async (snapshot) => {
    const signal = snapshot.val() as Signal;
    await processSignal(signal, hostPeer);

    await remove(snapshot.ref);
  });
}

export async function sendOffer(
  database: Database,
  srcId: string,
  dstId: string,
  hostPeer: Peer
) {
  let localDesc = hostPeer.conns.find((conn) => conn.dstId === dstId)?.conn
    .localDescription;

  let signal: Signal = {
    type: "Offer",
    srcId: srcId,
    dstId: dstId,
    sdp: localDesc?.toJSON() as Sdp,
  };

  const signalRef = ref(database, "signals/" + hostPeer.ip);
  await set(push(signalRef), signal);
}

export async function sendAnswer(
  database: Database,
  srcId: string,
  dstId: string,
  hostPeer: Peer
) {
  let localDesc = hostPeer.conns.find((conn) => conn.dstId === dstId)?.conn
    .localDescription;

  let signal: Signal = {
    type: "Answer",
    srcId: srcId,
    dstId: dstId,
    sdp: localDesc?.toJSON() as Sdp,
  };

  const signalRef = ref(database, "signals/" + hostPeer.ip);
  await set(push(signalRef), signal);
}

export async function sendCandidate(
  database: Database,
  srcId: string,
  dstId: string,
  candidate: string,
  hostPeer: Peer
) {
  let signal: Signal = {
    type: "Candidate",
    srcId: srcId,
    dstId: dstId,
    candidate: candidate,
  };

  const signalRef = ref(database, "signals/" + hostPeer.ip);
  await set(push(signalRef), signal);
}