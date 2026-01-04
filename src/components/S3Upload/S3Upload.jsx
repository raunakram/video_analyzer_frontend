import { useState } from 'react'
import axios from 'axios'
import './S3Upload.css'
import apiRoutes  from "../../apiRoute"


export default function S3Upload() {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [publicUrl, setPublicUrl] = useState('')

  const handleFileChange = (e) => setFile(e.target.files[0] || null)

  const handleUpload = async () => {
    if (!file) return setError('Please select a file to upload')
    setError('')
    setUploading(true)
    setProgress(0)
    setPublicUrl('')

    try {
      const fd = new FormData()
      fd.append('file', file, file.name)

      const url = `${apiRoutes.uploadToS3}`

      const resp = await axios.post(url, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100))
        },
      })

      const data = resp && resp.data ? resp.data : {}
      const downloadUrl = data.download_url || data.downloadUrl || data.publicUrl || ''
      setPublicUrl(downloadUrl)
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Upload error')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="s3upload-root">
      <h2>Upload video to S3</h2>
      <div className="s3upload-controls">
        <input type="file" accept="video/*" onChange={handleFileChange} />
        <button onClick={handleUpload} disabled={uploading || !file}>
          {uploading ? `Uploading (${progress}%)` : 'Upload'}
        </button>
      </div>

      {uploading && (
        <div className="s3upload-progress">
          <div className="s3upload-progress-bar" style={{ width: `${progress}%` }} />
        </div>
      )}

      {error && <div className="s3upload-error">Error: {error}</div>}

      {publicUrl && (
        <div className="s3upload-success">
          Uploaded! Public URL: <a href={publicUrl} target="_blank" rel="noreferrer">{publicUrl}</a>
        </div>
      )}
    </div>
  )
}
