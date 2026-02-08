import React from 'react';

interface FilePreviewProps {
  file?: File;
  url?: string;
  name?: string;
  size?: number;
  onRemove?: () => void;
}

const FilePreview: React.FC<FilePreviewProps> = ({ file, url, name, size, onRemove }) => {
  const fileName = file?.name || name || 'Unknown file';
  const fileSize = file?.size || size || 0;

  // Construct full URL for backend files or create object URL for local files
  const getFileUrl = () => {
    if (file) return URL.createObjectURL(file);
    if (!url) return '';
    // If URL is already absolute, use it; otherwise prepend backend URL
    if (url.startsWith('http')) return url;
    const backendUrl = process.env.REACT_APP_API_URL || 'http://localhost:8081';
    return `${backendUrl}${url}`;
  };

  const fileUrl = getFileUrl();

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Get file icon based on extension
  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf':
        return '📄';
      case 'doc':
      case 'docx':
        return '📝';
      case 'xls':
      case 'xlsx':
        return '📊';
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return '🖼️';
      case 'zip':
      case 'rar':
        return '🗜️';
      default:
        return '📎';
    }
  };

  // Check if file is an image
  const isImage = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '');
  };

  return (
    <div className="relative inline-block mr-2 mb-2">
      {isImage(fileName) && fileUrl ? (
        <div className="relative group">
          <img
            src={fileUrl}
            alt={fileName}
            className="w-24 h-24 object-cover rounded-lg border border-gray-300"
          />
          {onRemove && (
            <button
              onClick={onRemove}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors"
              type="button"
            >
              ×
            </button>
          )}
          <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 rounded-b-lg truncate">
            {fileName}
          </div>
        </div>
      ) : (
        <div className="flex items-center bg-gray-100 border border-gray-300 rounded-lg p-3 max-w-xs">
          <span className="text-2xl mr-3">{getFileIcon(fileName)}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{fileName}</p>
            <p className="text-xs text-gray-500">{formatSize(fileSize)}</p>
          </div>
          {onRemove ? (
            <button
              onClick={onRemove}
              className="ml-3 text-red-500 hover:text-red-700 font-bold"
              type="button"
            >
              ×
            </button>
          ) : url ? (
            <a
              href={url}
              download={fileName}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-3 text-blue-500 hover:text-blue-700"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </a>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default FilePreview;
