import React, { useEffect, useRef, useState } from 'react'

export default function TrailerChat({ wsUrl }) {
  const ws = useRef(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState("")
  const [isConnected, setIsConnected] = useState(false)
  
  console.log(wsUrl, "wsurl")

  useEffect(() => {
    if (ws.current) {
      console.log("WebSocket already exists, skipping creation")
      return
    }

    console.log("Creating new WebSocket connection to:", wsUrl)
    ws.current = new WebSocket(wsUrl)

    ws.current.onopen = () => {
      console.log('TrailerChat websocket open', wsUrl)
      setIsConnected(true)
    }

    ws.current.onmessage = (event) => {
      console.log('Message received:', event.data)
      try {
        const data = JSON.parse(event.data)
        const text = data.message ?? event.data
        setMessages(prev => [...prev, { role: 'assistant', text }])
      } catch (err) {
        setMessages(prev => [...prev, { role: 'assistant', text: event.data }])
      }
    }

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error)
    }

    ws.current.onclose = (event) => {
      console.log('TrailerChat websocket closed', event.code, event.reason)
      setIsConnected(false)
      ws.current = null // CRITICAL: Reset ref on close
    }

    // Cleanup function
    return () => {
      console.log('Cleaning up WebSocket')
      if (ws.current) {
        ws.current.close()
        ws.current = null
      }
    }
  }, [wsUrl])

  const send = () => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      console.warn('Cannot send - WebSocket not open')
      return
    }
    console.log('Sending message:', input)
    ws.current.send(input)
    setMessages(prev => [...prev, { role: 'user', text: input }])
    setInput("")
  }

  const handleKeyDown = (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()

    if (!input.trim()) return
    send()
  }
}


  return (
    <div style={{ border: '1px solid #de26c9ff', padding: 10, borderRadius: 6, marginTop: 12 }}>
      <div style={{ marginBottom: 8, fontSize: '12px', color: isConnected ? 'green' : 'red' }}>
        Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
      </div>
      
      <div style={{ 
              maxHeight: 160,
              overflowY: 'auto',
              marginBottom: 8,
              border: '1px solid #1bc8dfff',
              padding: 8,
              display: 'flex',          
              flexDirection: 'column',  
              gap: 6                    
            }}>

        {messages.length === 0 && (
          <div style={{ color: '#ef7a7aff', fontStyle: 'italic' }}>
            Waiting for messages...
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ 
            padding: '6px 10px',
            backgroundColor: m.role === 'user' ? '#4730dcff' : '#18dc5dff',
            borderRadius: 6,
            width: 'fit-content',        
            maxWidth: '80%',            
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            wordBreak: 'break-word',
            whiteSpace: 'normal'
          }}>
            <strong>{m.role}:</strong> {m.text}
          </div>
        ))}
      </div>
      
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message"
          style={{ flex: 1, padding: '6px 8px' }}
          disabled={!isConnected}
        />
        <button onClick={send} disabled={!isConnected || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  )
}