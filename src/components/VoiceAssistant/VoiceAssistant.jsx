import React, { useEffect, useRef, useState, useCallback } from 'react';

export default function VoiceAssistant({
  sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  wsUrl = "ws://35.175.97.228:8000/api/v1/ws/voice-chat"
}) {
  const ws = useRef(null);
  const recognition = useRef(null);
  const synth = useRef(typeof window !== 'undefined' ? window.speechSynthesis : null);
  const mediaStream = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const isMountedRef = useRef(true);
  const recognitionActiveRef = useRef(false);

  const [messages, setMessages] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [error, setError] = useState("");
  const [interviewStage, setInterviewStage] = useState("connecting");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isManualReconnect, setIsManualReconnect] = useState(false);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [useTextInput, setUseTextInput] = useState(false); // Fallback for speech recognition
  const [textInput, setTextInput] = useState("");

  // Initialize on component mount
  useEffect(() => {
    isMountedRef.current = true;
    
    // Check if we're on HTTPS
    if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost') {
      setError("⚠️ Speech recognition works better with HTTPS. For testing, use Chrome with: chrome://flags/#unsafely-treat-insecure-origin-as-secure");
    }
    
    // Initialize speech recognition (only if supported)
    if (isSpeechRecognitionSupported()) {
      initSpeechRecognition();
    } else {
      setUseTextInput(true);
      setError("Speech recognition not supported in this browser. Using text input instead.");
    }
    
    // Connect WebSocket
    connectWebSocket();
    
    return () => {
      isMountedRef.current = false;
      
      // Clear any pending reconnection
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      // Cleanup WebSocket
      if (ws.current) {
        ws.current.onopen = null;
        ws.current.onmessage = null;
        ws.current.onerror = null;
        ws.current.onclose = null;
        if (ws.current.readyState === WebSocket.OPEN) {
          ws.current.close();
        }
      }
      
      // Cleanup speech recognition
      if (recognition.current) {
        try {
          recognition.current.stop();
        } catch (e) {
          // Ignore errors
        }
        recognition.current = null;
      }
      
      // Cleanup speech synthesis
      if (synth.current && synth.current.speaking) {
        synth.current.cancel();
      }
      
      // Cleanup media stream
      if (mediaStream.current) {
        mediaStream.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Check if speech recognition is supported
  const isSpeechRecognitionSupported = () => {
    if (typeof window === 'undefined') return false;
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
  };

  // Initialize speech recognition
  const initSpeechRecognition = () => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setUseTextInput(true);
      setError("Speech recognition not available. Using text input.");
      return;
    }

    const recognitionInstance = new SpeechRecognition();
    recognitionInstance.continuous = false;
    recognitionInstance.interimResults = true;
    recognitionInstance.lang = 'en-US';
    recognitionInstance.maxAlternatives = 1;

    recognitionInstance.onstart = () => {
      console.log("🎤 Recording started");
      setIsRecording(true);
      recognitionActiveRef.current = true;
      setError("");
    };

    recognitionInstance.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      setTranscript(interimTranscript);

      if (finalTranscript) {
        console.log("✅ Final transcript:", finalTranscript);
        sendMessage(finalTranscript.trim());
        setTranscript("");
      }
    };

    recognitionInstance.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      recognitionActiveRef.current = false;
      
      // Don't show error for 'no-speech' - it's normal when user doesn't speak
      if (event.error === 'no-speech' || event.error === 'aborted') {
        setIsRecording(false);
        return;
      }
      
      if (event.error === 'network') {
        console.warn("Network error in speech recognition. This might be due to HTTPS requirement.");
        setError("Network error in speech recognition. Try using text input or enable HTTPS.");
        setUseTextInput(true); // Auto-fallback to text input
      } else if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        setError("Microphone permission denied. Please allow access or use text input.");
        setUseTextInput(true); // Auto-fallback to text input
      } else if (event.error !== 'no-speech') {
        setError(`Voice input error: ${event.error}. Try using text input.`);
      }
      
      setIsRecording(false);
    };

    recognitionInstance.onend = () => {
      console.log("⏹️ Recording ended");
      setIsRecording(false);
      recognitionActiveRef.current = false;
    };

    recognition.current = recognitionInstance;
  };

  // Connect to WebSocket
  const connectWebSocket = useCallback(() => {
    if (!isMountedRef.current) return;
    
    // Clear any existing timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    // Close existing connection if any
    if (ws.current) {
      ws.current.onopen = null;
      ws.current.onmessage = null;
      ws.current.onerror = null;
      ws.current.onclose = null;
      if (ws.current.readyState === WebSocket.OPEN) {
        ws.current.close();
      }
    }
    
    try {
      const fullWsUrl = `${wsUrl}/${sessionId}`;
      console.log(`🌐 Connecting to: ${fullWsUrl}`);
      
      ws.current = new WebSocket(fullWsUrl);
      
      ws.current.onopen = () => {
        if (!isMountedRef.current) return;
        console.log("✅ WebSocket connected");
        setIsConnected(true);
        setError("");
        setConnectionAttempts(0);
        setInterviewStage("connected");
        setIsManualReconnect(false);
      };

      ws.current.onmessage = (event) => {
        if (!isMountedRef.current) return;
        console.log("📥 Received from server:", event.data);
        
        try {
          const data = JSON.parse(event.data);
          const messageType = data.type || "response";
          const messageText = data.message || "No message content";
          
          console.log(`📊 Message type: ${messageType}, text: ${messageText.substring(0, 100)}...`);
          
          switch(messageType) {
            case "question":
              setInterviewStage("question");
              setCurrentQuestionIndex(prev => prev + 1);
              setMessages(prev => [...prev, { 
                role: "assistant", 
                text: messageText,
                type: "question",
                timestamp: new Date().toISOString()
              }]);
              
              if (autoSpeak) {
                speak(messageText);
              }
              break;
              
            case "response":
              setInterviewStage("response");
              setMessages(prev => [...prev, { 
                role: "assistant", 
                text: messageText,
                type: "response",
                timestamp: new Date().toISOString()
              }]);
              
              if (autoSpeak) {
                speak(messageText);
              }
              break;
              
            case "complete":
              setInterviewStage("complete");
              setMessages(prev => [...prev, { 
                role: "assistant", 
                text: messageText,
                type: "complete",
                timestamp: new Date().toISOString()
              }]);
              
              if (autoSpeak) {
                speak(messageText);
              }
              break;
              
            case "error":
              console.error("❌ Server error:", messageText);
              if (!error) {
                setError(`Server: ${messageText}`);
              }
              break;
              
            default:
              setMessages(prev => [...prev, { 
                role: "assistant", 
                text: messageText,
                timestamp: new Date().toISOString()
              }]);
              
              if (autoSpeak) {
                speak(messageText);
              }
          }
        } catch (parseError) {
          console.error("Failed to parse server response:", parseError);
          console.log("Raw response:", event.data);
        }
      };

      ws.current.onerror = (e) => {
        if (!isMountedRef.current) return;
        console.error("❌ WebSocket error event:", e);
        setIsConnected(false);
        setInterviewStage("error");
        setConnectionAttempts(prev => prev + 1);
        
        if (!error) {
          setError(`Connection error (attempt ${connectionAttempts + 1}/3). Please check server.`);
        }
      };

      ws.current.onclose = (e) => {
        if (!isMountedRef.current) return;
        console.log("🔌 WebSocket closed", e.code, e.reason);
        setIsConnected(false);
        setInterviewStage("disconnected");
        
        // Only auto-reconnect if it wasn't a manual close and we haven't exceeded attempts
        if (isMountedRef.current && !isManualReconnect && connectionAttempts < 3) {
          console.log(`🔄 Auto-reconnecting in 3 seconds (attempt ${connectionAttempts + 1}/3)...`);
          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              connectWebSocket();
            }
          }, 3000);
        } else if (connectionAttempts >= 3) {
          setError("Failed to connect after 3 attempts. Please check if the server is running.");
        }
      };
    } catch (err) {
      console.error("❌ Failed to create WebSocket:", err);
      if (isMountedRef.current) {
        setError(`Connection failed: ${err.message}`);
        setIsConnected(false);
        
        // Try to reconnect after delay if we haven't exceeded attempts
        if (connectionAttempts < 3) {
          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              connectWebSocket();
            }
          }, 3000);
        }
      }
    }
  }, [wsUrl, sessionId, autoSpeak, connectionAttempts]);

  // Send message to WebSocket
  const sendMessage = (text) => {
    if (!text.trim()) {
      setError("Please say something first");
      return;
    }

    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      setError("Not connected to server. Please wait...");
      return;
    }

    console.log("📤 Sending message to server:", text);
    
    // Add user message to UI immediately
    setMessages(prev => [...prev, { 
      role: "user", 
      text,
      timestamp: new Date().toISOString()
    }]);
    
    // Clear text input if using it
    if (useTextInput) {
      setTextInput("");
    }
    
    // Send as plain text
    try {
      ws.current.send(text);
      setError("");
    } catch (err) {
      console.error("Failed to send message:", err);
      setError("Failed to send message. Please try again.");
    }
  };

  // Text-to-speech
  const speak = (text) => {
    if (!synth.current || !text) return;
    
    if (synth.current.speaking) {
      synth.current.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onstart = () => {
      setIsSpeaking(true);
      console.log("🔊 Speaking:", text.substring(0, 50) + "...");
    };
    
    utterance.onend = () => {
      setIsSpeaking(false);
    };
    
    utterance.onerror = (e) => {
      setIsSpeaking(false);
      console.error("Speech synthesis error:", e);
    };

    synth.current.speak(utterance);
  };

  const stopSpeaking = () => {
    if (synth.current && synth.current.speaking) {
      synth.current.cancel();
      setIsSpeaking(false);
    }
  };

  // Recording functions
  const startRecording = async () => {
    if (interviewStage === "complete") {
      setError("Interview completed. No more questions.");
      return;
    }

    if (useTextInput) {
      setError("Using text input mode. Type your answer below and press Enter.");
      return;
    }

    if (!recognition.current) {
      setError("Voice input not available");
      return;
    }

    if (!isConnected) {
      setError("Please wait for connection...");
      return;
    }

    // If already recording, stop it
    if (isRecording) {
      stopRecording();
      return;
    }

    try {
      // Request microphone permission
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          mediaStream.current = await navigator.mediaDevices.getUserMedia({ 
            audio: {
              echoCancellation: true,
              noiseSuppression: true
            }
          });
        } catch (err) {
          console.warn("Could not get microphone:", err);
          // Don't fail hard - some browsers might still work
        }
      }

      setTranscript("");
      setError("");
      
      // Stop any existing recognition
      if (recognitionActiveRef.current) {
        try {
          recognition.current.stop();
        } catch (e) {
          // Ignore
        }
        // Small delay before starting new
        setTimeout(() => {
          try {
            recognition.current.start();
          } catch (err) {
            console.error("Failed to start recording:", err);
            setError("Failed to start recording. Please try again or use text input.");
            setUseTextInput(true);
          }
        }, 100);
      } else {
        try {
          recognition.current.start();
        } catch (err) {
          console.error("Failed to start recording:", err);
          setError("Failed to start recording. Please try again or use text input.");
          setUseTextInput(true);
        }
      }
      
    } catch (err) {
      console.error("Microphone error:", err);
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError("Microphone permission denied. Please allow access or use text input.");
        setUseTextInput(true);
      } else {
        setError("Microphone error: " + err.message);
      }
    }
  };

  const stopRecording = () => {
    if (recognition.current && recognitionActiveRef.current) {
      try {
        recognition.current.stop();
      } catch (err) {
        console.error("Error stopping recording:", err);
      }
    }
  };

  const handleReconnect = () => {
    setIsManualReconnect(true);
    setError("");
    setConnectionAttempts(0);
    connectWebSocket();
  };

  const resetConversation = () => {
    setMessages([]);
    setCurrentQuestionIndex(0);
    setInterviewStage("connected");
    setError("");
  };

  // Get status color based on stage
  const getStageColor = () => {
    switch(interviewStage) {
      case "complete": return "#10b981";
      case "question": return "#3b82f6";
      case "response": return "#f59e0b";
      case "connecting": return "#6b7280";
      case "connected": return "#22c55e";
      case "error": return "#ef4444";
      case "disconnected": return "#6b7280";
      default: return "#6b7280";
    }
  };

  // Handle text input submission
  const handleTextSubmit = (e) => {
    e.preventDefault();
    if (textInput.trim()) {
      sendMessage(textInput.trim());
    }
  };

  return (
    <div style={{
      maxWidth: 500,
      margin: "20px auto",
      padding: 20,
      border: "2px solid #e5e7eb",
      borderRadius: 12,
      fontFamily: "system-ui, -apple-system, sans-serif",
      backgroundColor: "#ffffff"
    }}>
      {/* Header */}
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16
      }}>
        <div>
          <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <span>🎙️</span> Video Interview Assistant
          </h3>
          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
            Mode: {useTextInput ? "Text Input" : "Voice Input"}
          </div>
        </div>
        <div style={{
          width: 12,
          height: 12,
          borderRadius: "50%",
          backgroundColor: isConnected ? "#22c55e" : "#ef4444"
        }} />
      </div>

      {/* Error Display */}
      {error && (
        <div style={{
          padding: 12,
          marginBottom: 12,
          backgroundColor: "#fee2e2",
          border: "1px solid #fca5a5",
          borderRadius: 8,
          color: "#991b1b",
          fontSize: 14
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <span style={{ fontSize: 16 }}>⚠️</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Notice</div>
              <div style={{ fontSize: 13 }}>{error}</div>
            </div>
            <button
              onClick={() => setError("")}
              style={{
                background: "none",
                border: "none",
                color: "#991b1b",
                cursor: "pointer",
                fontSize: 16,
                padding: 0,
                width: 24,
                height: 24
              }}
            >
              ✕
            </button>
          </div>
          {error.includes("HTTPS") && (
            <div style={{ marginTop: 8, fontSize: 12 }}>
              <a 
                href={`https://${window.location.host}${window.location.pathname}`}
                style={{ color: "#3b82f6", textDecoration: "underline" }}
              >
                Try HTTPS version
              </a>
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div style={{
        height: 260,
        overflowY: "auto",
        backgroundColor: "#f9fafb",
        padding: 12,
        borderRadius: 8,
        marginBottom: 12,
        border: "1px solid #e5e7eb"
      }}>
        {messages.length === 0 ? (
          <div style={{ 
            color: "#6b7280", 
            textAlign: "center",
            margin: "40px 0",
            fontSize: 14
          }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>
              {isConnected ? "🎤" : "🔌"}
            </div>
            <p style={{ margin: 0, fontWeight: 600 }}>
              {isConnected ? "Ready for Interview" : "Connecting..."}
            </p>
            <p style={{ margin: "4px 0", fontSize: 12 }}>
              {isConnected ? 
                (useTextInput ? "Type your answer below" : "Hold the button to answer") : 
                "Please wait for connection"}
            </p>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} style={{
              marginBottom: 10,
              padding: 10,
              borderRadius: 8,
              backgroundColor: m.role === "user" ? "#dbeafe" : "#ffffff",
              borderLeft: `4px solid ${m.role === "user" ? "#3b82f6" : 
                m.type === "question" ? "#10b981" : 
                m.type === "complete" ? "#8b5cf6" : "#f59e0b"}`
            }}>
              <div style={{ 
                fontSize: 11,
                fontWeight: 600,
                color: m.role === "user" ? "#1e40af" : 
                  m.type === "question" ? "#059669" :
                  m.type === "complete" ? "#7c3aed" : "#d97706",
                marginBottom: 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
              }}>
                <span>
                  {m.role === "user" ? "👤 You" : 
                   m.type === "question" ? "🤖 Question" :
                   m.type === "complete" ? "✅ Complete" : "💬 Response"}
                </span>
                <span style={{ fontWeight: 400, opacity: 0.7, fontSize: 10 }}>
                  {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.5 }}>{m.text}</div>
            </div>
          ))
        )}
      </div>

      {/* Live Transcript */}
      {transcript && !useTextInput && (
        <div style={{
          backgroundColor: "#fef3c7",
          padding: 10,
          borderRadius: 8,
          marginBottom: 12,
          fontSize: 14,
          border: "1px solid #fbbf24",
          display: "flex",
          alignItems: "center",
          gap: 8
        }}>
          <span style={{ fontSize: 16 }}>🎤</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>Listening...</div>
            <div>{transcript}</div>
          </div>
          <div style={{ 
            width: 20, 
            height: 20, 
            borderRadius: "50%", 
            backgroundColor: "#f59e0b",
            animation: "pulse 1.5s infinite"
          }} />
        </div>
      )}

      {/* Text Input (Fallback) */}
      {useTextInput && (
        <form onSubmit={handleTextSubmit} style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Type your answer here..."
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                fontSize: 14
              }}
              disabled={!isConnected || interviewStage === "complete"}
            />
            <button
              type="submit"
              disabled={!isConnected || interviewStage === "complete" || !textInput.trim()}
              style={{
                padding: "10px 20px",
                backgroundColor: isConnected ? "#3b82f6" : "#9ca3af",
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: isConnected ? "pointer" : "not-allowed",
                opacity: isConnected && textInput.trim() ? 1 : 0.7
              }}
            >
              Send
            </button>
          </div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
            Press Enter or click Send to submit your answer
          </div>
        </form>
      )}

      {/* Controls */}
      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        {!useTextInput ? (
          <button
            onClick={startRecording}
            disabled={!isConnected || interviewStage === "complete"}
            style={{
              flex: 1,
              padding: "14px 20px",
              fontSize: 16,
              fontWeight: 600,
              backgroundColor: isRecording ? "#ef4444" : 
                !isConnected ? "#9ca3af" :
                interviewStage === "complete" ? "#10b981" : "#3b82f6",
              color: "#ffffff",
              border: "none",
              borderRadius: 8,
              cursor: (isConnected && interviewStage !== "complete") ? "pointer" : "not-allowed",
              opacity: (isConnected && interviewStage !== "complete") ? 1 : 0.7,
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8
            }}
          >
            {!isConnected ? (
              <>
                <span>🔌</span> Connecting...
              </>
            ) : isRecording ? (
              <>
                <span>🔴</span> Click to Stop
              </>
            ) : interviewStage === "complete" ? (
              <>
                <span>✅</span> Interview Complete
              </>
            ) : (
              <>
                <span>🎤</span> Click to Speak
              </>
            )}
          </button>
        ) : (
          <button
            onClick={() => setUseTextInput(false)}
            style={{
              flex: 1,
              padding: "14px 20px",
              fontSize: 16,
              fontWeight: 600,
              backgroundColor: "#3b82f6",
              color: "#ffffff",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8
            }}
          >
            <span>🎤</span> Switch to Voice Input
          </button>
        )}

        <button
          onClick={stopSpeaking}
          disabled={!isSpeaking}
          style={{
            padding: "14px 20px",
            minWidth: 60,
            backgroundColor: isSpeaking ? "#f59e0b" : "#d1d5db",
            color: "#ffffff",
            border: "none",
            borderRadius: 8,
            cursor: isSpeaking ? "pointer" : "not-allowed",
            opacity: isSpeaking ? 1 : 0.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20
          }}
          title="Stop speaking"
        >
          {isSpeaking ? "🔊" : "🔇"}
        </button>
      </div>

      {/* Status Panel */}
      <div style={{ 
        padding: 12,
        backgroundColor: "#f3f4f6",
        borderRadius: 8,
        fontSize: 12,
        color: "#6b7280",
        border: "1px solid #e5e7eb",
        marginBottom: 8
      }}>
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "space-between",
          marginBottom: 8
        }}>
          <div style={{ 
            backgroundColor: getStageColor(), 
            color: "white",
            padding: "4px 8px",
            borderRadius: 4,
            fontWeight: 600,
            fontSize: 11
          }}>
            {interviewStage.toUpperCase()}
          </div>
          <div style={{ fontSize: 11 }}>
            Attempt: {connectionAttempts}/3
          </div>
        </div>
        
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "1fr 1fr", 
          gap: 8,
          fontSize: 11
        }}>
          <div>
            <div style={{ fontWeight: 600 }}>Connection</div>
            <div style={{ 
              color: isConnected ? "#059669" : "#dc2626",
              display: "flex",
              alignItems: "center",
              gap: 4
            }}>
              <div style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                backgroundColor: isConnected ? "#059669" : "#dc2626"
              }} />
              {isConnected ? "Connected" : "Disconnected"}
            </div>
          </div>
          
          <div>
            <div style={{ fontWeight: 600 }}>Question</div>
            <div>{currentQuestionIndex}/3</div>
          </div>
          
          <div>
            <div style={{ fontWeight: 600 }}>Input Mode</div>
            <div style={{ 
              color: useTextInput ? "#6b7280" : "#3b82f6",
              display: "flex",
              alignItems: "center",
              gap: 4
            }}>
              <div style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                backgroundColor: useTextInput ? "#6b7280" : "#3b82f6"
              }} />
              {useTextInput ? "Text" : "Voice"}
            </div>
          </div>
          
          <div>
            <div style={{ fontWeight: 600 }}>Speaker</div>
            <div style={{ 
              color: isSpeaking ? "#d97706" : "#6b7280",
              display: "flex",
              alignItems: "center",
              gap: 4
            }}>
              <div style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                backgroundColor: isSpeaking ? "#d97706" : "#6b7280"
              }} />
              {isSpeaking ? "Speaking" : "Silent"}
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={handleReconnect}
          style={{
            flex: 1,
            padding: "8px 12px",
            fontSize: 12,
            backgroundColor: "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6
          }}
        >
          <span>🔄</span> Reconnect
        </button>
        
        <button
          onClick={() => setAutoSpeak(!autoSpeak)}
          style={{
            flex: 1,
            padding: "8px 12px",
            fontSize: 12,
            backgroundColor: autoSpeak ? "#10b981" : "#6b7280",
            color: "white",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6
          }}
        >
          <span>🔊</span> {autoSpeak ? "Auto ON" : "Auto OFF"}
        </button>
        
        <button
          onClick={resetConversation}
          disabled={messages.length === 0}
          style={{
            flex: 1,
            padding: "8px 12px",
            fontSize: 12,
            backgroundColor: messages.length === 0 ? "#9ca3af" : "#6b7280",
            color: "white",
            border: "none",
            borderRadius: 6,
            cursor: messages.length === 0 ? "not-allowed" : "pointer",
            opacity: messages.length === 0 ? 0.5 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6
          }}
        >
          <span>🗑️</span> Clear
        </button>
      </div>

      {/* Help Text */}
      <div style={{ 
        marginTop: 12,
        padding: 8,
        backgroundColor: "#f0f9ff",
        borderRadius: 6,
        fontSize: 11,
        color: "#0369a1",
        border: "1px solid #bae6fd"
      }}>
        <strong>💡 Tips:</strong> {useTextInput ? 
          "Voice input requires HTTPS. For testing, use localhost or enable HTTPS." : 
          "Hold the microphone button to speak. Release to send."}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}