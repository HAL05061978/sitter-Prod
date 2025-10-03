'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../app/lib/supabase';

interface RescheduleResponseModalProps {
  isOpen: boolean;
  onClose: () => void;
  rescheduleRequestId: string;
  onResponseSuccess: () => void;
}

interface RescheduleDetails {
  reschedule_request: {
    id: string;
    status: string;
    created_at: string;
  };
  original_request: {
    id: string;
    date: string;
    start_time: string;
    end_time: string;
    notes: string;
  };
  new_request: {
    id: string;
    date: string;
    start_time: string;
    end_time: string;
    notes: string;
  };
  participating_parents: Array<{
    parent_id: string;
    parent_name: string;
    care_type: string;
    children: Array<{
      child_id: string;
      child_name: string;
    }>;
  }>;
  responses: Array<{
    responder_id: string;
    responder_name: string;
    response_type: string;
    response_notes: string;
    status: string;
    created_at: string;
  }>;
}

export default function RescheduleResponseModal({
  isOpen,
  onClose,
  rescheduleRequestId,
  onResponseSuccess
}: RescheduleResponseModalProps) {
  const [rescheduleDetails, setRescheduleDetails] = useState<RescheduleDetails | null>(null);
  const [responseNotes, setResponseNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && rescheduleRequestId) {
      fetchRescheduleDetails();
    }
  }, [isOpen, rescheduleRequestId]);

  const fetchRescheduleDetails = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_reschedule_request_details', {
        p_reschedule_request_id: rescheduleRequestId
      });

      if (error) throw error;
      setRescheduleDetails(data);
    } catch (err) {
      console.error('Error fetching reschedule details:', err);
      setError('Failed to load reschedule details');
    } finally {
      setLoading(false);
    }
  };

  const handleResponse = async (responseStatus: 'accepted' | 'declined') => {
    if (!rescheduleRequestId) return;

    setIsSubmitting(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase.rpc('handle_improved_reschedule_response', {
        p_care_request_id: rescheduleRequestId,
        p_response_status: responseStatus,
        p_response_notes: responseNotes || null
      });

      if (error) throw error;

      // Show success message based on response
      if (responseStatus === 'accepted') {
        alert('You have accepted the reschedule request. Your calendar has been updated with the new time.');
      } else {
        alert('You have declined the reschedule request. Your participation in the original time block has been removed.');
      }

      onResponseSuccess();
      onClose();
    } catch (err) {
      console.error('Error responding to reschedule request:', err);
      setError('Failed to submit response. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (time: string) => {
    return time.substring(0, 5); // Remove seconds, keep HH:MM format
  };

  const formatDate = (date: string) => {
    return new Date(date + 'T00:00:00').toLocaleDateString();
  };

  if (!isOpen) return null;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p>Loading reschedule details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!rescheduleDetails) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4">
          <div className="text-center">
            <p className="text-red-600">Failed to load reschedule details</p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { original_request, new_request, participating_parents, responses } = rescheduleDetails;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
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

        {/* Current vs New Schedule */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <h3 className="font-semibold text-red-800 mb-2">Current Schedule</h3>
            <p><strong>Date:</strong> {formatDate(original_request.date)}</p>
            <p><strong>Time:</strong> {formatTime(original_request.start_time)} - {formatTime(original_request.end_time)}</p>
            {original_request.notes && <p><strong>Notes:</strong> {original_request.notes}</p>}
          </div>
          
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <h3 className="font-semibold text-green-800 mb-2">Proposed New Schedule</h3>
            <p><strong>Date:</strong> {formatDate(new_request.date)}</p>
            <p><strong>Time:</strong> {formatTime(new_request.start_time)} - {formatTime(new_request.end_time)}</p>
            {new_request.notes && <p><strong>Notes:</strong> {new_request.notes}</p>}
          </div>
        </div>

        {/* Participating Parents */}
        <div className="mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">All Participating Parents</h3>
          <div className="space-y-2">
            {participating_parents.map((parent) => (
              <div key={parent.parent_id} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{parent.parent_name}</p>
                    <p className="text-sm text-gray-600">
                      {parent.care_type === 'provided' ? 'Providing Care' : 'Receiving Care'}
                    </p>
                    <div className="text-sm text-gray-600 mt-1">
                      <strong>Children:</strong> {parent.children.map(c => c.child_name).join(', ')}
                    </div>
                  </div>
                  <div className="text-sm">
                    {responses.find(r => r.responder_id === parent.parent_id) ? (
                      <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                        {responses.find(r => r.responder_id === parent.parent_id)?.status === 'accepted' ? 'Accepted' : 'Declined'}
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-800">
                        Pending
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Response Notes */}
        <div className="mb-6">
          <label htmlFor="responseNotes" className="block text-sm font-medium text-gray-700 mb-2">
            Response Notes (Optional)
          </label>
          <textarea
            id="responseNotes"
            value={responseNotes}
            onChange={(e) => setResponseNotes(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Add any notes about your response..."
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
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handleResponse('declined')}
            disabled={isSubmitting}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Processing...' : 'Decline'}
          </button>
          <button
            type="button"
            onClick={() => handleResponse('accepted')}
            disabled={isSubmitting}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Processing...' : 'Accept'}
          </button>
        </div>
      </div>
    </div>
  );
}