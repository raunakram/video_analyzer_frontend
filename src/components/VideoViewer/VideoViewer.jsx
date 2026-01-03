import React, { useState } from 'react'
import './VideoViewer.css'
import TrailerChat from '../TrailerChat/TrailerChat'
import apiRoutes  from "../../apiRoute"


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
  const [inputUrl, setInputUrl] = useState('')
  const [url, setUrl] = useState('')

  function loadUrl(e) {
    e.preventDefault()
    setUrl(inputUrl.trim())
  }

  const id = extractYouTubeId(url)
  const src = id ? `https://www.youtube.com/embed/${id}` : ''

  return (
    <div className="component-root">
      <h2>YouTube Video Viewer</h2>
      <form onSubmit={loadUrl} className="url-form">
        <input
          type="text"
          placeholder="Paste a YouTube URL (https://...)"
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          className="url-input"
        />
        <button type="submit" className="btn">Load</button>
        <button type="button" className="btn" onClick={() => { setInputUrl(''); setUrl('') }}>Clear</button>
      </form>

      {!url && <p className="hint">Paste a YouTube URL above to view the video.</p>}
      {url && !id && <p className="hint error">Invalid YouTube URL — please check and try again.</p>}

      {id && (
        <div className="video-wrapper">
          <iframe
            src={src}
            title="YouTube video player"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="responsive-iframe"
          />
        </div>
      )}
      {/* {id && ( */}
        <TrailerChat
          wsUrl={`${apiRoutes.chatUrl}/session123`}
        />
      {/* )} */}
    </div>
  )
}
