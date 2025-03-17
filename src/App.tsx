import { useState } from "react";
import { ReactFlow, Background, Controls } from '@xyflow/react';


const ws = new WebSocket("ws://localhost:6969/ws");

function App() {
  const [messages, setMessages] = useState<string[]>([]);
  const [peers, setPeers] = useState<any[]>([]);

  ws.onmessage = (e: MessageEvent) => {
    setMessages((msgs) => [...msgs, e.data]);
  };

  ws.onopen = () => {
    ws.send("Hello");
  };

  async function GetConnections() {
    const response = await fetch(`http://localhost:6969/conns`);
    
    if (!response.ok) {
      console.log("Error fetching connections");
      return;
    }

    const data = await response.json();

    // Convert peers to React Flow nodes
    const nodes = data.map((peer: string, idx: number) => ({
      id: `peer-${idx}`,
      position: { x: idx * 100, y: Math.random() * 300 },
      data: { label: peer },
    }));

    setPeers(nodes);
  }

  return (
    <div className="min-h-screen w-full">
      {/* React Flow Canvas */}
      <div style={{ height: "60vh", width: "100vw" }}>
        <ReactFlow nodes={peers}>
          <Background />
          <Controls />
        </ReactFlow>
      </div>

      {/* Messages */}
      <div className="p-4 mt-10 w-full border">
        {messages.map((msg, i) => (
          <p key={i} className="font-medium text-red-500">{msg}</p>
        ))}
      </div>

      {/* Fetch Peers Button */}
      <button
        onClick={() => GetConnections()}
        className="bg-red-400 px-2 py-1 rounded-sm text-black hover:cursor-pointer">
        Load Peers
      </button>
    </div>
  );
}

export default App;
