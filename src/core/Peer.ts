import { faker } from "@faker-js/faker";
import { FileMetadata, IceCandidate, RTCConn, Sdp } from "../types/types";
import { sendCandidate } from "./signal";
import { database } from "../firebase/firebase";
import { child, get, ref, remove, set } from "firebase/database";

class Peer {
  uid: string;
  ip!: string;
  os!: string;
  conns!: RTCConn[];
  chunks!: BlobPart[];
  metadata!: FileMetadata;

  constructor() {
    // Generate unique peer idReceived signal from
    this.uid = this.getPeerId();
    this.conns = [];
    this.chunks = [];
    this.metadata = this.initMetadata();
  }

  hasRtcConnection(dstId: string): boolean {
    return this.conns.length > 0 && this.conns.some((e) => e.dstId === dstId);
  }

  removeRtcConnection(dstPeerId: string) {
    const targetConn = this.conns.find((conn) => conn.dstId === dstPeerId);
    if (targetConn) targetConn.conn?.close();

    this.conns = this.conns.filter((conn) => conn.dstId !== dstPeerId);
  }

  initMetadata(): FileMetadata {
    return {
      filename: "",
      type: "",
      size: "",
    };
  }

  getPeerId(): string {
    let peerId;
    if (!localStorage.getItem("peerId")) {
      peerId = faker.animal.type() + "-" + faker.color.human();

      if (peerId) {
        localStorage.setItem("peerId", peerId);
      }
    } else {
      peerId = localStorage.getItem("peerId") || "";
    }

    return peerId;
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
    await set(ref(database, "rooms/" + this.ip + "room/" + this.uid), {
      uid: this.uid,
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

  async cleanupClosedRtcConn(dstId: string) {
    const rtcConn = this.conns.find((conn) => conn.dstId === dstId);

    if (rtcConn) {
      rtcConn.conn.close();
      await this.deletePeerFromDb(dstId);
    }
  }

  async addRtcDataConnection(dstId: string) {
    let rtcConn = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    let dc = rtcConn.createDataChannel("dc");

    dc.onclose = async () => {
      console.log("Data channel closed");
      await this.cleanupClosedRtcConn(dstId);
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
        await sendCandidate(
          this.uid,
          dstId,
          JSON.stringify(e.candidate),
          this
        );
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
        await this.cleanupClosedRtcConn(dstId);
        this.conns = this.conns.filter((conn) => conn.dstId !== dstId);
      }
    };

    const newConn: RTCConn = {
      srcId: this.uid,
      dstId: dstId,
      conn: rtcConn,
      srcDc: dc,
    };

    this.conns.push(newConn);
  }

  async createOfferAndSetLocalDesc(dstId: string) {
    let rtcConn = this.conns.find((conn) => conn.dstId === dstId);

    if (rtcConn) {
      let offer = await rtcConn.conn.createOffer();
      await rtcConn.conn.setLocalDescription(offer);
    }
  }

  async createAnswerAndSetLocalDesc(dstId: string) {
    let rtcConn = this.conns.find((conn) => conn.dstId === dstId);

    if (rtcConn) {
      let answer = await rtcConn.conn.createAnswer();
      await rtcConn.conn.setLocalDescription(answer);
    }
  }

  async setRemoteDesc(dstId: string, sdp: Sdp | undefined) {
    if (!sdp) return;

    let rtcConn = this.conns.find((conn) => conn.dstId === dstId);

    if (rtcConn && !rtcConn.conn.remoteDescription) {
      let sdpDesc = new RTCSessionDescription(sdp);
      await rtcConn.conn.setRemoteDescription(sdpDesc);
    }
  }

  async setIceCandidate(dstId: string, candidate: string | undefined) {
    if (!candidate) return;

    let rtcConn = this.conns.find((conn) => conn.dstId === dstId);

    if (rtcConn?.conn) {
      let iceCandidate = JSON.parse(candidate) as IceCandidate;
      await rtcConn.conn.addIceCandidate(iceCandidate);
    }
  }
}

export default Peer;
