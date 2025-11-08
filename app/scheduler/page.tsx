'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '../components/Header';
import { supabase } from '../lib/supabase';
import { formatDateOnly, formatTime, formatTimestampDate } from '../lib/date-utils';
import type { User } from '@supabase/supabase-js';
import RescheduleResponseModal from '../../components/care/RescheduleResponseModal';

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
  pet_name?: string;              // For pet care requests
  end_date?: string;              // For multi-day care
  care_type?: 'child' | 'pet';    // To distinguish between types
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
  pet_name?: string;              // For pet care requests
  end_date?: string;              // For multi-day care
  care_type?: 'child' | 'pet';    // To distinguish between types
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

interface Pet {
  id: string;
  name: string;
  species: string | null;
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

      // Get active children from child_group_members for the SPECIFIC group
      const { data: childrenData, error: childrenError } = await supabase
        .from('child_group_members')
        .select(`
          child_id,
          group_id,
          children!inner(id, full_name, parent_id)
        `)
        .eq('parent_id', user.id)  // Use parent_id, not profile_id
        .eq('group_id', invitation.group_id)  // Filter by the invitation's group
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
  const [groupChildren, setGroupChildren] = useState<Child[]>([]); // All children in selected group
  const [pets, setPets] = useState<Pet[]>([]);
  const [groupPets, setGroupPets] = useState<Pet[]>([]); // All pets in selected group
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Open block invitations state
  const [invitations, setInvitations] = useState<any[]>([]);
  const [processing, setProcessing] = useState(false);
  const [acceptingInvitation, setAcceptingInvitation] = useState<any>(null);
  const [availableChildren, setAvailableChildren] = useState<Array<{ id: string; full_name: string }>>([]);
  
  // Reschedule requests state (integrated into unified system)
  const [rescheduleRequests, setRescheduleRequests] = useState<any[]>([]);
  const [rescheduleNotifications, setRescheduleNotifications] = useState<any[]>([]);
  const [processingReschedule, setProcessingReschedule] = useState(false);
  const [showRescheduleResponseModal, setShowRescheduleResponseModal] = useState(false);
  const [selectedRescheduleRequest, setSelectedRescheduleRequest] = useState<{requestId: string, responseId: string} | null>(null);
  
  // Group invitations state
  const [groupInvitations, setGroupInvitations] = useState<any[]>([]);
  
  // Event invitations state
  const [eventInvitations, setEventInvitations] = useState<any[]>([]);

  // Hangout/Sleepover invitations state
  const [hangoutInvitations, setHangoutInvitations] = useState<any[]>([]);

  // Store actual end times for care requests
  const [actualEndTimes, setActualEndTimes] = useState<Map<string, string>>(new Map());
  
  // Alert cooldown system to prevent duplicate notifications
  let lastAlertTime = 0;
  const ALERT_COOLDOWN = 2000; // 2 seconds
  
  // Form state for new care request
  const [showNewRequestForm, setShowNewRequestForm] = useState(false);
  const [newRequest, setNewRequest] = useState({
    care_type: 'reciprocal' as 'reciprocal' | 'hangout' | 'sleepover',
    group_id: '',
    child_id: '',
    care_date: '',
    start_time: '',
    end_time: '',
    end_date: '', // For sleepovers
    hosting_child_ids: [] as string[], // For hangouts/sleepovers
    invited_child_ids: [] as string[], // For hangouts/sleepovers
    notes: ''
  });
  
