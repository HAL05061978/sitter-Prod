'use client';

import { useState, useEffect } from 'react';
import Header from '../components/Header';
import { supabase } from '../lib/supabase';
import { formatDateOnly, formatTime, formatTimestampDate } from '../lib/date-utils';

interface CareRequest {
  care_request_id: string;
  group_id: string;
  group_name: string;
  requester_id: string;           // Changed from requesting_parent_id
  requester_name: string;         // Changed from requesting_parent_name
  requested_date: string;         // Changed from care_date
  start_time: string;
  end_time: string;
  notes: string;
  status: string;
  created_at: string;
  response_count: number;
  accepted_response_count: number;
}

interface CareResponse {
  care_response_id: string;
  care_request_id: string;
  group_id: string;
  group_name: string;
  requester_id: string;           // Changed from requesting_parent_id
  requester_name: string;         // Changed from requesting_parent_name
  requested_date: string;         // Changed from care_date
  start_time: string;
  end_time: string;
  response_notes?: string;        // Added for response notes
  responder_id?: string;          // Added for responses to my requests
  responder_name?: string;        // Added for responses to my requests
  status: string;
  created_at: string;
  reciprocal_date: string;
  reciprocal_start_time: string;
  reciprocal_end_time: string;
}

interface Group {
   id: string;
  name: string;
}

interface Child {
  id: string;
  name: string;
  group_id: string;
 }

