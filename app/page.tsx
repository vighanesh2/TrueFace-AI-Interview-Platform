"use client";

import { useEffect, useRef, useState } from "react";
import { LiveAvatarSession, SessionEvent } from "@heygen/liveavatar-web-sdk";

export default function Home() {
  // --- STATE VARIABLES ---
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([]);
  const [isAvatarStarting, setIsAvatarStarting] = useState(false);
  const [isChatting, setIsChatting] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  
  // Audio & Video States
  const [isListening, setIsListening] = useState(false);
  const [fillerCount, setFillerCount] = useState(0);
  const [userVideoActive, setUserVideoActive] = useState(false);
  
  // Refs
  const recognitionRef = useRef<any>(null);
  const avatarRef = useRef<any>(null);
  const userVideoRef = useRef<HTMLVideoElement>(null);
  const interimFillerCountRef = useRef(0);

  // --- INITIALIZE BROWSER SPEECH RECOGNITION & FILLER WORD TRACKER ---
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true; 
        recognition.interimResults = true; 
        recognition.lang = "en-US";

        recognition.onresult = (event: any) => {
          let currentTranscript = "";
          let isFinalResult = false;

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            currentTranscript += event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              isFinalResult = true;
            }
          }
          
          setInput(currentTranscript);

          // 🚨 THE FIX: Catch fillers in the raw interim text before Chrome sanitizes it!
          const fillers = currentTranscript.match(/\b(um|uh|uhm|like|Ah|basically|literally)\b/gi);
          const currentFillerAmount = fillers ? fillers.length : 0;

          // If we found a NEW filler word in this split-second update, add the difference to our total
          if (currentFillerAmount > interimFillerCountRef.current) {
            const difference = currentFillerAmount - interimFillerCountRef.current;
            setFillerCount(prev => prev + difference);
            interimFillerCountRef.current = currentFillerAmount;
          }

          // Once Chrome finalizes the sentence, reset our local tracker for the next sentence
          if (isFinalResult) {
            interimFillerCountRef.current = 0;
          }
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

  // --- CAMERA CONTROL ---
  const startUserCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (userVideoRef.current) {
        userVideoRef.current.srcObject = stream;
        setUserVideoActive(true);
      }
    } catch (err) {
      console.error("Failed to access webcam:", err);
      alert("Please allow webcam access to analyze your body language.");
    }
  };

  // --- MICROPHONE CONTROL ---
  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      setInput(""); 
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  // --- AVATAR SESSION CONTROLS ---
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

  // --- CHAT & GEMINI PIPELINE ---
  const sendMessage = async () => {
    if (!input.trim() || isChatting) return;

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

  // --- COMPONENT CLEANUP ---
  useEffect(() => {
    return () => {
      if (avatarRef.current) {
        avatarRef.current.stop().catch(console.error);
      }
      // Stop the webcam if they navigate away
      if (userVideoRef.current && userVideoRef.current.srcObject) {
         const stream = userVideoRef.current.srcObject as MediaStream;
         stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-950 text-white font-sans">
      <h1 className="text-4xl font-bold mb-6 text-cyan-400">Mock Live Interview</h1>

      {/* --- VIDEO UI CONTAINER --- */}
      <div className="w-full max-w-3xl aspect-video bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-6 relative flex items-center justify-center shadow-2xl">
        
        {/* The HeyGen Avatar */}
        <video 
          id="avatar-video"
          autoPlay 
          playsInline 
          // Note: scale-110 and translate-y-4 creates the "News Anchor" zoom effect
          className={`w-full h-full object-cover scale-110 translate-y-4 ${sessionActive ? 'block' : 'hidden'}`}
        >
          <track kind="captions" />
        </video>

        {/* Live Metrics Dashboard */}
        {sessionActive && (
          <div className="absolute top-4 left-4 bg-gray-900/80 backdrop-blur-sm border border-gray-700 p-3 rounded-lg z-20 transition-all">
            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Live Metrics</p>
            <div className="flex items-center gap-2">
              <span className="text-lg">🗣️</span>
              <div>
                <p className="text-sm text-white">Filler Words: <span className={fillerCount > 5 ? "text-red-400 font-bold" : "text-green-400 font-bold"}>{fillerCount}</span></p>
              </div>
            </div>
          </div>
        )}

        {/* User Local Camera (Picture in Picture) */}
        <div className="absolute bottom-4 right-4 w-48 aspect-video bg-black rounded-lg overflow-hidden border-2 border-gray-700 shadow-xl z-20 group">
          
          {/* Always render button, hide when active */}
          <button 
            onClick={startUserCamera}
            className={`w-full h-full flex flex-col items-center justify-center bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 font-bold transition-colors ${userVideoActive ? 'hidden' : 'flex'}`}
          >
            <span className="text-xl mb-1">📷</span>
            Enable Camera
          </button>
          
          {/* Always render video, hide when inactive */}
          <video 
            ref={userVideoRef}
            autoPlay 
            playsInline 
            muted // Keep muted so we don't cause an echo loop!
            className={`w-full h-full object-cover transform -scale-x-100 ${userVideoActive ? 'block' : 'hidden'}`} 
          />
        </div>

        {/* Start/End Interview Overlays */}
        {!sessionActive && (
          <div className="absolute z-10 flex flex-col items-center gap-4">
            <p className="text-gray-400">Video feed offline.</p>
            <button 
              onClick={startAvatarSession}
              disabled={isAvatarStarting}
              className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-6 rounded-lg transition-colors shadow-lg shadow-cyan-900/50 disabled:opacity-50"
            >
              {isAvatarStarting ? "Booting up Avatar..." : "Start Interview"}
            </button>
          </div>
        )}

        {sessionActive && (
          <button 
            onClick={stopAvatarSession}
            className="absolute top-4 right-4 bg-red-600/80 hover:bg-red-500 text-white text-sm font-bold py-2 px-4 rounded-lg backdrop-blur-sm transition-colors z-20"
          >
            End Interview
          </button>
        )}
      </div>

      {/* --- CHAT INTERFACE --- */}
      <div className="w-full max-w-3xl flex flex-col gap-4">
        {/* Chat History */}
        <div className="h-40 overflow-y-auto bg-gray-900 border border-gray-800 rounded-lg p-4 flex flex-col gap-2 shadow-inner">
          {messages.map((msg, idx) => (
            <div key={idx} className={`p-3 rounded-lg max-w-[85%] ${msg.role === "user" ? "bg-cyan-900/50 border border-cyan-800 self-end" : "bg-gray-800 border border-gray-700 self-start"}`}>
              <span className="font-bold text-[10px] uppercase tracking-wider text-gray-400 block mb-1">
                {msg.role === "user" ? "You" : "Interviewer"}
              </span>
              <span className="text-sm text-gray-100">{msg.text}</span>
            </div>
          ))}
          {messages.length === 0 && <p className="text-gray-600 text-sm italic text-center mt-4">Conversation history will appear here...</p>}
        </div>

        {/* Input Bar */}
        <div className="flex gap-2">
          {/* Microphone Button */}
          <button
            onClick={toggleListening}
            disabled={!sessionActive || isChatting}
            className={`flex items-center justify-center px-5 rounded-lg transition-all duration-300 disabled:opacity-50 ${
              isListening ? "bg-red-600 hover:bg-red-500 animate-pulse shadow-lg shadow-red-900/50" : "bg-gray-800 border border-gray-700 hover:bg-gray-700"
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
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg p-4 text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
            disabled={!sessionActive || isChatting}
          />
          
          <button 
            onClick={sendMessage}
            disabled={!sessionActive || isChatting || (!input.trim() && !isListening)}
            className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-4 px-8 rounded-lg transition-colors shadow-lg shadow-cyan-900/50 disabled:opacity-50"
          >
            {isChatting ? "Thinking..." : "Send"}
          </button>
        </div>
      </div>
    </main>
  );
}
