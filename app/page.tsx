"use client"; // Required because we are using React state

import { useState } from "react";

export default function Home() {
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;

    // Add user message to UI immediately
    const newMessages = [...messages, { role: "user", text: input }];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      // Send to your backend
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input, history: newMessages }),
      });

      const data = await res.json();

      // Add AI response to UI
      setMessages((prev) => [...prev, { role: "ai", text: data.response }]);
    } catch (error) {
      console.error("Chat Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-8 bg-gray-950 text-white font-sans">
      <h1 className="text-4xl font-bold mb-2 text-cyan-400">Mock Live</h1>
      <p className="text-gray-400 mb-8">Your AI Interviewer is ready.</p>

      {/* Chat Window */}
      <div className="w-full max-w-2xl bg-gray-900 border border-gray-800 rounded-xl p-6 h-[500px] overflow-y-auto mb-4 flex flex-col gap-4">
        {messages.length === 0 && (
          <div className="text-gray-500 text-center mt-20">Type below to start your interview...</div>
        )}
        
        {messages.map((msg, idx) => (
          <div key={idx} className={`p-4 rounded-lg max-w-[80%] ${msg.role === "user" ? "bg-cyan-900 self-end" : "bg-gray-800 self-start"}`}>
            <span className="font-bold text-sm text-gray-400 block mb-1">
              {msg.role === "user" ? "You" : "Interviewer"}
            </span>
            {msg.text}
          </div>
        ))}
        {isLoading && <div className="text-gray-500 self-start animate-pulse">Interviewer is typing...</div>}
      </div>

      {/* Input Box */}
      <div className="w-full max-w-2xl flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Type your response..."
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg p-4 text-white focus:outline-none focus:border-cyan-500"
          disabled={isLoading}
        />
        <button 
          onClick={sendMessage}
          disabled={isLoading}
          className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-4 px-8 rounded-lg transition-colors disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </main>
  );
}