// Open Block Invitations Section Component
function OpenBlockInvitationsSection() {
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptingInvitation, setAcceptingInvitation] = useState<any>(null);
  const [availableChildren, setAvailableChildren] = useState<Array<{ id: string; full_name: string }>>([]);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchOpenBlockInvitations();
  }, []);

  const fetchOpenBlockInvitations = async () => {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('User not authenticated');
        return;
      }

      console.log('🔍 DEBUG: Fetching open block invitations for user:', user.id);

      // First, let's see what's actually in the database
      const { data: rawData, error: rawError } = await supabase
        .from('care_responses')
        .select('*')
        .eq('response_type', 'pending')  // Changed from 'invitation' to 'pending'
        .eq('status', 'pending');

      console.log('🔍 DEBUG: Raw care_responses data:', rawData);
      console.log('🔍 DEBUG: Raw care_responses error:', rawError);

      // Test the simple function
      const { data: testData, error: testError } = await supabase.rpc('test_open_block_invitations', {
        p_parent_id: user.id
      });

      console.log('🔍 DEBUG: Test function data:', testData);
      console.log('🔍 DEBUG: Test function error:', testError);

      // Call the Supabase function to get open block invitations
      const { data, error } = await supabase.rpc('get_open_block_invitations', {
        p_parent_id: user.id
      });

      console.log('🔍 DEBUG: Function response data:', data);
      console.log('🔍 DEBUG: Function response error:', error);

      if (error) {
        console.error('Error fetching invitations:', error);
        return;
      }

      setInvitations(data || []);
    } catch (error) {
      console.error('Error fetching invitations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (invitation: any) => {
    try {
      // Fetch available children for the current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: childrenData, error: childrenError } = await supabase
        .from('children')
        .select('id, full_name')
        .eq('parent_id', user.id)
        .order('full_name');

      if (childrenError) throw childrenError;

      // Auto-select the first (or only) child
      if (childrenData && childrenData.length > 0) {
        const activeChild = childrenData[0]; // Get the first child
        console.log('Auto-accepting with child:', activeChild);
        
        // Set available children first
        setAvailableChildren(childrenData);
        
        // Auto-accept with the active child (don't set acceptingInvitation to avoid showing UI)
        await handleAcceptanceSubmit(invitation, activeChild.id);
        return; // Exit early, no need to show selection UI
      }

      // Fallback: show selection if no children found
      setAvailableChildren(childrenData || []);
      setAcceptingInvitation(invitation);
    } catch (error) {
      console.error('Error preparing acceptance:', error);
      alert('Error preparing acceptance. Please try again.');
    }
  };

  const handleAcceptanceSubmit = async (invitation?: any, childId?: string) => {
    console.log('handleAcceptanceSubmit called with invitation:', invitation);
    console.log('invitation.invitation_id:', invitation?.invitation_id);
    
    // Use passed invitation or fall back to acceptingInvitation state
    const targetInvitation = invitation || acceptingInvitation;
    console.log('targetInvitation:', targetInvitation);
    console.log('targetInvitation.invitation_id:', targetInvitation?.invitation_id);
    
    if (!targetInvitation) {
      console.error('No invitation provided');
      return;
    }
    
    try {
      setProcessing(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Log the exact parameters being sent to the function
      const functionParams = {
        p_care_response_id: targetInvitation.care_response_id,
        p_accepting_parent_id: user.id,
        p_accepted_child_id: childId || (availableChildren && availableChildren.length > 0 ? availableChildren[0].id : null)
      };
      console.log('=== CALLING SUPABASE FUNCTION ===');
      console.log('Function name: accept_open_block_invitation');
      console.log('Parameters:', functionParams);
      console.log('User ID:', user.id);
      console.log('Child ID:', childId || (availableChildren && availableChildren.length > 0 ? availableChildren[0].id : null));
      
      const { error } = await supabase.rpc('accept_open_block_invitation', functionParams);

      if (!childId && (!availableChildren || availableChildren.length === 0)) {
        throw new Error('No child selected and no children available');
      }

      if (error) throw error;

      // Success! Refresh the invitations list
      await fetchOpenBlockInvitations();
      setAcceptingInvitation(null);
      
      alert('Invitation accepted successfully! Your child has been added to the care block.');
    } catch (error) {
      console.error('=== ERROR DETAILS ===');
      console.error('Error accepting invitation:', error);
      console.error('Error type:', typeof error);
      console.error('Error message:', error?.message);
      console.error('Error code:', error?.code);
      console.error('Error details:', error?.details);
      console.error('Full error object:', JSON.stringify(error, null, 2));
      alert('Error accepting invitation. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleDecline = async (invitation: any) => {
    if (!confirm('Are you sure you want to decline this invitation?')) return;

    try {
      setProcessing(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase.rpc('decline_open_block_invitation', {
        p_care_response_id: invitation.care_response_id,
        p_declining_parent_id: user.id
      });

      if (error) throw error;

      // Refresh the invitations list
      await fetchOpenBlockInvitations();
      alert('Invitation declined successfully.');
    } catch (error) {
      console.error('Error declining invitation:', error);
      alert('Error declining invitation. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spulse">
          <div className="h-8 bg-gray-200 rounded w-48 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading open block invitations...</p>
        </div>
      </div>
    );
  }

  if (acceptingInvitation) {
    return (
      <div className="border rounded-lg p-4 bg-blue-50">
        <h4 className="font-medium text-blue-900 mb-3">Accept Open Block Invitation</h4>
        <p className="text-sm text-blue-700 mb-4">
          You're accepting an invitation to join {acceptingInvitation.open_block_parent_name}'s care block
        </p>
        
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">Select Child to Join Care Block</label>
          <select 
            onChange={(e) => {
              if (e.target.value) {
                handleAcceptanceSubmit(acceptingInvitation, e.target.value);
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            disabled={processing}
          >
            <option value="">Select a child...</option>
            {availableChildren.map((child) => (
              <option key={child.id} value={child.id}>
                {child.full_name}
              </option>
            ))}
          </select>
          
          <div className="flex gap-3">
            <button
              onClick={() => setAcceptingInvitation(null)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
              disabled={processing}
            >
              Cancel
            </button>
            <button
              onClick={() => setAcceptingInvitation(null)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              disabled={processing}
            >
              {processing ? 'Processing...' : 'Accept Invitation'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (invitations.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-400 mb-4">
          <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Open Block Invitations</h3>
        <p className="text-gray-600">
          You don't have any pending open block invitations at the moment.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {invitations.map((invitation) => (
        <div key={invitation.invitation_id || `invitation-${invitation.care_response_id}`} className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-medium text-gray-900">
                {invitation.open_block_parent_name} is inviting you to join their care block
              </h3>
              <div className="mt-2 space-y-2">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Reciprocal Care Block:</span> {
                    invitation.reciprocal_date && invitation.reciprocal_start_time && invitation.reciprocal_end_time
                      ? `${formatDateOnly(invitation.reciprocal_date)} from ${invitation.reciprocal_start_time} to ${invitation.reciprocal_end_time}`
                      : 'Reciprocal care details will be available after acceptance'
                  }
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Status:</span> Pending invitation - {
                    invitation.reciprocal_date && invitation.reciprocal_start_time && invitation.reciprocal_end_time
                      ? 'You\'ll provide care during the time above'
                      : 'Reciprocal care details will be available after acceptance'
                  }
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Group:</span> {invitation.group_name}
                </p>
                {invitation.notes && (
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Notes:</span> {invitation.notes}
                  </p>
                )}
              </div>
              <div className="flex items-center space-x-4 mt-3">
                <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">
                  {invitation.status}
                </span>
                <span className="text-sm text-gray-500">
                  {formatDateOnly(invitation.created_at)}
                </span>
              </div>
            </div>
            
            {invitation.status === 'pending' && (
              <div className="flex gap-2 ml-4">
                <button
                  onClick={() => handleAccept(invitation)}
                  disabled={processing}
                  className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:bg-gray-400"
                >
                  Accept
                </button>
                <button
                  onClick={() => handleDecline(invitation)}
                  disabled={processing}
                  className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:bg-gray-400"
                >
                  Decline
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SchedulerPage() {
  const [careRequests, setCareRequests] = useState<CareRequest[]>([]);
  const [careResponses, setCareResponses] = useState<CareResponse[]>([]);
  const [mySubmittedResponses, setMySubmittedResponses] = useState<CareResponse[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Form state for new care request
  const [showNewRequestForm, setShowNewRequestForm] = useState(false);
  const [newRequest, setNewRequest] = useState({
    group_id: '',
    child_id: '',
    care_date: '',
    start_time: '',
    end_time: '',
    notes: ''
  });
  
  // Form state for reciprocal response
  const [showResponseForm, setShowResponseForm] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<CareRequest | null>(null);
  const [reciprocalResponse, setReciprocalResponse] = useState({
    reciprocal_date: '',
    reciprocal_start_time: '',
    reciprocal_end_time: '',
    reciprocal_child_id: '',
    notes: ''
  });

  

  useEffect(() => {
    fetchData();
  }, []);

  // Handle escape key for modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showResponseForm) {
        setShowResponseForm(false);
        setSelectedRequest(null);
      }
    };

    if (showResponseForm) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [showResponseForm]);

  // Fetch children when group changes
  useEffect(() => {
    console.log('🔍 DEBUG: useEffect triggered');
    console.log('🔍 DEBUG: newRequest.group_id =', newRequest.group_id);
    
    if (newRequest.group_id) {
      console.log('🔍 DEBUG: Calling fetchChildrenForGroup');
      fetchChildrenForGroup(newRequest.group_id);
    } else {
      console.log('🔍 DEBUG: No group selected, clearing children');
      setChildren([]);
    }
  }, [newRequest.group_id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('User not authenticated');
        return;
      }
      
      // Fetch user's groups
      const { data: groupsData, error: groupsError } = await supabase
        .from('group_members')
        .select(`
          group_id,
          groups!inner(id, name)
        `)
        .eq('profile_id', user.id)
        .eq('status', 'active');
      
      if (groupsError) {
        console.error('Error fetching groups:', groupsError);
        return;
      }
      
      const userGroups = groupsData.map(item => ({
        id: item.groups.id,
        name: item.groups.name
      }));
      setGroups(userGroups);

      // Fetch care requests and responses
      console.log('🔍 DEBUG: Fetching care requests for user:', user.id);
      const { data: requests, error: requestsError } = await supabase.rpc('get_reciprocal_care_requests', {
        parent_id: user.id
      });

      if (requestsError) {
        console.error('❌ Error fetching care requests:', requestsError);
        setCareRequests([]);
      } else {
        console.log('✅ Care requests fetched:', requests);
        setCareRequests(requests || []);
      }

            console.log('🔍 DEBUG: Fetching care responses for user:', user.id);
      const { data: responses, error: responsesError } = await supabase.rpc('get_reciprocal_care_responses', {
        parent_id: user.id
      });

      if (responsesError) {
        console.error('❌ Error fetching care responses:', responsesError);
        setCareResponses([]);
        } else {
        console.log('✅ Care responses fetched:', responses);
        setCareResponses(responses || []);
      }

      // Also fetch responses to requests I made (for accepting)
      console.log('🔍 DEBUG: Fetching responses to my requests for user:', user.id);
      const { data: responsesToMyRequests, error: responsesToMyRequestsError } = await supabase.rpc('get_responses_for_requester', {
        p_requester_id: user.id
      });

      if (responsesToMyRequestsError) {
        console.error('❌ Error fetching responses to my requests:', responsesToMyRequestsError);
      } else {
        console.log('✅ Responses to my requests fetched:', responsesToMyRequests);
        // Debug: Log each response status
        if (responsesToMyRequests) {
          responsesToMyRequests.forEach((response, index) => {
            console.log(`🔍 Response ${index}: ID=${response.care_response_id}, Status=${response.status}, Responder=${response.responder_name}`);
          });
        }
      }

      // Fetch my submitted responses (for "My Responses" section)
      console.log('🔍 DEBUG: Fetching my submitted responses for user:', user.id);
      const { data: mySubmittedResponses, error: myResponsesError } = await supabase.rpc('get_my_submitted_responses', {
        parent_id: user.id
      });

      if (myResponsesError) {
        console.error('❌ Error fetching my submitted responses:', myResponsesError);
        setMySubmittedResponses([]);
      } else {
        console.log('✅ My submitted responses fetched:', mySubmittedResponses);
        setMySubmittedResponses(mySubmittedResponses || []);
      }

      // Merge all responses - only include valid, non-duplicate responses
      const allResponses = [
        ...(responses || []), 
        ...(responsesToMyRequests || [])
      ];
      
      // Remove duplicates and invalid entries
      const uniqueResponses = allResponses.filter((response, index, self) => {
        // Remove entries with missing required fields
        if (!response.care_response_id || !response.care_request_id || !response.group_name || !response.requester_name) {
          return false;
        }
        
        // Remove duplicates based on care_response_id
        return index === self.findIndex(r => r.care_response_id === response.care_response_id);
      });
      
      setCareResponses(uniqueResponses);

    } catch (err) {
      console.error('Error:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchChildrenForGroup = async (groupId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      console.log('🔍 DEBUG: fetchChildrenForGroup called');
      console.log('🔍 DEBUG: groupId =', groupId);
      console.log('🔍 DEBUG: user.id =', user.id);

             // Get children that belong to this parent and are active in the selected group
      const { data, error } = await supabase
         .from('child_group_members')
         .select(`
           children!inner(id, full_name, parent_id),
           group_id
         `)
         .eq('group_id', groupId)
         .eq('active', true)
         .eq('children.parent_id', user.id);

      if (error) {
        console.error('❌ Error fetching children:', error);
        return;
      }

             console.log('🔍 DEBUG: Raw query result:', data);
       console.log('🔍 DEBUG: First item structure:', data[0]);
       console.log('🔍 DEBUG: First item children:', data[0]?.children);
       console.log('🔍 DEBUG: First item children.full_name:', data[0]?.children?.full_name);

       const groupChildren = data.map(item => ({
         id: item.children?.id,
         name: item.children?.full_name,
         group_id: item.group_id
       }));

       console.log('🔍 DEBUG: Processed children:', groupChildren);
      setChildren(groupChildren);
    } catch (err) {
      console.error('❌ Error in fetchChildrenForGroup:', err);
    }
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

             const { data, error } = await supabase.rpc('create_reciprocal_care_request', {
         requester_id: user.id,           // Changed from requesting_parent_id
         group_id: newRequest.group_id,
         requested_date: newRequest.care_date,  // Changed from care_date
         start_time: newRequest.start_time,
         end_time: newRequest.end_time,
         child_id: newRequest.child_id,         // Added child_id
         notes: newRequest.notes || null
       });

      if (error) {
        console.error('Error creating care request:', error);
        setError('Failed to create care request');
        return;
      }

      // Send notifications to group members via messages
      if (data) {
        await supabase.rpc('send_care_request_notifications', {
          p_care_request_id: data
        });
      }

      // Reset form and refresh data
      setNewRequest({
        group_id: '',
        child_id: '',
        care_date: '',
        start_time: '',
        end_time: '',
        notes: ''
      });
      setShowNewRequestForm(false);
      fetchData();
      
    } catch (err) {
      console.error('Error:', err);
      setError('An unexpected error occurred');
    }
  };

  const handleOpenResponseForm = async (request: CareRequest) => {
    setSelectedRequest(request);
    setShowResponseForm(true);
    
    // Fetch children for the responding parent in this group
    await fetchChildrenForGroup(request.group_id);
  };

  const handleSubmitResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedRequest) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase.rpc('submit_reciprocal_care_response', {
        care_request_id: selectedRequest.care_request_id,
        responding_parent_id: user.id,
        reciprocal_date: reciprocalResponse.reciprocal_date,
        reciprocal_start_time: reciprocalResponse.reciprocal_start_time,
        reciprocal_end_time: reciprocalResponse.reciprocal_end_time,
        reciprocal_child_id: reciprocalResponse.reciprocal_child_id,
        notes: reciprocalResponse.notes || null
      });

      if (error) {
        console.error('Error submitting response:', error);
        setError('Failed to submit response');
        return;
      }

      // Send notification message to requester
      if (data) {
        await supabase.rpc('send_care_response_notifications', {
          p_care_response_id: data
        });
      }

      // Reset form and refresh data
      setReciprocalResponse({
        reciprocal_date: '',
        reciprocal_start_time: '',
        reciprocal_end_time: '',
        reciprocal_child_id: '',
        notes: ''
      });
      setShowResponseForm(false);
      setSelectedRequest(null);
      fetchData();
      
    } catch (err) {
      console.error('Error:', err);
      setError('An unexpected error occurred');
    }
  };

  const handleAcceptResponse = async (responseId: string) => {
    try {
      const { error } = await supabase.rpc('accept_reciprocal_care_response', {
        p_care_response_id: responseId
      });

       if (error) {
        console.error('Error accepting response:', error);
        setError('Failed to accept response');
         return;
       }

      fetchData();
      
    } catch (err) {
      console.error('Error:', err);
      setError('An unexpected error occurred');
    }
  };

  const formatTime = (time: string | undefined | null) => {
    if (!time) return '';
    try {
      return time.substring(0, 5);
    } catch (error) {
      console.warn('formatTime error:', { time, error });
      return '';
    }
  };

  const resetNewRequestForm = () => {
    setNewRequest({
      group_id: '',
      child_id: '',
      care_date: '',
      start_time: '',
      end_time: '',
      notes: ''
    });
    setChildren([]);
    setShowNewRequestForm(false);
  };

  if (loading) {
  return (
      <div className="min-h-screen bg-gray-50">
      <Header currentPage="scheduler" />
        <div className="p-6">
          <div className="max-w-7xl mx-auto">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-48 mb-6"></div>
        <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-32 bg-gray-200 rounded"></div>
                ))}
                  </div>
                </div>
                </div>
              </div>
            </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header currentPage="scheduler" />
        <div className="p-6">
          <div className="max-w-7xl mx-auto">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">{error}</p>
          <button
                onClick={fetchData}
                className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Try Again
          </button>
        </div>
                  </div>
                </div>
                </div>
    );
  }
                 
                 return (
    <div className="min-h-screen bg-gray-50">
      <Header currentPage="scheduler" />
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Scheduler</h1>
                              <button
              onClick={() => setShowNewRequestForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                              >
              New Care Request
                              </button>
          </div>

          {/* New Care Request Modal */}
          {showNewRequestForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-900">Create New Care Request</h2>
                                  <button
                      onClick={resetNewRequestForm}
                      className="text-gray-400 hover:text-gray-600"
                                  >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                                  </button>
         </div>
       </div>

                <form onSubmit={handleCreateRequest} className="p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Group *
                      </label>
                  <select
                         required
                         value={newRequest.group_id}
                         onChange={(e) => {
                           console.log('🔍 DEBUG: Group selection changed');
                           console.log('🔍 DEBUG: Selected group ID =', e.target.value);
                           setNewRequest(prev => ({ ...prev, group_id: e.target.value, child_id: '' }));
                         }}
                         className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a group</option>
                        {groups.map(group => (
                          <option key={group.id} value={group.id}>
                            {group.name}
                          </option>
                    ))}
                  </select>
                </div>

                <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Child *
                      </label>
                  <select
                        required
                        value={newRequest.child_id}
                        onChange={(e) => setNewRequest(prev => ({ ...prev, child_id: (e.target as HTMLSelectElement).value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={!newRequest.group_id || children.length === 0}
                      >
                        <option value="">
                          {!newRequest.group_id 
                            ? 'Select a group first' 
                            : children.length === 0 
                            ? 'No active children in this group' 
                            : 'Select a child'
                          }
                        </option>
                    {children.map(child => (
                          <option key={child.id} value={child.id}>
                            {child.name}
                          </option>
                    ))}
                  </select>
                </div>

                <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Date *
                      </label>
                  <input
                    type="date"
                        required
                        value={newRequest.care_date}
                        onChange={(e) => setNewRequest(prev => ({ ...prev, care_date: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                  <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Start Time *
                      </label>
                    <input
                      type="time"
                        required
                        value={newRequest.start_time}
                        onChange={(e) => setNewRequest(prev => ({ ...prev, start_time: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                    
                  <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        End Time *
                      </label>
                    <input
                      type="time"
                        required
                        value={newRequest.end_time}
                        onChange={(e) => setNewRequest(prev => ({ ...prev, end_time: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes (Optional)
                    </label>
                  <textarea
                      value={newRequest.notes}
                      onChange={(e) => setNewRequest(prev => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Any additional details about the care needed..."
                  />
                </div>
                  
                  <div className="flex justify-end space-x-3 pt-4">
              <button
                      type="button"
                      onClick={resetNewRequestForm}
                      className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                      Cancel
              </button>
              <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                      Create Request
              </button>
            </div>
                </form>
          </div>
        </div>
      )}

                    {/* Reciprocal Response Modal */}
          {showResponseForm && selectedRequest && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setShowResponseForm(false);
                  setSelectedRequest(null);
                }
              }}
            >
              <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-900">
                      Submit Reciprocal Care Response
                    </h2>
                    <button
                      onClick={() => {
                        setShowResponseForm(false);
                        setSelectedRequest(null);
                      }}
                      className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                    >
                      ×
                    </button>
                  </div>
                  
                  <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">
                      <strong>Request:</strong> {selectedRequest.requester_name} needs care on{' '}
                      {formatDateOnly(selectedRequest.requested_date)} from{' '}
                      {formatTime(selectedRequest.start_time)} to {formatTime(selectedRequest.end_time)}
                    </p>
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
                          value={reciprocalResponse.reciprocal_date}
                          onChange={(e) => setReciprocalResponse(prev => ({ ...prev, reciprocal_date: e.target.value }))}
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
                          value={reciprocalResponse.reciprocal_start_time}
                          onChange={(e) => setReciprocalResponse(prev => ({ ...prev, reciprocal_start_time: e.target.value }))}
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
                          value={reciprocalResponse.reciprocal_end_time}
                          onChange={(e) => setReciprocalResponse(prev => ({ ...prev, reciprocal_end_time: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Child for Reciprocal Care
                        </label>
                        <select
                          required
                          value={reciprocalResponse.reciprocal_child_id}
                          onChange={(e) => setReciprocalResponse(prev => ({ ...prev, reciprocal_child_id: e.target.value }))}
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
                          value={reciprocalResponse.notes}
                          onChange={(e) => setReciprocalResponse(prev => ({ ...prev, notes: e.target.value }))}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Any additional details about your reciprocal care offer..."
                        />
                      </div>
                    </div>
                    
                    <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                      <button
                        type="button"
                        onClick={() => {
                          setShowResponseForm(false);
                          setSelectedRequest(null);
                        }}
                        className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                      >
                        Submit Response
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

                    {/* My Care Requests */}
          <div className="bg-white rounded-lg shadow mb-8">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">My Care Requests</h2>
            </div>
            <div className="p-6">
              {careRequests.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No care requests yet. Create one to get started!</p>
              ) : (
                <div className="space-y-4">
                  {careRequests.map(request => (
                    <div key={request.care_request_id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900">
                            {request.group_name} - {formatDateOnly(request.requested_date)}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {formatTime(request.start_time)} - {formatTime(request.end_time)}
                          </p>
                          {request.notes && (
                            <p className="text-sm text-gray-600 mt-1">{request.notes}</p>
                          )}
                          <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                            <span>Status: {request.status}</span>
                            <span>{request.response_count} responses</span>
                            {request.accepted_response_count > 0 && (
                              <span className="text-green-600 font-medium">
                                {request.accepted_response_count} accepted
                              </span>
                            )}
                          </div>
                        </div>
                                                  <div className="text-sm text-gray-500">
                            {formatDateOnly(request.created_at)}
                          </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Responses to My Requests - For Requester to Accept */}
          <div className="bg-white rounded-lg shadow mb-8">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Responses to My Requests</h2>
            </div>
            <div className="p-6">
              {careRequests.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No care requests to show responses for.</p>
              ) : (
               <div className="space-y-4">
                  {careRequests.map(request => {
                    // Find responses for this request
                    const requestResponses = careResponses.filter(
                      response => response.care_request_id === request.care_request_id && response.status === 'submitted'
                    );
                    
                    // Debug: Log what we're finding
                    console.log(`🔍 Request ${request.care_request_id}: Found ${requestResponses.length} submitted responses`);
                    console.log(`🔍 All responses for this request:`, careResponses.filter(r => r.care_request_id === request.care_request_id));
                    
                    if (requestResponses.length === 0) {
                      return null; // Don't show section if no responses
                    }
                    
                    return (
                      <div key={request.care_request_id} className="border border-gray-200 rounded-lg p-4">
                        <div className="mb-4">
                          <h3 className="font-medium text-gray-900 mb-2">
                            {request.group_name} - {formatDateOnly(request.requested_date)}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {formatTime(request.start_time)} - {formatTime(request.end_time)}
                          </p>
                 </div>

                        <div className="space-y-3">
                          {requestResponses.map(response => (
                            <div key={response.care_response_id} className="bg-gray-50 rounded-lg p-3 border-l-4 border-blue-500">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <p className="font-medium text-gray-900">
                                    Response from: {response.responder_name || 'Unknown User'}
                                  </p>
                                  <p className="text-sm text-gray-600 mt-1">
                                    Reciprocal care: {formatDateOnly(response.reciprocal_date)} from{' '}
                                    {formatTime(response.reciprocal_start_time)} to {formatTime(response.reciprocal_end_time)}
                                  </p>
                                  {response.response_notes && (
                                    <p className="text-sm text-gray-500 mt-1">
                                      Notes: {response.response_notes}
                                    </p>
                                  )}
                   </div>
                                <button
                                  onClick={() => handleAcceptResponse(response.care_response_id)}
                                  className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 ml-4"
                                >
                                  Accept
                                </button>
                   </div>
                 </div>
                          ))}
               </div>
             </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Care Responses I Need to Handle */}
          <div className="bg-white rounded-lg shadow mb-8">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Care Requests I Need to Respond To</h2>
            </div>
            <div className="p-6">
              {careResponses.filter(r => r.status === 'pending').length === 0 ? (
                <p className="text-gray-500 text-center py-8">No pending care requests to respond to.</p>
              ) : (
                <div className="space-y-4">
                                    {careResponses
                    .filter(response => response.status === 'pending')
                    .map((response, index) => (
                      <div key={response.care_response_id || `pending-${index}`} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                                                         <h3 className="font-medium text-gray-900">
                               {response.group_name} - {response.requester_name}
                             </h3>
                             <p className="text-sm text-gray-600">
                               Needs care on {formatDateOnly(response.requested_date)} from{' '}
                               {formatTime(response.start_time)} to {formatTime(response.end_time)}
                             </p>
                            <p className="text-sm text-gray-500 mt-1">
                              Requested on {formatDateOnly(response.created_at)}
                            </p>
                          </div>
               <button
                            onClick={() => handleOpenResponseForm({
                               care_request_id: response.care_request_id,
                               group_id: response.group_id,
                               group_name: response.group_name,
                               requester_id: response.requester_id,
                               requester_name: response.requester_name,
                               requested_date: response.requested_date,
                               start_time: response.start_time,
                               end_time: response.end_time,
                               notes: '',
                               status: 'pending',
                               created_at: response.created_at,
                               response_count: 0,
                               accepted_response_count: 0
                             })}
                            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                          >
                            Respond
               </button>
             </div>
           </div>
                    ))}
         </div>
       )}
            </div>
          </div>

          {/* My Responses */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">My Responses</h2>
            </div>
            <div className="p-6">
              {mySubmittedResponses && mySubmittedResponses.length > 0 ? (
                <div className="space-y-4">
                  {mySubmittedResponses.map((response, index) => (
                    <div key={response.care_response_id || `submitted-${index}`} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900">
                            {response.group_name} - {response.requester_name}
                          </h3>
                          <p className="text-sm text-gray-600">
                            Original request: {formatDateOnly(response.requested_date)} from{' '}
                            {formatTime(response.start_time)} to {formatTime(response.end_time)}
                          </p>
                          {response.reciprocal_date && (
                            <p className="text-sm text-gray-600">
                              My offer: {formatDateOnly(response.reciprocal_date)} from{' '}
                              {formatTime(response.reciprocal_start_time)} to {formatTime(response.reciprocal_end_time)}
                              {response.reciprocal_child_id && (
                                <span className="ml-2 text-gray-500">
                                  (for child ID: {response.reciprocal_child_id})
                                </span>
                              )}
                            </p>
                          )}
                          <div className="flex items-center space-x-4 mt-2">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              response.status === 'accepted' 
                                ? 'bg-green-100 text-green-800' 
                                : response.status === 'declined'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {response.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No responses submitted yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* Open Block Invitations */}
        <div className="bg-white rounded-lg shadow mt-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Open Block Invitations</h2>
            <p className="text-sm text-gray-600 mt-1">Invitations to join other parents' care blocks</p>
          </div>
          <div className="p-6">
            <OpenBlockInvitationsSection />
          </div>
        </div>
      </div>
    </div>
  );
}




