import React, { useState } from 'react';
import { serviceRequestService } from '../services';

export enum AbandonmentReason {
  EMERGENCY = 'EMERGENCY',
  ILLNESS = 'ILLNESS',
  OVERCOMMITTED = 'OVERCOMMITTED',
  PERSONAL_REASONS = 'PERSONAL_REASONS',
  TECHNICAL_ISSUES = 'TECHNICAL_ISSUES',
  CLIENT_UNRESPONSIVE = 'CLIENT_UNRESPONSIVE',
  OTHER = 'OTHER',
}

interface AbandonRequestDialogProps {
  requestId: string;
  requestStatus: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const AbandonRequestDialog: React.FC<AbandonRequestDialogProps> = ({
  requestId,
  requestStatus,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [reason, setReason] = useState<AbandonmentReason | ''>('');
  const [reasonText, setReasonText] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abandonmentReasons = [
    { value: AbandonmentReason.EMERGENCY, label: 'Emergency', description: 'Urgent personal or family emergency' },
    { value: AbandonmentReason.ILLNESS, label: 'Illness', description: 'Health issues preventing work' },
    { value: AbandonmentReason.OVERCOMMITTED, label: 'Overcommitted', description: 'Too many active projects' },
    { value: AbandonmentReason.PERSONAL_REASONS, label: 'Personal Reasons', description: 'Personal circumstances' },
    { value: AbandonmentReason.TECHNICAL_ISSUES, label: 'Technical Issues', description: 'Technology or infrastructure problems' },
    { value: AbandonmentReason.CLIENT_UNRESPONSIVE, label: 'Client Unresponsive', description: 'Cannot reach or get information from client' },
    { value: AbandonmentReason.OTHER, label: 'Other', description: 'Other reasons (please specify)' },
  ];

  const getReputationPenalty = () => {
    return requestStatus === 'IN_PROGRESS' ? 0.3 : 0.2;
  };

  const handleSubmit = async () => {
    if (!reason) {
      setError('Please select a reason for abandonment');
      return;
    }

    if (reason === AbandonmentReason.OTHER && !reasonText.trim()) {
      setError('Please provide details for "Other" reason');
      return;
    }

    setShowConfirmation(true);
  };

  const handleConfirm = async () => {
    setProcessing(true);
    setError(null);

    try {
      await serviceRequestService.abandonRequest(requestId, reason as string, reasonText);

      // Success
      if (onSuccess) {
        onSuccess();
      }
      handleClose();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to abandon request');
      setShowConfirmation(false);
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    setReason('');
    setReasonText('');
    setShowConfirmation(false);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={showConfirmation ? undefined : handleClose}
        />

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          {!showConfirmation ? (
            /* Step 1: Abandonment Form */
            <>
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <svg
                      className="h-6 w-6 text-red-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Abandon Service Request
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Abandoning this request will result in a{' '}
                        <strong className="text-red-600">-{getReputationPenalty()}</strong> reputation penalty
                        and the request will be reopened for other CAs to accept.
                      </p>
                    </div>

                    {error && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                        {error}
                      </div>
                    )}

                    {/* Abandonment Reason */}
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Reason for Abandonment <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={reason}
                        onChange={(e) => setReason(e.target.value as AbandonmentReason)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select a reason</option>
                        {abandonmentReasons.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                      {reason && (
                        <p className="mt-1 text-xs text-gray-500">
                          {abandonmentReasons.find((r) => r.value === reason)?.description}
                        </p>
                      )}
                    </div>

                    {/* Additional Details */}
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Additional Details {reason === AbandonmentReason.OTHER && <span className="text-red-500">*</span>}
                      </label>
                      <textarea
                        value={reasonText}
                        onChange={(e) => setReasonText(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Provide additional context about why you need to abandon this request..."
                      />
                    </div>

                    {/* Warning Box */}
                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                      <h4 className="text-sm font-semibold text-yellow-800 mb-1">Consequences:</h4>
                      <ul className="text-xs text-yellow-700 space-y-1">
                        <li>• Your reputation score will be reduced by {getReputationPenalty()}</li>
                        <li>• Abandonment count will be tracked in your profile</li>
                        <li>• Request will be reopened for other CAs</li>
                        <li>• Client will be notified</li>
                        <li>• High abandonment rates may affect future opportunities</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!reason}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  Continue
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            /* Step 2: Confirmation */
            <>
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <svg
                      className="h-6 w-6 text-red-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Confirm Abandonment
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-700">
                        Are you absolutely sure you want to abandon this request?
                      </p>
                      <div className="mt-3 p-3 bg-gray-50 rounded border border-gray-200">
                        <p className="text-sm">
                          <strong>Reason:</strong> {abandonmentReasons.find((r) => r.value === reason)?.label}
                        </p>
                        {reasonText && (
                          <p className="text-sm mt-2">
                            <strong>Details:</strong> {reasonText}
                          </p>
                        )}
                      </div>
                      <p className="text-sm text-red-600 font-medium mt-3">
                        This action cannot be undone. Your reputation score will decrease.
                      </p>
                    </div>

                    {error && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                        {error}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={processing}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm disabled:bg-red-400 disabled:cursor-not-allowed"
                >
                  {processing ? 'Processing...' : 'Yes, Abandon Request'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfirmation(false)}
                  disabled={processing}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:w-auto sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  Go Back
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AbandonRequestDialog;
