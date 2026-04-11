"use client";

import { useEffect, useRef, useState } from "react";
import { LiveAvatarSession, SessionEvent } from "@heygen/liveavatar-web-sdk";

export default function Home() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([]);
  const [isAvatarStarting, setIsAvatarStarting] = useState(false);
  const [isChatting, setIsChatting] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  
  const avatarRef = useRef<any>(null);

  // 1. Start the Avatar Session
  const startAvatarSession = async () => {
    setIsAvatarStarting(true);
    try {
      const tokenRes = await fetch("/api/get-access-token", { method: "POST" });
      const tokenData = await tokenRes.json();
      
      if (!tokenData.token) throw new Error("Failed to get token");

      const avatar = new LiveAvatarSession(tokenData.token);
      avatarRef.current = avatar;

    // 3. THE MAGIC ATTACHER (2026 SDK Method)
    avatar.on(SessionEvent.SESSION_STREAM_READY, () => {
      console.log("🎥 Stream event triggered!");
      
      // Grab the raw HTML video element
      const videoElement = document.getElementById("avatar-video") as HTMLVideoElement;
      
      if (videoElement) {
        console.log("✅ Binding SDK directly to video element!");
        
        // THE FIX: Let the SDK handle the stream automatically!
        avatar.attach(videoElement);
        
        setSessionActive(true);
      } else {
        console.error("❌ Could not find the video player on the screen.");
      }
    });

      await avatar.start();

    } catch (error) {
      console.error("Failed to start avatar:", error);
      alert("Failed to start avatar. Check your browser console for exact details.");
    } finally {
      setIsAvatarStarting(false);
    }
  };

  // 2. Handle Sending Messages
  const sendMessage = async () => {
    if (!input.trim() || isChatting) return;

    const userText = input;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: userText }]);
    setIsChatting(true);

    try {
      const chatRes = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userText }),
      });
      const chatData = await chatRes.json();
      const aiResponse = chatData.response;

      setMessages((prev) => [...prev, { role: "ai", text: aiResponse }]);

      if (avatarRef.current) {
        if (typeof avatarRef.current.speak === 'function') {
           await avatarRef.current.speak({ text: aiResponse });
        } else if (typeof avatarRef.current.sendText === 'function') {
           await avatarRef.current.sendText(aiResponse);
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
    } finally {
      setIsChatting(false);
    }
  };

  useEffect(() => {
    return () => {
      if (avatarRef.current && typeof avatarRef.current.stop === 'function') {
        avatarRef.current.stop();
      }
    };
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-950 text-white font-sans">
      <h1 className="text-4xl font-bold mb-6 text-cyan-400">Mock Live Interview</h1>

      {/* Video Player Container */}
      <div className="w-full max-w-3xl aspect-video bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-6 relative flex items-center justify-center">
        
        {/* Added raw HTML ID here! */}
        <video 
          id="avatar-video"
          autoPlay 
          playsInline 
          className={`w-full h-full object-cover ${sessionActive ? 'block' : 'hidden'}`}
        >
          <track kind="captions" />
        </video>

        {/* Start Button Overlay */}
        {!sessionActive && (
          <div className="absolute z-10 flex flex-col items-center gap-4">
            <p className="text-gray-400">Video feed offline.</p>
            <button 
              onClick={startAvatarSession}
              disabled={isAvatarStarting}
              className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50"
            >
              {isAvatarStarting ? "Booting up Avatar..." : "Start Interview"}
            </button>
          </div>
        )}
      </div>

      {/* Chat Interface */}
      <div className="w-full max-w-3xl flex flex-col gap-4">
        <div className="h-40 overflow-y-auto bg-gray-900 border border-gray-800 rounded-lg p-4 flex flex-col gap-2">
          {messages.map((msg, idx) => (
            <div key={idx} className={`p-2 rounded max-w-[85%] ${msg.role === "user" ? "bg-cyan-900 self-end" : "bg-gray-800 self-start"}`}>
              <span className="font-bold text-xs text-gray-400 block">{msg.role === "user" ? "You" : "Interviewer"}</span>
              <span className="text-sm">{msg.text}</span>
            </div>
          ))}
          {messages.length === 0 && <p className="text-gray-600 text-sm italic text-center mt-4">Conversation history will appear here...</p>}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Type your answer here..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg p-4 text-white focus:outline-none focus:border-cyan-500"
            disabled={!sessionActive || isChatting}
          />
          <button 
            onClick={sendMessage}
            disabled={!sessionActive || isChatting}
            className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-4 px-8 rounded-lg transition-colors disabled:opacity-50"
          >
            {isChatting ? "Thinking..." : "Send"}
          </button>
        </div>
      </div>
    </main>
  );
}