import Peer from "../core/Peer";
import { useRef, useState } from "react";
import { sendOffer } from "../core/signal";
import { FileMetadata, PeerNodeArg } from "../types/types";
import { database } from "../firebase/firebase";
import { MdOutlineComputer } from "react-icons/md";

export default function PeerNode({ id, data }: PeerNodeArg) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [isHost, _] = useState<boolean>(data.hostPeer.uid === id);

  async function handleClick() {
    let hostPeer: Peer = data.hostPeer;
    if (data.uid === hostPeer.uid) return;

    if (hostPeer && !hostPeer.hasRtcConnection(data.uid)) {
      hostPeer.addRtcDataConnection(data.uid);
      await hostPeer.createOfferAndSetLocalDesc(data.uid);
      await sendOffer(database, hostPeer.uid, data.uid, hostPeer);
    }

    fileRef.current?.click();
  }

  async function handleFileChange(e: any) {
    try {
      const selectedFile = e.target.files[0];
      const chunkSize = 64 * 1024;
      const destPeerUid = id;
      const hostPeer = data.hostPeer;

      if (selectedFile) {
        let buffer = await selectedFile.arrayBuffer();
        let rtcConn = hostPeer.conns.find((conn) => conn.dstId === destPeerUid);

        if (rtcConn) {
          const metaData: FileMetadata = {
            filename: selectedFile.name,
            type: selectedFile.type,
            size: selectedFile.size,
          };

          rtcConn.srcDc?.send(JSON.stringify(metaData));
          while (buffer.byteLength) {
            const chunk = buffer.slice(0, chunkSize);
            buffer = buffer.slice(chunkSize, buffer.byteLength);

            rtcConn.srcDc?.send(chunk);
          }

          rtcConn.srcDc?.send("Done");
        }
      }
    } catch (error) {
      console.error("Error sending the file", error);
    }
  }

  return (
    <>
      <div
        className={`flex justify-start items-center ${
          isHost ? "flex-col-reverse" : "flex-col"
        }`}
      >
        <p className={`${isHost ? "text-[#ffa828]" : "text-[#b7ff54]"}`}>
          {data.label}
        </p>
        <div
          onClick={handleClick}
          className={`p-3 rounded-full font-medium hover:cursor-pointer ${
            isHost
              ? "text-[#ffa828] bg-[#413422]"
              : "bg-[#384027] text-[#b7ff54]"
          }`}
        >
          <MdOutlineComputer className={`${isHost ? "text-3xl" : "text-lg"}`} />
        </div>
        <input
          type="file"
          ref={fileRef}
          onChange={handleFileChange}
          style={{ display: "none" }}
        />
      </div>

      {/* {id === "self" ? (
        <Handle
          type="target"
          position={Position.Top}
          isConnectable={true}
          style={{
            background: "#b7ff54",
          }}
        />
      ) : (
        <Handle
          type="target"
          position={Position.Bottom}
          isConnectable={true}
          style={{
            background: "#ffa828",
          }}
        />
      )} */}
    </>
  );
}
