import Peer from "../core/Peer";
import { FaPencil } from "react-icons/fa6";
import { JSX, useRef, useState } from "react";
import { IoCheckmark } from "react-icons/io5";
import { MdOutlineComputer } from "react-icons/md";
import { sendOffer, sendSyn } from "../util/signal";
import { FaAndroid, FaApple, FaWindows } from "react-icons/fa";
import { FileMetadata, PeerDescription, PeerNodeArg } from "../types/types";


const CHUNK_SIZE = 16 * 1024; // 16 kb
const BUFFER_LIMIT = 64 * 1024 // 64 kb

export default function PeerNode({ id, data }: PeerNodeArg) {
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isEditable, setIsEditable] = useState<boolean>(false);
  const [isHost, _] = useState<boolean>(data.hostPeer.desc.peerId === id);

  async function handleClick() {
    let hostPeer: Peer = data.hostPeer;
    if (data.desc.peerId === hostPeer.desc.peerId) return;

    if (hostPeer && !hostPeer.hasRtcConnection(data.desc.peerId)) {
      hostPeer.addRtcDataConnection(data.desc);
      await hostPeer.createOfferAndSetLocalDesc(data.desc);

      await sendOffer(hostPeer.desc, data.desc, hostPeer);
    }

    fileRef.current?.click();
  }

  async function waitDuration(durationInMilliSec : number) {
    return new Promise((resolve) => {
      setTimeout(resolve, durationInMilliSec)
    })
  }

  async function handlePeerNameChange() {
    const newName = inputRef.current?.value?.trim();
    
    if(newName && newName !== data.label) {
      data.label = newName;
      updateLocalStorage(newName);
      
      data.hostPeer.desc.peerName = newName;
      await sendSyn(data.hostPeer);
    }

    setIsEditable(false);
  }

  function handleEdit() {
    setIsEditable(true);
  }

  function updateLocalStorage(newPeerName : string) {
    let newDesc : PeerDescription = {
      peerId : data.desc.peerId,
      peerName : newPeerName
    }

    localStorage.setItem("peerDesc",JSON.stringify(newDesc))
  }

  function renderOsIcon(os: string): JSX.Element {
    switch (os) {
      case "Windows":
        return <FaWindows className={`${isHost ? "text-3xl" : "text-lg"}`} />;
      case "macOS":
        return <FaApple className={`${isHost ? "text-3xl" : "text-lg"}`} />;
      case "Android":
        return <FaAndroid className={`${isHost ? "text-3xl" : "text-lg"}`} />;
      default:
        return (
          <MdOutlineComputer className={`${isHost ? "text-3xl" : "text-lg"}`} />
        );
    }
  }

  async function handleFileChange(e: any) {
    try {
      const selectedFile = e.target.files[0];
      const destPeerUid = id;
      const hostPeer = data.hostPeer;

      if (selectedFile) {
        let buffer = await selectedFile.arrayBuffer();
        let rtcConn = hostPeer.conns.find(
          (conn) => conn.toDesc.peerId === destPeerUid
        );

        if (rtcConn) {
          const metaData: FileMetadata = {
            filename: selectedFile.name,
            type: selectedFile.type,
            size: selectedFile.size,
          };

          rtcConn.srcDc?.send(JSON.stringify(metaData));

          while (buffer.byteLength) {
            const chunk = buffer.slice(0, CHUNK_SIZE);
            buffer = buffer.slice(CHUNK_SIZE, buffer.byteLength);

            if(rtcConn.srcDc?.bufferedAmount || 0 < BUFFER_LIMIT) {
              rtcConn.srcDc?.send(chunk);
            } else {
              // Wait for one millisec
              await waitDuration(1);
            }
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
        <>
          {!isEditable && (
            <div className="flex flex-row gap-2 items-center">
              <p
                className={`w-30 text-center ${
                  isHost ? "text-[#ffa828]" : "text-[#b7ff54]"
                }`}
              >
                {data.label}
              </p>
              {isHost && <FaPencil
                onClick={handleEdit}
                className={`text-sm text-[#b7ff54] hover:cursor-pointer ${
                  isHost ? "text-[#ffa828]" : "text-[#b7ff54]"
                }`}
              />}
            </div>
          )}
          {isEditable && (
            <div className="flex flex-row gap-2 items-center">
              <input
                ref={inputRef}
                className={`ml-2 pl-2 pr-2 w-30 rounded-lg focus:outline-none
              ${
                isHost
                  ? "text-[#ffa828] bg-[#413422]"
                  : "bg-[#384027] text-[#b7ff54]"
              }
            `}
              />
              <IoCheckmark
                onClick={handlePeerNameChange}
                className={`text-[#b7ff54] hover:cursor-pointer ${
                  isHost ? "text-[#ffa828]" : "text-[#b7ff54]"
                }`}
              />
            </div>
          )}
        </>
        <div
          onClick={handleClick}
          className={`p-3 rounded-full font-medium hover:cursor-pointer ${
            isHost
              ? "text-[#ffa828] bg-[#413422] mb-2"
              : "bg-[#384027] text-[#b7ff54] mt-2"
          } `}
        >
          {renderOsIcon(data.os)}
        </div>
        <input
          type="file"
          ref={fileRef}
          onChange={handleFileChange}
          style={{ display: "none" }}
        />
      </div>
    </>
  );
}
