'use client';

import { useState, useEffect } from 'react';
import Header from '../components/Header';
import { supabase } from '../lib/supabase';
import { formatDateOnly, formatTime, formatTimestampDate } from '../lib/date-utils';
import type { User } from '@supabase/supabase-js';

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
  notes: string;                  // Added for care request notes
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
  const [expandedInvitations, setExpandedInvitations] = useState<Set<string>>(new Set());

  const toggleExpanded = (invitationId: string) => {
    const newExpanded = new Set(expandedInvitations);
    if (newExpanded.has(invitationId)) {
      newExpanded.delete(invitationId);
    } else {
      newExpanded.delete(invitationId);
      newExpanded.add(invitationId);
    }
    setExpandedInvitations(newExpanded);
  };

  useEffect(() => {
    fetchOpenBlockInvitations();
  }, []);

  const fetchOpenBlockInvitations = async () => {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // User not authenticated
        return;
      }

      // Call the Supabase function to get open block invitations
      const { data, error } = await supabase.rpc('get_open_block_invitations', {
        p_parent_id: user.id
      });

      if (error) {
        // Error fetching invitations
        return;
      }

      setInvitations(data || []);
    } catch (error) {
      // Error fetching invitations
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (invitation: any) => {
    try {
      // Fetch available children for the current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get active children from child_group_members using parent_id (not profile_id)
      const { data: childrenData, error: childrenError } = await supabase
        .from('child_group_members')
        .select(`
          child_id,
          children!inner(id, full_name, parent_id)
        `)
        .eq('parent_id', user.id)  // Use parent_id, not profile_id
        .eq('active', true);  // Filter by active status in child_group_members

      if (childrenError) throw childrenError;

      // Transform the nested data structure to match the expected format
      const transformedChildren: Array<{id: string, full_name: string}> = [];
      
      if (childrenData) {
        childrenData.forEach(item => {
          if (item.children && Array.isArray(item.children) && item.children[0]?.id) {
            transformedChildren.push({
              id: item.children[0].id,
              full_name: item.children[0].full_name
            });
          }
        });
      }

      // Auto-select the first (or only) child
      if (transformedChildren.length > 0) {
        const activeChild = transformedChildren[0]; // Get the first child
        
        // Set available children first
        setAvailableChildren(transformedChildren);
        
        // Auto-accept with the active child (don't set acceptingInvitation to avoid showing UI)
        await handleAcceptanceSubmit(invitation, activeChild.id);
        return; // Exit early, no need to show selection UI
      }

      // Fallback: show selection if no children found
      setAvailableChildren(transformedChildren);
      setAcceptingInvitation(invitation);
    } catch (error) {
      showAlertOnce('Error preparing acceptance. Please try again.');
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
      <div className="text-center py-6 bg-gray-50 rounded-lg">
        <p className="text-gray-500">No pending open block invitations at the moment.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {invitations.map((invitation) => (
        <div key={invitation.invitation_id || `invitation-${invitation.care_response_id}`} className="border border-gray-200 rounded-lg overflow-hidden">
          {/* Header - Always Visible */}
          <div 
            className="p-4 bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
            onClick={() => toggleExpanded(invitation.invitation_id || `invitation-${invitation.care_response_id}`)}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h4 className="font-medium text-gray-900">
                  {invitation.open_block_parent_name} is inviting you to join their care block
                </h4>
                <p className="text-sm text-gray-600">
                  Reciprocal care: {
                    invitation.reciprocal_date && invitation.reciprocal_start_time && invitation.reciprocal_end_time
                      ? `${formatDateOnly(invitation.reciprocal_date)} from ${invitation.reciprocal_start_time} to ${invitation.reciprocal_end_time}`
                      : 'Details will be available after acceptance'
                  }
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Group: {invitation.group_name} • {formatDateOnly(invitation.created_at)}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">
                  {invitation.status}
                </span>
                <svg 
                  className={`w-5 h-5 text-gray-400 transition-transform ${
                    expandedInvitations.has(invitation.invitation_id || `invitation-${invitation.care_response_id}`) ? 'rotate-180' : ''
                  }`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Expandable Content */}
          {expandedInvitations.has(invitation.invitation_id || `invitation-${invitation.care_response_id}`) && (
            <div className="p-4 bg-white border-t border-gray-200">
              <div className="space-y-3">
                {invitation.notes && (
                  <p className="text-sm text-gray-600">
                    <strong>Notes:</strong> {invitation.notes}
                  </p>
                )}
                {invitation.status === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAccept(invitation)}
                      disabled={processing}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 transition-colors"
                    >
                      Accept Invitation
                    </button>
                    <button
                      onClick={() => handleDecline(invitation)}
                      disabled={processing}
                      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400 transition-colors"
                    >
                      Decline Invitation
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// RescheduleRequestsSection component removed - reschedule requests are now integrated into UnifiedMessagesInbox

export default function SchedulerPage() {
  const [user, setUser] = useState<User | null>(null);
  const [careRequests, setCareRequests] = useState<CareRequest[]>([]);
  const [careResponses, setCareResponses] = useState<CareResponse[]>([]);
  const [mySubmittedResponses, setMySubmittedResponses] = useState<CareResponse[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Open block invitations state
  const [invitations, setInvitations] = useState<any[]>([]);
  const [processing, setProcessing] = useState(false);
  const [acceptingInvitation, setAcceptingInvitation] = useState<any>(null);
  const [availableChildren, setAvailableChildren] = useState<Array<{ id: string; full_name: string }>>([]);
  
  // Reschedule requests state (integrated into unified system)
  const [rescheduleRequests, setRescheduleRequests] = useState<any[]>([]);
  const [processingReschedule, setProcessingReschedule] = useState(false);
  
  // Group invitations state
  const [groupInvitations, setGroupInvitations] = useState<any[]>([]);
  
  // Event invitations state
  const [eventInvitations, setEventInvitations] = useState<any[]>([]);
  
  // Unread messages tracking
  const [unreadMessages, setUnreadMessages] = useState<Set<string>>(new Set());
  
  // Store actual end times for care requests
  const [actualEndTimes, setActualEndTimes] = useState<Map<string, string>>(new Map());
  
  // Alert cooldown system to prevent duplicate notifications
  let lastAlertTime = 0;
  const ALERT_COOLDOWN = 2000; // 2 seconds
  
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

  // Utility function to extract actual end time from notes for next-day care
  const getActualEndTime = (notes: string, fallbackEndTime: string): string => {
    if (!notes) return fallbackEndTime;
    
    const match = notes.match(/\[Next-day care: Actual end time is ([0-9]{2}:[0-9]{2})\]/);
    return match ? match[1] : fallbackEndTime;
  };

  // Function to fetch actual end times for care responses that don't have notes
  const fetchActualEndTimes = async () => {
    const endTimesMap = new Map<string, string>();
    
    // Get all care response IDs that need notes (both pending and accepted)
    const responseIds = careResponses
      .filter(response => !response.notes)
      .map(response => response.care_request_id);

    if (responseIds.length === 0) return;

    try {
      const { data, error } = await supabase
        .from('care_requests')
        .select('id, notes, end_time')
        .in('id', responseIds);

      if (error) {
        console.error('Error fetching care request notes:', error);
        return;
      }

      data?.forEach(request => {
        const actualEndTime = getActualEndTime(request.notes || '', request.end_time);
        endTimesMap.set(request.id, actualEndTime);
      });

      setActualEndTimes(endTimesMap);
    } catch (error) {
      console.error('Error fetching care request notes:', error);
    }
  };

  // Unified Messages Inbox Component
  function UnifiedMessagesInbox() {
    const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());

    const toggleExpanded = (messageId: string) => {
      const newExpanded = new Set(expandedMessages);
      if (newExpanded.has(messageId)) {
        newExpanded.delete(messageId);
      } else {
        newExpanded.add(messageId);
      }
      setExpandedMessages(newExpanded);
    };

    // Get all messages in chronological order
    const getAllMessages = () => {
      const messages: Array<{
        id: string;
        type: 'open_block_invitation' | 'care_request' | 'care_response' | 'care_accepted' | 'care_declined' | 'open_block_accepted' | 'group_invitation' | 'event_invitation' | 'reschedule_request';
        title: string;
        subtitle: string;
        timestamp: string;
        data: any;
        actions?: React.ReactNode;
      }> = [];

      // Add open block invitations (grouped by person/group)
      const invitationGroups = new Map();
      
      invitations.forEach((invitation, index) => {
        // Group by the parent who made the open block offer
        const key = invitation.open_block_parent_id || invitation.open_block_parent_name;
        
        if (!invitationGroups.has(key)) {
          invitationGroups.set(key, {
            parentName: invitation.open_block_parent_name,
            parentId: invitation.open_block_parent_id,
            invitations: [],
            hasPending: false
          });
        }
        
        const group = invitationGroups.get(key);
        group.invitations.push(invitation);
        
        if (invitation.status === 'pending') {
          group.hasPending = true;
        }
      });

      // Add reschedule requests to unified inbox (grouped by reschedule_group_id to avoid duplicates)
      const rescheduleGroups = new Map();
      
      rescheduleRequests.forEach((request) => {
        // Use reschedule_group_id if available, otherwise fall back to request_id
        const key = request.reschedule_group_id || request.request_id;
        
        if (!rescheduleGroups.has(key)) {
          rescheduleGroups.set(key, {
            request: request,
            responses: []
          });
        }
        
        rescheduleGroups.get(key).responses.push(request);
      });
      
      // Create one message per reschedule request (not per response)
      rescheduleGroups.forEach((group, requestId) => {
        const request = group.request;
        messages.push({
          id: `reschedule-${requestId}`,
          type: 'reschedule_request',
          title: `${request.requester_name} wants to reschedule a care block`,
          subtitle: `From ${request.original_date ? formatDateOnly(request.original_date) : 'Unknown'} ${request.original_start_time || 'Unknown'}-${request.original_end_time || 'Unknown'} to ${formatDateOnly(request.new_date)} ${request.new_start_time}-${request.new_end_time}`,
          timestamp: request.created_at,
          data: request,
          actions: (
            <div className="flex space-x-2">
              <button
                onClick={() => handleRescheduleResponse(request.request_id, 'accepted')}
                disabled={processingReschedule}
                className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
              >
                Accept
              </button>
              <button
                onClick={() => handleRescheduleResponse(request.request_id, 'declined')}
                disabled={processingReschedule}
                className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50"
              >
                Decline
              </button>
            </div>
          )
        });
      });

      // Create one message per open block offer with all their time blocks
      invitationGroups.forEach((group, key) => {
        const totalTimeBlocks = group.invitations.length;
        
        if (totalTimeBlocks > 0) {

          
          // Get the opening block details for the title
          const openingBlock = group.invitations[0]; // Use first invitation for the main block details
          const openingDate = openingBlock.existing_block_date;
          const openingStartTime = openingBlock.existing_block_start_time;
          const openingEndTime = openingBlock.existing_block_end_time;
          const groupName = openingBlock.group_name;
          
          let title = `${group.parentName} is opening `;
          if (openingDate && openingStartTime && openingEndTime) {
            const date = new Date(openingDate);
            const startTime = openingStartTime.substring(0, 5); // Remove seconds
            const endTime = openingEndTime.substring(0, 5); // Remove seconds
            
            title += `${formatDateOnly(openingDate)} from ${startTime} to ${endTime} block to the group`;
          } else {
            title += `a care block to the group`;
          }
          
          messages.push({
            id: `invitation-group-${key}`,
            type: 'open_block_invitation',
            title: title,
            subtitle: '', // Empty string instead of undefined
            timestamp: group.invitations[0].created_at,
            data: { group, invitations: group.invitations, totalTimeBlocks },
            actions: undefined
          });
        }
      });

      // Add care requests I need to respond to
      careResponses
        .filter(response => response.status === 'pending')
        .forEach((response, index) => {
          // Get actual end time - use cached value if available, otherwise use notes or fallback
          const cachedActualEndTime = actualEndTimes.get(response.care_request_id);
          const actualEndTime = cachedActualEndTime || getActualEndTime(response.notes || '', response.end_time);
          
          // Debug logging
          console.log('Processing care response for message:', {
            responseId: response.care_response_id,
            requesterName: response.requester_name,
            requestedDate: response.requested_date,
            endTime: response.end_time,
            notes: response.notes,
            actualEndTime: actualEndTime,
            cachedActualEndTime: cachedActualEndTime,
            hasNotes: !!response.notes,
            notesLength: response.notes?.length || 0
          });
          
          messages.push({
          id: `pending-${response.care_response_id || index}`,
          type: 'care_request',
          title: `A care request for ${formatDateOnly(response.requested_date)} from ${formatTime(response.start_time)} to ${formatTime(actualEndTime)} has been sent from ${response.requester_name}`,
          subtitle: '', // Remove redundant subtitle since date/time is now in title
          timestamp: response.created_at,
          data: response,
          actions: (
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
              Respond to Request
            </button>
          )
        });
        });

      // Add care requests I need to respond to (already responded ones for audit)
      careResponses
        .filter(response => response.status === 'responded' || response.status === 'accepted')
        .forEach((response, index) => {
          messages.push({
            id: `responded-${response.care_response_id || index}`,
            type: 'care_request',
            title: response.status === 'accepted' 
              ? `You accepted ${response.requester_name}'s reciprocal request for your ${formatDateOnly(response.requested_date)} from ${formatTime(response.start_time)} to ${formatTime(getActualEndTime(response.notes || '', response.end_time))} request`
              : `Care request from ${response.requester_name} - Responded`,
            subtitle: '', // Remove redundant subtitle for accepted requests
            timestamp: response.created_at,
            data: response,
            actions: undefined
          });
        });

      // Group responses to my requests by request (instead of showing separate messages for each response)
      const requestResponseMap = new Map();
      
      careRequests.forEach(request => {
        // Show ALL responses (submitted, accepted, declined) not just submitted ones
        const requestResponses = careResponses.filter(
          response => response.care_request_id === request.care_request_id && 
                     (response.status === 'submitted' || response.status === 'accepted' || response.status === 'declined')
        );
        
        if (requestResponses.length > 0) {
          requestResponseMap.set(request.care_request_id, {
            request,
            responses: requestResponses
          });
        }
      });

      // Add one message per request that has responses
      requestResponseMap.forEach(({ request, responses }) => {
        const responseCount = responses.length;
        const latestResponse = responses.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];

        // Check if any response has been accepted
        const hasAcceptedResponse = responses.some((resp: any) => resp.status === 'accepted');
        
        // Only show the original request message if NO responses have been accepted
        // If any response is accepted, this will be hidden (the accepted message will show instead)
        if (!hasAcceptedResponse) {
          messages.push({
            id: `responses-${request.care_request_id}`,
            type: 'care_response',
            title: `Your request for ${formatDateOnly(request.requested_date)} from ${formatTime(request.start_time)} to ${formatTime(getActualEndTime(request.notes || '', request.end_time))} care has received ${responseCount} response${responseCount !== 1 ? 's' : ''}`,
            subtitle: '', // Empty string instead of undefined
            timestamp: latestResponse.created_at,
            data: { request, responses, responseCount },
            actions: undefined // Actions will be shown in expanded view for each individual response
          });
        }
      });

      // Add my responses status updates
      mySubmittedResponses.forEach((response, index) => {
        if (response.status === 'accepted' || response.status === 'declined') {
          messages.push({
            id: `status-${response.care_response_id || index}`,
            type: response.status === 'accepted' ? 'care_accepted' : 'care_declined',
            title: response.status === 'accepted' 
              ? `Your response to ${response.requester_name} has been accepted!`
              : `Your response to ${response.requester_name} has been declined.`,
            subtitle: `Original request: ${formatDateOnly(response.requested_date)} from ${formatTime(response.start_time)} to ${formatTime(getActualEndTime(response.notes || '', response.end_time))}`,
            timestamp: response.created_at,
            data: response
          });
        }
      });

      // Add group invitations
      groupInvitations.forEach((invitation, index) => {
        messages.push({
          id: `group-invitation-${invitation.invitation_id || index}`,
          type: 'group_invitation',
          title: `${invitation.inviter_name} has invited you to join "${invitation.group_name}"`,
          subtitle: '', // Remove redundant subtitle
          timestamp: invitation.invited_at,
          data: invitation,
          actions: (
            <div className="flex space-x-2">
              <button
                onClick={() => handleAcceptGroupInvitation(invitation.group_id)}
                className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
              >
                Accept
              </button>
              <button
                onClick={() => handleDeclineGroupInvitation(invitation.group_id)}
                className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
              >
                Decline
              </button>
            </div>
          )
        });
      });

      // Add event invitations
      eventInvitations.forEach((invitation, index) => {
        messages.push({
          id: `event-invitation-${invitation.event_request_id || index}`,
          type: 'event_invitation',
          title: `${invitation.inviter_name} has invited you to "${invitation.event_title}"`,
          subtitle: `${formatDateOnly(invitation.care_date)} from ${formatTime(invitation.start_time)} to ${formatTime(getActualEndTime(invitation.notes || '', invitation.end_time))} • ${invitation.child_name}`,
          timestamp: invitation.created_at,
          data: invitation,
          actions: undefined // Actions will be shown in expanded view
        });
      });

      // Sort by timestamp (newest first)
      return messages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    };

    const messages = getAllMessages();

    if (messages.length === 0) {
      return (
        <div className="text-center py-8">
          <div className="text-gray-400 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Messages</h3>
          <p className="text-gray-600">
            You're all caught up! New notifications will appear here.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {messages.map((message) => (
          <div key={message.id} className={`border border-gray-200 rounded-lg overflow-hidden ${
            unreadMessages.has(message.id) ? 'ring-2 ring-blue-500 bg-blue-50' : ''
          }`}>
            {/* Header - Always Visible */}
            <div 
              className="p-4 bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
              onClick={() => {
                toggleExpanded(message.id);
                // Mark as read when expanded
                if (unreadMessages.has(message.id)) {
                  markMessageAsRead(message.id);
                }
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h4 className="font-medium text-gray-900">{message.title}</h4>
                    {unreadMessages.has(message.id) && (
                      <span className="inline-block w-2 h-2 bg-blue-600 rounded-full"></span>
                    )}
                  </div>
                  {message.subtitle && (
                    <p className="text-sm text-gray-600 mt-1">{message.subtitle}</p>
                  )}
                  <p className="text-sm text-gray-500 mt-1">
                    {formatDateOnly(message.timestamp)}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    message.type === 'open_block_invitation' ? 'bg-yellow-100 text-yellow-800' :
                    message.type === 'care_request' ? 'bg-blue-100 text-blue-800' :
                    message.type === 'care_response' ? 'bg-green-100 text-green-800' :
                    message.type === 'care_accepted' ? 'bg-green-100 text-green-800' :
                    message.type === 'group_invitation' ? 'bg-purple-100 text-purple-800' :
                    message.type === 'event_invitation' ? 'bg-orange-100 text-orange-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {message.type === 'open_block_invitation' ? 'Invitation' :
                     message.type === 'care_request' ? 'Request' :
                     message.type === 'care_response' ? 'Response' :
                     message.type === 'care_accepted' ? 'Accepted' :
                     message.type === 'group_invitation' ? 'Group Invite' :
                     message.type === 'event_invitation' ? 'Event Invite' :
                     'Update'}
                  </span>
                  
                  {/* Show Accept/Decline buttons to the right of Group Invite badge */}
                  {message.type === 'group_invitation' && message.data.status === 'pending' && (
                    <div className="flex space-x-2 ml-2">
                      <button
                        onClick={() => handleAcceptGroupInvitation(message.data.group_id)}
                        className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleDeclineGroupInvitation(message.data.group_id)}
                        className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                      >
                        Decline
                      </button>
                    </div>
                  )}
                  
                  {/* Show "Accepted" badge to the right of Group Invite badge */}
                  {message.type === 'group_invitation' && message.data.status === 'accepted' && (
                    <span className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded ml-2">
                      Accepted
                    </span>
                  )}
                  
                  {/* Show "Rejected" badge to the right of Group Invite badge */}
                  {message.type === 'group_invitation' && message.data.status === 'rejected' && (
                    <span className="px-3 py-1 bg-red-100 text-red-800 text-sm rounded ml-2">
                      Rejected
                    </span>
                  )}
                  
                  {/* Only show expand arrow for non-group-invitation messages */}
                  {message.type !== 'group_invitation' && (
                    <svg 
                      className={`w-5 h-5 text-gray-400 transition-transform ${
                        expandedMessages.has(message.id) ? 'rotate-180' : ''
                      }`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </div>
              </div>
            </div>

            {/* Expandable Content */}
            {expandedMessages.has(message.id) && (
              <div className="p-4 bg-white border-t border-gray-200">
                {/* Don't show actions for group invitations since buttons are inline */}
                {message.actions && message.type !== 'group_invitation' && (
                  <div className="mb-3">
                    {message.actions}
                  </div>
                )}
                
                {/* Show grouped open block invitations if this is an invitation message */}
                {message.type === 'open_block_invitation' && message.data.invitations && (
                  <div className="space-y-3 mb-4">
                    {message.data.invitations.map((invitation: any, index: number) => (
                      <div key={invitation.invitation_id || index} className="bg-gray-50 rounded-lg p-3 border-l-4 border-yellow-500">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900 text-sm">
                              {invitation.reciprocal_date && invitation.reciprocal_start_time && invitation.reciprocal_end_time
                                ? `Reciprocal care: ${formatDateOnly(invitation.reciprocal_date)} from ${formatTime(invitation.reciprocal_start_time)} to ${formatTime(invitation.reciprocal_end_time)}`
                                : 'Reciprocal care details will be available after acceptance'}
                            </p>
                            {invitation.notes && (
                              <p className="text-sm text-gray-500 mt-1">
                                <strong>Notes:</strong> {invitation.notes}
                              </p>
                            )}
                            <p className="text-sm text-gray-500 mt-1">
                              <strong>Group:</strong> {invitation.group_name || 'N/A'}
                            </p>
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
                )}
                
                {/* Show grouped responses if this is a response message */}
                {message.type === 'care_response' && message.data.responses && (
                  <div className="space-y-3 mb-4">
                    <h5 className="font-medium text-gray-900 text-sm">All Responses:</h5>
                    {message.data.responses.map((response: any, index: number) => (
                      <div key={response.care_response_id || index} className="bg-gray-50 rounded-lg p-3 border-l-4 border-blue-500">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900 text-sm">
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
                          {response.status === 'accepted' ? (
                            <span className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded ml-4">
                              Accepted
                            </span>
                          ) : (
                            <button
                              onClick={() => handleAcceptResponse(response.care_response_id)}
                              className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 ml-4"
                            >
                              Accept Response
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Show accepted care request details if this is an accepted request */}
                {message.type === 'care_request' && message.data.status === 'accepted' && (
                  <div className="space-y-3 mb-4">
                    <h5 className="font-medium text-gray-900 text-sm">Accepted Care Details:</h5>
                    <div className="bg-green-50 rounded-lg p-3 border-l-4 border-green-500">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">
                          Accepted from: {message.data.requester_name}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          Reciprocal care: {formatDateOnly(message.data.reciprocal_date)} from{' '}
                          {formatTime(message.data.reciprocal_start_time)} to {formatTime(message.data.reciprocal_end_time)}
                        </p>
                        {message.data.reciprocal_child_name && (
                          <p className="text-sm text-gray-500 mt-1">
                            Child: {message.data.reciprocal_child_name}
                          </p>
                        )}
                        {message.data.notes && (
                          <p className="text-sm text-gray-500 mt-1">
                            Notes: {message.data.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Show event invitation RSVP options if this is an event invitation */}
                {message.type === 'event_invitation' && (
                  <div className="space-y-3 mb-4">
                    <h5 className="font-medium text-gray-900 text-sm">Event Details:</h5>
                    <div className="bg-orange-50 rounded-lg p-3 border-l-4 border-orange-500">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">
                          Event: {message.data.event_title}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          Date: {formatDateOnly(message.data.care_date)} from {formatTime(message.data.start_time)} to {formatTime(message.data.end_time)}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          Child: {message.data.child_name}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          Group: {message.data.group_name}
                        </p>
                      </div>
                    </div>
                    
                    <h5 className="font-medium text-gray-900 text-sm mt-4">RSVP:</h5>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEventRSVP(message.data.event_request_id, 'going')}
                        className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                      >
                        Going
                      </button>
                      <button
                        onClick={() => handleEventRSVP(message.data.event_request_id, 'maybe')}
                        className="px-4 py-2 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700"
                      >
                        Maybe
                      </button>
                      <button
                        onClick={() => handleEventRSVP(message.data.event_request_id, 'not_going')}
                        className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                      >
                        Not Going
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Only show notes if they're not redundant with the main message */}
                {message.data.notes && message.type !== 'care_request' && (
                  <div className="text-sm text-gray-600">
                    <p><strong>Notes:</strong> {message.data.notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Initialize user state
  useEffect(() => {
    const initializeUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    initializeUser();
  }, []);

  useEffect(() => {
    // Add a small delay to ensure any previous requests complete
    const timer = setTimeout(() => {
      fetchData();
      fetchOpenBlockInvitations();
      fetchGroupInvitations();
      fetchEventInvitations();
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  // Fetch actual end times when care responses change
  useEffect(() => {
    if (careResponses.length > 0) {
      fetchActualEndTimes();
    }
  }, [careResponses]);

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
    if (newRequest.group_id) {
      fetchChildrenForGroup(newRequest.group_id);
    } else {
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
      
      console.log('Fetching data for user:', user.id);
      
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
        // Error fetching groups
        return;
      }
      
      const userGroups = groupsData.map(item => ({
        id: item.groups.id,
        name: item.groups.name
      }));
      setGroups(userGroups);

      // Fetch care requests and responses
      const { data: requests, error: requestsError } = await supabase.rpc('get_reciprocal_care_requests', {
        parent_id: user.id
      });

      if (requestsError) {
        console.error('Error fetching care requests:', requestsError);
        setCareRequests([]);
      } else {
        console.log('Fetched care requests:', requests);
        if (requests && requests.length > 0) {
          console.log('First request structure:', requests[0]);
          console.log('First request notes:', requests[0].notes);
        }
        setCareRequests(requests || []);
      }

      const { data: responses, error: responsesError } = await supabase.rpc('get_reciprocal_care_responses', {
        parent_id: user.id
      });

      if (responsesError) {
        console.error('Error fetching care responses:', responsesError);
        setCareResponses([]);
      } else {
        console.log('Fetched care responses:', responses);
        if (responses && responses.length > 0) {
          console.log('First response structure:', responses[0]);
          console.log('First response notes:', responses[0].notes);
          console.log('All response fields:', Object.keys(responses[0]));
        }
        setCareResponses(responses || []);
      }

      // Also fetch responses to requests I made (for accepting)
      const { data: responsesToMyRequests, error: responsesToMyRequestsError } = await supabase.rpc('get_responses_for_requester', {
        p_requester_id: user.id
      });

      if (responsesToMyRequestsError) {
        // Error fetching responses to my requests
      } else {
        // Responses to my requests fetched
      }

      // Fetch my submitted responses (for "My Responses" section)
      const { data: mySubmittedResponses, error: myResponsesError } = await supabase.rpc('get_my_submitted_responses', {
        parent_id: user.id
      });

      if (myResponsesError) {
        setMySubmittedResponses([]);
      } else {
        setMySubmittedResponses(mySubmittedResponses || []);
      }

      // Fetch reschedule requests for unified inbox
      const { data: rescheduleRequestsData, error: rescheduleRequestsError } = await supabase.rpc('get_reschedule_requests', {
        p_parent_id: user.id
      });

      if (rescheduleRequestsError) {
        console.error('Error fetching reschedule requests:', rescheduleRequestsError);
        setRescheduleRequests([]);
      } else {
        setRescheduleRequests(rescheduleRequestsData || []);
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
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchChildrenForGroup = async (groupId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

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
        return;
      }

       const groupChildren = data.map(item => ({
         id: item.children?.id,
         name: item.children?.full_name,
         group_id: item.group_id
       }));

       setChildren(groupChildren);
    } catch (err) {
      // Error in fetchChildrenForGroup
    }
  };

  // Handle reschedule response (integrated into unified system)
  const handleRescheduleResponse = async (careResponseId: string, response: 'accepted' | 'declined', notes?: string) => {
    try {
      setProcessingReschedule(true);
      
      const { data, error } = await supabase.rpc('handle_improved_reschedule_response', {
        p_care_request_id: careResponseId,
        p_response_status: response,
        p_response_notes: notes || null
      });

      if (error) {
        console.error('Error handling reschedule response:', error);
        showAlertOnce('Failed to process response. Please try again.');
        return;
      }

      if (data.success) {
        showAlertOnce(`Successfully ${response} the reschedule request.`);
        // Refresh all data
        await fetchData();
      } else {
        showAlertOnce('Failed to process response: ' + data.error);
      }
    } catch (error) {
      console.error('Error handling reschedule response:', error);
      showAlertOnce('An error occurred. Please try again.');
    } finally {
      setProcessingReschedule(false);
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
      
      // Dispatch event to update header counter
      window.dispatchEvent(new CustomEvent('careRequestResponded'));
      
    } catch (err) {
      setError('An unexpected error occurred');
    }
  };

  const handleAcceptResponse = async (responseId: string) => {
    try {
      const { error } = await supabase.rpc('accept_reciprocal_care_response', {
        p_care_response_id: responseId
      });

       if (error) {
        setError('Failed to accept response');
         return;
       }

      // Send notifications to all parents with children in the care blocks
      await sendReciprocalAcceptanceNotifications(responseId);

      // Show success message when reciprocal care response is accepted
      showAlertOnce('Reciprocal care response accepted successfully! Calendar blocks have been created.');
      
      fetchData();
      
      // Dispatch event to update header counter
      window.dispatchEvent(new CustomEvent('invitationAccepted'));
      
    } catch (err) {
      setError('An unexpected error occurred');
    }
  };

  // Function to send notifications to all parents with children in the care blocks
  const sendReciprocalAcceptanceNotifications = async (responseId: string) => {
    try {
      // Get the care response details to find the care request
      const { data: careResponse, error: responseError } = await supabase
        .from('care_responses')
        .select(`
          *,
          care_requests!inner(
            id,
            group_id,
            requester_id,
            requested_date,
            start_time,
            end_time,
            notes,
            groups(name)
          )
        `)
        .eq('id', responseId)
        .single();

      if (responseError) {
        console.error('Error fetching care response:', responseError);
        return;
      }

      const careRequest = careResponse.care_requests;
      
      // FIXED: Use the new safe notification function instead of sending to all group members
      // This prevents duplicate notifications
      const { data: notificationResult, error: notificationError } = await supabase.rpc(
        'send_reciprocal_acceptance_notifications_safe',
        {
          p_care_request_id: careRequest.id,
          p_accepting_parent_id: careResponse.responder_id,
          p_group_id: careRequest.group_id
        }
      );

      if (notificationError) {
        console.error('Error sending notification:', notificationError);
        return;
      }

      console.log('Notification sent successfully:', notificationResult);

    } catch (error) {
      console.error('Error sending reciprocal acceptance notifications:', error);
    }
  };

  const formatTime = (time: string | undefined | null) => {
    if (!time) return '';
    try {
      return time.substring(0, 5);
    } catch (error) {
      return '';
    }
  };

  // Helper function to prevent duplicate alerts
  const showAlertOnce = (message: string) => {
    const now = Date.now();
    if (now - lastAlertTime > ALERT_COOLDOWN) {
      alert(message);
      lastAlertTime = now;
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

  // Open block invitation handlers
  const handleAccept = async (invitation: any) => {
    try {
      // Fetch available children for the current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get active children from child_group_members using parent_id (not profile_id)
      const { data: childrenData, error: childrenError } = await supabase
        .from('child_group_members')
        .select(`
          child_id,
          children!inner(id, full_name, parent_id)
        `)
        .eq('parent_id', user.id)  // Use parent_id, not profile_id
        .eq('active', true);  // Filter by active status in child_group_members

      if (childrenError) throw childrenError;

      // Transform the nested data structure to match the expected format
      const transformedChildren: Array<{id: string, full_name: string}> = [];
      
      if (childrenData) {
        childrenData.forEach(item => {
          if (item.children && item.children.id) {
            transformedChildren.push({
              id: item.children.id,
              full_name: item.children.full_name
            });
          }
        });
      }

      // Auto-select the first (or only) child
      if (transformedChildren.length > 0) {
        const activeChild = transformedChildren[0]; // Get the first child
        
        console.log('🔍 DEBUG: Found children, auto-accepting with:', activeChild);
        
        // Auto-accept with the active child
        await handleAcceptanceSubmit(invitation, activeChild.id);
        return; // Exit early, no need to show selection UI
      }
      
      console.log('🔍 DEBUG: No children found, transformedChildren:', transformedChildren);

      // Fallback: show selection if no children found
      setAvailableChildren(transformedChildren);
      setAcceptingInvitation(invitation);
    } catch (error) {
      showAlertOnce('Error preparing acceptance. Please try again.');
    }
  };

  const handleAcceptanceSubmit = async (invitation?: any, childId?: string) => {
    // Use passed invitation or fall back to acceptingInvitation state
    const targetInvitation = invitation || acceptingInvitation;
    
    if (!targetInvitation) {
      // No invitation provided
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

      console.log('🔍 DEBUG: Calling accept_open_block_invitation with params:', functionParams);
      
      const { error } = await supabase.rpc('accept_open_block_invitation', functionParams);
      
      console.log('🔍 DEBUG: RPC call result - error:', error);

      if (!childId && (!availableChildren || availableChildren.length === 0)) {
        throw new Error('No child selected and no children available');
      }

      if (error) throw error;

      // Success! Refresh the invitations list
      await fetchOpenBlockInvitations();
      setAcceptingInvitation(null);
      
      // Dispatch event to update header counter
      window.dispatchEvent(new CustomEvent('invitationAccepted'));
      
      // Create confirmation messages for both parties
      await createOpenBlockAcceptanceMessages(targetInvitation, user.id);
      
      showAlertOnce('Invitation accepted successfully! Your child has been added to the care block.');
    } catch (error) {
      showAlertOnce('Error accepting invitation. Please try again.');
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
      
      // Dispatch event to update header counter
      window.dispatchEvent(new CustomEvent('invitationDeclined'));
      
      showAlertOnce('Invitation declined successfully.');
    } catch (error) {
      showAlertOnce('Error declining invitation. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  // Function to send notifications to all parents with children in the care blocks for open block acceptances
  const sendOpenBlockAcceptanceNotifications = async (invitation: any, acceptingParentId: string, acceptedChildId: string) => {
    try {
      // Get the accepting parent's details
      const { data: acceptingParent, error: parentError } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', acceptingParentId)
        .single();

      if (parentError) {
        console.error('Error fetching accepting parent:', parentError);
        return;
      }

      // Get the accepted child's details
      const { data: acceptedChild, error: childError } = await supabase
        .from('children')
        .select('full_name')
        .eq('id', acceptedChildId)
        .single();

      if (childError) {
        console.error('Error fetching accepted child:', childError);
        return;
      }

      // Get the care block details
      const { data: careBlock, error: blockError } = await supabase
        .from('scheduled_care')
        .select(`
          *,
          groups(name)
        `)
        .eq('id', invitation.existing_block_id)
        .single();

      if (blockError) {
        console.error('Error fetching care block:', blockError);
        return;
      }

      // Get all parents with children in this group
      const { data: groupMembers, error: membersError } = await supabase
        .from('group_members')
        .select(`
          profile_id,
          profiles!inner(full_name)
        `)
        .eq('group_id', careBlock.group_id)
        .eq('status', 'active');

      if (membersError) {
        console.error('Error fetching group members:', membersError);
        return;
      }

      // Send notification messages to all group members
      for (const member of groupMembers || []) {
        if (member.profile_id !== acceptingParentId) { // Don't send to the accepting parent
          const messageContent = `${acceptingParent.full_name} accepted an open block invitation and added ${acceptedChild.full_name} to the care block for ${careBlock.groups.name} on ${formatDateOnly(careBlock.care_date)}.`;
          
          await supabase.rpc('send_care_response_notifications', {
            p_care_request_id: invitation.care_request_id || 'open_block',
            p_responder_id: member.profile_id,
            p_message_content: messageContent
          });
        }
      }

      // Send a specific message to the accepting parent
      const successMessage = `You successfully accepted the open block invitation and added ${acceptedChild.full_name} to the care block for ${careBlock.groups.name} on ${formatDateOnly(careBlock.care_date)}.`;
      
      await supabase.rpc('send_care_response_notifications', {
        p_care_request_id: invitation.care_request_id || 'open_block',
        p_responder_id: acceptingParentId,
        p_message_content: successMessage
      });

    } catch (error) {
      console.error('Error sending open block acceptance notifications:', error);
    }
  };

  // Function to create confirmation messages for open block acceptances
  const createOpenBlockAcceptanceMessages = async (invitation: any, acceptingParentId: string) => {
    try {
      // Get the accepting parent's name
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: acceptingParentProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', acceptingParentId)
        .single();

      const acceptingParentName = acceptingParentProfile?.full_name || 'Unknown Parent';

      // Create a message for the accepting parent
      const acceptingParentMessage = {
        type: 'open_block_accepted',
        title: `You accepted ${invitation.open_block_parent_name}'s open block offer`,
        subtitle: `Care block: ${formatDateOnly(invitation.existing_block_date)} from ${formatTime(invitation.existing_block_start_time)} to ${formatTime(getActualEndTime(invitation.notes || '', invitation.existing_block_end_time))}`,
        timestamp: new Date().toISOString(),
        data: {
          invitation,
          acceptingParentId,
          acceptingParentName
        }
      };

      // Store the message for the accepting parent (you might want to store this in a database)

      // TODO: You might want to store these messages in a database table
      // For now, we'll just log them. You could create a 'messages' table to store these
      
    } catch (error) {
      // Error creating acceptance messages
    }
  };

  const fetchOpenBlockInvitations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase.rpc('get_open_block_invitations', {
        p_parent_id: user.id
      });

      if (error) {
        console.error('Error fetching invitations:', error);
        return;
      }

      setInvitations(data || []);
    } catch (error) {
      console.error('Error fetching invitations:', error);
    }
  };

  const fetchGroupInvitations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase.rpc('get_pending_group_invitations', {
        p_user_id: user.id
      });

      if (error) {
        console.error('Error fetching group invitations:', error);
        return;
      }

      console.log('✅ Group invitations fetched:', data);
      setGroupInvitations(data || []);
    } catch (error) {
      console.error('Error fetching group invitations:', error);
    }
  };

  const handleAcceptGroupInvitation = async (groupId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase.rpc('accept_group_invitation', {
        p_user_id: user.id,
        p_group_id: groupId
      });

      if (error) {
        console.error('Error accepting group invitation:', error);
        showAlertOnce('Failed to accept invitation: ' + error.message);
        return;
      }

      console.log('✅ Group invitation accepted:', data);
      showAlertOnce('Group invitation accepted successfully!');
      
      // Refresh the data immediately
      await fetchGroupInvitations();
      await fetchData(); // Refresh groups
      
      // Update the Header counter immediately
      window.dispatchEvent(new Event('schedulerUpdated'));
      
      // Also dispatch a specific event for group invitation updates
      window.dispatchEvent(new CustomEvent('groupInvitationUpdated', {
        detail: { action: 'accepted', groupId }
      }));
      
    } catch (error) {
      console.error('Error accepting group invitation:', error);
      showAlertOnce('Failed to accept invitation');
    }
  };

  const handleDeclineGroupInvitation = async (groupId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase.rpc('decline_group_invitation', {
        p_user_id: user.id,
        p_group_id: groupId
      });

      if (error) {
        console.error('Error declining group invitation:', error);
        showAlertOnce('Failed to decline invitation: ' + error.message);
        return;
      }

      console.log('✅ Group invitation declined:', data);
      showAlertOnce('Group invitation declined');
      
      // Refresh the data immediately
      await fetchGroupInvitations();
      
      // Update the Header counter immediately
      window.dispatchEvent(new Event('schedulerUpdated'));
      
      // Also dispatch a specific event for group invitation updates
      window.dispatchEvent(new CustomEvent('groupInvitationUpdated', {
        detail: { action: 'declined', groupId }
      }));
      
    } catch (error) {
      console.error('Error declining group invitation:', error);
      showAlertOnce('Failed to decline invitation');
    }
  };

  const fetchEventInvitations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase.rpc('get_pending_event_invitations', {
        p_user_id: user.id
      });

      if (error) {
        console.error('Error fetching event invitations:', error);
        return;
      }

      console.log('✅ Event invitations fetched:', data);
      setEventInvitations(data || []);
    } catch (error) {
      console.error('Error fetching event invitations:', error);
    }
  };

  const handleEventRSVP = async (eventRequestId: string, responseType: 'going' | 'maybe' | 'not_going') => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase.rpc('update_event_response', {
        p_event_request_id: eventRequestId,
        p_responder_id: user.id,
        p_response_type: responseType,
        p_response_notes: null
      });

      if (error) {
        console.error('Error updating event response:', error);
        showAlertOnce('Failed to submit RSVP: ' + error.message);
        return;
      }

      console.log('✅ Event RSVP submitted:', data);
      showAlertOnce(`RSVP submitted: ${responseType}`);
      
      // Refresh the data immediately
      await fetchEventInvitations();
      
      // Update the Header counter immediately
      window.dispatchEvent(new Event('schedulerUpdated'));
      
    } catch (error) {
      console.error('Error submitting event RSVP:', error);
      showAlertOnce('Failed to submit RSVP');
    }
  };

  // Mark message as read
  const markMessageAsRead = (messageId: string) => {
    setUnreadMessages(prev => {
      const newUnread = new Set(prev);
      newUnread.delete(messageId);
      
      // Update localStorage for persistence
      localStorage.setItem('schedulerUnreadMessages', JSON.stringify(Array.from(newUnread)));
      
      // Update Header's unread count via localStorage
      const headerUnreadCount = newUnread.size;
      localStorage.setItem('headerSchedulerUnreadCount', headerUnreadCount.toString());
      
      // Dispatch event to notify Header component
      window.dispatchEvent(new Event('schedulerUpdated'));
      
      return newUnread;
    });
  };

  // Check if message has pending actions (unread)
  const hasPendingActions = (message: any) => {
    if (message.type === 'open_block_invitation') {
      return message.data.status === 'pending';
    }
    if (message.type === 'care_request') {
      return true; // Always unread until responded to
    }
    if (message.type === 'care_response') {
      return message.data.responses.some((r: any) => r.status === 'submitted');
    }
    if (message.type === 'group_invitation') {
      return message.data.status === 'pending'; // Only unread if pending (not accepted or rejected)
    }
    if (message.type === 'event_invitation') {
      return true; // Always unread until RSVP is submitted
    }
    return false;
  };

  // Initialize unread messages when data loads
  useEffect(() => {
    if (careRequests.length > 0 || careResponses.length > 0 || invitations.length > 0) {
      const pendingMessages = new Set<string>();
      
      // Check invitations
      invitations.forEach((invitation, index) => {
        if (invitation.status === 'pending') {
          // Use the grouped invitation ID instead of individual invitation ID
          const key = `${invitation.open_block_parent_id || invitation.open_block_parent_name}-${invitation.care_response_id}`;
          pendingMessages.add(`invitation-group-${key}`);
        }
      });

      // Check group invitations (only pending ones)
      groupInvitations.forEach((invitation, index) => {
        if (invitation.status === 'pending') {
          pendingMessages.add(`group-invitation-${invitation.invitation_id || index}`);
        }
      });

      // Check event invitations (all are unread until RSVP is submitted)
      eventInvitations.forEach((invitation, index) => {
        pendingMessages.add(`event-invitation-${invitation.event_request_id || index}`);
      });
      
      // Check care requests
      careResponses
        .filter(response => response.status === 'pending')
        .forEach((response, index) => {
          pendingMessages.add(`pending-${response.care_response_id || index}`);
        });
      
      // Check care requests (already responded ones)
      careResponses
        .filter(response => response.status === 'responded' || response.status === 'accepted')
        .forEach((response, index) => {
          pendingMessages.add(`responded-${response.care_response_id || index}`);
        });
      
      // Check responses to my requests
      careRequests.forEach(request => {
        const requestResponses = careResponses.filter(
          response => response.care_request_id === request.care_request_id && response.status === 'submitted'
        );
        if (requestResponses.length > 0) {
          pendingMessages.add(`responses-${request.care_request_id}`);
        }
      });
      
      // Load existing unread messages from localStorage
      const savedUnread = localStorage.getItem('schedulerUnreadMessages');
      if (savedUnread) {
        const savedUnreadArray = JSON.parse(savedUnread);
        const savedUnreadSet = new Set(savedUnreadArray);
        
        // Merge with current pending messages, keeping only valid ones
        const mergedUnread = new Set<string>();
        savedUnreadSet.forEach(id => {
          if (pendingMessages.has(id)) {
            mergedUnread.add(id);
          }
        });
        
        setUnreadMessages(mergedUnread);
        
        // Update Header's unread count
        localStorage.setItem('headerSchedulerUnreadCount', mergedUnread.size.toString());
      } else {
        setUnreadMessages(pendingMessages);
        localStorage.setItem('schedulerUnreadMessages', JSON.stringify(Array.from(pendingMessages)));
        localStorage.setItem('headerSchedulerUnreadCount', pendingMessages.size.toString());
      }
    }
  }, [careRequests, careResponses, invitations]);

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
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Scheduler</h1>
          </div>


          {/* Unified Messages Inbox */}
          <div className="bg-white rounded-lg shadow mb-8">
            <div className="px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Messages</h2>
                <p className="text-sm text-gray-600 mt-1">Click any message to expand and take action</p>
              </div>
            </div>
            <div className="p-6">
              <UnifiedMessagesInbox />
            </div>
          </div>

          {/* Reschedule requests are now integrated into the Unified Messages Inbox above */}

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
                      {formatTime(selectedRequest.start_time)} to {formatTime(getActualEndTime(selectedRequest.notes || '', selectedRequest.end_time))}
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

          






        </div>


      </div>
    </div>
  );
}




