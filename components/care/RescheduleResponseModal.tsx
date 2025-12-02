'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../app/lib/supabase';

interface RescheduleResponseModalProps {
  isOpen: boolean;
  onClose: () => void;
  rescheduleRequestId: string;  // This is the care_request_id
  careResponseId?: string;      // This is the specific care_response_id for this user
  onResponseSuccess: () => void;
}

interface RescheduleDetails {
  reschedule_request: {
    id: string;
    status: string;
    created_at: string;
    is_counter_proposal?: boolean;  // ✅ Added to detect counter-proposals
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

interface Arrangement {
  request_id: string;
  date: string;
  start_time: string;
  end_time: string;
  notes: string;
  requesting_parent_name: string;
  receiving_parent_name: string;
}

export default function RescheduleResponseModal({
  isOpen,
  onClose,
  rescheduleRequestId,
  careResponseId,
  onResponseSuccess
}: RescheduleResponseModalProps) {
  console.log('🔵 RescheduleResponseModal loaded - ENHANCED VERSION with decline workflow');
  const [rescheduleDetails, setRescheduleDetails] = useState<RescheduleDetails | null>(null);
  const [responseNotes, setResponseNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showDeclineOptions, setShowDeclineOptions] = useState(true); // Start with decline options visible
  const [arrangements, setArrangements] = useState<Arrangement[]>([]);
  const [selectedCancellationRequestId, setSelectedCancellationRequestId] = useState<string>('');
  const [offerReplacement, setOfferReplacement] = useState(false);
  const [counterProposalDate, setCounterProposalDate] = useState('');
  const [counterProposalStartTime, setCounterProposalStartTime] = useState('');
  const [counterProposalEndTime, setCounterProposalEndTime] = useState('');
  const [counterProposalNotes, setCounterProposalNotes] = useState('');

  useEffect(() => {
    if (isOpen && rescheduleRequestId) {
      fetchRescheduleDetails();
      fetchArrangements(); // Fetch arrangements immediately when modal opens
    }
  }, [isOpen, rescheduleRequestId]);

  const fetchRescheduleDetails = async () => {
    try {
      setLoading(true);

      // ✅ Query care_requests directly to get counter_proposal_to field
      const { data: requestData, error: requestError } = await supabase
        .from('care_requests')
        .select('id, counter_proposal_to, requester_id, requested_date, start_time, end_time, reciprocal_date, reciprocal_start_time, reciprocal_end_time, notes')
        .eq('id', rescheduleRequestId)
        .single();

      if (requestError) throw requestError;

      // Build reschedule details with is_counter_proposal flag
      const details = {
        reschedule_request: {
          id: requestData.id,
          is_counter_proposal: requestData.counter_proposal_to !== null,
          counter_proposal_to: requestData.counter_proposal_to
        },
        original_request: {
          id: requestData.id,
          date: requestData.reciprocal_date,
          start_time: requestData.reciprocal_start_time,
          end_time: requestData.reciprocal_end_time,
          notes: requestData.notes
        },
        new_request: {
          id: requestData.id,
          date: requestData.requested_date,
          start_time: requestData.start_time,
          end_time: requestData.end_time,
          notes: requestData.notes
        },
        participating_parents: [],
        responses: []
      };

      console.log('✅ Reschedule details loaded:', details);
      console.log('✅ Is counter-proposal:', details.reschedule_request.is_counter_proposal);

      setRescheduleDetails(details);

      // Pre-fill counter proposal times with the proposed reschedule times
      // User only needs to change the date, but can still modify times if needed
      if (details.new_request.start_time) {
        setCounterProposalStartTime(details.new_request.start_time.substring(0, 5)); // Format: HH:MM
      }
      if (details.new_request.end_time) {
        setCounterProposalEndTime(details.new_request.end_time.substring(0, 5)); // Format: HH:MM
      }
    } catch (err) {
      console.error('Error fetching reschedule details:', err);
      setError('Failed to load reschedule details');
    } finally {
      setLoading(false);
    }
  };

  const fetchArrangements = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get the requesting parent ID from the reschedule request
      const { data: requestData, error: requestError } = await supabase
        .from('care_requests')
        .select('requester_id')
        .eq('id', rescheduleRequestId)
        .single();

      if (requestError || !requestData) {
        console.error('Could not find request:', requestError);
        return;
      }

      console.log('Fetching arrangements between:', user.id, 'and', requestData.requester_id);

      // Fetch all arrangements between these two parents
      const { data, error } = await supabase.rpc('get_arrangements_between_parents', {
        p_parent1_id: user.id,
        p_parent2_id: requestData.requester_id
      });

      console.log('Arrangements result:', { data, error });

      if (error) throw error;
      setArrangements(data || []);

      // Set the current reschedule request as the default selection
      if (data && data.length > 0) {
        const currentRequest = data.find((arr: Arrangement) => arr.request_id === rescheduleRequestId);
        if (currentRequest) {
          setSelectedCancellationRequestId(currentRequest.request_id);
        } else if (data.length > 0) {
          setSelectedCancellationRequestId(data[0].request_id);
        }
      }
    } catch (err) {
      console.error('Error fetching arrangements:', err);
      setError('Failed to load arrangements');
    }
  };

