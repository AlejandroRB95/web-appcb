import { Amplify } from "aws-amplify";
import "./App.css";
import { withAuthenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import { list, uploadData, getUrl, downloadData, isCancelError } from "@aws-amplify/storage";

import awsExports from "./aws-exports";
import { useEffect, useState, useRef } from "react";
Amplify.configure(awsExports);

function App({ signOut, user }) {
  const [fileData, setFileData] = useState(null);
  const [fileStatus, setFileStatus] = useState(false);
  const [fileList, setFileList] = useState([]);
  const [originalFileList, setOriginalFileList] = useState([]);
  const [downloadProgress, setDownloadProgress] = useState({});
  const [downloadTasks, setDownloadTasks] = useState({});
  const [dragging, setDragging] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropRef = useRef(null);

  // 📌 Formatear fecha
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  // 📌 Formatear tamaño del archivo
  const formatSize = (size) => {
    return size > 1024 * 1024
      ? `${(size / (1024 * 1024)).toFixed(2)} MB`
      : `${(size / 1024).toFixed(2)} KB`;
  };

  // 📌 Subir archivos
  const uploadFile = async (file) => {
    try {
      if (!file) {
        console.error("No file selected");
        return;
      }

      const result = await uploadData({
        key: `public/${file.name}`,
        data: file,
        options: { contentType: file.type },
      });

      setFileStatus(true);
      console.log("Upload success:", result);

      fetchFiles();
    } catch (error) {
      console.error("Upload failed:", error);
    }
  };

  // 📌 Obtener lista de archivos de S3
  const fetchFiles = async () => {
    try {
      const result = await list({ path: "public/" });
      setFileList(result.items);
      setOriginalFileList(result.items);
    } catch (error) {
      console.error("Error fetching file list:", error);
    }
  };

  // 📌 Buscar archivos
  const handleSearch = (event) => {
    const term = event.target.value.toLowerCase();
    setSearchTerm(term);

    if (term === '') {
      setFileList(originalFileList);
    } else {
      const filteredFiles = originalFileList.filter(file => 
        file.path.toLowerCase().includes(term)
      );
      setFileList(filteredFiles);
    }
  };

  // 📌 Descargar archivo desde S3 (abre en el navegador)
  const downloadFile = async (fileKey) => {
    try {
      const url = await getUrl({ key: fileKey });
      window.open(url, "_blank");
    } catch (error) {
      console.error("Error getting file URL:", error);
    }
  };

  // 📌 Descargar archivo en memoria con opción de cancelar
  const downloadFileToMemory = async (fileKey) => {
    try {
      const task = downloadData({
        path: fileKey,
        options: {
          onProgress: (progress) => {
            const percent = ((progress.transferredBytes / progress.totalBytes) * 100).toFixed(2);
            setDownloadProgress((prev) => ({ ...prev, [fileKey]: percent }));
            console.log(`Download progress: ${percent}%`);
          },
        },
      });

      setDownloadTasks((prev) => ({ ...prev, [fileKey]: task }));

      const { body, eTag } = await task.result;
      console.log("File downloaded to memory:", eTag);

      const blob = new Blob([body], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileKey.split("/").pop();
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setDownloadProgress((prev) => ({ ...prev, [fileKey]: null }));
      setDownloadTasks((prev) => ({ ...prev, [fileKey]: null }));
    } catch (error) {
      if (isCancelError(error)) {
        console.log(`Download canceled: ${fileKey}`);
        setDownloadProgress((prev) => ({ ...prev, [fileKey]: "Canceled" }));
      } else {
        console.error("Error downloading file to memory:", error);
      }
    }
  };

  // 📌 Cancelar descarga en curso
  const cancelDownload = (fileKey) => {
    if (downloadTasks[fileKey]) {
      downloadTasks[fileKey].cancel();
    }
  };

  // 📌 Drag & Drop - Arrastrar sobre el área
  const handleDragOver = (event) => {
    event.preventDefault();
    setDragging(true);
  };

  // 📌 Drag & Drop - Dejar el área de arrastre
  const handleDragLeave = () => {
    setDragging(false);
  };

  // 📌 Drag & Drop - Soltar archivo
  const handleDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
      setFileData(files[0]);
      uploadFile(files[0]); // Subir archivo al soltarlo
    }
  };

  // 📌 Cargar archivos al inicio
  useEffect(() => {
    fetchFiles();
  }, []);

  return (
    <div className="App">
      <div className="sign-out-container">
        <button onClick={signOut}>Sign out</button>
      </div>
      <h1>CITY BOX TECHNOLOGY 📦 </h1>

      {/* 📌 Drag & Drop Area */}
      <div
        ref={dropRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`drop-area ${dragging ? "dragging" : ""}`}
      >
        {dragging ? "Drop your file here..." : "Arrastra y suelta tus archivos aquí"}
      </div>

      <div className="file-upload-container">
        <input type="file" onChange={(e) => setFileData(e.target.files[0])} />
        <button onClick={() => uploadFile(fileData)}>Upload file</button>
      </div>
      {fileStatus && <p>File uploaded successfully</p>}

      {/* 📌 Barra de búsqueda */}
      <div className="search-container">
        <input 
          type="text" 
          placeholder="Search files..." 
          value={searchTerm}
          onChange={handleSearch}
          className="search-input"
        />
      </div>

      <h2>Uploaded Files:</h2>
      {fileList.length === 0 ? (
        <p>No files found.</p>
      ) : (
        <ul>
          {fileList.map((file, index) => (
            <li key={index}>
              <strong>{file.path}</strong> <br />
              📅 Last Modified: {formatDate(file.lastModified)} <br />
              📦 Size: {formatSize(file.size)} <br />
              <button onClick={() => downloadFileToMemory(file.path)}>Download File</button>
              {downloadProgress[file.path] && <p>Downloading: {downloadProgress[file.path]}%</p>}
              {downloadTasks[file.path] && <button onClick={() => cancelDownload(file.path)}>Cancel</button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default withAuthenticator(App);