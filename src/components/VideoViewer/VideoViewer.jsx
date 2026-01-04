import { useState } from "react"
import apiRoutes from "../../apiRoute"
import TrailerChat from "../TrailerChat/TrailerChat"
import "./VideoViewer.css"

function extractYouTubeId(url) {
  if (!url) return null

  const patterns = [
    /(?:youtu\.be\/)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/watch\?v=)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
    /[?&]v=([A-Za-z0-9_-]{11})/
  ]

  for (const p of patterns) {
    const m = url.match(p)
    if (m && m[1]) return m[1]
  }

  return null
}

export default function VideoViewer() {
  const [inputUrl, setInputUrl] = useState("")
  const [url, setUrl] = useState("")
  const [sessionId, setSessionId] = useState(null)
  const [loading, setLoading] = useState(false)

  async function loadUrl(e) {
    e.preventDefault()

    const cleanUrl = inputUrl.trim()
    if (!cleanUrl) return

    setUrl(cleanUrl)
    setLoading(true)
    setSessionId(null)

    try {
      const formData = new FormData()
      formData.append("youtube_url", cleanUrl)

      const res = await fetch(apiRoutes.summarizeYoutubeVideo, {
        method: "POST",
        body: formData
      })

      if (!res.ok) {
        throw new Error("Failed to summarize video")
      }

      const data = await res.json()
      setSessionId(data.session_id)
    } catch (err) {
      console.error(err)
      alert("Failed to process video")
    } finally {
      setLoading(false)
    }
  }

  const id = extractYouTubeId(url)
  const src = id ? `https://www.youtube.com/embed/${id}` : ""

  return (
    <div className="video-viewer-root">
      <h2>YouTube Video Viewer</h2>

      <form onSubmit={loadUrl} className="url-form">
        <input
          type="text"
          placeholder="Paste a YouTube URL"
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
        />
        <button type="submit" disabled={loading}>
          {loading ? "Processing..." : "Load"}
        </button>
      </form>

      {id && (
        <div className="video-container">
          <iframe
            src={src}
            title="YouTube player"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      {loading && <p className="loading-text">Analyzing video…</p>}

      {sessionId && (
        <div className="chat-container">
          <TrailerChat wsUrl={`${apiRoutes.chatUrl}/${sessionId}`} />
        </div>
      )}
    </div>
  )
}