  const handleDeclineClick = async () => {
    console.log('=== DECLINE BUTTON CLICKED ===');

    // ✅ Check if this is a counter-proposal - if so, use simple decline
    if (rescheduleDetails?.reschedule_request?.is_counter_proposal) {
      console.log('Counter-proposal detected - using simple decline');
      await handleSimpleDecline();
    } else {
      console.log('Original reschedule - showing full decline options');
      setShowDeclineOptions(true);
      await fetchArrangements();
    }
  };

  // ✅ Simple decline for counter-proposals (no arrangement selection, no counter back)
  const handleSimpleDecline = async () => {
    if (!rescheduleRequestId) return;

    const confirmed = window.confirm(
      'Are you sure you want to decline this counter-proposal? The parent will be notified and their selected arrangement will be canceled.'
    );

    if (!confirmed) return;

    setIsSubmitting(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get the care_response_id if not provided
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
          console.error('Could not find care_response:', responseError);
          throw new Error('Could not find your response record');
        }
        responseId = responseData.id;
      }

      console.log('Calling simple decline for counter-proposal');

      const { data, error } = await supabase.rpc('handle_improved_reschedule_response', {
        p_care_response_id: responseId,
        p_responder_id: user.id,
        p_response_status: 'declined',
        p_response_notes: responseNotes || null,
        p_decline_action: null,
        p_selected_cancellation_request_id: null
      });

      console.log('RPC result:', { data, error });

      if (error) throw error;

      // Mark the reschedule_counter_sent or reschedule_request notification as read
      const notificationType = rescheduleDetails?.reschedule_request?.is_counter_proposal
        ? 'reschedule_counter_sent'
        : 'reschedule_request';

      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('type', notificationType)
        .eq('data->>request_id', rescheduleRequestId);

