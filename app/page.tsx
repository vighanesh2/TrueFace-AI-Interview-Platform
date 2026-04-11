"use client";

import { useEffect, useRef, useState } from "react";
import { LiveAvatarSession, SessionEvent } from "@heygen/liveavatar-web-sdk";

export default function Home() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([]);
  const [isAvatarStarting, setIsAvatarStarting] = useState(false);
  const [isChatting, setIsChatting] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  
  // 🚨 NEW: Speech-to-Text State
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  
  const avatarRef = useRef<any>(null);

  // 🚨 NEW: Initialize Browser Native Speech Recognition
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Support both standard and WebKit browsers (Chrome/Safari)
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true; // Keep listening until they stop
        recognition.interimResults = true; // Show words as they speak
        recognition.lang = "en-US";

        recognition.onresult = (event: any) => {
          let currentTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            currentTranscript += event.results[i][0].transcript;
          }
          // Update the text box with what they are saying
          setInput(currentTranscript);
        };

        recognition.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      } else {
        console.warn("Speech Recognition is not supported in this browser. Use Chrome.");
      }
    }
  }, []);

  // 🚨 NEW: Toggle Microphone
  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      setInput(""); // Clear the box before they start talking
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  // Cleanly close the session to prevent Ghost Sessions
  const stopAvatarSession = async () => {
    if (avatarRef.current) {
      try {
        console.log("Stopping avatar session...");
        await avatarRef.current.stop();
      } catch (e) {
        console.error("Error stopping avatar cleanly:", e);
      }
      avatarRef.current = null;
    }
    setSessionActive(false);
    setIsAvatarStarting(false);
    setIsChatting(false);
    
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }
  };

  // 1. Start the Avatar Session
  const startAvatarSession = async () => {
    if (isAvatarStarting || sessionActive) return;
    
    setIsAvatarStarting(true);

    try {
      const tokenRes = await fetch("/api/get-access-token", { method: "POST" });
      const tokenData = await tokenRes.json();
      
      if (!tokenRes.ok || !tokenData.token) {
        console.error("🚨 SERVER REJECTED TOKEN REQUEST:", tokenData);
        alert(`Server Error: ${tokenData.details?.message || "Check VS Code terminal for the exact reason"}`);
        throw new Error("Token generation failed before session could start.");
      }

      const avatar = new LiveAvatarSession(tokenData.token);
      avatarRef.current = avatar;

      avatar.on(SessionEvent.SESSION_STREAM_READY, () => {
        console.log("🎥 Stream event triggered!");
        const videoElement = document.getElementById("avatar-video") as HTMLVideoElement;
        
        if (videoElement) {
          avatar.attach(videoElement);
          setSessionActive(true);
        } else {
          console.error("❌ Could not find the video player on the screen.");
        }
      });

      avatar.on(SessionEvent.SESSION_DISCONNECTED, () => {
        console.log("Session disconnected from server.");
        stopAvatarSession();
      });

      await avatar.start();

    } catch (error) {
      console.error("Failed to start avatar:", error);
      await stopAvatarSession();
    } finally {
      setIsAvatarStarting(false);
    }
  };

  // 2. Handle Sending Messages
  const sendMessage = async () => {
    if (!input.trim() || isChatting) return;

    // Stop listening automatically when they hit send
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }

    const userText = input;
    setInput("");
    
    const currentMessages = [...messages, { role: "user", text: userText }];
    setMessages(currentMessages);
    setIsChatting(true);

    try {
      const formattedHistory = currentMessages.map((msg) => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.text }],
      }));

      const chatRes = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: userText,
          history: formattedHistory
        }),
      });
      
      const chatData = await chatRes.json();
      
      if (!chatRes.ok || !chatData.response) {
         throw new Error(chatData.error || "Gemini API failed to respond");
      }

      const aiResponse = chatData.response;

      setMessages((prev) => [...prev, { role: "ai", text: aiResponse }]);

      if (avatarRef.current) {
        try {
           console.log("Sending text to avatar...");
           await avatarRef.current.repeat(aiResponse);
        } catch (sdkError) {
           console.error("Failed to make avatar repeat:", sdkError);
        }
      } else {
         console.error("Critical SDK Error: Avatar reference is missing.");
      }
      
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(messages); 
      alert("The Brain (Gemini) is temporarily overloaded. Please wait 5 seconds and try sending your message again.");
    } finally {
      setIsChatting(false);
    }
  };

  useEffect(() => {
    return () => {
      if (avatarRef.current) {
        avatarRef.current.stop().catch(console.error);
      }
    };
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-950 text-white font-sans">
      <h1 className="text-4xl font-bold mb-6 text-cyan-400">Mock Live Interview</h1>

      {/* Video Player Container */}
      <div className="w-full max-w-3xl aspect-video bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-6 relative flex items-center justify-center">
        
        <video 
          id="avatar-video"
          autoPlay 
          playsInline 
          className={`w-full h-full object-cover ${sessionActive ? 'block' : 'hidden'}`}
        >
          <track kind="captions" />
        </video>

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

        {sessionActive && (
          <button 
            onClick={stopAvatarSession}
            className="absolute top-4 right-4 bg-red-600/80 hover:bg-red-500 text-white text-sm font-bold py-2 px-4 rounded-lg backdrop-blur-sm transition-colors"
          >
            End Interview
          </button>
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
          {/* 🚨 NEW: Microphone Button */}
          <button
            onClick={toggleListening}
            disabled={!sessionActive || isChatting}
            className={`flex items-center justify-center px-4 rounded-lg transition-colors disabled:opacity-50 ${
              isListening ? "bg-red-600 hover:bg-red-500 animate-pulse" : "bg-gray-700 hover:bg-gray-600"
            }`}
            title={isListening ? "Stop Listening" : "Start Microphone"}
          >
            {isListening ? "🛑" : "🎙️"}
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Type or speak your answer here..."
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
