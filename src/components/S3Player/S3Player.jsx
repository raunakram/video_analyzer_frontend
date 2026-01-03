import React, { useEffect, useState } from "react"
import TrailerChat from "../TrailerChat/TrailerChat"
import "./S3Player.css"

const API_BASE = "http://35.175.97.228:8000/api/v1"

export default function S3Player() {
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedVideo, setSelectedVideo] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [error, setError] = useState(null)

  // Fetch S3 video list on load
  useEffect(() => {
    async function fetchVideos() {
      try {
        const res = await fetch(`${API_BASE}/list-all-s3-objects`)
        const data = await res.json()
        setVideos(data.objects || [])
      } catch (err) {
        setError("Failed to load S3 videos")
      }
    }

    fetchVideos()
  }, [])

  // Handle click on video
  async function handleVideoSelect(video) {
    setSelectedVideo(video)
    setSessionId(null)
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(
        `${API_BASE}/summarize-video/from-s3?s3_key=${encodeURIComponent(
          video.s3_key
        )}`,
        {
          method: "POST",
        }
      )

      if (!res.ok) {
        throw new Error("Summary API failed")
      }

      const data = await res.json()
      setSessionId(data.session_id)
    } catch (err) {
      setError("Failed to summarize video")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="component-root">
      <h2>S3 Video Library</h2>

      {error && <p className="error">{error}</p>}

      {/* Video List */}
      <div className="video-list-wrapper">
        {videos.length === 0 && <p>No videos found in S3</p>}

        <ul className="video-list">
          {videos.map((video) => (
            <li key={video.s3_key}>
              <button
                className="video-item"
                onClick={() => handleVideoSelect(video)}
              >
                {video.s3_key.split("/").pop()}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Video Player */}
      {selectedVideo && (
        <div className="video-player-wrapper">
          <h3>Now Playing</h3>
          <video controls className="responsive-video">
            <source src={selectedVideo.download_url} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        </div>
      )}

      {/* Loading Indicator */}
      {loading && <p className="loading">Generating summary…</p>}

      {/* Chat */}
      {sessionId && (
        <TrailerChat
          wsUrl={`ws://35.175.97.228:8000/api/v1/ws/chat/${sessionId}`}
        />
      )}
    </div>
  )
}
