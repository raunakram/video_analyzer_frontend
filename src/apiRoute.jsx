const VITE_WS_BASE_URL = "wss://api-videoanalyzer.duckdns.org/api/v1";
const VITE_BASE_URL = "https://api-videoanalyzer.duckdns.org/api/v1";


const apiRoutes = {
  listS3Objects: `${VITE_BASE_URL}/list-all-s3-objects`,
  summarizeVideo: `${VITE_BASE_URL}/summarize-video/from-s3`,
  uploadToS3: `${VITE_BASE_URL}/upload-to-s3`,
  chatUrl: `${VITE_WS_BASE_URL}/ws/chat`,
};

export default apiRoutes;
