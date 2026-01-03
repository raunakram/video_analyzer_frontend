import React, { useEffect, useRef, useState } from 'react'

export default function TrailerChat({ wsUrl = "ws://35.175.97.228:8000/api/v1/ws/chat/session1234" }) {
  const ws = useRef(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState("")

  useEffect(() => {
    ws.current = new WebSocket(wsUrl)

    ws.current.onopen = () => {
      try { console.debug('TrailerChat websocket open', wsUrl) } catch (e) {}
    }

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        const text = data.message ?? event.data
        setMessages(prev => [...prev, { role: 'assistant', text }])
      } catch (err) {
        setMessages(prev => [...prev, { role: 'assistant', text: event.data }])
      }
    }

    ws.current.onclose = () => {
      try { console.debug('TrailerChat websocket closed') } catch (e) {}
    }

    return () => {
      try { ws.current && ws.current.close() } catch (e) {}
    }
  }, [wsUrl])

  const send = () => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) return
    ws.current.send(input)
    setMessages(prev => [...prev, { role: 'user', text: input }])
    setInput("")
  }

  return (
    <div style={{ border: '1px solid #e6e6e6', padding: 10, borderRadius: 6, marginTop: 12 }}>
      <div style={{ maxHeight: 160, overflowY: 'auto', marginBottom: 8 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 6 }}>
            <strong>{m.role}:</strong> {m.text}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message"
          style={{ flex: 1, padding: '6px 8px' }}
        />
        <button onClick={send}>Send</button>
      </div>
    </div>
  )
}
