'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatDateOnly, formatTime } from '../lib/date-utils';

interface CareMessageProps {
  message: {
    id: string;
    message_type: string;
    care_request_id?: string;
    care_response_id?: string;
    action_data?: any;
    subject: string;
    content: string;
    sender_id: string;
    recipient_id: string;
    group_id?: string; // Add group_id to interface
    created_at: string;
    status?: string;
  };
  onActionComplete: () => void;
}

export default function CareMessageComponent({ message, onActionComplete }: CareMessageProps) {
  const [loading, setLoading] = useState(false);
  const [showResponseForm, setShowResponseForm] = useState(false);
  const [responseData, setResponseData] = useState({
    reciprocal_date: '',
    reciprocal_start_time: '',
    reciprocal_end_time: '',
    reciprocal_child_id: '',
    notes: ''
  });
  const [children, setChildren] = useState<Array<{ id: string; name: string }>>([]);
  const [existingResponse, setExistingResponse] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [responsesToRequest, setResponsesToRequest] = useState<Array<any>>([]);

  // Check if current user has already responded to this care request
  const checkExistingResponse = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !message.care_request_id) return;
      
      setCurrentUser(user);
      console.log('Current user:', user.id);
      console.log('Message sender_id:', message.sender_id);
      console.log('Is requester?', message.sender_id === user.id);

      // Check if user already submitted a response
      const { data: responseData } = await supabase
        .from('care_responses')
        .select('*')
        .eq('request_id', message.care_request_id)
        .eq('responder_id', user.id)
        .single();

      if (responseData) {
        setExistingResponse(responseData);
        console.log('Existing response found:', responseData);
      }

      // If user is the requester, also fetch all responses to their request
      if (message.sender_id === user.id) {
        console.log('Fetching responses for requester...');
        const { data: allResponses, error } = await supabase
          .from('care_responses')
          .select(`
            *,
            profiles!inner(full_name)
          `)
          .eq('request_id', message.care_request_id)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching responses:', error);
        } else if (allResponses) {
          console.log('Responses found:', allResponses);
          setResponsesToRequest(allResponses);
        } else {
          console.log('No responses found');
        }
      }
    } catch (error) {
      console.log('No existing response found');
    }
  };

  // Check for existing response when component mounts
  useEffect(() => {
    if (message.message_type === 'care_request') {
      checkExistingResponse();
    }
  }, [message]);

  const handleCareRequest = async () => {
    // Don't allow response if user already responded
    if (existingResponse) {
      alert('You have already responded to this care request.');
      return;
    }

    setLoading(true);
    try {
      // Fetch children for the user in this group
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get the group_id from action_data or fallback to message.group_id
      const groupId = message.action_data?.group_id || message.group_id;
      
      if (!groupId) {
        console.error('No group_id available for fetching children');
        alert('Unable to fetch group information. Please try again.');
        return;
      }

      console.log('Fetching children for group:', groupId);

      const { data: childrenData, error } = await supabase
        .from('child_group_members')
        .select(`
          children!inner(id, full_name, parent_id),
          group_id
        `)
        .eq('group_id', groupId)
        .eq('active', true)
        .eq('children.parent_id', user.id);

      if (error) {
        console.error('Error fetching children:', error);
        alert('Error fetching children. Please try again.');
        return;
      }

      if (childrenData && childrenData.length > 0) {
        const childrenList = childrenData
          .filter((item: any) => item.children?.id && item.children?.full_name)
          .map((item: any) => ({
            id: item.children.id,
            name: item.children.full_name
          }));
        
        setChildren(childrenList);
        console.log('Found children:', childrenList);
      } else {
        console.log('No children found for user in this group');
        setChildren([]);
        alert('No children found in this group. Please check your group membership.');
        return;
      }

      setShowResponseForm(true);
    } catch (error) {
      console.error('Error fetching children:', error);
      alert('An error occurred while fetching children. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !message.care_request_id) return;

      // Submit the care response
      const { data, error } = await supabase.rpc('submit_reciprocal_care_response', {
        care_request_id: message.care_request_id,
        responding_parent_id: user.id,
        reciprocal_date: responseData.reciprocal_date,
        reciprocal_start_time: responseData.reciprocal_start_time,
        reciprocal_end_time: responseData.reciprocal_end_time,
        reciprocal_child_id: responseData.reciprocal_child_id,
        notes: responseData.notes || null
      });

      if (error) {
        console.error('Error submitting response:', error);
        alert('Failed to submit response');
        return;
      }

      // Send notification message
      await supabase.rpc('send_care_response_notifications', {
        p_care_response_id: data
      });

      // Update the existing response state to reflect the submission
      setExistingResponse({
        id: data,
        request_id: message.care_request_id,
        responder_id: user.id,
        status: 'pending',
        reciprocal_date: responseData.reciprocal_date,
        reciprocal_start_time: responseData.reciprocal_start_time,
        reciprocal_end_time: responseData.reciprocal_end_time,
        reciprocal_child_id: responseData.reciprocal_child_id,
        notes: responseData.notes
      });

      setShowResponseForm(false);
      onActionComplete();
    } catch (error) {
      console.error('Error:', error);
      alert('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptResponse = async (careResponseId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc('handle_care_response_action', {
        p_care_response_id: careResponseId,
        p_action: 'accept'
      });

      if (error) {
        console.error('Error accepting response:', error);
        alert('Failed to accept response');
        return;
      }

      onActionComplete();
    } catch (error) {
      console.error('Error:', error);
      alert('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDeclineResponse = async (careResponseId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc('handle_care_response_action', {
        p_care_response_id: careResponseId,
        p_action: 'decline'
      });

      if (error) {
        console.error('Error declining response:', error);
        alert('Failed to decline response');
        return;
      }

      onActionComplete();
    } catch (error) {
      console.error('Error:', error);
      alert('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const renderCareRequest = () => {
    // Debug logging
    console.log('=== RENDER DEBUG ===');
    console.log('Current user:', currentUser?.id);
    console.log('Message sender_id:', message.sender_id);
    console.log('Is requester?', currentUser && message.sender_id === currentUser.id);
    console.log('Existing response:', existingResponse);
    console.log('Responses to request:', responsesToRequest);
    console.log('===================');

    // If user is the requester, show different UI with responses
    if (currentUser && message.sender_id === currentUser.id) {
      return (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-medium text-blue-900 mb-2">
                Your Care Request
              </h3>
              <div className="text-sm text-blue-800 space-y-1">
                <p><strong>Date:</strong> {formatDateOnly(message.action_data?.request_date)}</p>
                <p><strong>Time:</strong> {formatTime(message.action_data?.start_time)} - {formatTime(message.action_data?.end_time)}</p>
                <p><strong>Group:</strong> {message.action_data?.group_name}</p>
              </div>
              <p className="text-blue-700 mt-2">{message.content}</p>
              
              {/* Show responses if any */}
              {responsesToRequest.length > 0 && (
                <div className="mt-4 space-y-3">
                  <h4 className="font-medium text-blue-900">Responses Received:</h4>
                  {responsesToRequest.map((response) => (
                    <div key={response.id} className="bg-white p-3 rounded border border-blue-200">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm text-blue-800">
                            <strong>From:</strong> {response.profiles?.full_name || 'Unknown'}
                          </p>
                          <p className="text-sm text-blue-800">
                            <strong>Reciprocal Date:</strong> {formatDateOnly(response.reciprocal_date)}
                          </p>
                          <p className="text-sm text-blue-800">
                            <strong>Reciprocal Time:</strong> {formatTime(response.reciprocal_start_time)} - {formatTime(response.reciprocal_end_time)}
                          </p>
                          {response.notes && (
                            <p className="text-sm text-blue-800">
                              <strong>Notes:</strong> {response.notes}
                            </p>
                          )}
                          <p className="text-sm text-blue-800">
                            <strong>Status:</strong> {response.status}
                          </p>
                        </div>
                        {response.status === 'pending' && (
                          <div className="ml-4 space-x-2">
                            <button
                              onClick={() => handleAcceptResponse(response.id)}
                              disabled={loading}
                              className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
                            >
                              {loading ? 'Processing...' : 'Accept'}
                            </button>
                            <button
                              onClick={() => handleDeclineResponse(response.id)}
                              disabled={loading}
                              className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50"
                            >
                              {loading ? 'Processing...' : 'Decline'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="ml-4 text-sm text-blue-600">
              {responsesToRequest.length > 0 ? `${responsesToRequest.length} response(s) received` : 'Waiting for responses...'}
            </div>
          </div>
        </div>
      );
    }

    // If user has already responded, show response status
    if (existingResponse) {
      return (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-medium text-green-900 mb-2">
                Care Request from {message.action_data?.requester_name}
              </h3>
              <div className="text-sm text-green-800 space-y-1">
                <p><strong>Date:</strong> {formatDateOnly(message.action_data?.request_date)}</p>
                <p><strong>Time:</strong> {formatTime(message.action_data?.start_time)} - {formatTime(message.action_data?.end_time)}</p>
                <p><strong>Group:</strong> {message.action_data?.group_name}</p>
              </div>
              <p className="text-green-700 mt-2">{message.content}</p>
              <div className="mt-2 p-2 bg-green-100 rounded">
                <p className="text-sm text-green-800">
                  <strong>Your Response:</strong> {existingResponse.status}
                </p>
                {existingResponse.reciprocal_date && (
                  <p className="text-sm text-green-800">
                    <strong>Reciprocal Date:</strong> {formatDateOnly(existingResponse.reciprocal_date)}
                  </p>
                )}
                {existingResponse.reciprocal_start_time && existingResponse.reciprocal_end_time && (
                  <p className="text-sm text-green-800">
                    <strong>Reciprocal Time:</strong> {formatTime(existingResponse.reciprocal_start_time)} - {formatTime(existingResponse.reciprocal_end_time)}
                  </p>
                )}
              </div>
            </div>
            <div className="ml-4 text-sm text-green-600">
              Response: {existingResponse.status}
            </div>
          </div>
        </div>
      );
    }

    // Default: show respond button for new requests
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-medium text-blue-900 mb-2">
              Care Request from {message.action_data?.requester_name}
            </h3>
            <div className="text-sm text-blue-800 space-y-1">
              <p><strong>Date:</strong> {formatDateOnly(message.action_data?.request_date)}</p>
              <p><strong>Time:</strong> {formatTime(message.action_data?.start_time)} - {formatTime(message.action_data?.end_time)}</p>
              <p><strong>Group:</strong> {message.action_data?.group_name}</p>
            </div>
            <p className="text-blue-700 mt-2">{message.content}</p>
          </div>
          <button
            onClick={handleCareRequest}
            disabled={loading}
            className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Respond'}
          </button>
        </div>
      </div>
    );
  };

  const renderCareResponse = () => (
    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-medium text-green-900 mb-2">
            Care Response from {message.action_data?.responder_name}
          </h3>
          <div className="text-sm text-green-800 space-y-1">
            <p><strong>Reciprocal Date:</strong> {formatDateOnly(message.action_data?.reciprocal_date)}</p>
            <p><strong>Reciprocal Time:</strong> {formatTime(message.action_data?.reciprocal_start_time)} - {formatTime(message.action_data?.reciprocal_end_time)}</p>
          </div>
          <p className="text-green-700 mt-2">{message.content}</p>
        </div>
        <div className="ml-4 space-x-2">
          <button
            onClick={handleAcceptResponse}
            disabled={loading}
            className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Accept'}
          </button>
          <button
            onClick={handleDeclineResponse}
            disabled={loading}
            className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Decline'}
          </button>
        </div>
      </div>
    </div>
  );

  const renderResponseForm = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Submit Reciprocal Care Response
            </h2>
            <button
              onClick={() => setShowResponseForm(false)}
              className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
            >
              ×
            </button>
          </div>
          
          <form onSubmit={handleSubmitResponse} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reciprocal Date
                </label>
                <input
                  type="date"
                  required
                  value={responseData.reciprocal_date}
                  onChange={(e) => setResponseData(prev => ({ ...prev, reciprocal_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reciprocal Start Time
                </label>
                <input
                  type="time"
                  required
                  value={responseData.reciprocal_start_time}
                  onChange={(e) => setResponseData(prev => ({ ...prev, reciprocal_start_time: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reciprocal End Time
                </label>
                <input
                  type="time"
                  required
                  value={responseData.reciprocal_end_time}
                  onChange={(e) => setResponseData(prev => ({ ...prev, reciprocal_end_time: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Child for Reciprocal Care
                </label>
                <select
                  required
                  value={responseData.reciprocal_child_id}
                  onChange={(e) => setResponseData(prev => ({ ...prev, reciprocal_child_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a child</option>
                  {children.map(child => (
                    <option key={child.id} value={child.id}>
                      {child.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  value={responseData.notes}
                  onChange={(e) => setResponseData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Any additional details about your reciprocal care offer..."
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setShowResponseForm(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Submit Response'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  // Render based on message type
  switch (message.message_type) {
    case 'care_request':
      return (
        <>
          {renderCareRequest()}
          {showResponseForm && renderResponseForm()}
        </>
      );
    case 'care_response':
      return renderCareResponse();
    case 'care_accepted':
    case 'care_declined':
      return (
        <div className={`border-l-4 ${message.message_type === 'care_accepted' ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'} p-4 mb-4`}>
          <p className={`font-medium ${message.message_type === 'care_accepted' ? 'text-green-900' : 'text-red-900'}`}>
            {message.subject}
          </p>
          <p className={`text-sm ${message.message_type === 'care_accepted' ? 'text-green-800' : 'text-red-800'} mt-1`}>
            {message.content}
          </p>
        </div>
      );
    default:
      return null;
  }
}
