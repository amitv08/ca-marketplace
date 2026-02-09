import React from 'react';

interface RejectionEntry {
  caId: string;
  caName: string;
  reason: string;
  rejectedAt: string;
}

interface RejectionHistoryProps {
  history: RejectionEntry[];
  reopenedCount: number;
}

const RejectionHistory: React.FC<RejectionHistoryProps> = ({ history, reopenedCount }) => {
  if (!history || history.length === 0) {
    return null;
  }

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-yellow-600"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <h3 className="text-sm font-semibold text-yellow-800">
            Rejection History
          </h3>
        </div>
        {reopenedCount > 0 && (
          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full font-medium">
            Reopened {reopenedCount}x
          </span>
        )}
      </div>

      <div className="space-y-3">
        {history.map((entry, index) => (
          <div
            key={index}
            className="bg-white border border-yellow-200 rounded-md p-3"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-medium text-gray-900">{entry.caName}</p>
                  <span className="text-xs text-gray-500">
                    #{index + 1}
                  </span>
                </div>
                <p className="text-sm text-gray-700 mb-2">
                  <span className="font-medium">Reason:</span> {entry.reason}
                </p>
                <p className="text-xs text-gray-500">
                  Rejected on {new Date(entry.rejectedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {history.length > 1 && (
        <div className="mt-3 p-2 bg-yellow-100 rounded text-xs text-yellow-800">
          <strong>Note:</strong> This request has been rejected {history.length} time(s).
          Consider reviewing the requirements or contacting support.
        </div>
      )}
    </div>
  );
};

export default RejectionHistory;