      // No popup needed - decline confirmation will appear in Messages tab
      onResponseSuccess();
      onClose();
    } catch (err) {
      console.error('Error declining counter-proposal:', err);
      setError('Failed to submit response. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAccept = async () => {
    if (!rescheduleRequestId) return;

    setIsSubmitting(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get the care_response_id if not provided
      let responseId = careResponseId;
      if (!responseId) {
        console.log('Looking up care_response_id for request_id:', rescheduleRequestId, 'user:', user.id);
        const { data: responseData, error: responseError } = await supabase
          .from('care_responses')
          .select('id')
          .eq('request_id', rescheduleRequestId)
          .eq('responder_id', user.id)
          .eq('status', 'pending')
          .single();

        console.log('care_responses query result:', { responseData, responseError });

        if (responseError || !responseData) {
          console.error('Could not find care_response:', responseError);
          throw new Error('Could not find your response record');
        }
        responseId = responseData.id;
      }

      console.log('Calling handle_improved_reschedule_response with:', {
        p_care_response_id: responseId,
        p_responder_id: user.id,
        p_response_status: 'accepted'
      });

      const { data, error } = await supabase.rpc('handle_improved_reschedule_response', {
        p_care_response_id: responseId,
        p_responder_id: user.id,
        p_response_status: 'accepted',
        p_response_notes: responseNotes || null
      });

      console.log('RPC result:', { data, error });

      if (error) throw error;

      // No popup needed - acceptance confirmation will appear in Messages tab
      onResponseSuccess();
      onClose();
    } catch (err) {
      console.error('Error accepting reschedule request:', err);
      setError('Failed to submit response. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeclineSubmit = async () => {
    if (!rescheduleRequestId || !selectedCancellationRequestId) {
      setError('Please select an arrangement to cancel');
      return;
    }

    if (offerReplacement && (!counterProposalDate || !counterProposalStartTime || !counterProposalEndTime)) {
      setError('Please fill in all replacement time fields');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get the care_response_id if not provided
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
          console.error('Could not find care_response:', responseError);
          throw new Error('Could not find your response record');
        }
        responseId = responseData.id;
      }

      const rpcParams: any = {
        p_care_response_id: responseId,
        p_responder_id: user.id,
        p_response_status: 'declined',
        p_response_notes: responseNotes || null,
        p_decline_action: offerReplacement ? 'counter_propose' : 'cancel',
        p_selected_cancellation_request_id: selectedCancellationRequestId
      };

      if (offerReplacement) {
        rpcParams.p_counter_proposal_date = counterProposalDate;
        rpcParams.p_counter_proposal_start_time = counterProposalStartTime;
        rpcParams.p_counter_proposal_end_time = counterProposalEndTime;
        rpcParams.p_counter_proposal_notes = counterProposalNotes || null;
      }

      console.log('Calling handle_improved_reschedule_response with:', rpcParams);

      const { data, error } = await supabase.rpc('handle_improved_reschedule_response', rpcParams);

      console.log('RPC result:', { data, error });

      if (error) throw error;

      // Mark the reschedule_request notification as read
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('user_id', currentUser.id)
          .eq('type', 'reschedule_request')
          .eq('data->>request_id', rescheduleRequestId);
      }

      // No popup needed - decline confirmation will appear in Messages tab
      onResponseSuccess();
      onClose();
    } catch (err) {
      console.error('Error declining reschedule request:', err);
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
      <div className="fixed left-0 right-0 bg-black bg-opacity-50 flex items-center justify-center p-4" style={{ top: '145px', bottom: '90px', zIndex: 9999 }}>
        <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-full overflow-y-auto">
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
      <div className="fixed left-0 right-0 bg-black bg-opacity-50 flex items-center justify-center p-4" style={{ top: '145px', bottom: '90px', zIndex: 9999 }}>
        <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-full overflow-y-auto">
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

  // ✅ FIX: Handle null values from database (especially for open block scenarios)
  const safeParticipatingParents = participating_parents || [];
  const safeResponses = responses || [];

  // If showing decline options, render the enhanced decline view
  if (showDeclineOptions) {
    return (
      <div className="fixed left-0 right-0 bg-black bg-opacity-50 flex items-center justify-center p-4" style={{ top: '145px', bottom: '90px', zIndex: 9999 }}>
        <div className="bg-white rounded-lg p-6 w-full max-w-4xl mx-4 max-h-full overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-gray-900">Respond to Reschedule Request</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Show the reschedule summary */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <h3 className="font-semibold text-red-800 mb-2">Current Schedule</h3>
              <p><strong>Date:</strong> {formatDate(original_request.date)}</p>
              <p><strong>Time:</strong> {formatTime(original_request.start_time)} - {formatTime(original_request.end_time)}</p>
            </div>
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="font-semibold text-green-800 mb-2">Proposed New Schedule</h3>
              <p><strong>Date:</strong> {formatDate(new_request.date)}</p>
              <p><strong>Time:</strong> {formatTime(new_request.start_time)} - {formatTime(new_request.end_time)}</p>
            </div>
          </div>

          {/* Select arrangement to cancel */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">Which arrangement should be canceled?</h3>
            {(() => {
              // Filter to only show future arrangements
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const futureArrangements = arrangements.filter((arr) => {
                const arrDate = new Date(arr.date + 'T00:00:00');
                return arrDate >= today;
              });

              if (futureArrangements.length === 0) {
                return <p className="text-sm text-gray-600">No future arrangements found between you and the requesting parent.</p>;
              }

              return (
                <div className="space-y-2">
                  {futureArrangements.map((arr) => (
                    <label key={arr.request_id} className="flex items-start p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                      <input
                        type="radio"
                        name="cancellation"
                        value={arr.request_id}
                        checked={selectedCancellationRequestId === arr.request_id}
                        onChange={(e) => setSelectedCancellationRequestId(e.target.value)}
                        className="mt-1 mr-3"
                      />
                      <div className="flex-1">
                        <p className="font-medium">
                          {formatDate(arr.date)} at {formatTime(arr.start_time)} - {formatTime(arr.end_time)}
                          {arr.request_id === rescheduleRequestId && <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">(Current Request)</span>}
                        </p>
                        <p className="text-sm text-gray-600">
                          {arr.requesting_parent_name} requesting care from {arr.receiving_parent_name}
                        </p>
                        {arr.notes && <p className="text-sm text-gray-600 mt-1">{arr.notes}</p>}
                      </div>
                    </label>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Offer replacement time */}
          <div className="mb-6">
            <label className="flex items-center mb-3">
              <input
                type="checkbox"
                checked={offerReplacement}
                onChange={(e) => setOfferReplacement(e.target.checked)}
                className="mr-2"
              />
              <span className="font-semibold text-gray-900">Offer an alternative time (optional)</span>
            </label>

            {offerReplacement && (
              <div className="pl-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={counterProposalDate}
                    onChange={(e) => setCounterProposalDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                    <input
                      type="time"
                      value={counterProposalStartTime}
                      onChange={(e) => setCounterProposalStartTime(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                    <input
                      type="time"
                      value={counterProposalEndTime}
                      onChange={(e) => setCounterProposalEndTime(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}
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
              onClick={handleDeclineSubmit}
              disabled={isSubmitting || !selectedCancellationRequestId}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Processing...' : 'Submit Decline'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed left-0 right-0 bg-black bg-opacity-50 flex items-center justify-center p-4" style={{ top: '145px', bottom: '90px', zIndex: 9999 }}>
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl mx-4 max-h-full overflow-y-auto">
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
            {safeParticipatingParents.map((parent) => (
              <div key={parent.parent_id} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{parent.parent_name}</p>
                    <p className="text-sm text-gray-600">
                      {parent.care_type === 'provided' ? 'Providing Care' : 'Receiving Care'}
                    </p>
                    <div className="text-sm text-gray-600 mt-1">
                      <strong>Children:</strong> {(parent.children || []).map(c => c.child_name).join(', ')}
                    </div>
                  </div>
                  <div className="text-sm">
                    {safeResponses.find(r => r.responder_id === parent.parent_id) ? (
                      <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                        {safeResponses.find(r => r.responder_id === parent.parent_id)?.status === 'accepted' ? 'Accepted' : 'Declined'}
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
            onClick={handleDeclineClick}
            disabled={isSubmitting}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={handleAccept}
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