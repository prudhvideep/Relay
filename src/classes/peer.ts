import { faker } from "@faker-js/faker";
import { Database, ref, set } from "firebase/database";

class Peer {
  uid: string;
  ip!: string;
  os!: string;
  peers: Peer[];

  constructor() {
    this.uid = this.getPeerId();
    this.peers = [];
  }

  initDataChannel(conn: RTCPeerConnection) {
    conn.createDataChannel("dc");
  }

  getPeerId(): string {
    let peerId;
    if (!sessionStorage.getItem("peerId")) {
      peerId = faker.animal.type() + "-" + faker.color.human();

      if (peerId) {
        sessionStorage.setItem("peerId", peerId);
      }
    } else {
      peerId = sessionStorage.getItem("peerId") || "";
    }

    return peerId;
  }

  async resolvePeerData() {
    const response = await fetch(
      `${import.meta.env.VITE_METADATA_URL}`
    );

    const data = await response.json();
    this.ip = data?.ip;
    this.os = data?.os;
  }

  async addPeerToDb(database: Database) {
    await set(ref(database, "rooms/" + this.ip + "room/" + this.uid), {
      uid: this.uid,
      os: this.os,
    });
  }
}

export default Peer;
