import { Link, Routes, Route } from 'react-router-dom'
import './App.css'
import VideoViewer from './components/VideoViewer/VideoViewer'
import S3Player from './components/S3Player/S3Player'
// import VoiceAssistant from './components/VoiceAssistant/VoiceAssistant'

function App() {
  return (
    <div>
      <h1>Video Tools</h1>
      <nav style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '1rem' }}>
        <Link to="/youtube">YouTube Viewer</Link>
        <Link to="/s3-uploader">S3 / Direct Video</Link>
        {/* <Link to="/voice">Voice Assistant</Link> */}
      </nav>

      <Routes>
        <Route path="/" element={<div style={{textAlign:'center'}}>Select a tool above.</div>} />
        <Route path="/youtube" element={<VideoViewer />} />
        <Route path="/s3-uploader" element={<S3Player />} />
        {/* <Route path="/voice" element={<VoiceAssistant />} /> */}
      </Routes>
    </div>
  )
}

export default App
