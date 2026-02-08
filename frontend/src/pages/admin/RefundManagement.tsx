import React, { useState } from 'react';
import { Card } from '../../components/common';
import { refundService, RefundReason, RefundEligibility } from '../../services';

interface RefundFormData {
  paymentId: string;
  reason: RefundReason | '';
  reasonText: string;
  percentage?: number;
}

const RefundManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'initiate' | 'check'>('initiate');
  const [formData, setFormData] = useState<RefundFormData>({
    paymentId: '',
    reason: '',
    reasonText: '',
    percentage: undefined,
  });
  const [eligibility, setEligibility] = useState<RefundEligibility | null>(null);
  const [checkingEligibility, setCheckingEligibility] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const refundReasons = [
    { value: RefundReason.CANCELLATION_BEFORE_START, label: 'Cancellation Before Start' },
    { value: RefundReason.CANCELLATION_IN_PROGRESS, label: 'Cancellation In Progress' },
    { value: RefundReason.CA_ABANDONMENT, label: 'CA Abandonment' },
    { value: RefundReason.QUALITY_ISSUE, label: 'Quality Issue' },
    { value: RefundReason.DISPUTE_RESOLUTION, label: 'Dispute Resolution' },
    { value: RefundReason.ADMIN_REFUND, label: 'Admin Refund' },
    { value: RefundReason.OTHER, label: 'Other' },
  ];

  const handleCheckEligibility = async () => {
    if (!formData.paymentId.trim()) {
      setError('Please enter a payment ID');
      return;
    }

    setCheckingEligibility(true);
    setError(null);
    setEligibility(null);

    try {
      const result = await refundService.checkEligibility(formData.paymentId);
      setEligibility(result);

      // Auto-fill recommended percentage if eligible
      if (result.eligible && result.recommendedPercentage) {
        setFormData(prev => ({
          ...prev,
          percentage: result.recommendedPercentage,
        }));
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to check eligibility');
    } finally {
      setCheckingEligibility(false);
    }
  };

  const handleInitiateRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!formData.paymentId.trim()) {
      setError('Payment ID is required');
      return;
    }

    if (!formData.reason) {
      setError('Refund reason is required');
      return;
    }

    setProcessing(true);

    try {
      const result = await refundService.initiateRefund({
        paymentId: formData.paymentId,
        reason: formData.reason as RefundReason,
        reasonText: formData.reasonText || undefined,
        percentage: formData.percentage,
      });

      setSuccess(
        `Refund processed successfully! Amount: ₹${result.data.refund.refundAmount.toFixed(2)}`
      );

      // Reset form
      setFormData({
        paymentId: '',
        reason: '',
        reasonText: '',
        percentage: undefined,
      });
      setEligibility(null);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to process refund');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Refund Management</h1>
        <p className="text-gray-600">Process refunds and check refund eligibility</p>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('initiate')}
              className={`${
                activeTab === 'initiate'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Initiate Refund
            </button>
            <button
              onClick={() => setActiveTab('check')}
              className={`${
                activeTab === 'check'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Check Eligibility
            </button>
          </nav>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          {success}
        </div>
      )}

      {/* Initiate Refund Tab */}
      {activeTab === 'initiate' && (
        <Card>
          <h2 className="text-xl font-bold mb-6">Initiate Refund</h2>

          <form onSubmit={handleInitiateRefund} className="space-y-6">
            {/* Payment ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment ID <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.paymentId}
                  onChange={(e) => setFormData({ ...formData, paymentId: e.target.value })}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter payment UUID"
                  required
                />
                <button
                  type="button"
                  onClick={handleCheckEligibility}
                  disabled={checkingEligibility}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {checkingEligibility ? 'Checking...' : 'Check Eligibility'}
                </button>
              </div>
            </div>

            {/* Eligibility Status */}
            {eligibility && (
              <div
                className={`p-4 rounded-lg ${
                  eligibility.eligible
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-yellow-50 border border-yellow-200'
                }`}
              >
                <div className="flex items-start">
                  <div className="flex-1">
                    <h3 className="font-semibold mb-2">
                      {eligibility.eligible ? '✓ Eligible for Refund' : '⚠ Manual Review Required'}
                    </h3>
                    {!eligibility.eligible && (
                      <p className="text-sm mb-2">
                        Reason: {eligibility.reason}
                        {eligibility.requiresManual && ' (Requires manual processing)'}
                      </p>
                    )}
                    {eligibility.calculation && (
                      <div className="text-sm space-y-1">
                        <p>Original Amount: ₹{eligibility.calculation.originalAmount.toFixed(2)}</p>
                        <p>Platform Fee: ₹{eligibility.calculation.platformFee.toFixed(2)}</p>
                        <p>
                          Refund Amount ({eligibility.calculation.refundPercentage}%): ₹
                          {eligibility.calculation.refundAmount.toFixed(2)}
                        </p>
                        <p>Processing Fee: ₹{eligibility.calculation.processingFee.toFixed(2)}</p>
                        <p className="font-semibold text-base mt-2">
                          Final Refund: ₹{eligibility.calculation.finalRefundAmount.toFixed(2)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Refund Reason */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Refund Reason <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value as RefundReason })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Select a reason</option>
                {refundReasons.map((reason) => (
                  <option key={reason.value} value={reason.value}>
                    {reason.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Additional Details */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Additional Details (Optional)
              </label>
              <textarea
                value={formData.reasonText}
                onChange={(e) => setFormData({ ...formData, reasonText: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Provide additional context for this refund..."
              />
            </div>

            {/* Refund Percentage */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Refund Percentage
                {eligibility?.recommendedPercentage && (
                  <span className="text-gray-500 text-xs ml-2">
                    (Recommended: {eligibility.recommendedPercentage}%)
                  </span>
                )}
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={formData.percentage || 0}
                  onChange={(e) => setFormData({ ...formData, percentage: parseInt(e.target.value) })}
                  className="flex-1"
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.percentage || 0}
                  onChange={(e) =>
                    setFormData({ ...formData, percentage: parseInt(e.target.value) || 0 })
                  }
                  className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-center"
                />
                <span className="text-gray-700">%</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Leave empty to use recommended percentage based on request status
              </p>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end gap-4">
              <button
                type="button"
                onClick={() => {
                  setFormData({
                    paymentId: '',
                    reason: '',
                    reasonText: '',
                    percentage: undefined,
                  });
                  setEligibility(null);
                  setError(null);
                  setSuccess(null);
                }}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Reset
              </button>
              <button
                type="submit"
                disabled={processing}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed"
              >
                {processing ? 'Processing...' : 'Process Refund'}
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* Check Eligibility Tab */}
      {activeTab === 'check' && (
        <Card>
          <h2 className="text-xl font-bold mb-6">Check Refund Eligibility</h2>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment ID</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.paymentId}
                  onChange={(e) => setFormData({ ...formData, paymentId: e.target.value })}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter payment UUID"
                />
                <button
                  onClick={handleCheckEligibility}
                  disabled={checkingEligibility}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed"
                >
                  {checkingEligibility ? 'Checking...' : 'Check'}
                </button>
              </div>
            </div>

            {/* Eligibility Result */}
            {eligibility && (
              <div
                className={`p-6 rounded-lg ${
                  eligibility.eligible
                    ? 'bg-green-50 border-2 border-green-200'
                    : 'bg-red-50 border-2 border-red-200'
                }`}
              >
                <h3 className="text-lg font-semibold mb-4">
                  {eligibility.eligible ? '✓ Refund Eligible' : '✗ Not Eligible'}
                </h3>

                {!eligibility.eligible && (
                  <div className="mb-4">
                    <p className="font-medium">Reason:</p>
                    <p className="text-gray-700">{eligibility.reason}</p>
                    {eligibility.requiresManual && (
                      <p className="mt-2 text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-2">
                        ⚠ This refund requires manual processing
                      </p>
                    )}
                  </div>
                )}

                {eligibility.calculation && (
                  <div className="bg-white rounded-lg p-4 border">
                    <h4 className="font-semibold mb-3">Refund Calculation:</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Original Amount:</span>
                        <span className="font-medium">
                          ₹{eligibility.calculation.originalAmount.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>Platform Fee (10%):</span>
                        <span>-₹{eligibility.calculation.platformFee.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Refund Amount ({eligibility.calculation.refundPercentage}%):</span>
                        <span className="font-medium">
                          ₹{eligibility.calculation.refundAmount.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>Processing Fee:</span>
                        <span>-₹{eligibility.calculation.processingFee.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-lg font-bold pt-2 border-t">
                        <span>Final Refund Amount:</span>
                        <span className="text-green-600">
                          ₹{eligibility.calculation.finalRefundAmount.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {eligibility.recommendedPercentage && (
                      <p className="mt-4 text-sm text-gray-600">
                        Recommended refund percentage: {eligibility.recommendedPercentage}%
                      </p>
                    )}
                  </div>
                )}

                {eligibility.eligible && (
                  <div className="mt-4">
                    <button
                      onClick={() => setActiveTab('initiate')}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Proceed to Initiate Refund
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Information Box */}
      <Card className="mt-6 bg-blue-50 border-blue-200">
        <h3 className="font-semibold mb-2">Refund Policy Information</h3>
        <ul className="text-sm space-y-1 text-gray-700">
          <li>• <strong>PENDING/ACCEPTED:</strong> 100% refund (no processing fee)</li>
          <li>• <strong>IN_PROGRESS:</strong> 50% refund</li>
          <li>• <strong>COMPLETED:</strong> 0% refund (service already delivered)</li>
          <li>• Processing fee: 2% (minimum ₹10, maximum ₹100)</li>
          <li>• Refunds to payments already released to CA require manual processing</li>
          <li>• All refund actions are logged and auditable</li>
        </ul>
      </Card>
    </div>
  );
};

export default RefundManagement;
