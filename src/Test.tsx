export default function Test() {
  const conn = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  });
  conn.createDataChannel("test");
  const candidates: any[] = [];

  conn.onicegatheringstatechange = () => {
    console.log("ICE gathering state:", conn.iceGatheringState);
  };

  conn.onicecandidate = (e: any) => {
    console.log("Ice candidate ", e);
    candidates.push(e);
  };

  async function resolveIp() {
    const offer = await conn.createOffer();
    await conn.setLocalDescription(offer);

    console.log("Offer ", offer);
  }

  return (
    <div className="min-h-screen bg-gray-800">
      <div className="flex flex-row gap-2 w-full items-center justify-center">
        <input className="input mt-10 p-2 bg-white rounded-md"></input>
        <button
          onClick={async () => await resolveIp()}
          className="bg-blue-200 p-2 mt-10 rounded-md text-gray-800 font-medium cursor-pointer"
        >
          Resolve
        </button>
      </div>
    </div>
  );
}
