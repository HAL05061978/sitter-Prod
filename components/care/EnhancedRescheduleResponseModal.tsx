'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../app/lib/suupa base';

interface EnhancedRescheduleResponseModalProps {
  isOpen: boolean;
  onClose: () => void;
  rescheduleRequestId: string;
  careResponseId?: string;
  reschedulingParentId: string;
  reschedulingParentName: string;
  groupId: string;
  originalDate: string;
  originalStartTime: string;
  originalEndTime: string;
  newDate: string;
  newStartTime: string;
  newEndTime: string;
  onResponseSuccess: () => void;
}

interface Arrangement {
  request_id: string;
  parent_a_provides_date: string;
  parent_a_provides_start_time: string;
  parent_a_provides_end_time: string;
  parent_b_provides_date: string;
  parent_b_provides_start_time: string;
  parent_b_provides_end_time: string;
}

export default function EnhancedRescheduleResponseModal({
  isOpen,
  onClose,
  rescheduleRequestId,
  careResponseId,
  reschedulingParentId,
  reschedulingParentName,
  groupId,
  originalDate,
  originalStartTime,
  originalEndTime,
  newDate,
  newStartTime,
  newEndTime,
  onResponseSuccess
}: EnhancedRescheduleResponseModalProps) {
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [arrangements, setArrangements] = useState<Arrangement[]>([]);
  const [selectedCancellationId, setSelectedCancellationId] = useState<string>('current');
  const [offerReplacement, setOfferReplacement] = useState(false);
  const [replacementDate, setReplacementDate] = useState('');
  const [replacementStartTime, setReplacementStartTime] = useState('');
  const [replacementEndTime, setReplacementEndTime] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (showDeclineModal) {
      fetchArrangements();
    }
  }, [showDeclineModal]);

  // Pre-fill replacement times with the proposed reschedule times when modal opens
  // User only needs to change the date, but can still modify times if needed
  useEffect(() => {
    if (isOpen && newStartTime) {
      setReplacementStartTime(newStartTime.substring(0, 5)); // Format: HH:MM
    }
    if (isOpen && newEndTime) {
      setReplacementEndTime(newEndTime.substring(0, 5)); // Format: HH:MM
    }
  }, [isOpen, newStartTime, newEndTime]);

  const fetchArrangements = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase.rpc('get_arrangements_between_parents', {
        p_parent_a_id: user.id,
        p_parent_b_id: reschedulingParentId,
        p_group_id: groupId
      });

      if (error) throw error;
      setArrangements(data || []);
    } catch (err) {
      console.error('Error fetching arrangements:', err);
      setError('Failed to load arrangements');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    setIsSubmitting(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      let responseId = careResponseId;
      if (!responseId) {
        const { data: responseData, error: responseError } = await supabase
          .from('care_responses')
          .select('id')
          .eq('request_id', rescheduleRequestId)
          .eq('responder_id', user.id)
          .eq('status', 'pending')
          .single();

        if (responseError || !responseData) {
          throw new Error('Could not find your response record');
        }
        responseId = responseData.id;
      }

      const { data, error } = await supabase.rpc('handle_improved_reschedule_response', {
        p_care_response_id: responseId,
        p_responder_id: user.id,
        p_response_status: 'accepted',
        p_response_notes: notes || null
      });

      if (error) throw error;

      alert('Reschedule accepted! Your calendar has been updated.');
      onResponseSuccess();
      onClose();
    } catch (err) {
      console.error('Error accepting reschedule:', err);
      setError('Failed to accept. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeclineSubmit = async () => {
    setIsSubmitting(true);
    setError('');

    // Validation
    if (offerReplacement) {
      if (!replacementDate || !replacementStartTime || !replacementEndTime) {
        setError('Please fill out all replacement time fields or uncheck the replacement option');
        setIsSubmitting(false);
        return;
      }
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      let responseId = careResponseId;
      if (!responseId) {
        const { data: responseData, error: responseError } = await supabase
          .from('care_responses')
          .select('id')
          .eq('request_id', rescheduleRequestId)
          .eq('responder_id', user.id)
          .eq('status', 'pending')
          .single();

        if (responseError || !responseData) {
          throw new Error('Could not find your response record');
        }
        responseId = responseData.id;
      }

      const params: any = {
        p_care_response_id: responseId,
        p_responder_id: user.id,
        p_response_status: 'declined',
        p_response_notes: notes || null,
        p_decline_action: offerReplacement ? 'counter_propose' : 'cancel',
        p_selected_cancellation_request_id: selectedCancellationId === 'current' ? null : selectedCancellationId
      };

      if (offerReplacement) {
        params.p_counter_proposal_date = replacementDate;
        params.p_counter_proposal_start_time = replacementStartTime;
        params.p_counter_proposal_end_time = replacementEndTime;
      }

      const { data, error } = await supabase.rpc('handle_improved_reschedule_response', params);

      if (error) throw error;

      if (offerReplacement) {
        alert(`Counter-proposal sent! ${reschedulingParentName} will be notified of your alternative time.`);
      } else {
        alert(`Decline sent. ${reschedulingParentName} will be notified.`);
      }

      onResponseSuccess();
      onClose();
    } catch (err) {
      console.error('Error declining reschedule:', err);
      setError('Failed to decline. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (time: string) => {
    return time?.substring(0, 5) || '';
  };

  const formatDate = (date: string) => {
    if (!date) return '';
    return new Date(date + 'T00:00:00').toLocaleDateString();
  };

  if (!isOpen) return null;

  // Decline Modal
  if (showDeclineModal) {
    return (
      <div className="fixed left-0 right-0 bg-black bg-opacity-50 flex items-center justify-center p-4" style={{ top: '145px', bottom: '90px', zIndex: 9999 }}>
        <div className="bg-white rounded-lg p-6 w-full max-w-3xl mx-4 max-h-full overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-gray-900">Decline Reschedule Request</h2>
            <button
              onClick={() => setShowDeclineModal(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="font-medium text-gray-900 mb-2">
              {reschedulingParentName} wants to reschedule care for your child:
            </p>
            <p className="text-sm text-gray-700">
              <strong>FROM:</strong> {formatDate(originalDate)} {formatTime(originalStartTime)}-{formatTime(originalEndTime)}
            </p>
            <p className="text-sm text-gray-700">
              <strong>TO:</strong> {formatDate(newDate)} {formatTime(newStartTime)}-{formatTime(newEndTime)}
            </p>
            <p className="text-sm text-gray-600 mt-2">
              The NEW time doesn't work for my child.
            </p>
          </div>

          {/* STEP 1: Select which arrangement to cancel */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">STEP 1: Which arrangement should be canceled?</h3>

            <div className="space-y-2">
              <label className="flex items-start p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="cancellation"
                  value="current"
                  checked={selectedCancellationId === 'current'}
                  onChange={(e) => setSelectedCancellationId(e.target.value)}
                  className="mt-1 mr-3"
                />
                <div>
                  <div className="font-medium">Cancel the current one</div>
                  <div className="text-sm text-gray-600">
                    {formatDate(originalDate)} {formatTime(originalStartTime)}-{formatTime(originalEndTime)}
                  </div>
                </div>
              </label>

              {loading ? (
                <div className="text-center py-4 text-gray-500">Loading other arrangements...</div>
              ) : (() => {
                // Filter to only show future arrangements
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const futureArrangements = arrangements.filter((arr) => {
                  // Check if either date is in the future
                  const dateA = arr.parent_a_provides_date ? new Date(arr.parent_a_provides_date + 'T00:00:00') : null;
                  const dateB = arr.parent_b_provides_date ? new Date(arr.parent_b_provides_date + 'T00:00:00') : null;
                  return (dateA && dateA >= today) || (dateB && dateB >= today);
                });

                if (futureArrangements.length === 0) {
                  return (
                    <div className="text-sm text-gray-500 p-3 bg-gray-50 rounded-lg">
                      No other future arrangements found
                    </div>
                  );
                }

                return futureArrangements.map((arr) => (
                  <label key={arr.request_id} className="flex items-start p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="cancellation"
                      value={arr.request_id}
                      checked={selectedCancellationId === arr.request_id}
                      onChange={(e) => setSelectedCancellationId(e.target.value)}
                      className="mt-1 mr-3"
                    />
                    <div>
                      <div className="font-medium">Cancel this one instead:</div>
                      <div className="text-sm text-gray-600">
                        {formatDate(arr.parent_a_provides_date)} {formatTime(arr.parent_a_provides_start_time)}-{formatTime(arr.parent_a_provides_end_time)} ⟷ {formatDate(arr.parent_b_provides_date)} {formatTime(arr.parent_b_provides_start_time)}-{formatTime(arr.parent_b_provides_end_time)}
                      </div>
                    </div>
                  </label>
                ));
              })()}
            </div>
          </div>

          {/* STEP 2: Optional replacement */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">STEP 2: (Optional) Propose replacement time</h3>

            <label className="flex items-start p-4 border rounded-lg cursor-pointer hover:bg-gray-50 mb-3">
              <input
                type="checkbox"
                checked={offerReplacement}
                onChange={(e) => setOfferReplacement(e.target.checked)}
                className="mt-1 mr-3"
              />
              <div className="flex-1">
                <div className="font-medium">BUT, if you can do THIS time instead, keep it:</div>
                <div className="text-sm text-gray-600 mb-3">
                  When does your child need care?
                </div>

                {offerReplacement && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                      <input
                        type="date"
                        value={replacementDate}
                        onChange={(e) => setReplacementDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                      <input
                        type="time"
                        value={replacementStartTime}
                        onChange={(e) => setReplacementStartTime(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                      <input
                        type="time"
                        value={replacementEndTime}
                        onChange={(e) => setReplacementEndTime(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                  </div>
                )}
              </div>
            </label>
          </div>

          {/* Notes */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message to {reschedulingParentName}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="e.g., 'Doctor appt Wed, but Fri works if you can'"
            />
          </div>

          {error && (
            <div className="mb-4 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              onClick={() => setShowDeclineModal(false)}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
            >
              Back
            </button>
            <button
              onClick={handleDeclineSubmit}
              disabled={isSubmitting}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Response'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main Modal (Accept/Decline choice)
  return (
    <div className="fixed left-0 right-0 bg-black bg-opacity-50 flex items-center justify-center p-4" style={{ top: '145px', bottom: '90px', zIndex: 9999 }}>
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-full overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-gray-900">Reschedule Request</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="font-medium text-gray-900 mb-2">
            {reschedulingParentName} wants to reschedule care for your child:
          </p>
          <div className="grid grid-cols-2 gap-4 mt-3">
            <div>
              <p className="text-sm font-medium text-gray-700">Current Schedule:</p>
              <p className="text-sm text-gray-600">{formatDate(originalDate)}</p>
              <p className="text-sm text-gray-600">{formatTime(originalStartTime)} - {formatTime(originalEndTime)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Proposed New Schedule:</p>
              <p className="text-sm text-gray-600">{formatDate(newDate)}</p>
              <p className="text-sm text-gray-600">{formatTime(newStartTime)} - {formatTime(newEndTime)}</p>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notes (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            placeholder="Add any notes about your response..."
          />
        </div>

        {error && (
          <div className="mb-4 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={() => setShowDeclineModal(true)}
            disabled={isSubmitting}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
          >
            Decline
          </button>
          <button
            onClick={handleAccept}
            disabled={isSubmitting}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Processing...' : 'Accept'}
          </button>
        </div>
      </div>
    </div>
  );
}