  // Form state for reciprocal response
  const [showResponseForm, setShowResponseForm] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<CareRequest | null>(null);
  const [reciprocalResponse, setReciprocalResponse] = useState({
    reciprocal_date: '',
    reciprocal_end_date: '',
    reciprocal_start_time: '',
    reciprocal_end_time: '',
    reciprocal_child_id: '',
    reciprocal_pet_id: '',
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
        type: 'open_block_invitation' | 'care_request' | 'care_response' | 'care_accepted' | 'care_declined' | 'open_block_accepted' | 'group_invitation' | 'event_invitation' | 'reschedule_request' | 'reschedule_accepted' | 'reschedule_declined' | 'reschedule_counter_sent' | 'reschedule_counter_accepted' | 'reschedule_counter_declined';
        title: string;
        subtitle: string;
        timestamp: string;
        data: any;
        actions?: React.ReactNode;
      }> = [];

      // Add open block invitations (grouped by person/group)
      // ONLY show pending invitations or accepted invitations from acceptor's view
      // Do NOT show accepted invitations from provider's view here (they're shown separately below)
      const invitationGroups = new Map();

      invitations
        .filter(invitation => {
          // Only include pending invitations OR accepted invitations where current user is the acceptor
          return invitation.status === 'pending';
        })
        .forEach((invitation, index) => {
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
      
      // Get all counter-proposal request IDs AND original request IDs to filter them out from reschedule_request messages
      const counterProposalRequestIds = new Set(
        rescheduleNotifications
          .filter(n => n.type === 'reschedule_counter_sent' && n.data?.counter_request_id)
          .map(n => n.data.counter_request_id)
      );

      // Get original request IDs that have PENDING counter-proposals (not yet answered)
      // We only hide the original request if the counter is still pending
      const originalRequestIdsWithPendingCounters = new Set();
      rescheduleNotifications.forEach(notification => {
        if (notification.type === 'reschedule_counter_sent') {
          const counterRequestId = notification.data?.counter_request_id;
          const originalRequestId = notification.data?.original_request_id;

          // Check if this counter has been answered
          const hasBeenAnswered = rescheduleNotifications.some(n =>
            (n.type === 'reschedule_counter_accepted' || n.type === 'reschedule_counter_declined') &&
            n.data?.counter_request_id === counterRequestId
          );

          // Only add to the set if the counter is PENDING (not yet answered)
          if (!hasBeenAnswered && originalRequestId) {
            originalRequestIdsWithPendingCounters.add(originalRequestId);
          }
        }
      });

      // Create one message per reschedule request (not per response)
      // BUT skip if this is a counter-proposal (will be shown via reschedule_counter_sent notification instead)
      rescheduleGroups.forEach((group, requestId) => {
        const request = group.request;

        // Skip if this request is actually a counter-proposal
        if (counterProposalRequestIds.has(requestId) || counterProposalRequestIds.has(request.request_id)) {
          console.log('Skipping reschedule_request message for counter-proposal:', requestId);
          return;
        }

        // Skip if this request has a PENDING counter-proposal (show counter instead)
        // Check both the map key (requestId) and the actual request.request_id
        if (originalRequestIdsWithPendingCounters.has(requestId) || originalRequestIdsWithPendingCounters.has(request.request_id)) {
          console.log('Skipping reschedule_request message - has pending counter-proposal:', requestId);
          return;
        }

        messages.push({
          id: `reschedule-${requestId}`,
          type: 'reschedule_request',
          title: `${request.requester_name} wants to reschedule ${request.original_date ? formatDateOnly(request.original_date) : 'a'} care block`,
          subtitle: `From ${request.original_date ? formatDateOnly(request.original_date) : 'Unknown'} ${request.original_start_time || 'Unknown'}-${request.original_end_time || 'Unknown'} to ${formatDateOnly(request.new_date)} ${request.new_start_time}-${request.new_end_time}`,
          timestamp: request.created_at,
          data: request,
          actions: (
            <div className="flex space-x-2">
              <button
                onClick={() => handleRescheduleResponse(request.care_response_id, 'accepted', undefined, request.request_id)}
                disabled={processingReschedule}
                className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
              >
                Accept
              </button>
              <button
                onClick={() => handleRescheduleResponse(request.care_response_id, 'declined', undefined, request.request_id)}
                disabled={processingReschedule}
                className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50"
              >
                Decline
              </button>
            </div>
          )
        });
      });

      // Add reschedule acceptance/decline notifications
      rescheduleNotifications.forEach((notification, index) => {
        // Skip counter_sent notifications if they've been answered (accepted/declined)
        // We check if there's a corresponding accepted/declined notification for the same counter_request_id
        if (notification.type === 'reschedule_counter_sent') {
          const counterRequestId = notification.data?.counter_request_id;
          const hasBeenAnswered = rescheduleNotifications.some(n =>
            (n.type === 'reschedule_counter_accepted' || n.type === 'reschedule_counter_declined') &&
            n.data?.counter_request_id === counterRequestId
          );

          if (hasBeenAnswered) {
            console.log('Skipping counter_sent notification - already answered:', counterRequestId);
            return; // Skip this notification
          }
        }

        // Add Accept/Decline buttons for counter-proposal notifications sent TO current user
        let actions = undefined;
        if (notification.type === 'reschedule_counter_sent' && notification.data?.original_requester_id === user?.id) {
          // This is a counter-proposal sent TO me (I'm the original requester)
          actions = (
            <div className="flex space-x-2">
              <button
                onClick={() => handleRescheduleResponse(notification.data.care_response_id, 'accepted', undefined, notification.data.counter_request_id)}
                disabled={processingReschedule}
                className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
              >
                Accept
              </button>
              <button
                onClick={() => handleRescheduleResponse(notification.data.care_response_id, 'declined', undefined, notification.data.counter_request_id)}
                disabled={processingReschedule}
                className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50"
              >
                Decline
              </button>
            </div>
          );
        }

        messages.push({
          id: notification.type === 'care_declined' ? `care-declined-${notification.id}` : `reschedule-notification-${notification.id}`,
          type: notification.type as 'reschedule_accepted' | 'reschedule_declined' | 'reschedule_counter_sent' | 'reschedule_counter_accepted' | 'reschedule_counter_declined' | 'care_declined',
          title: notification.title,
          subtitle: '',
          timestamp: notification.created_at,
          data: notification.data,
          actions: actions
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

            title += `${formatDateOnly(openingDate)} from ${startTime} to ${endTime} block to ${groupName}`;
          } else {
            title += `a care block to ${groupName}`;
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

      // Add ACCEPTED open block invitations (for audit trail)
      const acceptedInvitations = invitations.filter(invitation => invitation.status === 'accepted');
      console.log('📊 Accepted invitations to display:', acceptedInvitations);

      acceptedInvitations.forEach((invitation, index) => {
          const openingDate = invitation.existing_block_date;
          const openingStartTime = invitation.existing_block_start_time?.substring(0, 5);
          const openingEndTime = invitation.existing_block_end_time?.substring(0, 5);
          const groupName = invitation.group_name;

          console.log('📊 Processing invitation:', {
            is_provider_view: invitation.is_provider_view,
            is_acceptor_view: invitation.is_acceptor_view,
            acceptor_name: invitation.acceptor_name,
            provider_name: invitation.open_block_parent_name
          });

          // Show different message based on perspective
          if (invitation.is_provider_view) {
            // Current user is the provider (person who created the open block)
            const acceptorName = invitation.acceptor_name;
            const groupName = invitation.group_name;
            const msg = {
              id: `open-block-provider-${invitation.invitation_id || invitation.id || index}`,
              type: 'open_block_provider_notified',
              title: `${acceptorName} accepted your ${groupName} open block offer for ${formatDateOnly(invitation.existing_block_date)}`,
              subtitle: '',
              timestamp: invitation.created_at,
              data: invitation
            };
            console.log('📊 Adding provider message:', msg);
            messages.push(msg);
          } else {
            // Current user is the acceptor (person who accepted the open block)
            const providerName = invitation.open_block_parent_name;
            const groupName = invitation.group_name;
            const msg = {
              id: `open-block-accepted-${invitation.invitation_id || index}`,
              type: 'open_block_accepted',
              title: `You accepted ${providerName}'s ${groupName} open block offer for ${formatDateOnly(invitation.existing_block_date)}`,
              subtitle: '',
              timestamp: invitation.created_at,
              data: invitation
            };
            console.log('📊 Adding acceptor message:', msg);
            messages.push(msg);
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
          title: `A ${response.care_type === 'pet' ? '🐾 pet' : 'child'} care request for ${formatDateOnly(response.requested_date)} from ${formatTime(response.start_time)} to ${formatTime(actualEndTime)} has been sent from ${response.requester_name}${response.care_type === 'pet' && response.pet_name ? ` for ${response.pet_name}` : ''}${response.end_date ? ` until ${formatDateOnly(response.end_date)}` : ''}`,
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
                accepted_response_count: 0,
                care_type: response.care_type,
                pet_name: response.pet_name,
                end_date: response.end_date
              })}
              className={`px-3 py-1 ${response.care_type === 'pet' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'} text-white text-sm rounded`}
            >
              Respond to Request
            </button>
          )
        });
        });

      // Add care requests I need to respond to (already responded ones for audit)
      // Note: Only show 'responded' status here. Accepted/declined statuses are handled by mySubmittedResponses below.
      careResponses
        .filter(response => response.status === 'responded')
        .forEach((response, index) => {
          messages.push({
            id: `responded-${response.care_response_id || index}`,
            type: 'care_request',
            title: `Care request from ${response.requester_name} - Responded`,
            subtitle: '', // Remove redundant subtitle for accepted requests
            timestamp: response.created_at,
            data: response,
            actions: undefined
          });
        });

      // Group responses to my requests by request (instead of showing separate messages for each response)
      const requestResponseMap = new Map();

      console.log('🔍 Checking for responses to my requests...');
      console.log('🔍 careRequests:', careRequests);
      console.log('🔍 careResponses:', careResponses);

      careRequests.forEach(request => {
        // Show ALL responses (pending, submitted, accepted, declined) not just submitted ones
        const requestResponses = careResponses.filter(
          response => response.care_request_id === request.care_request_id &&
                     (response.status === 'pending' || response.status === 'submitted' || response.status === 'accepted' || response.status === 'declined')
        );

        if (requestResponses.length > 0) {
          console.log(`🔍 Found ${requestResponses.length} responses for request ${request.care_request_id}:`, requestResponses);
          requestResponseMap.set(request.care_request_id, {
            request,
            responses: requestResponses
          });
        }
      });

      console.log('🔍 Total requests with responses:', requestResponseMap.size);

      // Add one message per request that has responses
      requestResponseMap.forEach(({ request, responses }) => {
        const responseCount = responses.length;
        const latestResponse = responses.sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];

        // Check if any response has been accepted
        const acceptedResponse = responses.find((resp: any) => resp.status === 'accepted');

        if (acceptedResponse) {
          // Show accepted message for the requester
          const responderName = acceptedResponse.responder_name || 'Someone';
          const groupName = acceptedResponse.group_name || 'your group';
          messages.push({
            id: `request-accepted-${request.care_request_id}`,
            type: 'care_request',
            title: `You accepted ${responderName}'s ${groupName} reciprocal offer for ${formatDateOnly(request.requested_date)}`,
            subtitle: '',
            timestamp: acceptedResponse.created_at,
            data: acceptedResponse,
            actions: undefined
          });
        } else {
          // Only show the original request message if NO responses have been accepted
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

      // Add my responses status updates (accepted only)
      // Note: Declined responses are now shown via care_declined notifications from the database
      mySubmittedResponses.forEach((response, index) => {
        if (response.status === 'accepted') {
          const requesterName = response.requester_name || 'Someone';
          messages.push({
            id: `status-${response.care_response_id || index}`,
            type: 'care_accepted',
            title: `${requesterName} accepted your reciprocal response for ${formatDateOnly(response.requested_date)}`,
            subtitle: '', // Remove subtitle, all info is in title
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

      // Add hangout/sleepover invitations
      hangoutInvitations.forEach((invitation, index) => {
        messages.push({
          id: `hangout-${invitation.care_response_id}`,
          type: invitation.request_type, // 'hangout' or 'sleepover'
          title: `${invitation.host_parent_name} invited ${invitation.invited_child_name} to a ${invitation.request_type}`,
          subtitle: `${formatDateOnly(invitation.requested_date)} from ${formatTime(invitation.start_time)} to ${formatTime(invitation.end_time)}${invitation.end_date ? ' until ' + formatDateOnly(invitation.end_date) : ''} • ${invitation.group_name}`,
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
          <div key={message.id} className="border border-gray-200 rounded-lg overflow-hidden">
            {/* Header - Always Visible */}
            <div
              className={`p-4 bg-gray-50 transition-colors ${message.type !== 'care_declined' && message.type !== 'reschedule_request' ? 'hover:bg-gray-100 cursor-pointer' : ''}`}
              onClick={() => {
                // Don't allow expansion for care_declined or reschedule_request messages
                if (message.type === 'care_declined' || message.type === 'reschedule_request') return;

                // Always toggle (expand/collapse)
                toggleExpanded(message.id);
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h4 className="font-medium text-gray-900">{message.title}</h4>
                  </div>
                  {message.subtitle && (
                    <p className="text-sm text-gray-600 mt-1">{message.subtitle}</p>
                  )}
                  <p className="text-sm text-gray-500 mt-1">
                    {formatDateOnly(message.timestamp)}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  {/* Don't show badge for reschedule_request or reschedule_counter_sent since buttons are inline */}
                  {message.type !== 'reschedule_request' && message.type !== 'reschedule_counter_sent' && (
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      message.type === 'open_block_invitation' ? 'bg-yellow-100 text-yellow-800' :
                      message.type === 'open_block_accepted' ? 'bg-green-100 text-green-800' :
                      message.type === 'open_block_provider_notified' ? 'bg-blue-100 text-blue-800' :
                      message.type === 'care_request' && message.data.status === 'accepted' ? 'bg-green-100 text-green-800' :
                      message.type === 'care_request' ? 'bg-blue-100 text-blue-800' :
                      message.type === 'care_response' ? 'bg-green-100 text-green-800' :
                      message.type === 'care_accepted' ? 'bg-green-100 text-green-800' :
                      message.type === 'care_declined' ? 'bg-red-100 text-red-800' :
                      message.type === 'reschedule_accepted' ? 'bg-green-100 text-green-800' :
                      message.type === 'reschedule_declined' ? 'bg-red-100 text-red-800' :
                      message.type === 'reschedule_counter_sent' ? 'bg-yellow-100 text-yellow-800' :
                      message.type === 'reschedule_counter_accepted' ? 'bg-green-100 text-green-800' :
                      message.type === 'reschedule_counter_declined' ? 'bg-red-100 text-red-800' :
                      message.type === 'group_invitation' ? 'bg-purple-100 text-purple-800' :
                      message.type === 'event_invitation' ? 'bg-orange-100 text-orange-800' :
                      message.type === 'hangout' ? 'bg-pink-100 text-pink-800' :
                      message.type === 'sleepover' ? 'bg-indigo-100 text-indigo-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {message.type === 'open_block_invitation' ? 'Invitation' :
                       message.type === 'open_block_accepted' ? 'Accepted' :
                       message.type === 'open_block_provider_notified' ? 'Block Accepted' :
                       message.type === 'care_request' && message.data.status === 'accepted' ? 'Accepted' :
                       message.type === 'care_request' ? 'Request' :
                       message.type === 'care_response' ? 'Response' :
                       message.type === 'care_accepted' ? 'Accepted' :
                       message.type === 'care_declined' ? 'Not Accepted' :
                       message.type === 'reschedule_accepted' ? 'Accepted' :
                       message.type === 'reschedule_declined' ? 'Declined' :
                       message.type === 'reschedule_counter_sent' ? 'Counter Sent' :
                       message.type === 'reschedule_counter_accepted' ? 'Accepted' :
                       message.type === 'reschedule_counter_declined' ? 'Declined' :
                       message.type === 'group_invitation' ? 'Group Invite' :
                       message.type === 'event_invitation' ? 'Event Invite' :
                       message.type === 'hangout' ? 'Hangout Invite' :
                       message.type === 'sleepover' ? 'Sleepover Invite' :
                       'Update'}
                    </span>
                  )}
                  
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
                  
                  {/* Show Accept/Decline buttons to the right of reschedule badge */}
                  {message.type === 'reschedule_request' && message.actions && (
                    <div className="ml-2" onClick={(e) => e.stopPropagation()}>
                      {message.actions}
                    </div>
                  )}

                  {/* Show Accept/Decline buttons to the right of counter-proposal badge */}
                  {message.type === 'reschedule_counter_sent' && message.actions && (
                    <div className="ml-2" onClick={(e) => e.stopPropagation()}>
                      {message.actions}
                    </div>
                  )}

                  {/* Only show expand arrow for messages that have expandable content */}
                  {message.type !== 'group_invitation' && message.type !== 'care_declined' && message.type !== 'reschedule_request' && message.type !== 'reschedule_counter_sent' && (
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
                {/* Don't show actions for group invitations, reschedule requests, or counter-proposals since buttons are inline */}
                {message.actions && message.type !== 'group_invitation' && message.type !== 'reschedule_request' && message.type !== 'reschedule_counter_sent' && (
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

                {/* Show accepted open block details - ACCEPTOR VIEW */}
                {message.type === 'open_block_accepted' && (() => {
                  console.log('📊 Open block accepted message data:', message.data);
                  return null;
                })()}
                {message.type === 'open_block_accepted' && (
                  <div className="space-y-3 mb-4">
                    {/* Block 1: You will receive care */}
                    <div className="bg-blue-50 rounded-lg p-3 border-l-4 border-blue-500">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">
                          You will receive care
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {formatDateOnly(message.data.existing_block_date)} from{' '}
                          {formatTime(message.data.existing_block_start_time)} to {formatTime(message.data.existing_block_end_time)}
                        </p>
                        <button
                          onClick={() => navigateToCareBlock(message.data.existing_block_date, 'needed')}
                          className="inline-block mt-3 px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                        >
                          View in Calendar
                        </button>
                      </div>
                    </div>

                    {/* Block 2: You will provide care (Reciprocal) */}
                    <div className="bg-green-50 rounded-lg p-3 border-l-4 border-green-500">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">
                          You will provide care
                        </p>
                        {message.data.reciprocal_date && message.data.reciprocal_start_time && message.data.reciprocal_end_time ? (
                          <>
                            <p className="text-sm text-gray-600 mt-1">
                              {formatDateOnly(message.data.reciprocal_date)} from{' '}
                              {formatTime(message.data.reciprocal_start_time)} to {formatTime(message.data.reciprocal_end_time)}
                            </p>
                            <button
                              onClick={() => navigateToCareBlock(message.data.reciprocal_date, 'provided')}
                              className="inline-block mt-3 px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                            >
                              View in Calendar
                            </button>
                          </>
                        ) : (
                          <p className="text-sm text-gray-500 mt-1 italic">
                            Check your calendar for the reciprocal care time
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Show accepted open block details - PROVIDER VIEW */}
                {message.type === 'open_block_provider_notified' && (() => {
                  console.log('📊 Open block provider notified message data:', message.data);
                  return null;
                })()}
                {message.type === 'open_block_provider_notified' && (
                  <div className="space-y-3 mb-4">
                    {/* Block 1: You will provide care */}
                    <div className="bg-green-50 rounded-lg p-3 border-l-4 border-green-500">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">
                          You will provide care
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {formatDateOnly(message.data.existing_block_date)} from{' '}
                          {formatTime(message.data.existing_block_start_time)} to {formatTime(message.data.existing_block_end_time)}
                        </p>
                        <button
                          onClick={() => navigateToCareBlock(message.data.existing_block_date, 'provided')}
                          className="inline-block mt-3 px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                        >
                          View in Calendar
                        </button>
                      </div>
                    </div>

                    {/* Block 2: You will receive care (Reciprocal) */}
                    <div className="bg-blue-50 rounded-lg p-3 border-l-4 border-blue-500">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">
                          You will receive care
                        </p>
                        {message.data.reciprocal_date && message.data.reciprocal_start_time && message.data.reciprocal_end_time ? (
                          <>
                            <p className="text-sm text-gray-600 mt-1">
                              {formatDateOnly(message.data.reciprocal_date)} from{' '}
                              {formatTime(message.data.reciprocal_start_time)} to {formatTime(message.data.reciprocal_end_time)}
                            </p>
                            <button
                              onClick={() => navigateToCareBlock(message.data.reciprocal_date, 'needed')}
                              className="inline-block mt-3 px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                            >
                              View in Calendar
                            </button>
                          </>
                        ) : (
                          <p className="text-sm text-gray-500 mt-1 italic">
                            Check your calendar for the reciprocal care time
                          </p>
                        )}
                      </div>
                    </div>

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
                    {/* Block 1: You will receive care */}
                    <div className="bg-blue-50 rounded-lg p-3 border-l-4 border-blue-500">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">
                          You will receive care
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {formatDateOnly(message.data.requested_date)} from{' '}
                          {formatTime(message.data.start_time)} to {formatTime(getActualEndTime(message.data.notes || '', message.data.end_time))}
                        </p>
                        <button
                          onClick={() => navigateToCareBlock(message.data.requested_date, 'needed')}
                          className="inline-block mt-3 px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                        >
                          View in Calendar
                        </button>
                      </div>
                    </div>

                    {/* Block 2: You will provide care */}
                    <div className="bg-green-50 rounded-lg p-3 border-l-4 border-green-500">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">
                          You will provide care
                        </p>
                        {message.data.reciprocal_date && message.data.reciprocal_start_time && message.data.reciprocal_end_time ? (
                          <>
                            <p className="text-sm text-gray-600 mt-1">
                              {formatDateOnly(message.data.reciprocal_date)} from{' '}
                              {formatTime(message.data.reciprocal_start_time)} to {formatTime(message.data.reciprocal_end_time)}
                            </p>
                            <button
                              onClick={() => navigateToCareBlock(message.data.reciprocal_date, 'provided')}
                              className="inline-block mt-3 px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                            >
                              View in Calendar
                            </button>
                          </>
                        ) : (
                          <p className="text-sm text-gray-500 mt-1 italic">
                            Check your calendar for the reciprocal care time
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Show accepted reciprocal response details (responder's view) */}
                {message.type === 'care_accepted' && (
                  <div className="space-y-3 mb-4">
                    {/* Block 1: You will provide care */}
                    <div className="bg-green-50 rounded-lg p-3 border-l-4 border-green-500">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">
                          You will provide care
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {formatDateOnly(message.data.requested_date)} from{' '}
                          {formatTime(message.data.start_time)} to {formatTime(getActualEndTime(message.data.notes || '', message.data.end_time))}
                        </p>
                        <button
                          onClick={() => navigateToCareBlock(message.data.requested_date, 'provided')}
                          className="inline-block mt-3 px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                        >
                          View in Calendar
                        </button>
                      </div>
                    </div>

                    {/* Block 2: You will receive care */}
                    <div className="bg-blue-50 rounded-lg p-3 border-l-4 border-blue-500">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">
                          You will receive care
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {formatDateOnly(message.data.reciprocal_date)} from{' '}
                          {formatTime(message.data.reciprocal_start_time)} to {formatTime(message.data.reciprocal_end_time)}
                        </p>
                        <button
                          onClick={() => navigateToCareBlock(message.data.reciprocal_date, 'needed')}
                          className="inline-block mt-3 px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                        >
                          View in Calendar
                        </button>
                      </div>
                    </div>

                  </div>
                )}

                {/* Show accepted reschedule details */}
                {message.type === 'reschedule_accepted' && (
                  <div className="space-y-3 mb-4">
                    <div className="bg-blue-50 rounded-lg p-3 border-l-4 border-blue-500">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">
                          New care block (receiving care)
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {formatDateOnly(message.data.new_date)} from{' '}
                          {formatTime(message.data.new_start_time)} to {formatTime(message.data.new_end_time)}
                        </p>
                        <button
                          onClick={() => navigateToCareBlock(message.data.new_date, 'needed')}
                          className="inline-block mt-3 px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                        >
                          View in Calendar
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Show declined reschedule details */}
                {message.type === 'reschedule_declined' && (
                  <div className="space-y-3 mb-4">
                    <h5 className="font-medium text-gray-900 text-sm">Cancelled care blocks:</h5>

                    {/* Block 1: The reschedule request that was declined */}
                    <div className="bg-red-50 rounded-lg p-3 border-l-4 border-red-500">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">
                          Declined reschedule
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {formatDateOnly(message.data.declined_reschedule_date)} from{' '}
                          {formatTime(message.data.declined_reschedule_start_time)} to {formatTime(message.data.declined_reschedule_end_time)}
                        </p>
                      </div>
                    </div>

                    {/* Block 2: The existing arrangement that was selected to be removed */}
                    {message.data.selected_cancellation_date && (
                      <div className="bg-red-50 rounded-lg p-3 border-l-4 border-red-500">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 text-sm">
                            Selected arrangement removed
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            {formatDateOnly(message.data.selected_cancellation_date)} from{' '}
                            {formatTime(message.data.selected_cancellation_start_time)} to {formatTime(message.data.selected_cancellation_end_time)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Show counter-proposal sent details */}
                {message.type === 'reschedule_counter_sent' && (
                  <div className="space-y-3 mb-4">
                    <h5 className="font-medium text-gray-900 text-sm">Counter-proposal details:</h5>

                    <div className="bg-yellow-50 rounded-lg p-3 border-l-4 border-yellow-500">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">
                          Original request
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {formatDateOnly(message.data.original_requested_date)} from{' '}
                          {formatTime(message.data.original_requested_start_time)} to {formatTime(message.data.original_requested_end_time)}
                        </p>
                      </div>
                    </div>

                    <div className="bg-blue-50 rounded-lg p-3 border-l-4 border-blue-500">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">
                          Counter-proposal
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {formatDateOnly(message.data.counter_date)} from{' '}
                          {formatTime(message.data.counter_start_time)} to {formatTime(message.data.counter_end_time)}
                        </p>
                      </div>
                    </div>

                    {/* Show selected cancellation block (block at risk if counter is declined) */}
                    {message.data.selected_cancellation_date && message.data.original_requester_id === user?.id && (
                      <div className="bg-red-50 rounded-lg p-3 border-l-4 border-red-500">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 text-sm">
                            Block at risk if declined
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            {formatDateOnly(message.data.selected_cancellation_date)} from{' '}
                            {formatTime(message.data.selected_cancellation_start_time)} to {formatTime(message.data.selected_cancellation_end_time)}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {message.data.selected_cancellation_requesting_parent} requesting care from {message.data.selected_cancellation_receiving_parent}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Show counter-proposal accepted details */}
                {message.type === 'reschedule_counter_accepted' && (
                  <div className="space-y-3 mb-4">
                    <div className="bg-blue-50 rounded-lg p-3 border-l-4 border-blue-500">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">
                          New care block (receiving care)
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {formatDateOnly(message.data.new_date)} from{' '}
                          {formatTime(message.data.new_start_time)} to {formatTime(message.data.new_end_time)}
                        </p>
                        <button
                          onClick={() => navigateToCareBlock(message.data.new_date, 'needed')}
                          className="inline-block mt-3 px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                        >
                          View in Calendar
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Show counter-proposal declined details */}
                {message.type === 'reschedule_counter_declined' && (
                  <div className="space-y-3 mb-4">
                    <h5 className="font-medium text-gray-900 text-sm">Cancelled care blocks:</h5>

                    {/* Declined counter */}
                    <div className="bg-red-50 rounded-lg p-3 border-l-4 border-red-500">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">
                          Declined counter-proposal
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {formatDateOnly(message.data.declined_counter_date)} from{' '}
                          {formatTime(message.data.declined_counter_start_time)} to {formatTime(message.data.declined_counter_end_time)}
                        </p>
                      </div>
                    </div>

                    {/* Selected cancellation */}
                    {message.data.selected_cancellation_date && (
                      <div className="bg-red-50 rounded-lg p-3 border-l-4 border-red-500">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 text-sm">
                            Selected arrangement removed
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            {formatDateOnly(message.data.selected_cancellation_date)} from{' '}
                            {formatTime(message.data.selected_cancellation_start_time)} to {formatTime(message.data.selected_cancellation_end_time)}
                          </p>
                        </div>
                      </div>
                    )}
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

                {/* Show hangout/sleepover invitation details */}
                {(message.type === 'hangout' || message.type === 'sleepover') && (
                  <div className="space-y-3 mb-4">
                    <h5 className="font-medium text-gray-900 text-sm">{message.type === 'hangout' ? 'Hangout' : 'Sleepover'} Details:</h5>
                    <div className={`${message.type === 'hangout' ? 'bg-pink-50 border-pink-500' : 'bg-indigo-50 border-indigo-500'} rounded-lg p-3 border-l-4`}>
                      <div className="flex-1 space-y-2">
                        <p className="font-medium text-gray-900 text-sm">
                          Host: {message.data.host_parent_name}
                        </p>
                        <p className="text-sm text-gray-600">
                          Your child: {message.data.invited_child_name}
                        </p>
                        {message.data.hosting_children_names && message.data.hosting_children_names.length > 0 && (
                          <p className="text-sm text-gray-600">
                            Hosting children: {message.data.hosting_children_names.join(', ')}
                          </p>
                        )}
                        <p className="text-sm text-gray-600">
                          Date: {formatDateOnly(message.data.requested_date)} from {formatTime(message.data.start_time)} to {formatTime(message.data.end_time)}
                        </p>
                        {message.data.end_date && (
                          <p className="text-sm text-gray-600">
                            Until: {formatDateOnly(message.data.end_date)} at {formatTime(message.data.end_time)}
                          </p>
                        )}
                        <p className="text-sm text-gray-500">
                          Group: {message.data.group_name}
                        </p>
                        {message.data.notes && (
                          <p className="text-sm text-gray-500 mt-2">
                            <strong>Notes:</strong> {message.data.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    <h5 className="font-medium text-gray-900 text-sm mt-4">Respond:</h5>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleAcceptHangoutInvitation(message.data, message.data.invited_child_id)}
                        className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleDeclineHangoutInvitation(message.data)}
                        className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                      >
                        Decline
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
      fetchHangoutInvitations();
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // Set up real-time subscription for new notifications (reschedule requests, counters, etc.)
  useEffect(() => {
    if (!user) return;

    console.log('📡 Setting up real-time notifications subscription for scheduler page');

    const channel = supabase
      .channel('scheduler_notifications_updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('📬 Scheduler: New notification received, refreshing data...', payload.new);
          // Refresh all data when new notification arrives
          fetchData();
        }
      )
      .subscribe();

    return () => {
      console.log('📡 Cleaning up real-time notifications subscription');
      supabase.removeChannel(channel);
    };
  }, [user]);

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

      // Fetch CHILD care requests and responses
      const { data: childRequests, error: childRequestsError } = await supabase.rpc('get_reciprocal_care_requests', {
        parent_id: user.id
      });

      // Fetch PET care requests (only if function exists)
      let petRequests: any[] = [];
      let petRequestsError: any = null;
      try {
        const { data, error } = await supabase.rpc('get_reciprocal_pet_care_requests', {
          p_parent_id: user.id
        });
        if (!error) {
          petRequests = data || [];
        } else {
          petRequestsError = error;
        }
      } catch (err) {
        // Pet care function doesn't exist, skip
      }

      // Combine child and pet requests with safety checks
      const allRequests = [
        ...(Array.isArray(childRequests) ? childRequests : []).map((r: any) => ({ ...r, care_type: 'child' as const })),
        ...(Array.isArray(petRequests) ? petRequests : []).map((r: any) => ({ ...r, care_type: 'pet' as const }))
      ].sort((a, b) => {
        try {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        } catch (e) {
          return 0;
        }
      });

      if (childRequestsError) {
        console.error('Error fetching child care requests:', childRequestsError);
      }
      if (petRequestsError) {
        console.error('Error fetching pet care requests:', petRequestsError);
      }

      console.log('🔍 Fetched combined requests:', allRequests);
      console.log('🔍 Pet requests:', petRequests);
      console.log('🔍 Child requests:', childRequests);
      setCareRequests(allRequests);

      // Fetch CHILD care responses
      const { data: childResponses, error: childResponsesError } = await supabase.rpc('get_reciprocal_care_responses', {
        parent_id: user.id
      });

      // Fetch PET care responses (only if function exists)
      let petResponses: any[] = [];
      let petResponsesError: any = null;
      try {
        const { data, error } = await supabase.rpc('get_reciprocal_pet_care_responses', {
          p_parent_id: user.id
        });
        if (!error) {
          petResponses = data || [];
        } else {
          petResponsesError = error;
        }
      } catch (err) {
        // Pet care function doesn't exist, skip
      }

      // Combine child and pet responses with safety checks
      const combinedResponses = [
        ...(Array.isArray(childResponses) ? childResponses : []).map((r: any) => ({ ...r, care_type: 'child' as const })),
        ...(Array.isArray(petResponses) ? petResponses : []).map((r: any) => ({ ...r, care_type: 'pet' as const }))
      ].sort((a, b) => {
        try {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        } catch (e) {
          return 0;
        }
      });

      if (childResponsesError) {
        console.error('Error fetching child care responses:', childResponsesError);
      }
      if (petResponsesError) {
        console.error('Error fetching pet care responses:', petResponsesError);
      }

      console.log('🔍 Fetched combined responses:', combinedResponses);
      console.log('🔍 Pet responses:', petResponses);
      console.log('🔍 Child responses:', childResponses);

      // Also fetch responses to requests I made (for accepting)
      const { data: responsesToMyRequests, error: responsesToMyRequestsError } = await supabase.rpc('get_responses_for_requester', {
        p_requester_id: user.id
      });

      if (responsesToMyRequestsError) {
        console.error('Error fetching responses to my requests:', responsesToMyRequestsError);
      }

      // Fetch pet care responses to MY pet care requests (simpler query without join)
      const { data: petResponsesToMyRequests, error: petResponsesToMyRequestsError } = await supabase
        .from('pet_care_responses')
        .select(`
          id,
          request_id,
          responder_id,
          status,
          response_type,
          response_notes,
          reciprocal_date,
          reciprocal_start_time,
          reciprocal_end_time,
          reciprocal_pet_id,
          created_at,
          pet_care_requests!inner(
            id,
            group_id,
            requester_id,
            requested_date,
            start_time,
            end_time,
            notes,
            pet_id,
            end_date
          )
        `)
        .eq('pet_care_requests.requester_id', user.id);

      if (petResponsesToMyRequestsError) {
        console.error('Error fetching pet responses to my requests:', petResponsesToMyRequestsError);
      }

      // Get responder names separately
      const responderIds = (petResponsesToMyRequests || []).map((r: any) => r.responder_id).filter(Boolean);
      const responderNames: Record<string, string> = {};

      if (responderIds.length > 0) {
        const { data: responders } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', responderIds);

        (responders || []).forEach((r: any) => {
          responderNames[r.id] = r.full_name;
        });
      }

      // Get group names for pet requests
      const petGroupIds = [...new Set(allRequests.filter(r => r.care_type === 'pet').map(r => r.group_id))];
      const groupNames: Record<string, string> = {};

      if (petGroupIds.length > 0) {
        const { data: groupsData } = await supabase
          .from('groups')
          .select('id, name')
          .in('id', petGroupIds);

        (groupsData || []).forEach((g: any) => {
          groupNames[g.id] = g.name;
        });
      }

      // Transform pet responses to match the expected format
      const formattedPetResponsesToMyRequests = (petResponsesToMyRequests || []).map((r: any) => ({
        care_response_id: r.id,
        care_request_id: r.request_id,
        group_id: r.pet_care_requests.group_id,
        group_name: groupNames[r.pet_care_requests.group_id] || '',
        requester_id: r.pet_care_requests.requester_id,
        requester_name: user?.email || '', // Current user
        requested_date: r.pet_care_requests.requested_date,
        start_time: r.pet_care_requests.start_time,
        end_time: r.pet_care_requests.end_time,
        notes: r.pet_care_requests.notes,
        status: r.status,
        created_at: r.created_at,
        reciprocal_date: r.reciprocal_date,
        reciprocal_start_time: r.reciprocal_start_time,
        reciprocal_end_time: r.reciprocal_end_time,
        response_notes: r.response_notes,
        responder_id: r.responder_id,
        responder_name: responderNames[r.responder_id] || '',
        care_type: 'pet' as const,
        pet_name: '',
        end_date: r.pet_care_requests.end_date
      }));

      console.log('🔍 Pet responses to my requests:', formattedPetResponsesToMyRequests);

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

      // Fetch reschedule acceptance/decline notifications
      const { data: rescheduleNotifications, error: rescheduleNotificationsError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .in('type', ['reschedule_accepted', 'reschedule_declined', 'reschedule_counter_sent', 'reschedule_counter_accepted', 'reschedule_counter_declined', 'care_declined'])
        .order('created_at', { ascending: false });

      if (rescheduleNotificationsError) {
        console.error('Error fetching reschedule notifications:', rescheduleNotificationsError);
        setRescheduleNotifications([]);
      } else {
        setRescheduleNotifications(rescheduleNotifications || []);
      }

      console.log('📊 Reschedule notifications fetched:', rescheduleNotifications);

      // Merge all responses - only include valid, non-duplicate responses
      const allResponses = [
        ...(Array.isArray(combinedResponses) ? combinedResponses : []),
        ...(Array.isArray(responsesToMyRequests) ? responsesToMyRequests : []),
        ...(Array.isArray(formattedPetResponsesToMyRequests) ? formattedPetResponsesToMyRequests : [])
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

      console.log('🔍 Final uniqueResponses being set to careResponses:', uniqueResponses);
      console.log('🔍 Care types in responses:', uniqueResponses.map(r => ({ id: r.care_response_id, care_type: r.care_type })));

      setCareResponses(uniqueResponses);

    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const navigateToCareBlock = async (date: string, careType: 'needed' | 'provided') => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Find the block for this date and care type
      const { data: blocks } = await supabase
        .from('scheduled_care')
        .select('id')
        .eq('care_date', date)
        .eq('parent_id', user.id)
        .eq('care_type', careType)
        .limit(1);

      if (blocks && blocks.length > 0) {
        // Navigate with block ID to auto-open
        window.location.href = `/calendar?date=${date}&selectBlock=${blocks[0].id}`;
      } else {
        // Fallback to just the date
        window.location.href = `/calendar?date=${date}`;
      }
    } catch (err) {
      console.error('Error finding block:', err);
      // Fallback to just the date
      window.location.href = `/calendar?date=${date}`;
    }
  };

  const fetchChildrenForGroup = async (groupId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      console.log('🔍 Debug: Starting fetchChildrenForGroup');
      console.log('🔍 Debug: groupId =', groupId);
      console.log('🔍 Debug: user.id =', user.id);

      // Try a simpler approach - get children directly with a join
      const { data, error } = await supabase
        .from('child_group_members')
        .select(`
          child_id,
          children!inner(id, full_name, parent_id)
        `)
        .eq('group_id', groupId)
        .eq('active', true)
        .eq('children.parent_id', user.id);

      console.log('🔍 Debug: Direct query result:', { data, error });

      if (error) {
        console.error('Error fetching children for group:', error);
        return;
      }

      if (!data || data.length === 0) {
        console.log('🔍 Debug: No children found for this user in this group');
        setChildren([]);
        return;
      }

      const groupChildren = data.map(item => ({
        id: item.children.id,
        name: item.children.full_name,
        group_id: groupId
      }));

      console.log('✅ Children fetched for group:', groupChildren);
      setChildren(groupChildren);
    } catch (err) {
      console.error('Error in fetchChildrenForGroup:', err);
    }
  };

  const fetchPetsForGroup = async (groupId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      console.log('🔍 Debug: Starting fetchPetsForGroup');
      console.log('🔍 Debug: groupId =', groupId);
      console.log('🔍 Debug: user.id =', user.id);

      // Get pets for this user in this group
      const { data, error } = await supabase
        .from('pet_group_members')
        .select(`
          pet_id,
          pets!inner(id, name, species, parent_id)
        `)
        .eq('group_id', groupId)
        .eq('active', true)
        .eq('pets.parent_id', user.id);

      console.log('🔍 Debug: Direct query result:', { data, error });

      if (error) {
        console.error('Error fetching pets for group:', error);
        return;
      }

      if (!data || data.length === 0) {
        console.log('🔍 Debug: No pets found for this user in this group');
        setPets([]);
        return;
      }

      const groupPets = data.map(item => ({
        id: item.pets.id,
        name: item.pets.name,
        species: item.pets.species,
        group_id: groupId
      }));

      console.log('✅ Pets fetched for group:', groupPets);
      setPets(groupPets);
    } catch (err) {
      console.error('Error in fetchPetsForGroup:', err);
    }
  };

  const fetchAllGroupChildren = async (groupId: string) => {
    try {
      const { data, error } = await supabase
        .from('child_group_members')
        .select(`
          child_id,
          children!inner(id, full_name, parent_id)
        `)
        .eq('group_id', groupId)
        .eq('active', true);

      if (error) {
        console.error('Error fetching all group children:', error);
        return;
      }

      if (!data || data.length === 0) {
        setGroupChildren([]);
        return;
      }

      const allChildren = data.map(item => ({
        id: item.children.id,
        name: item.children.full_name,
        group_id: groupId,
        parent_id: item.children.parent_id
      }));

      console.log('✅ All children fetched for group:', allChildren);
      setGroupChildren(allChildren);
    } catch (err) {
      console.error('Error in fetchAllGroupChildren:', err);
    }
  };

  // Handle reschedule response (integrated into unified system)
  const handleRescheduleResponse = async (careResponseId: string, response: 'accepted' | 'declined', notes?: string, careRequestId?: string) => {
    try {
      // If declining, check if it's a counter-proposal first
      if (response === 'declined') {
        console.log('=== HANDLING RESCHEDULE DECLINE ===');
        console.log('Care Request ID:', careRequestId);
        console.log('Care Response ID:', careResponseId);

        if (!careRequestId) {
          // Need to look up the care_request_id from the care_response_id
          const { data: responseData, error: responseError } = await supabase
            .from('care_responses')
            .select('request_id')
            .eq('id', careResponseId)
            .single();

          if (responseError || !responseData) {
            console.error('Could not find care request:', responseError);
            showAlertOnce('Failed to load reschedule details');
            return;
          }
          careRequestId = responseData.request_id;
        }

        // ✅ Check if this is a counter-proposal BEFORE opening modal
        const { data: requestData, error: requestError } = await supabase
          .from('care_requests')
          .select('counter_proposal_to')
          .eq('id', careRequestId)
          .single();

        if (requestError) {
          console.error('Error checking if counter-proposal:', requestError);
          showAlertOnce('Failed to load reschedule details');
          return;
        }

        const isCounterProposal = requestData.counter_proposal_to !== null;
        console.log('✅ Is counter-proposal:', isCounterProposal);

        if (isCounterProposal) {
          // This is a counter-proposal - decline immediately without showing modal
          console.log('Counter-proposal detected - declining immediately without modal');

          const confirmed = window.confirm(
            'Are you sure you want to decline this counter-proposal? The parent will be notified and their selected arrangement will be canceled.'
          );

          if (!confirmed) return;

          setProcessingReschedule(true);

          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            showAlertOnce('User not authenticated');
            return;
          }

          // ✅ FIX: Get the counter-proposer's selected_cancellation_request_id
          // When the original requester declines a counter-proposal, we need to find
          // the care_response that created this counter and get the selected block
          const { data: counterResponseData, error: counterResponseError } = await supabase
            .from('care_responses')
            .select('selected_cancellation_request_id, decline_action')
            .eq('request_id', requestData.counter_proposal_to) // Original request
            .eq('decline_action', 'counter_propose')
            .single();

          if (counterResponseError) {
            console.error('Error finding counter-proposer response:', counterResponseError);
          }

          const selectedCancellationId = counterResponseData?.selected_cancellation_request_id || null;
          console.log('Counter-proposer selected cancellation:', selectedCancellationId);

          const { data, error } = await supabase.rpc('handle_improved_reschedule_response', {
            p_care_response_id: careResponseId,
            p_responder_id: user.id,
            p_response_status: 'declined',
            p_response_notes: notes || null,
            p_decline_action: null,
            p_selected_cancellation_request_id: selectedCancellationId
          });

          if (error) throw error;

          showAlertOnce('You have declined the counter-proposal. The parent has been notified.');
          await fetchData();
          setProcessingReschedule(false);
          return;
        }

        // Not a counter-proposal - show the full modal with decline options
        console.log('Original reschedule - showing modal with decline options');
        setSelectedRescheduleRequest({
          requestId: careRequestId,
          responseId: careResponseId
        });
        setShowRescheduleResponseModal(true);
        return;
      }

      // If accepting, process immediately
      setProcessingReschedule(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showAlertOnce('User not authenticated');
        return;
      }

      const { data, error } = await supabase.rpc('handle_improved_reschedule_response', {
        p_care_response_id: careResponseId,
        p_responder_id: user.id,
        p_response_status: response,
        p_response_notes: notes || null
      });

      if (error) {
        console.error('Error handling reschedule response:', error);
        showAlertOnce('Failed to process response. Please try again.');
        return;
      }

      if (data.success) {
        // If accepting, update calendar counter
        if (response === 'accepted') {
          // Reschedule acceptance modifies 2 existing blocks (doesn't create new ones)
          // So we add +2 to indicate calendar was updated
          const currentCalendarCount = parseInt(localStorage.getItem('newCalendarBlocksCount') || '0', 10);
          localStorage.setItem('newCalendarBlocksCount', (currentCalendarCount + 2).toString());

          // Dispatch calendar counter update event
          window.dispatchEvent(new Event('calendarCountUpdated'));
        }

        // Dispatch scheduler counter update event (to decrement Messages button)
        window.dispatchEvent(new Event('schedulerCountUpdated'));

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

      // Validate date and time are not in the past
      const inputDateTime = new Date(`${newRequest.care_date}T${newRequest.start_time}:00`);
      const now = new Date();

      if (inputDateTime <= now) {
        alert('Cannot schedule care in the past. Please select a future date and time.');
        return;
      }

      // Validate end date for sleepovers/multi-day care
      if (newRequest.end_date) {
        const endDateTime = new Date(`${newRequest.end_date}T${newRequest.end_time}:00`);
        if (endDateTime <= now) {
          alert('End date and time cannot be in the past. Please select a future date and time.');
          return;
        }
        if (endDateTime <= inputDateTime) {
          alert('End date and time must be after start date and time.');
          return;
        }
      }

      let data, error;
  
      if (newRequest.care_type === 'reciprocal') {
        // Validate reciprocal-specific fields
        if (!newRequest.child_id) {
          setError('Please select a child');
          return;
        }
  
        // Create reciprocal care request (existing logic)
        const result = await supabase.rpc('create_reciprocal_care_request', {
          requester_id: user.id,
          group_id: newRequest.group_id,
          requested_date: newRequest.care_date,
          start_time: newRequest.start_time,
          end_time: newRequest.end_time,
          child_id: newRequest.child_id,
          notes: newRequest.notes || null
        });
        data = result.data;
        error = result.error;
  
      } else if (newRequest.care_type === 'hangout') {
        // Validate hangout-specific fields
        if (newRequest.hosting_child_ids.length === 0) {
          setError('Please select at least one hosting child');
          return;
        }
        if (newRequest.invited_child_ids.length === 0) {
          setError('Please select at least one child to invite');
          return;
        }
  
        // Create hangout invitation
        const result = await supabase.rpc('create_hangout_invitation', {
          p_requesting_parent_id: user.id,
          p_group_id: newRequest.group_id,
          p_care_date: newRequest.care_date,
          p_start_time: newRequest.start_time,
          p_end_time: newRequest.end_time,
          p_hosting_child_ids: newRequest.hosting_child_ids,
          p_invited_child_ids: newRequest.invited_child_ids,
          p_notes: newRequest.notes || null
        });
        data = result.data?.[0]?.request_id;
        error = result.error;
  
      } else if (newRequest.care_type === 'sleepover') {
        // Validate sleepover-specific fields
        if (!newRequest.end_date) {
          setError('End date is required for sleepovers');
          return;
        }
        if (newRequest.hosting_child_ids.length === 0) {
          setError('Please select at least one hosting child');
          return;
        }
        if (newRequest.invited_child_ids.length === 0) {
          setError('Please select at least one child to invite');
          return;
        }
  
        // Create sleepover invitation
        const result = await supabase.rpc('create_sleepover_invitation', {
          p_requesting_parent_id: user.id,
          p_group_id: newRequest.group_id,
          p_care_date: newRequest.care_date,
          p_start_time: newRequest.start_time,
          p_end_date: newRequest.end_date,
          p_end_time: newRequest.end_time,
          p_hosting_child_ids: newRequest.hosting_child_ids,
          p_invited_child_ids: newRequest.invited_child_ids,
          p_notes: newRequest.notes || null
        });
        data = result.data?.[0]?.request_id;
        error = result.error;
      }
  
      if (error) {
        setError(`Failed to create ${newRequest.care_type}`);
        console.error('Error creating care request:', error);
        return;
      }
  
      // Send notifications to group members via messages
      if (data) {
        await supabase.rpc('send_care_request_notifications', {
          p_care_request_id: data
        });
      }
  
      // Reset form and refresh data
      resetNewRequestForm();
      fetchData();
  
    } catch (err) {
      console.error('Error in handleCreateRequest:', err);
      setError('An unexpected error occurred');
    }
  };
  
  const handleOpenResponseForm = async (request: CareRequest) => {
    console.log('🐾 Opening response form for request:', request);
    console.log('🐾 Care type:', request.care_type);

    setSelectedRequest(request);
    setShowResponseForm(true);

    // Fetch children or pets based on care type
    if (request.care_type === 'pet') {
      console.log('🐾 Fetching pets for group:', request.group_id);
      await fetchPetsForGroup(request.group_id);
    } else {
      console.log('👶 Fetching children for group:', request.group_id);
      await fetchChildrenForGroup(request.group_id);
    }
  };

  const handleSubmitResponse = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedRequest) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let data, error;

      // Call the appropriate RPC function based on care type
      if (selectedRequest.care_type === 'pet') {
        const result = await supabase.rpc('submit_pet_care_response', {
          p_care_request_id: selectedRequest.care_request_id,
          p_responding_parent_id: user.id,
          p_reciprocal_date: reciprocalResponse.reciprocal_date,
          p_reciprocal_end_date: reciprocalResponse.reciprocal_end_date || null,
          p_reciprocal_start_time: reciprocalResponse.reciprocal_start_time,
          p_reciprocal_end_time: reciprocalResponse.reciprocal_end_time,
          p_reciprocal_pet_id: reciprocalResponse.reciprocal_pet_id,
          p_notes: reciprocalResponse.notes || null
        });
        data = result.data;
        error = result.error;
      } else {
        // Child care response
        const result = await supabase.rpc('submit_reciprocal_care_response', {
          p_care_request_id: selectedRequest.care_request_id,
          p_responding_parent_id: user.id,
          p_reciprocal_date: reciprocalResponse.reciprocal_date,
          p_reciprocal_start_time: reciprocalResponse.reciprocal_start_time,
          p_reciprocal_end_time: reciprocalResponse.reciprocal_end_time,
          p_reciprocal_child_id: reciprocalResponse.reciprocal_child_id,
          p_notes: reciprocalResponse.notes || null
        });
        data = result.data;
        error = result.error;
      }

      if (error) {
        setError('Failed to submit response');
        console.error('Error submitting response:', error);
        return;
      }

      // Send notification message to requester (only for child care - pet care notifications not yet implemented)
      if (data && selectedRequest.care_type !== 'pet') {
        try {
          const notificationMessage = `${selectedRequest.requester_name} has received a response for their ${selectedRequest.care_type || 'care'} request on ${reciprocalResponse.reciprocal_date}`;
          await supabase.rpc('send_care_response_notifications', {
            p_care_request_id: selectedRequest.care_request_id,
            p_responder_id: user.id,
            p_message_content: notificationMessage
          });
        } catch (notifError) {
          console.log('Notification failed (non-critical):', notifError);
        }
      }

      // Reset form and refresh data
      setReciprocalResponse({
        reciprocal_date: '',
        reciprocal_end_date: '',
        reciprocal_start_time: '',
        reciprocal_end_time: '',
        reciprocal_child_id: '',
        reciprocal_pet_id: '',
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
      // First, get the response details to find the request ID and care type
      const responseToAccept = careResponses.find(r => r.care_response_id === responseId);
      const requestId = responseToAccept?.care_request_id;
      const careType = responseToAccept?.care_type; // 'child' or 'pet'

      console.log('🔍 Accepting response:', { responseId, careType, responseToAccept });

      // Call the appropriate accept function based on care type
      let error;
      if (careType === 'pet') {
        const result = await supabase.rpc('accept_pet_care_response', {
          p_care_response_id: responseId
        });
        error = result.error;
      } else {
        const result = await supabase.rpc('accept_reciprocal_care_response', {
          p_care_response_id: responseId
        });
        error = result.error;
      }

       if (error) {
        console.error('❌ ERROR accepting response:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        setError('Failed to accept response: ' + error.message);
         return;
       }

      // Send notifications to all parents with children in the care blocks (only for child care)
      if (careType !== 'pet') {
        await sendReciprocalAcceptanceNotifications(responseId);
      }

      // Update calendar counter - 4 blocks created (2 for requester, 2 for responder)
      // For reciprocal care, the requester gets 2 blocks (needed care + reciprocal providing care)
      const currentCalendarCount = parseInt(localStorage.getItem('newCalendarBlocksCount') || '0', 10);
      localStorage.setItem('newCalendarBlocksCount', (currentCalendarCount + 2).toString());

      // Show success message when reciprocal care response is accepted
      const careTypeLabel = careType === 'pet' ? 'Pet care' : 'Reciprocal care';
      showAlertOnce(`${careTypeLabel} response accepted successfully! Calendar blocks have been created.`);

      fetchData();

      // Dispatch events to update header counters
      // Note: Don't mark as read here - the counter logic will handle it based on
      // whether there are still pending responses for this request
      window.dispatchEvent(new Event('schedulerCountUpdated'));
      window.dispatchEvent(new Event('calendarCountUpdated'));

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
      care_type: 'reciprocal',
      group_id: '',
      child_id: '',
      care_date: '',
      start_time: '',
      end_time: '',
      end_date: '',
      hosting_child_ids: [],
      invited_child_ids: [],
      notes: ''
    });
    setChildren([]);
    setGroupChildren([]);
    setShowNewRequestForm(false);
  };

  // Open block invitation handlers
  const handleAccept = async (invitation: any) => {
    try {
      // Fetch available children for the current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get active children from child_group_members for the SPECIFIC group
      const { data: childrenData, error: childrenError } = await supabase
        .from('child_group_members')
        .select(`
          child_id,
          group_id,
          children!inner(id, full_name, parent_id)
        `)
        .eq('parent_id', user.id)  // Use parent_id, not profile_id
        .eq('group_id', invitation.group_id)  // Filter by the invitation's group
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

      // Success! Update calendar counter (+2 blocks for acceptor)
      const currentCalendarCount = parseInt(localStorage.getItem('newCalendarBlocksCount') || '0', 10);
      localStorage.setItem('newCalendarBlocksCount', (currentCalendarCount + 2).toString());

      // Dispatch events to update header counters
      window.dispatchEvent(new CustomEvent('invitationAccepted'));
      window.dispatchEvent(new Event('calendarCountUpdated'));

      // Refresh the invitations list
      await fetchOpenBlockInvitations();
      setAcceptingInvitation(null);

      // Create confirmation messages for both parties
      await createOpenBlockAcceptanceMessages(targetInvitation, user.id);

      // Show success popup
      alert('Open block accepted successfully! Care blocks have been added to your calendar.');
    } catch (error) {
      console.error('Error accepting open block:', error);
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

      // Fetch pending invitations
      const { data: pendingData, error: pendingError } = await supabase.rpc('get_open_block_invitations', {
        p_parent_id: user.id
      });

      if (pendingError) {
        console.error('Error fetching pending invitations:', pendingError);
        return;
      }

      // Also fetch ACCEPTED invitations for audit trail (messages) - ACCEPTOR VIEW
      // First get the IDs, then fetch details separately
      const { data: acceptedResponseIds, error: acceptedError } = await supabase
        .from('care_responses')
        .select('id, request_id, responder_id, status, created_at, block_time_id')
        .eq('responder_id', user.id)
        .eq('status', 'accepted');

      console.log('📊 Raw acceptor responses:', acceptedResponseIds);

      // Fetch full details for accepted responses
      const acceptedData = await Promise.all(
        (acceptedResponseIds || []).map(async (response: any) => {
          const { data: request } = await supabase
            .from('care_requests')
            .select('requested_date, start_time, end_time, request_type, requester_id, group_id, reciprocal_date, reciprocal_start_time, reciprocal_end_time')
            .eq('id', response.request_id)
            .single();

          // Only include open block requests
          if (!request || request.request_type !== 'open_block') return null;

          const { data: requesterProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', request.requester_id)
            .single();

          const { data: group } = await supabase
            .from('groups')
            .select('name')
            .eq('id', request.group_id)
            .single();

          return {
            ...response,
            existing_block_date: request.requested_date,
            existing_block_start_time: request.start_time,
            existing_block_end_time: request.end_time,
            open_block_parent_name: requesterProfile?.full_name,
            provider_name: requesterProfile?.full_name,
            group_name: group?.name,
            reciprocal_date: request.reciprocal_date,
            reciprocal_start_time: request.reciprocal_start_time,
            reciprocal_end_time: request.reciprocal_end_time
          };
        })
      );

      const acceptedDataFiltered = acceptedData.filter(item => item !== null);

      // NEW: Fetch ACCEPTED invitations where current user is the PROVIDER (requester)
      const { data: providerResponseIds, error: providerError } = await supabase
        .from('care_responses')
        .select('id, request_id, responder_id, status, created_at, block_time_id')
        .eq('status', 'accepted');

      console.log('📊 Raw provider responses:', providerResponseIds);

      // Filter for requests where current user is the requester
      const providerAcceptedData = await Promise.all(
        (providerResponseIds || []).map(async (response: any) => {
          // First check if this request is from the current user
          const { data: request } = await supabase
            .from('care_requests')
            .select('requested_date, start_time, end_time, request_type, requester_id, group_id, reciprocal_date, reciprocal_start_time, reciprocal_end_time')
            .eq('id', response.request_id)
            .single();

          // Only include if: 1) request exists, 2) current user is requester, 3) it's an open block
          if (!request || request.requester_id !== user.id || request.request_type !== 'open_block') {
            return null;
          }

          const { data: group } = await supabase
            .from('groups')
            .select('name')
            .eq('id', request.group_id)
            .single();

          return {
            ...response,
            existing_block_date: request.requested_date,
            existing_block_start_time: request.start_time,
            existing_block_end_time: request.end_time,
            group_name: group?.name,
            reciprocal_date: request.reciprocal_date,
            reciprocal_start_time: request.reciprocal_start_time,
            reciprocal_end_time: request.reciprocal_end_time
          };
        })
      );

      const providerAcceptedDataFiltered = providerAcceptedData.filter(item => item !== null);

      // Debug logging
      console.log('📊 Provider accepted data:', providerAcceptedDataFiltered);
      console.log('📊 Acceptor accepted data:', acceptedDataFiltered);

      // Get acceptor names separately for provider view
      const providerAcceptedWithNames = await Promise.all(
        providerAcceptedDataFiltered.map(async (item: any) => {
          const { data: acceptorProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', item.responder_id)
            .single();

          return {
            ...item,
            acceptor_name: acceptorProfile?.full_name
          };
        })
      );

      console.log('📊 Provider with names:', providerAcceptedWithNames);

      // Combine pending and accepted invitations (acceptor view + provider view)
      const allInvitations = [
        ...(pendingData || []),
        ...acceptedDataFiltered.map((item: any) => ({
          ...item,
          is_acceptor_view: true
        })),
        ...providerAcceptedWithNames.map((item: any) => ({
          ...item,
          is_provider_view: true
        }))
      ];

      console.log('📊 All invitations combined:', allInvitations);
      setInvitations(allInvitations);
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

      // Dispatch event for group invitation updates
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
      
      // Dispatch event for group invitation updates
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

  const fetchHangoutInvitations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase.rpc('get_hangout_sleepover_invitations', {
        p_parent_id: user.id
      });

      if (error) {
        console.error('Error fetching hangout/sleepover invitations:', error);
        return;
      }

      console.log('✅ Hangout/sleepover invitations fetched:', data);
      setHangoutInvitations(data || []);
    } catch (error) {
      console.error('Error fetching hangout/sleepover invitations:', error);
    }
  };

  const handleAcceptHangoutInvitation = async (invitation: any, childId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase.rpc('accept_hangout_sleepover_invitation', {
        p_care_response_id: invitation.care_response_id,
        p_accepting_parent_id: user.id,
        p_invited_child_id: childId
      });

      if (error) {
        console.error('Error accepting invitation:', error);
        showAlertOnce('Failed to accept invitation: ' + error.message);
        return;
      }

      console.log('✅ Hangout/sleepover invitation accepted:', data);
      showAlertOnce(`${invitation.request_type === 'hangout' ? 'Hangout' : 'Sleepover'} invitation accepted successfully!`);

      // Refresh invitations
      await fetchHangoutInvitations();

    } catch (error) {
      console.error('Error accepting invitation:', error);
      showAlertOnce('Failed to accept invitation');
    }
  };

  const handleDeclineHangoutInvitation = async (invitation: any, reason?: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase.rpc('decline_hangout_sleepover_invitation', {
        p_care_response_id: invitation.care_response_id,
        p_declining_parent_id: user.id,
        p_decline_reason: reason || null
      });

      if (error) {
        console.error('Error declining invitation:', error);
        showAlertOnce('Failed to decline invitation: ' + error.message);
        return;
      }

      console.log('✅ Hangout/sleepover invitation declined:', data);
      showAlertOnce('Invitation declined');

      // Refresh invitations
      await fetchHangoutInvitations();

    } catch (error) {
      console.error('Error declining invitation:', error);
      showAlertOnce('Failed to decline invitation');
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

    } catch (error) {
      console.error('Error submitting event RSVP:', error);
      showAlertOnce('Failed to submit RSVP');
    }
  };

  // Calculate and update notification counters
  useEffect(() => {
    if (!user) return;

    // Count messages for Messages/Scheduler button
    let schedulerCount = 0;

    // NOTE: Calendar counter is NOT calculated here - it's only updated when:
    // 1. Accepting a response (handleAcceptResponse adds +2)
    // 2. Viewing calendar page (calendar page clears it after 2 seconds)
    // This prevents race conditions where this useEffect overwrites the counter

    // Load previously read messages from localStorage
    const savedReadMessages = localStorage.getItem('readSchedulerMessages');
    const readMessages = savedReadMessages ? new Set(JSON.parse(savedReadMessages)) : new Set<string>();

    // Messages counter logic - only count unread messages
    console.log('🔍 Counter Calculation Debug:', {
      totalCareResponses: careResponses.length,
      totalCareRequests: careRequests.length,
      totalInvitations: invitations.length,
      totalRescheduleRequests: rescheduleRequests.length,
      totalRescheduleNotifications: rescheduleNotifications.length,
      readMessagesCount: readMessages.size
    });

    // 1. Pending care requests (reciprocal care requests needing response)
    const pendingCareResponses = careResponses.filter(r =>
      r.status === 'pending' && !readMessages.has(`pending-${r.care_response_id}`)
    );
    console.log('📊 Pending care responses (unread):', {
      total: careResponses.filter(r => r.status === 'pending').length,
      unread: pendingCareResponses.length,
      data: pendingCareResponses
    });
    schedulerCount += pendingCareResponses.length;

    // 2. Responses to my requests (submitted status)
    const submittedResponses = careRequests.filter(req => {
      const hasUnreadResponse = careResponses.some(res =>
        res.care_request_id === req.care_request_id &&
        (res.status === 'submitted' || res.status === 'pending') &&
        !readMessages.has(`responses-${req.care_request_id}`)
      );
      return hasUnreadResponse;
    });
    schedulerCount += submittedResponses.length;

    // 3. Pending open block invitations
    invitations.filter(inv => inv.status === 'pending').forEach(inv => {
      const key = `${inv.open_block_parent_id || inv.open_block_parent_name}-${inv.care_response_id}`;
      if (!readMessages.has(`invitation-group-${key}`)) {
        schedulerCount++;
      }
    });

    // 4. Accepted open block invitations (for audit trail)
    invitations.filter(inv => inv.status === 'accepted').forEach((inv, index) => {
      const messageId = `open-block-accepted-${inv.invitation_id || index}`;
      if (!readMessages.has(messageId)) {
        schedulerCount++;
      }
    });

    // 5. Pending reschedule requests
    rescheduleRequests.forEach(req => {
      const requestId = req.reschedule_group_id || req.request_id;
      if (!readMessages.has(`reschedule-${requestId}`)) {
        schedulerCount++;
      }
    });

    // 6. Pending reschedule counter proposals
    const pendingCounters = rescheduleNotifications.filter(n =>
      n.type === 'reschedule_counter_sent' &&
      !rescheduleNotifications.some(rn =>
        (rn.type === 'reschedule_counter_accepted' || rn.type === 'reschedule_counter_declined') &&
        rn.data?.counter_request_id === n.data?.counter_request_id
      )
    );
    pendingCounters.forEach(n => {
      if (!readMessages.has(`reschedule-notification-${n.id}`)) {
        schedulerCount++;
      }
    });

    // 7. Acceptance/decline notifications (informational)
    const acceptDeclineNotifications = rescheduleNotifications.filter(n =>
      n.type === 'reschedule_accepted' ||
      n.type === 'reschedule_declined' ||
      n.type === 'reschedule_counter_accepted' ||
      n.type === 'reschedule_counter_declined'
    );
    acceptDeclineNotifications.forEach(n => {
      if (!readMessages.has(`reschedule-notification-${n.id}`)) {
        schedulerCount++;
      }
    });

    // Update localStorage and dispatch events
    localStorage.setItem('schedulerMessagesCount', schedulerCount.toString());
    window.dispatchEvent(new Event('schedulerCountUpdated'));

    console.log('📊 Counter Update:', { schedulerCount });

  }, [user, loading, careRequests, careResponses, invitations, rescheduleRequests, rescheduleNotifications]);

  // Mark messages as read after user has viewed the scheduler page for 2 seconds
  useEffect(() => {
    if (!user || loading) return;

    // Wait 2 seconds to give user time to see the counter, then mark everything as read
    const timer = setTimeout(() => {
      const savedReadMessages = localStorage.getItem('readSchedulerMessages');
      const readMessages = savedReadMessages ? new Set(JSON.parse(savedReadMessages)) : new Set<string>();

      // Mark all current messages as read
      careResponses.filter(r => r.status === 'pending').forEach(r => {
        readMessages.add(`pending-${r.care_response_id}`);
      });

      // NOTE: Do NOT mark responses to my requests as read here.
      // Those should only be marked as read after the requester accepts/declines them.
      // The responses-${request_id} key is used for tracking responses to requests I MADE,
      // not responses I need to submit.

      // REMOVED: The code that was marking responses-${req.care_request_id} as read
      // because it was causing the counter to never show responses that need acceptance.

      invitations.filter(inv => inv.status === 'pending').forEach(inv => {
        const key = `${inv.open_block_parent_id || inv.open_block_parent_name}-${inv.care_response_id}`;
        readMessages.add(`invitation-group-${key}`);
      });

      invitations.filter(inv => inv.status === 'accepted').forEach((inv, index) => {
        readMessages.add(`open-block-accepted-${inv.invitation_id || index}`);
      });

      rescheduleRequests.forEach(req => {
        const requestId = req.reschedule_group_id || req.request_id;
        readMessages.add(`reschedule-${requestId}`);
      });

      rescheduleNotifications.forEach(n => {
        if (n.type === 'care_declined') {
          readMessages.add(`care-declined-${n.id}`);
        } else {
          readMessages.add(`reschedule-notification-${n.id}`);
        }
      });

      // Save to localStorage
      localStorage.setItem('readSchedulerMessages', JSON.stringify(Array.from(readMessages)));

      // Trigger counter update to refresh the badge
      window.dispatchEvent(new Event('schedulerCountUpdated'));

      console.log('📧 Marked all scheduler messages as read');
    }, 2000); // 2 second delay

    return () => clearTimeout(timer);
  }, [user, loading, careRequests, careResponses, invitations, rescheduleRequests, rescheduleNotifications]);

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

          {/* Pet Care Requests Section */}
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg shadow border-2 border-purple-200 mb-8 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Pet Care Requests</h2>
                  <p className="text-sm text-gray-600">Manage pet care scheduling with other pet owners</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg p-4">
              <p className="text-gray-700 mb-3">
                Pet care scheduling works just like child care! You can:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-600 ml-2">
                <li>Request reciprocal pet care from other pet owners in your groups</li>
                <li>View and respond to pet care requests in your Messages</li>
                <li>Track pet care blocks in the <strong>Pet Care</strong> calendar view</li>
                <li>Multi-day pet sitting support for vacations and trips</li>
              </ul>
              <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-md">
                <p className="text-sm text-purple-800">
                  <strong>💡 Tip:</strong> Switch to "Pet Care" mode in the Calendar to create new pet care requests and view your pet care schedule!
                </p>
              </div>
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
  {/* Care Type Selector */}
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">
      Type *
    </label>
    <div className="grid grid-cols-3 gap-3">
      <button
        type="button"
        onClick={() => setNewRequest(prev => ({ ...prev, care_type: 'reciprocal', hosting_child_ids: [], invited_child_ids: [], end_date: '' }))}
        className={`px-4 py-3 rounded-md border-2 transition-all ${
          newRequest.care_type === 'reciprocal'
            ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        Care Request
      </button>
      <button
        type="button"
        onClick={() => setNewRequest(prev => ({ ...prev, care_type: 'hangout', child_id: '', end_date: '' }))}
        className={`px-4 py-3 rounded-md border-2 transition-all ${
          newRequest.care_type === 'hangout'
            ? 'border-green-500 bg-green-50 text-green-700 font-semibold'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        Hangout
      </button>
      <button
        type="button"
        onClick={() => setNewRequest(prev => ({ ...prev, care_type: 'sleepover', child_id: '' }))}
        className={`px-4 py-3 rounded-md border-2 transition-all ${
          newRequest.care_type === 'sleepover'
            ? 'border-purple-500 bg-purple-50 text-purple-700 font-semibold'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        Sleepover
      </button>
    </div>
  </div>

  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {/* Date */}
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {newRequest.care_type === 'sleepover' ? 'Start Date *' : 'Date *'}
      </label>
      <input
        type="date"
        required
        value={newRequest.care_date}
        onChange={(e) => setNewRequest(prev => ({ ...prev, care_date: e.target.value }))}
        min={new Date().toISOString().split('T')[0]}
        max={`${new Date().getFullYear() + 5}-12-31`}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>

    {/* End Date (Sleepover only) */}
    {newRequest.care_type === 'sleepover' && (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          End Date *
        </label>
        <input
          type="date"
          required
          value={newRequest.end_date}
          onChange={(e) => setNewRequest(prev => ({ ...prev, end_date: e.target.value }))}
          min={newRequest.care_date || new Date().toISOString().split('T')[0]}
          max={`${new Date().getFullYear() + 5}-12-31`}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    )}

    {/* Start Time */}
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

    {/* End Time */}
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

    {/* Group */}
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Group *
      </label>
      <select
        required
        value={newRequest.group_id}
        onChange={(e) => {
          const groupId = e.target.value;
          setNewRequest(prev => ({
            ...prev,
            group_id: groupId,
            child_id: '',
            hosting_child_ids: [],
            invited_child_ids: []
          }));
          if (groupId) {
            fetchChildrenForGroup(groupId);
            if (newRequest.care_type !== 'reciprocal') {
              fetchAllGroupChildren(groupId);
            }
          }
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

    {/* Child (Reciprocal only) */}
    {newRequest.care_type === 'reciprocal' && (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Child *
        </label>
        <select
          required
          value={newRequest.child_id}
          onChange={(e) => setNewRequest(prev => ({ ...prev, child_id: e.target.value }))}
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
    )}
  </div>

  {/* Hosting Children (Hangout/Sleepover only) */}
  {(newRequest.care_type === 'hangout' || newRequest.care_type === 'sleepover') && (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Hosting Children * (Select your children who will host)
      </label>
      <div className="border border-gray-300 rounded-md p-3 max-h-40 overflow-y-auto">
        {!newRequest.group_id ? (
          <p className="text-sm text-gray-500">Select a group first</p>
        ) : children.length === 0 ? (
          <p className="text-sm text-gray-500">No children available</p>
        ) : (
          <div className="space-y-2">
            {children.map(child => (
              <label key={child.id} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newRequest.hosting_child_ids.includes(child.id)}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setNewRequest(prev => ({
                      ...prev,
                      hosting_child_ids: checked
                        ? [...prev.hosting_child_ids, child.id]
                        : prev.hosting_child_ids.filter(id => id !== child.id)
                    }));
                  }}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm">{child.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  )}

  {/* Invited Children (Hangout/Sleepover only) */}
  {(newRequest.care_type === 'hangout' || newRequest.care_type === 'sleepover') && (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Invited Children * (Select children from the group to invite)
      </label>
      <div className="border border-gray-300 rounded-md p-3 max-h-40 overflow-y-auto">
        {!newRequest.group_id ? (
          <p className="text-sm text-gray-500">Select a group first</p>
        ) : groupChildren.length === 0 ? (
          <p className="text-sm text-gray-500">No children available in this group</p>
        ) : (
          <div className="space-y-2">
            {groupChildren
              .filter(child => !children.some(myChild => myChild.id === child.id))
              .map(child => (
                <label key={child.id} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newRequest.invited_child_ids.includes(child.id)}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setNewRequest(prev => ({
                        ...prev,
                        invited_child_ids: checked
                          ? [...prev.invited_child_ids, child.id]
                          : prev.invited_child_ids.filter(id => id !== child.id)
                      }));
                    }}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm">{child.name}</span>
                </label>
              ))}
          </div>
        )}
      </div>
    </div>
  )}

  {/* Notes */}
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      Notes (Optional)
    </label>
    <textarea
      value={newRequest.notes}
      onChange={(e) => setNewRequest(prev => ({ ...prev, notes: e.target.value }))}
      rows={3}
      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      placeholder={
        newRequest.care_type === 'reciprocal'
          ? "Any additional details about the care needed..."
          : `Any additional details about the ${newRequest.care_type}...`
      }
    />
  </div>

  {/* Buttons */}
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
      Create {newRequest.care_type === 'reciprocal' ? 'Request' : newRequest.care_type.charAt(0).toUpperCase() + newRequest.care_type.slice(1)}
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
                      Submit Reciprocal {selectedRequest.care_type === 'pet' ? 'Pet' : 'Child'} Care Response
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
                      <strong>Request:</strong> {selectedRequest.requester_name} needs {selectedRequest.care_type === 'pet' ? 'pet' : 'child'} care on{' '}
                      {formatDateOnly(selectedRequest.requested_date)} from{' '}
                      {formatTime(selectedRequest.start_time)} to {formatTime(getActualEndTime(selectedRequest.notes || '', selectedRequest.end_time))}
                      {selectedRequest.end_date && ` until ${formatDateOnly(selectedRequest.end_date)}`}
                      {selectedRequest.care_type === 'pet' && selectedRequest.pet_name && ` for ${selectedRequest.pet_name}`}
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
                          min={new Date().toISOString().split('T')[0]}
                          max={`${new Date().getFullYear() + 5}-12-31`}
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
                      {selectedRequest.care_type === 'pet' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Reciprocal End Date (for multi-day care)
                          </label>
                          <input
                            type="date"
                            value={reciprocalResponse.reciprocal_end_date}
                            onChange={(e) => setReciprocalResponse(prev => ({ ...prev, reciprocal_end_date: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {selectedRequest.care_type === 'pet' ? 'Pet' : 'Child'} for Reciprocal Care
                        </label>
                        {selectedRequest.care_type === 'pet' ? (
                          <select
                            required
                            value={reciprocalResponse.reciprocal_pet_id}
                            onChange={(e) => setReciprocalResponse(prev => ({ ...prev, reciprocal_pet_id: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                          >
                            <option value="">Select a pet</option>
                            {pets.map(pet => (
                              <option key={pet.id} value={pet.id}>
                                {pet.name} {pet.species ? `(${pet.species})` : ''}
                              </option>
                            ))}
                          </select>
                        ) : (
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
                        )}
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
                        className={`px-4 py-2 ${selectedRequest.care_type === 'pet' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-md transition-colors`}
                      >
                        Submit Response
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* Reschedule Response Modal */}
          {showRescheduleResponseModal && selectedRescheduleRequest && (
            <RescheduleResponseModal
              isOpen={showRescheduleResponseModal}
              onClose={() => {
                setShowRescheduleResponseModal(false);
                setSelectedRescheduleRequest(null);
              }}
              rescheduleRequestId={selectedRescheduleRequest.requestId}
              careResponseId={selectedRescheduleRequest.responseId}
              onResponseSuccess={async () => {
                setShowRescheduleResponseModal(false);
                setSelectedRescheduleRequest(null);
                await fetchData();
              }}
            />
          )}

        </div>


      </div>
    </div>
  );
}




