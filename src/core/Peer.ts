import { faker } from "@faker-js/faker";
import {
  FileMetadata,
  IceCandidate,
  PeerDescription,
  RTCConn,
  Sdp,
} from "../types/types";
import { sendCandidate } from "../util/signal";
import { database } from "../firebase/firebase";
import { child, get, ref, remove, set } from "firebase/database";

class Peer {
  ip!: string;
  os!: string;
  desc: PeerDescription;
  conns!: RTCConn[];
  chunks!: BlobPart[];
  metadata!: FileMetadata;

  constructor() {
    // Generate unique peer idReceived signal from
    this.desc = this.initPeerDesc();
    this.conns = [];
    this.chunks = [];
    this.metadata = this.initMetadata();
  }

  initMetadata(): FileMetadata {
    return {
      filename: "",
      type: "",
      size: "",
    };
  }

  hasRtcConnection(toPeerId: string): boolean {
    return this.conns.length > 0 && this.conns.some((e) => e.toDesc.peerId === toPeerId);
  }

  removeRtcConnection(dstPeerId: string) {
    const targetConn = this.conns.find((conn) => conn.toDesc.peerId === dstPeerId);
    if (targetConn) targetConn.conn?.close();

    this.conns = this.conns.filter((conn) => conn.toDesc.peerId !== dstPeerId);
  }

  generatePeerId(): string {
    const randId = crypto.randomUUID();
    return randId;
  }

  generatePeerName(): string {
    const peerId = faker.animal.type() + "-" + faker.color.human();
    return peerId;
  }

  initPeerDesc(): PeerDescription {
    if (!localStorage.getItem("peerDesc")) {
      let desc: PeerDescription = {
        peerId: this.generatePeerId(),
        peerName: this.generatePeerName(),
      };

      localStorage.setItem("peerDesc", JSON.stringify(desc));
      return desc;
    }

    let descStr = localStorage.getItem("peerDesc") || "{}";

    return JSON.parse(descStr) as PeerDescription;
  }

  saveBlob(blob: Blob, fileName: string) {
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.style.display = "none";
    document.body.appendChild(link);

    link.href = blobUrl;

    link.download = fileName;

    link.click();

    URL.revokeObjectURL(blobUrl);
  }

  async addPeerToDb() {
    await set(ref(database, "rooms/" + this.ip + "room/" + this.desc.peerId), {
      uid: this.desc.peerId,
      os: this.os,
    });
  }

  async deletePeerFromDb(peerId: string) {
    const nodeRef = ref(database, "rooms/" + this.ip + "room/" + peerId);
    await remove(nodeRef);
  }

  async resolvePeerData() {
    const response = await fetch(`${import.meta.env.VITE_METADATA_URL}`);

    const data = await response.json();
    this.ip = data?.ip;
    this.os = data?.os;
  }

  async getPeers() {
    const dbRef = ref(database);
    const snapshot = await get(child(dbRef, "rooms/" + this.ip + "room/"));

    if (snapshot.exists()) {
      return Object.keys(snapshot.val());
    }
    return [];
  }

  async cleanupClosedRtcConn(toPeerId: string) {
    const rtcConn = this.conns.find((conn) => conn.toDesc.peerId === toPeerId);

    if (rtcConn) {
      rtcConn.conn.close();
      await this.deletePeerFromDb(toPeerId);
    }
  }

  async addRtcDataConnection(toPeerDesc: PeerDescription) {
    let rtcConn = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    let dc = rtcConn.createDataChannel("dc");

    dc.onclose = async () => {
      console.log("Data channel closed");
      await this.cleanupClosedRtcConn(toPeerDesc.peerId);
    };

    rtcConn.ondatachannel = (event) => {
      const receivedChannel = event.channel;

      receivedChannel.onmessage = (e) => {
        if (e.data === "Done") {
          const file = new Blob(this.chunks);
          console.log("Received file ", file);

          this.saveBlob(file, this.metadata.filename);

          //Clean out this chunks
          this.chunks.length = 0;
          this.metadata = this.initMetadata();
        } else {
          // Need to add blob for android
          if (e.data instanceof ArrayBuffer || e.data instanceof Blob) {
            this.chunks.push(e.data);
          } else {
            this.metadata = JSON.parse(e.data);
          }
        }
      };
    };

    rtcConn.onicecandidate = async (e: any) => {
      if (e.candidate) {
        await sendCandidate(this.desc, toPeerDesc, JSON.stringify(e.candidate), this);
      }
    };

    rtcConn.onconnectionstatechange = async (e: any) => {
      let connState = e.currentTarget.connectionState;
      console.log("Connection state ", connState);
      if (
        connState === "disconnected" ||
        connState === "failed" ||
        connState === "closed"
      ) {
        rtcConn.close();
        console.log("Closing connection");
        await this.cleanupClosedRtcConn(toPeerDesc.peerId);
        this.conns = this.conns.filter((conn) => conn.toDesc.peerId !== toPeerDesc.peerId);
      }
    };

    const newConn: RTCConn = {
      fromDesc: this.desc,
      toDesc: toPeerDesc,
      conn: rtcConn,
      srcDc: dc,
    };

    this.conns.push(newConn);
  }

  async createOfferAndSetLocalDesc(toPeerDesc: PeerDescription) {
    let rtcConn = this.conns.find((conn) => conn.toDesc.peerId === toPeerDesc.peerId);

    if (rtcConn) {
      let offer = await rtcConn.conn.createOffer();
      await rtcConn.conn.setLocalDescription(offer);
    }
  }

  async createAnswerAndSetLocalDesc(toPeerDesc: PeerDescription) {
    let rtcConn = this.conns.find((conn) => conn.toDesc.peerId === toPeerDesc.peerId);

    if (rtcConn) {
      let answer = await rtcConn.conn.createAnswer();
      await rtcConn.conn.setLocalDescription(answer);
    }
  }

  async setRemoteDesc(toPeerDesc: PeerDescription, sdp: Sdp | undefined) {
    if (!sdp) return;

    let rtcConn = this.conns.find((conn) => conn.toDesc.peerId === toPeerDesc.peerId);

    if (rtcConn && !rtcConn.conn.remoteDescription) {
      let sdpDesc = new RTCSessionDescription(sdp);
      await rtcConn.conn.setRemoteDescription(sdpDesc);
    }
  }

  async setIceCandidate(toPeerDesc: PeerDescription, candidate: string | undefined) {
    if (!candidate) return;

    let rtcConn = this.conns.find((conn) => conn.toDesc.peerId === toPeerDesc.peerId);

    if (rtcConn?.conn) {
      let iceCandidate = JSON.parse(candidate) as IceCandidate;
      await rtcConn.conn.addIceCandidate(iceCandidate);
    }
  }
}

export default Peer;
