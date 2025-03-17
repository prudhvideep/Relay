import { useState } from "react";

const ws = new WebSocket("ws://localhost:6969/ws");

function App() {
  const [messages, setMessages] = useState<string[]>();

  ws.onmessage = (e: MessageEvent) => {
    setMessages((msgs = []) => [...msgs, e.data]);
  };

  ws.onopen = () => {
    ws.send("Hello");
  };

  async function GetConnections() {
    const response = await fetch(`localhost:6969/conns`)
    
    if (!response.ok){
      console.log("Error fetching connections");
      return;
    }

    const data = await response.json();

    console.log("Conns ---> ",data);
  }

  return (
    <>
      <div className="min-h-screen w-full">
        <div className="p-4 mt-10 w-full border">
          {messages &&
            messages.map((msg: string, i: number) => (
              <p key={i} className="font-medium text-red-500">
                {msg}
              </p>
            ))}
        </div>
        <button className="bg-red-400 pl-2 pr-2 rounded-sm text-black hover:cursor-pointer">
          Conns
        </button>
      </div>
    </>
  );
}

export default App;
