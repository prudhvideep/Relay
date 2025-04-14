import { Handle, Position } from "@xyflow/react";
import { useRef } from "react";
import { MdOutlineComputer } from "react-icons/md";

export default function PeerNode({ data, id }: any) {
  const fileRef = useRef<HTMLInputElement>(null);

  function handleClick() {
    fileRef.current?.click();
  }

  function handleFileChange() {
    for (const file of fileRef.current?.files || []) {
      data.fileTransfer(file,id);
    }
  }

  return (
    <>
      <div
        className={`flex justify-start items-center ${
          id === "self" ? "flex-col-reverse" : "flex-col"
        }`}
      >
        <p className={`${id === "self" ? "text-[#ffa828]" : "text-[#b7ff54]"}`}>
          {data.label}
        </p>
        <div
          onClick={handleClick}
          className={`p-3 rounded-full font-medium hover:cursor-pointer ${
            id === "self"
              ? "text-[#ffa828] bg-[#413422]"
              : "bg-[#384027] text-[#b7ff54]"
          }`}
        >
          <MdOutlineComputer
            className={`${id === "self" ? "text-3xl" : "text-lg"}`}
          />
        </div>
        <input
          type="file"
          ref={fileRef}
          onChange={handleFileChange}
          style={{ display: "none" }}
        />
      </div>

      {id === "self" ? (
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
      )}
    </>
  );
}
