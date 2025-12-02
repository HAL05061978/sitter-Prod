'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '../components/Header';
import { supabase } from '../lib/supabase';
import { formatDateOnly, formatTime, formatTimestampDate } from '../lib/date-utils';
import type { User } from '@supabase/supabase-js';
import RescheduleResponseModal from '../../components/care/RescheduleResponseModal';
import { CounterDebugger } from '../../lib/counter-debugger';
import { useTranslation } from 'react-i18next';
import { getNotificationTitle, getNotificationMessage } from '../../lib/notification-translator';

interface CareRequest {
  care_request_id: string;
  group_id: string;
  group_name: string;
  requester_id: string;           // Changed from requesting_parent_id
  requester_name: string;         // Changed from requesting_parent_name
  requested_date: string;         // Changed from care_date
  requested_end_date?: string;    // For multi-day care (from SQL function)
  start_time: string;
  end_time: string;
  notes: string;
  status: string;
  created_at: string;
  response_count: number;
  accepted_response_count: number;
  pet_name?: string;              // For pet care requests
  end_date?: string;              // For multi-day care (alternate field name)
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
  const { t, i18n } = useTranslation();
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptingInvitation, setAcceptingInvitation] = useState<any>(null);
  const [availableChildren, setAvailableChildren] = useState<Array<{ id: string; full_name: string }>>([]);
  const [processing, setProcessing] = useState(false);
  const [expandedInvitations, setExpandedInvitations] = useState<Set<string>>(new Set());

  // Helper to format date with current language
  const formatDateLocalized = (dateString: string | Date) => {
    return formatDateOnly(dateString, i18n.language);
  };

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
          <p className="text-gray-600">{t('loadingOpenBlockInvitations')}</p>
        </div>
      </div>
    );
  }

  if (acceptingInvitation) {
    return (
      <div className="border rounded-lg p-4 bg-blue-50">
        <h4 className="font-medium text-blue-900 mb-3">{t('acceptOpenBlockInvitation')}</h4>
        <p className="text-sm text-blue-700 mb-4">
          You're accepting an invitation to join {acceptingInvitation.open_block_parent_name}'s care block
        </p>
        
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">{t('selectChildToJoin')}</label>
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
              {t('cancel')}
            </button>
            <button
              onClick={() => setAcceptingInvitation(null)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              disabled={processing}
            >
              {processing ? t('processing') : t('acceptInvitation')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (invitations.length === 0) {
    return (
      <div className="text-center py-6 bg-gray-50 rounded-lg">
        <p className="text-gray-500">{t('noPendingInvitations')}</p>
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
                      ? `${formatDateLocalized(invitation.reciprocal_date)} from ${invitation.reciprocal_start_time} to ${invitation.reciprocal_end_time}`
                      : 'Details will be available after acceptance'
                  }
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Group: {invitation.group_name} • {formatDateLocalized(invitation.created_at)}
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
                      {t('acceptInvitation')}
                    </button>
                    <button
                      onClick={() => handleDecline(invitation)}
                      disabled={processing}
                      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400 transition-colors"
                    >
                      {t('declineInvitation')}
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
  const { t, i18n } = useTranslation();
  const router = useRouter();

  // Helper to format date with current language
  const formatDateLocalized = (dateString: string | Date) => {
    return formatDateOnly(dateString, i18n.language);
  };
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
  const [dateOverlapWarning, setDateOverlapWarning] = useState('');

  // Check for date overlap (live validation)
  useEffect(() => {
    if (!selectedRequest || selectedRequest.care_type !== 'pet') {
      setDateOverlapWarning('');
      return;
    }

    if (!reciprocalResponse.reciprocal_date) {
      setDateOverlapWarning('');
      return;
    }

    const reqStart = new Date(selectedRequest.requested_date);
    // Try both field names since SQL function uses requested_end_date but interface has end_date
    const reqEnd = new Date(selectedRequest.requested_end_date || selectedRequest.end_date || selectedRequest.requested_date);
    const recStart = new Date(reciprocalResponse.reciprocal_date);
    const recEnd = new Date(reciprocalResponse.reciprocal_end_date || reciprocalResponse.reciprocal_date);

    // Check if date ranges overlap
    if (recStart <= reqEnd && recEnd >= reqStart) {
      const warning = '⚠️ Warning: Reciprocal dates overlap with the original request. You cannot watch their pet while they are watching yours. Please choose different dates.';
      setDateOverlapWarning(warning);
    } else {
      setDateOverlapWarning('');
    }
  }, [reciprocalResponse.reciprocal_date, reciprocalResponse.reciprocal_end_date, selectedRequest]);

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
        type: 'open_block_invitation' | 'care_request' | 'care_response' | 'care_accepted' | 'care_declined' | 'open_block_accepted' | 'group_invitation' | 'event_invitation' | 'reschedule_request' | 'reschedule_accepted' | 'reschedule_declined' | 'reschedule_counter_sent' | 'reschedule_counter_accepted' | 'reschedule_counter_declined' | 'hangout_accepted';
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
          return;
        }

        // Skip if this request has a PENDING counter-proposal (show counter instead)
        // Check both the map key (requestId) and the actual request.request_id
        if (originalRequestIdsWithPendingCounters.has(requestId) || originalRequestIdsWithPendingCounters.has(request.request_id)) {
          return;
        }

        messages.push({
          id: `reschedule-${requestId}`,
          type: 'reschedule_request',
          title: request.original_date
            ? t('wantsToReschedule', { name: request.requester_name, date: formatDateLocalized(request.original_date) })
            : t('wantsToRescheduleA', { name: request.requester_name }),
          subtitle: t('fromDateToDate', {
            fromDate: request.original_date ? formatDateLocalized(request.original_date) : t('unknown'),
            fromTime: `${request.original_start_time || t('unknown')}-${request.original_end_time || t('unknown')}`,
            toDate: formatDateLocalized(request.new_date),
            toTime: `${request.new_start_time}-${request.new_end_time}`
          }),
          timestamp: request.created_at,
          data: request,
          actions: (
            <div className="flex space-x-2">
              <button
                onClick={() => handleRescheduleResponse(request.care_response_id, 'accepted', undefined, request.request_id)}
                disabled={processingReschedule}
                className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
              >
                {t('accept')}
              </button>
              <button
                onClick={() => handleRescheduleResponse(request.care_response_id, 'declined', undefined, request.request_id)}
                disabled={processingReschedule}
                className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50"
              >
                {t('decline')}
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
                {t('accept')}
              </button>
              <button
                onClick={() => handleRescheduleResponse(notification.data.care_response_id, 'declined', undefined, notification.data.counter_request_id)}
                disabled={processingReschedule}
                className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50"
              >
                {t('decline')}
              </button>
            </div>
          );
        }

        messages.push({
          id: notification.type === 'care_declined' ? `care-declined-${notification.id}` : notification.type === 'hangout_accepted' ? `hangout-accepted-${notification.id}` : `reschedule-notification-${notification.id}`,
          type: notification.type as 'reschedule_accepted' | 'reschedule_declined' | 'reschedule_counter_sent' | 'reschedule_counter_accepted' | 'reschedule_counter_declined' | 'care_declined' | 'hangout_accepted',
          title: getNotificationTitle(notification, t),
          subtitle: getNotificationMessage(notification, t),
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
          
          let title = '';
          if (openingDate && openingStartTime && openingEndTime) {
            const startTime = openingStartTime.substring(0, 5); // Remove seconds
            const endTime = openingEndTime.substring(0, 5); // Remove seconds
            title = t('isOpeningBlock', {
              name: group.parentName,
              date: formatDateLocalized(openingDate),
              startTime: startTime,
              endTime: endTime,
              group: groupName
            });
          } else {
            title = t('isOpeningBlockGeneric', { name: group.parentName, group: groupName });
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

      acceptedInvitations.forEach((invitation, index) => {
          const openingDate = invitation.existing_block_date;
          const openingStartTime = invitation.existing_block_start_time?.substring(0, 5);
          const openingEndTime = invitation.existing_block_end_time?.substring(0, 5);
          const groupName = invitation.group_name;

          // Show different message based on perspective
          if (invitation.is_provider_view) {
            // Current user is the provider (person who created the open block)
            const acceptorName = invitation.acceptor_name;
            const groupName = invitation.group_name;
            const msg = {
              id: `open-block-provider-${invitation.invitation_id || invitation.id || index}`,
              type: 'open_block_provider_notified',
              title: t('acceptedYourOpenBlock', {
                name: acceptorName,
                group: groupName,
                date: formatDateLocalized(invitation.existing_block_date)
              }),
              subtitle: '',
              timestamp: invitation.created_at,
              data: invitation
            };
            messages.push(msg);
          } else {
            // Current user is the acceptor (person who accepted the open block)
            const providerName = invitation.open_block_parent_name;
            const groupName = invitation.group_name;
            const msg = {
              id: `open-block-accepted-${invitation.invitation_id || index}`,
              type: 'open_block_accepted',
              title: t('youAcceptedOpenBlock', {
                name: providerName,
                group: groupName,
                date: formatDateLocalized(invitation.existing_block_date)
              }),
              subtitle: '',
              timestamp: invitation.created_at,
              data: invitation
            };
            messages.push(msg);
          }
        });

      // Add care requests I need to respond to
      careResponses
        .filter(response => response.status === 'pending' && response.responder_id === user.id)
        .forEach((response, index) => {
          // Get actual end time - use cached value if available, otherwise use notes or fallback
          const cachedActualEndTime = actualEndTimes.get(response.care_request_id);
          const actualEndTime = cachedActualEndTime || getActualEndTime(response.notes || '', response.end_time);

          // Build care request title with translations
          const endDateStr = response.end_date || (response as any).requested_end_date;
          const hasMultiDay = endDateStr && endDateStr !== response.requested_date;
          let careTitle = response.care_type === 'pet'
            ? t('petCareRequestFrom', {
                date: formatDateLocalized(response.requested_date),
                startTime: formatTime(response.start_time),
                endTime: formatTime(actualEndTime),
                name: response.requester_name,
                petName: response.pet_name || ''
              })
            : t('childCareRequestFrom', {
                date: formatDateLocalized(response.requested_date),
                startTime: formatTime(response.start_time),
                endTime: formatTime(actualEndTime),
                name: response.requester_name
              });
          if (hasMultiDay) {
            careTitle += t('careRequestUntil', { date: formatDateLocalized(endDateStr) });
          }

          messages.push({
          id: `pending-${response.care_response_id || index}`,
          type: 'care_request',
          title: careTitle,
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
              {t('respondToRequest')}
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
            title: t('careRequestResponded', { name: response.requester_name }),
            subtitle: '', // Remove redundant subtitle for accepted requests
            timestamp: response.created_at,
            data: response,
            actions: undefined
          });
        });

      // Group responses to my requests by request (instead of showing separate messages for each response)
      const requestResponseMap = new Map();

      careRequests.forEach(request => {
        // IMPORTANT: Only show this section if the current user is the REQUESTER
        // Skip if current user is not the requester (they're just a responder)
        if (!user || request.requester_id !== user.id) {
          return; // Skip this request - current user is not the requester
        }

        // Show only SUBMITTED responses (not pending invitations that haven't been filled out yet)
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
        const acceptedResponse = responses.find((resp: any) => resp.status === 'accepted');

        if (acceptedResponse) {
          // Show accepted message for the requester
          const responderName = acceptedResponse.responder_name || t('unknown');
          const groupName = acceptedResponse.group_name || t('group');
          messages.push({
            id: `request-accepted-${request.care_request_id}`,
            type: 'care_request',
            title: t('youAcceptedReciprocal', {
              name: responderName,
              group: groupName,
              date: formatDateLocalized(request.requested_date)
            }),
            subtitle: '',
            timestamp: acceptedResponse.created_at,
            data: acceptedResponse,
            actions: undefined
          });
        } else {
          // Only show the original request message if NO responses have been accepted
          const careType = request.care_type === 'pet' ? t('petCare') : t('childCare');
          messages.push({
            id: `responses-${request.care_request_id}`,
            type: 'care_response',
            title: responseCount === 1
              ? t('yourCareRequestReceived', {
                  type: careType,
                  date: formatDateLocalized(request.requested_date),
                  startTime: formatTime(request.start_time),
                  endTime: formatTime(getActualEndTime(request.notes || '', request.end_time)),
                  count: responseCount
                })
              : t('yourCareRequestReceivedPlural', {
                  type: careType,
                  date: formatDateLocalized(request.requested_date),
                  startTime: formatTime(request.start_time),
                  endTime: formatTime(getActualEndTime(request.notes || '', request.end_time)),
                  count: responseCount
                }),
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
          const requesterName = response.requester_name || t('unknown');
          messages.push({
            id: `status-${response.care_response_id || index}`,
            type: 'care_accepted',
            title: t('acceptedYourReciprocal', {
              name: requesterName,
              date: formatDateLocalized(response.requested_date)
            }),
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
          title: t('invitedToJoinGroup', {
            name: invitation.inviter_name,
            group: invitation.group_name
          }),
          subtitle: '', // Remove redundant subtitle
          timestamp: invitation.invited_at,
          data: invitation,
          actions: (
            <div className="flex space-x-2">
              <button
                onClick={() => handleAcceptGroupInvitation(invitation.group_id)}
                className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
              >
                {t('accept')}
              </button>
              <button
                onClick={() => handleDeclineGroupInvitation(invitation.group_id)}
                className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
              >
                {t('decline')}
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
          title: t('invitedToEvent', {
            name: invitation.inviter_name,
            event: invitation.event_title
          }),
          subtitle: `${formatDateLocalized(invitation.care_date)} ${t('from')} ${formatTime(invitation.start_time)} ${t('to')} ${formatTime(getActualEndTime(invitation.notes || '', invitation.end_time))} • ${invitation.child_name}`,
          timestamp: invitation.created_at,
          data: invitation,
          actions: undefined // Actions will be shown in expanded view
        });
      });

      // Add hangout/sleepover invitations
      hangoutInvitations.forEach((invitation, index) => {
        const hangoutType = invitation.request_type === 'hangout' ? t('hangout') : t('sleepover');
        messages.push({
          id: `hangout-${invitation.care_response_id}`,
          type: invitation.request_type, // 'hangout' or 'sleepover'
          title: t('invitedToHangout', {
            name: invitation.host_parent_name,
            child: invitation.invited_child_name,
            type: hangoutType
          }),
          subtitle: `${formatDateLocalized(invitation.requested_date)} ${t('from')} ${formatTime(invitation.start_time)} ${t('to')} ${formatTime(invitation.end_time)}${invitation.end_date ? ' ' + t('until') + ' ' + formatDateLocalized(invitation.end_date) : ''} • ${invitation.group_name}`,
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
          <h3 className="text-lg font-medium text-gray-900 mb-2">{t('noMessages')}</h3>
          <p className="text-gray-600">
            {t('allCaughtUp')}
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
              className={`p-4 bg-gray-50 transition-colors ${message.type !== 'care_declined' && message.type !== 'reschedule_request' && message.type !== 'hangout_accepted' ? 'hover:bg-gray-100 cursor-pointer' : ''}`}
              onClick={() => {
                // Don't allow expansion for care_declined, reschedule_request, or hangout_accepted messages (informational only)
                if (message.type === 'care_declined' || message.type === 'reschedule_request' || message.type === 'hangout_accepted') return;

                // Always toggle (expand/collapse)
                toggleExpanded(message.id);
              }}
            >
              {/* Stacked layout: Message content on top, buttons/badges below */}
              <div className="flex flex-col space-y-3">
                {/* Top section: Message content with badge and expand arrow */}
                <div className="flex items-start justify-between">
                  <div className="flex-1 pr-2">
                    <div className="flex items-center flex-wrap gap-2 mb-1">
                      <h4 className="font-medium text-gray-900">{message.title}</h4>
                      {/* Badge inline with title */}
                      {message.type !== 'reschedule_request' && message.type !== 'reschedule_counter_sent' && (
                        <span className={`px-2 py-1 text-xs rounded-full whitespace-nowrap ${
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
                          message.type === 'hangout_accepted' ? 'bg-green-100 text-green-800' :
                          message.type === 'group_invitation' ? 'bg-purple-100 text-purple-800' :
                          message.type === 'event_invitation' ? 'bg-orange-100 text-orange-800' :
                          message.type === 'hangout' ? 'bg-pink-100 text-pink-800' :
                          message.type === 'sleepover' ? 'bg-indigo-100 text-indigo-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {message.type === 'open_block_invitation' ? t('invitation') :
                           message.type === 'open_block_accepted' ? t('accepted') :
                           message.type === 'open_block_provider_notified' ? t('blockAccepted') :
                           message.type === 'care_request' && message.data.status === 'accepted' ? t('accepted') :
                           message.type === 'care_request' ? t('request') :
                           message.type === 'care_response' ? t('response') :
                           message.type === 'care_accepted' ? t('accepted') :
                           message.type === 'care_declined' ? t('notAccepted') :
                           message.type === 'reschedule_accepted' ? t('accepted') :
                           message.type === 'reschedule_declined' ? t('declined') :
                           message.type === 'reschedule_counter_sent' ? t('counterSent') :
                           message.type === 'reschedule_counter_accepted' ? t('accepted') :
                           message.type === 'reschedule_counter_declined' ? t('declined') :
                           message.type === 'hangout_accepted' ? t('accepted') :
                           message.type === 'group_invitation' ? t('groupInvite') :
                           message.type === 'event_invitation' ? t('eventInvite') :
                           message.type === 'hangout' ? t('hangoutInvite') :
                           message.type === 'sleepover' ? t('sleeoverInvite') :
                           t('update')}
                        </span>
                      )}
                    </div>
                    {message.subtitle && message.type !== 'hangout_accepted' && (
                      <p className="text-sm text-gray-600 mt-1">{message.subtitle}</p>
                    )}
                    <p className="text-sm text-gray-500 mt-1">
                      {formatDateLocalized(message.timestamp)}
                    </p>
                  </div>
                  {/* Expand arrow on the right */}
                  {message.type !== 'group_invitation' && message.type !== 'care_declined' && message.type !== 'reschedule_request' && message.type !== 'reschedule_counter_sent' && message.type !== 'hangout_accepted' && (
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ${
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

                {/* Bottom section: Action buttons (full width, below message) */}
                {/* Group invitation buttons */}
                {message.type === 'group_invitation' && message.data.status === 'pending' && (
                  <div className="flex gap-2 pt-2 border-t border-gray-200">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleAcceptGroupInvitation(message.data.group_id); }}
                      className="flex-1 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700"
                    >
                      {t('accept')}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeclineGroupInvitation(message.data.group_id); }}
                      className="flex-1 px-3 py-2 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700"
                    >
                      {t('decline')}
                    </button>
                  </div>
                )}

                {/* Group invitation accepted badge */}
                {message.type === 'group_invitation' && message.data.status === 'accepted' && (
                  <div className="pt-2 border-t border-gray-200">
                    <span className="inline-block px-3 py-1 bg-green-100 text-green-800 text-sm rounded">
                      {t('accepted')}
                    </span>
                  </div>
                )}

                {/* Group invitation rejected badge */}
                {message.type === 'group_invitation' && message.data.status === 'rejected' && (
                  <div className="pt-2 border-t border-gray-200">
                    <span className="inline-block px-3 py-1 bg-red-100 text-red-800 text-sm rounded">
                      {t('rejected')}
                    </span>
                  </div>
                )}

                {/* Reschedule request buttons */}
                {message.type === 'reschedule_request' && message.actions && (
                  <div className="pt-2 border-t border-gray-200" onClick={(e) => e.stopPropagation()}>
                    {message.actions}
                  </div>
                )}

                {/* Counter-proposal buttons */}
                {message.type === 'reschedule_counter_sent' && message.actions && (
                  <div className="pt-2 border-t border-gray-200" onClick={(e) => e.stopPropagation()}>
                    {message.actions}
                  </div>
                )}
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
                        {/* Stacked layout: content on top, buttons below */}
                        <div className="flex flex-col space-y-3">
                          <div>
                            <p className="font-medium text-gray-900 text-sm">
                              {invitation.reciprocal_date && invitation.reciprocal_start_time && invitation.reciprocal_end_time
                                ? `${t('reciprocalCare')} ${formatDateLocalized(invitation.reciprocal_date)} ${t('from')} ${formatTime(invitation.reciprocal_start_time)} ${t('to')} ${formatTime(invitation.reciprocal_end_time)}`
                                : t('reciprocalCareDetails')}
                            </p>
                            {invitation.notes && (
                              <p className="text-sm text-gray-500 mt-1">
                                <strong>{t('notes')}:</strong> {invitation.notes}
                              </p>
                            )}
                            <p className="text-sm text-gray-500 mt-1">
                              <strong>{t('group')}:</strong> {invitation.group_name || 'N/A'}
                            </p>
                          </div>
                          {invitation.status === 'pending' && (
                            <div className="flex gap-2 pt-2 border-t border-gray-200">
                              <button
                                onClick={() => handleAccept(invitation)}
                                disabled={processing}
                                className="flex-1 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 disabled:bg-gray-400"
                              >
                                {t('accept')}
                              </button>
                              <button
                                onClick={() => handleDecline(invitation)}
                                disabled={processing}
                                className="flex-1 px-3 py-2 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 disabled:bg-gray-400"
                              >
                                {t('decline')}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Show accepted open block details - ACCEPTOR VIEW */}
                {message.type === 'open_block_accepted' && (
                  <div className="space-y-3 mb-4">
                    {/* Block 1: You will receive care */}
                    <div className="bg-blue-50 rounded-lg p-3 border-l-4 border-blue-500">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">
                          {t('youWillReceiveCare')}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {formatDateLocalized(message.data.existing_block_date)} {t('from')}{' '}
                          {formatTime(message.data.existing_block_start_time)} {t('to')} {formatTime(message.data.existing_block_end_time)}
                        </p>
                        <button
                          onClick={() => navigateToCareBlock(message.data.existing_block_date, 'needed')}
                          className="inline-block mt-3 px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                        >
                          {t('viewInCalendar')}
                        </button>
                      </div>
                    </div>

                    {/* Block 2: You will provide care (Reciprocal) */}
                    <div className="bg-green-50 rounded-lg p-3 border-l-4 border-green-500">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">
                          {t('youWillProvideCare')}
                        </p>
                        {message.data.reciprocal_date && message.data.reciprocal_start_time && message.data.reciprocal_end_time ? (
                          <>
                            <p className="text-sm text-gray-600 mt-1">
                              {formatDateLocalized(message.data.reciprocal_date)} {t('from')}{' '}
                              {formatTime(message.data.reciprocal_start_time)} {t('to')} {formatTime(message.data.reciprocal_end_time)}
                            </p>
                            <button
                              onClick={() => navigateToCareBlock(message.data.reciprocal_date, 'provided')}
                              className="inline-block mt-3 px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                            >
                              {t('viewInCalendar')}
                            </button>
                          </>
                        ) : (
                          <p className="text-sm text-gray-500 mt-1 italic">
                            {t('checkCalendarForReciprocal')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Show accepted open block details - PROVIDER VIEW */}
                {message.type === 'open_block_provider_notified' && (
                  <div className="space-y-3 mb-4">
                    {/* Block 1: You will provide care */}
                    <div className="bg-green-50 rounded-lg p-3 border-l-4 border-green-500">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">
                          {t('youWillProvideCare')}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {formatDateLocalized(message.data.existing_block_date)} {t('from')}{' '}
                          {formatTime(message.data.existing_block_start_time)} {t('to')} {formatTime(message.data.existing_block_end_time)}
                        </p>
                        <button
                          onClick={() => navigateToCareBlock(message.data.existing_block_date, 'provided')}
                          className="inline-block mt-3 px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                        >
                          {t('viewInCalendar')}
                        </button>
                      </div>
                    </div>

                    {/* Block 2: You will receive care (Reciprocal) */}
                    <div className="bg-blue-50 rounded-lg p-3 border-l-4 border-blue-500">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">
                          {t('youWillReceiveCare')}
                        </p>
                        {message.data.reciprocal_date && message.data.reciprocal_start_time && message.data.reciprocal_end_time ? (
                          <>
                            <p className="text-sm text-gray-600 mt-1">
                              {formatDateLocalized(message.data.reciprocal_date)} {t('from')}{' '}
                              {formatTime(message.data.reciprocal_start_time)} {t('to')} {formatTime(message.data.reciprocal_end_time)}
                            </p>
                            <button
                              onClick={() => navigateToCareBlock(message.data.reciprocal_date, 'needed')}
                              className="inline-block mt-3 px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                            >
                              {t('viewInCalendar')}
                            </button>
                          </>
                        ) : (
                          <p className="text-sm text-gray-500 mt-1 italic">
                            {t('checkCalendarForReciprocal')}
                          </p>
                        )}
                      </div>
                    </div>

                  </div>
                )}

                {/* Show grouped responses if this is a response message */}
                {message.type === 'care_response' && message.data.responses && (
                  <div className="space-y-3 mb-4">
                    <h5 className="font-medium text-gray-900 text-sm">{t('allResponses')}</h5>
                    {message.data.responses.map((response: any, index: number) => (
                      <div key={response.care_response_id || index} className={`bg-gray-50 rounded-lg p-3 border-l-4 ${response.care_type === 'pet' ? 'border-purple-500' : 'border-blue-500'}`}>
                        {/* Stacked layout: content on top, button below */}
                        <div className="flex flex-col space-y-3">
                          <div>
                            <p className="font-medium text-gray-900 text-sm">
                              Response from: {response.responder_name || 'Unknown User'}
                            </p>
                            <p className="text-sm text-gray-600 mt-1">
                              Reciprocal care: {formatDateLocalized(response.reciprocal_date)} from{' '}
                              {formatTime(response.reciprocal_start_time)} to {formatTime(response.reciprocal_end_time)}
                            </p>
                            {response.response_notes && (
                              <p className="text-sm text-gray-500 mt-1">
                                Notes: {response.response_notes}
                              </p>
                            )}
                          </div>
                          {response.status === 'accepted' ? (
                            <div className="pt-2 border-t border-gray-200">
                              <span className="inline-block px-3 py-1 bg-green-100 text-green-800 text-sm rounded">
                                Accepted
                              </span>
                            </div>
                          ) : (
                            <div className="pt-2 border-t border-gray-200">
                              <button
                                onClick={() => handleAcceptResponse(response.care_response_id)}
                                className={`w-full px-3 py-2 text-white text-sm font-medium rounded ${response.care_type === 'pet' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-green-600 hover:bg-green-700'}`}
                              >
                                Accept Response
                              </button>
                            </div>
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
                          {t('youWillReceiveCare')}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {formatDateLocalized(message.data.requested_date)} {t('from')}{' '}
                          {formatTime(message.data.start_time)} {t('to')} {formatTime(getActualEndTime(message.data.notes || '', message.data.end_time))}
                        </p>
                        <button
                          onClick={() => navigateToCareBlock(message.data.requested_date, 'needed')}
                          className="inline-block mt-3 px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                        >
                          {t('viewInCalendar')}
                        </button>
                      </div>
                    </div>

                    {/* Block 2: You will provide care */}
                    <div className="bg-green-50 rounded-lg p-3 border-l-4 border-green-500">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">
                          {t('youWillProvideCare')}
                        </p>
                        {message.data.reciprocal_date && message.data.reciprocal_start_time && message.data.reciprocal_end_time ? (
                          <>
                            <p className="text-sm text-gray-600 mt-1">
                              {formatDateLocalized(message.data.reciprocal_date)} {t('from')}{' '}
                              {formatTime(message.data.reciprocal_start_time)} {t('to')} {formatTime(message.data.reciprocal_end_time)}
                            </p>
                            <button
                              onClick={() => navigateToCareBlock(message.data.reciprocal_date, 'provided')}
                              className="inline-block mt-3 px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                            >
                              {t('viewInCalendar')}
                            </button>
                          </>
                        ) : (
                          <p className="text-sm text-gray-500 mt-1 italic">
                            {t('checkCalendarForReciprocal')}
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
                          {t('youWillProvideCare')}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {formatDateLocalized(message.data.requested_date)} {t('from')}{' '}
                          {formatTime(message.data.start_time)} {t('to')} {formatTime(getActualEndTime(message.data.notes || '', message.data.end_time))}
                        </p>
                        <button
                          onClick={() => navigateToCareBlock(message.data.requested_date, 'provided')}
                          className="inline-block mt-3 px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                        >
                          {t('viewInCalendar')}
                        </button>
                      </div>
                    </div>

                    {/* Block 2: You will receive care */}
                    <div className="bg-blue-50 rounded-lg p-3 border-l-4 border-blue-500">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">
                          {t('youWillReceiveCare')}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {formatDateLocalized(message.data.reciprocal_date)} {t('from')}{' '}
                          {formatTime(message.data.reciprocal_start_time)} {t('to')} {formatTime(message.data.reciprocal_end_time)}
                        </p>
                        <button
                          onClick={() => navigateToCareBlock(message.data.reciprocal_date, 'needed')}
                          className="inline-block mt-3 px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                        >
                          {t('viewInCalendar')}
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
                          {t('newCareBlockReceiving')}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {formatDateLocalized(message.data.new_date)} {t('from')}{' '}
                          {formatTime(message.data.new_start_time)} {t('to')} {formatTime(message.data.new_end_time)}
                        </p>
                        <button
                          onClick={() => navigateToCareBlock(message.data.new_date, 'needed')}
                          className="inline-block mt-3 px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                        >
                          {t('viewInCalendar')}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Show declined reschedule details */}
                {message.type === 'reschedule_declined' && (
                  <div className="space-y-3 mb-4">
                    <h5 className="font-medium text-gray-900 text-sm">{t('cancelledCareBlocksLabel')}</h5>

                    {/* Block 1: The reschedule request that was declined */}
                    <div className="bg-red-50 rounded-lg p-3 border-l-4 border-red-500">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">
                          {t('declinedReschedule')}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {formatDateLocalized(message.data.declined_reschedule_date)} {t('from')}{' '}
                          {formatTime(message.data.declined_reschedule_start_time)} {t('to')} {formatTime(message.data.declined_reschedule_end_time)}
                        </p>
                      </div>
                    </div>

                    {/* Block 2: The existing arrangement that was selected to be removed */}
                    {message.data.selected_cancellation_date && (
                      <div className="bg-red-50 rounded-lg p-3 border-l-4 border-red-500">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 text-sm">
                            {t('selectedArrangementRemoved')}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            {formatDateLocalized(message.data.selected_cancellation_date)} {t('from')}{' '}
                            {formatTime(message.data.selected_cancellation_start_time)} {t('to')} {formatTime(message.data.selected_cancellation_end_time)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Show counter-proposal sent details */}
                {message.type === 'reschedule_counter_sent' && (
                  <div className="space-y-3 mb-4">
                    <h5 className="font-medium text-gray-900 text-sm">{t('counterProposalDetails')}</h5>

                    <div className="bg-yellow-50 rounded-lg p-3 border-l-4 border-yellow-500">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">
                          {t('originalRequest')}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {formatDateLocalized(message.data.original_requested_date)} {t('from')}{' '}
                          {formatTime(message.data.original_requested_start_time)} {t('to')} {formatTime(message.data.original_requested_end_time)}
                        </p>
                      </div>
                    </div>

                    <div className="bg-blue-50 rounded-lg p-3 border-l-4 border-blue-500">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">
                          {t('counterProposal')}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {formatDateLocalized(message.data.counter_date)} {t('from')}{' '}
                          {formatTime(message.data.counter_start_time)} {t('to')} {formatTime(message.data.counter_end_time)}
                        </p>
                      </div>
                    </div>

                    {/* Show selected cancellation block (block at risk if counter is declined) */}
                    {message.data.selected_cancellation_date && message.data.original_requester_id === user?.id && (
                      <div className="bg-red-50 rounded-lg p-3 border-l-4 border-red-500">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 text-sm">
                            {t('blockAtRiskIfDeclined')}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            {formatDateLocalized(message.data.selected_cancellation_date)} {t('from')}{' '}
                            {formatTime(message.data.selected_cancellation_start_time)} {t('to')} {formatTime(message.data.selected_cancellation_end_time)}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {t('requestingCareFrom', { requester: message.data.selected_cancellation_requesting_parent, receiver: message.data.selected_cancellation_receiving_parent })}
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
                          {t('newCareBlockReceiving')}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {formatDateLocalized(message.data.new_date)} {t('from')}{' '}
                          {formatTime(message.data.new_start_time)} {t('to')} {formatTime(message.data.new_end_time)}
                        </p>
                        <button
                          onClick={() => navigateToCareBlock(message.data.new_date, 'needed')}
                          className="inline-block mt-3 px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                        >
                          {t('viewInCalendar')}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Show counter-proposal declined details */}
                {message.type === 'reschedule_counter_declined' && (
                  <div className="space-y-3 mb-4">
                    <h5 className="font-medium text-gray-900 text-sm">{t('cancelledCareBlocksLabel')}</h5>

                    {/* Declined counter */}
                    <div className="bg-red-50 rounded-lg p-3 border-l-4 border-red-500">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">
                          {t('declinedCounterProposal')}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {formatDateLocalized(message.data.declined_counter_date)} {t('from')}{' '}
                          {formatTime(message.data.declined_counter_start_time)} {t('to')} {formatTime(message.data.declined_counter_end_time)}
                        </p>
                      </div>
                    </div>

                    {/* Selected cancellation */}
                    {message.data.selected_cancellation_date && (
                      <div className="bg-red-50 rounded-lg p-3 border-l-4 border-red-500">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 text-sm">
                            {t('selectedArrangementRemoved')}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            {formatDateLocalized(message.data.selected_cancellation_date)} {t('from')}{' '}
                            {formatTime(message.data.selected_cancellation_start_time)} {t('to')} {formatTime(message.data.selected_cancellation_end_time)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Show event invitation RSVP options if this is an event invitation */}
                {message.type === 'event_invitation' && (
                  <div className="space-y-3 mb-4">
                    <h5 className="font-medium text-gray-900 text-sm">{t('eventDetails')}</h5>
                    <div className="bg-orange-50 rounded-lg p-3 border-l-4 border-orange-500">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">
                          {t('event')} {message.data.event_title}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {t('date')}: {formatDateLocalized(message.data.care_date)} {t('from')} {formatTime(message.data.start_time)} {t('to')} {formatTime(message.data.end_time)}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          {t('child')} {message.data.child_name}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          {t('group')}: {message.data.group_name}
                        </p>
                      </div>
                    </div>

                    <h5 className="font-medium text-gray-900 text-sm mt-4">{t('rsvp')}</h5>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEventRSVP(message.data.event_request_id, 'going')}
                        className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                      >
                        {t('going')}
                      </button>
                      <button
                        onClick={() => handleEventRSVP(message.data.event_request_id, 'maybe')}
                        className="px-4 py-2 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700"
                      >
                        {t('maybe')}
                      </button>
                      <button
                        onClick={() => handleEventRSVP(message.data.event_request_id, 'not_going')}
                        className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                      >
                        {t('notGoing')}
                      </button>
                    </div>
                  </div>
                )}

                {/* Show hangout/sleepover invitation details */}
                {(message.type === 'hangout' || message.type === 'sleepover') && (
                  <div className="space-y-3 mb-4">
                    <h5 className="font-medium text-gray-900 text-sm">{message.type === 'hangout' ? t('hangoutDetails') : t('sleepoverDetails')}</h5>
                    <div className={`${message.type === 'hangout' ? 'bg-pink-50 border-pink-500' : 'bg-indigo-50 border-indigo-500'} rounded-lg p-3 border-l-4`}>
                      <div className="flex-1 space-y-2">
                        <p className="font-medium text-gray-900 text-sm">
                          {t('host')} {message.data.host_parent_name}
                        </p>
                        <p className="text-sm text-gray-600">
                          {t('yourChild')} {message.data.invited_child_name}
                        </p>
                        {message.data.hosting_children_names && message.data.hosting_children_names.length > 0 && (
                          <p className="text-sm text-gray-600">
                            {t('hostingChildren')} {message.data.hosting_children_names.join(', ')}
                          </p>
                        )}
                        <p className="text-sm text-gray-600">
                          {t('date')}: {formatDateLocalized(message.data.requested_date)} {t('from')} {formatTime(message.data.start_time)} {t('to')} {formatTime(message.data.end_time)}
                        </p>
                        {message.data.end_date && (
                          <p className="text-sm text-gray-600">
                            {t('until')} {formatDateLocalized(message.data.end_date)} {t('at')} {formatTime(message.data.end_time)}
                          </p>
                        )}
                        <p className="text-sm text-gray-500">
                          {t('group')}: {message.data.group_name}
                        </p>
                        {message.data.notes && (
                          <p className="text-sm text-gray-500 mt-2">
                            <strong>{t('notes')}:</strong> {message.data.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    <h5 className="font-medium text-gray-900 text-sm mt-4">{t('respond')}</h5>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleAcceptHangoutInvitation(message.data, message.data.invited_child_id)}
                        className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                      >
                        {t('accept')}
                      </button>
                      <button
                        onClick={() => handleDeclineHangoutInvitation(message.data)}
                        className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                      >
                        {t('decline')}
                      </button>
                    </div>
                  </div>
                )}

                {/* Only show notes if they're not redundant with the main message */}
                {message.data.notes && message.type !== 'care_request' && (
                  <div className="text-sm text-gray-600">
                    <p><strong>{t('notes')}:</strong> {message.data.notes}</p>
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
          // Refresh all data when new notification arrives
          fetchData();
        }
      )
      .subscribe();

    return () => {
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

      // Fetch reschedule acceptance/decline notifications and hangout acceptance notifications
      const { data: rescheduleNotifications, error: rescheduleNotificationsError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .in('type', ['reschedule_accepted', 'reschedule_declined', 'reschedule_counter_sent', 'reschedule_counter_accepted', 'reschedule_counter_declined', 'care_declined', 'hangout_accepted'])
        .order('created_at', { ascending: false });

      if (rescheduleNotificationsError) {
        console.error('Error fetching reschedule notifications:', rescheduleNotificationsError);
        setRescheduleNotifications([]);
      } else {
        setRescheduleNotifications(rescheduleNotifications || []);
      }

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
        router.push(`/calendar?date=${date}&selectBlock=${blocks[0].id}`);
      } else {
        // Fallback to just the date
        router.push(`/calendar?date=${date}`);
      }
    } catch (err) {
      console.error('Error finding block:', err);
      // Fallback to just the date
      router.push(`/calendar?date=${date}`);
    }
  };

  const fetchChildrenForGroup = async (groupId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

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

      if (error) {
        console.error('Error fetching children for group:', error);
        return;
      }

      if (!data || data.length === 0) {
        setChildren([]);
        return;
      }

      const groupChildren = data.map(item => ({
        id: item.children.id,
        name: item.children.full_name,
        group_id: groupId
      }));

      setChildren(groupChildren);
    } catch (err) {
      console.error('Error in fetchChildrenForGroup:', err);
    }
  };

  const fetchPetsForGroup = async (groupId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

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

      if (error) {
        console.error('Error fetching pets for group:', error);
        return;
      }

      if (!data || data.length === 0) {
        setPets([]);
        return;
      }

      const groupPets = data.map(item => ({
        id: item.pets.id,
        name: item.pets.name,
        species: item.pets.species,
        group_id: groupId
      }));

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

        if (isCounterProposal) {
          // This is a counter-proposal - decline immediately without showing modal
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

          const { data, error } = await supabase.rpc('handle_improved_reschedule_response', {
            p_care_response_id: careResponseId,
            p_responder_id: user.id,
            p_response_status: 'declined',
            p_response_notes: notes || null,
            p_decline_action: null,
            p_selected_cancellation_request_id: selectedCancellationId
          });

          if (error) throw error;

          // Mark the reschedule_counter_sent notification as read
          if (careRequestId) {
            await supabase
              .from('notifications')
              .update({ is_read: true })
              .eq('user_id', user.id)
              .eq('type', 'reschedule_counter_sent')
              .eq('data->>counter_request_id', careRequestId);
          }

          showAlertOnce('You have declined the counter-proposal. The parent has been notified.');
          await fetchData();
          setProcessingReschedule(false);
          return;
        }

        // Not a counter-proposal - show the full modal with decline options
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

      // Look up care_request_id if not provided
      let requestId = careRequestId;
      if (!requestId) {
        const { data: responseData, error: responseError } = await supabase
          .from('care_responses')
          .select('request_id')
          .eq('id', careResponseId)
          .single();

        if (responseData) {
          requestId = responseData.request_id;
        }
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
        // Mark the reschedule_request notification as read
        if (requestId) {
          await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', user.id)
            .eq('type', 'reschedule_request')
            .eq('data->>request_id', requestId);
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
    setSelectedRequest(request);
    setShowResponseForm(true);

    // Fetch children or pets based on care type
    if (request.care_type === 'pet') {
      await fetchPetsForGroup(request.group_id);
    } else {
      await fetchChildrenForGroup(request.group_id);
    }
  };

  const handleSubmitResponse = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedRequest) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // VALIDATION: For pet care, check that reciprocal dates don't overlap with original request
      if (dateOverlapWarning) {
        setError('Please fix the date overlap before submitting. Choose reciprocal dates that do not conflict with the original request.');
        return;
      }

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
        // Check if it's a date overlap error from backend
        if (error.message && error.message.includes('overlap')) {
          setError('Date overlap detected: Please choose reciprocal dates that do not conflict with the original request dates.');
        } else {
          setError('Failed to submit response. Please check your inputs and try again.');
        }
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
          // Notification failed (non-critical)
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

      CounterDebugger.logReciprocalAcceptance(
        responseId,
        careType || 'child',
        responseToAccept?.requester_id || 'unknown',
        responseToAccept?.responder_id || user?.id || 'unknown'
      );

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

      // Dispatch event to refresh counters in Header
      CounterDebugger.logEventDispatch('refreshCounters', 'Scheduler.handleAcceptResponse', { responseId, careType });
      window.dispatchEvent(new CustomEvent('refreshCounters'));

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

        // Auto-accept with the active child
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

      CounterDebugger.logOpenBlockAcceptance(
        targetInvitation.invitation_id || targetInvitation.care_response_id,
        user.id,
        targetInvitation.open_block_parent_id || targetInvitation.requester_id
      );

      const functionParams = {
        p_care_response_id: targetInvitation.care_response_id,
        p_accepting_parent_id: user.id,
        p_accepted_child_id: childId || (availableChildren && availableChildren.length > 0 ? availableChildren[0].id : null)
      };

      const { error } = await supabase.rpc('accept_open_block_invitation', functionParams);

      if (!childId && (!availableChildren || availableChildren.length === 0)) {
        throw new Error('No child selected and no children available');
      }

      if (error) throw error;

      // Success! Update calendar counter (+2 blocks for acceptor)
      const currentCalendarCount = parseInt(localStorage.getItem('newCalendarBlocksCount') || '0', 10);
      localStorage.setItem('newCalendarBlocksCount', (currentCalendarCount + 2).toString());

      // Dispatch events to update header counters
      window.dispatchEvent(new CustomEvent('invitationAccepted'));
      CounterDebugger.logEventDispatch('calendarCountUpdated', 'Scheduler.handleAcceptanceSubmit', {
        invitationId: targetInvitation.invitation_id,
        acceptorId: user.id,
        offererId: targetInvitation.open_block_parent_id
      });
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
          const messageContent = `${acceptingParent.full_name} accepted an open block invitation and added ${acceptedChild.full_name} to the care block for ${careBlock.groups.name} on ${formatDateLocalized(careBlock.care_date)}.`;
          
          await supabase.rpc('send_care_response_notifications', {
            p_care_request_id: invitation.care_request_id || 'open_block',
            p_responder_id: member.profile_id,
            p_message_content: messageContent
          });
        }
      }

      // Send a specific message to the accepting parent
      const successMessage = `You successfully accepted the open block invitation and added ${acceptedChild.full_name} to the care block for ${careBlock.groups.name} on ${formatDateLocalized(careBlock.care_date)}.`;
      
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
        subtitle: `Care block: ${formatDateLocalized(invitation.existing_block_date)} from ${formatTime(invitation.existing_block_start_time)} to ${formatTime(getActualEndTime(invitation.notes || '', invitation.existing_block_end_time))}`,
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

      showAlertOnce(`${invitation.request_type === 'hangout' ? 'Hangout' : 'Sleepover'} invitation accepted successfully!`);

      // Refresh invitations
      await fetchHangoutInvitations();

      // Trigger counter refresh in Header
      window.dispatchEvent(new CustomEvent('refreshCounters'));

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
    // 1. Pending care requests (reciprocal care requests needing response)
    const pendingCareResponses = careResponses.filter(r =>
      r.status === 'pending' && !readMessages.has(`pending-${r.care_response_id}`)
    );
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

      // Mark hangout_accepted notifications as read in the database (informational only, no action needed)
      const hangoutAcceptedNotifications = rescheduleNotifications.filter(n => n.type === 'hangout_accepted' && !n.is_read);
      if (hangoutAcceptedNotifications.length > 0) {
        const notificationIds = hangoutAcceptedNotifications.map(n => n.id);
        supabase
          .from('notifications')
          .update({ is_read: true })
          .in('id', notificationIds)
          .then(() => {
            // Trigger counter update to refresh the badge
            window.dispatchEvent(new CustomEvent('refreshCounters'));
          });
      }

      // Trigger counter update to refresh the badge
      window.dispatchEvent(new Event('schedulerCountUpdated'));
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
    <Header currentPage="scheduler">
      <div className="px-4 py-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900">{t('scheduler')}</h1>
          </div>


          {/* Unified Messages Inbox */}
          <div className="bg-white rounded-lg shadow mb-8">
            <div className="px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{t('messages')}</h2>
                <p className="text-sm text-gray-600 mt-1">{t('clickMessageToExpand')}</p>
              </div>
            </div>
            <div className="p-6">
              <UnifiedMessagesInbox />
            </div>
          </div>

          {/* Reschedule requests are now integrated into the Unified Messages Inbox above */}

          {/* New Care Request Modal */}
          {showNewRequestForm && (
            <div className="fixed left-0 right-0 bg-black bg-opacity-50 overflow-y-auto" style={{ top: '80px', bottom: '70px', zIndex: 9999 }}>
              <div className="flex items-start justify-center p-4">
                <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
                  {/* Fixed Header */}
                  <div className="px-6 py-4 border-b border-gray-200 sticky top-0 bg-white rounded-t-lg z-10">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-semibold text-gray-900">{t('createNewCareRequest')}</h2>
                      <button
                        type="button"
                        onClick={resetNewRequestForm}
                        className="text-gray-600 hover:text-gray-900 p-2 -mr-2 rounded-full hover:bg-gray-100"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Form Content */}
                  <form onSubmit={handleCreateRequest}>
                    <div className="p-6 space-y-4">
  {/* Care Type Selector */}
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">
      {t('type')} *
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
        {t('careRequestType')}
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
        {t('hangout')}
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
        {t('sleepover')}
      </button>
    </div>
  </div>

  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {/* Date */}
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {newRequest.care_type === 'sleepover' ? `${t('startDate')} *` : `${t('date')} *`}
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
          {t('endDate')} *
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
        {t('startTime')} *
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
        {t('endTime')} *
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
        {t('group')} *
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
        <option value="">{t('selectGroup')}</option>
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
          {t('child')} *
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
              ? t('selectGroupFirst')
              : children.length === 0
              ? t('noActiveChildrenInGroup')
              : t('selectChild')
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
        {t('hostingChildrenLabel')} * {t('hostingChildrenDesc')}
      </label>
      <div className="border border-gray-300 rounded-md p-3 max-h-40 overflow-y-auto">
        {!newRequest.group_id ? (
          <p className="text-sm text-gray-500">{t('selectGroupFirst')}</p>
        ) : children.length === 0 ? (
          <p className="text-sm text-gray-500">{t('noChildrenAvailable')}</p>
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
        {t('invitedChildrenLabel')} * {t('invitedChildrenDesc')}
      </label>
      <div className="border border-gray-300 rounded-md p-3 max-h-40 overflow-y-auto">
        {!newRequest.group_id ? (
          <p className="text-sm text-gray-500">{t('selectGroupFirst')}</p>
        ) : groupChildren.length === 0 ? (
          <p className="text-sm text-gray-500">{t('noChildrenInThisGroup')}</p>
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
      {t('notesOptional')}
    </label>
    <textarea
      value={newRequest.notes}
      onChange={(e) => setNewRequest(prev => ({ ...prev, notes: e.target.value }))}
      rows={3}
      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      placeholder={t('anyAdditionalNotes')}
    />
  </div>
                    </div>

                    {/* Footer with Buttons */}
                    <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={resetNewRequestForm}
                        className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                      >
                        {t('cancel')}
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        {newRequest.care_type === 'reciprocal' ? t('createRequestBtn') :
                         newRequest.care_type === 'hangout' ? t('createHangoutBtn') :
                         t('createSleepoverBtn')}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

                    {/* Reciprocal Response Modal */}
          {showResponseForm && selectedRequest && (
            <div
              className="fixed left-0 right-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
              style={{ top: '145px', bottom: '90px', zIndex: 9999 }}
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setShowResponseForm(false);
                  setSelectedRequest(null);
                }
              }}
            >
              <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-full overflow-y-auto">
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
                      {formatDateLocalized(selectedRequest.requested_date)} from{' '}
                      {formatTime(selectedRequest.start_time)} to {formatTime(getActualEndTime(selectedRequest.notes || '', selectedRequest.end_time))}
                      {selectedRequest.end_date && ` until ${formatDateLocalized(selectedRequest.end_date)}`}
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
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                            dateOverlapWarning
                              ? 'border-yellow-500 focus:ring-yellow-500 bg-yellow-50'
                              : 'border-gray-300 focus:ring-blue-500'
                          }`}
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
                            Reciprocal End Date
                            <span className="ml-2 text-xs text-purple-600">(Optional - for multi-day care)</span>
                          </label>
                          <input
                            type="date"
                            value={reciprocalResponse.reciprocal_end_date}
                            onChange={(e) => setReciprocalResponse(prev => ({ ...prev, reciprocal_end_date: e.target.value }))}
                            min={reciprocalResponse.reciprocal_date || undefined}
                            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                              dateOverlapWarning
                                ? 'border-yellow-500 focus:ring-yellow-500 bg-yellow-50'
                                : 'border-gray-300 focus:ring-purple-500'
                            }`}
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Leave empty for same-day reciprocal care
                          </p>
                        </div>
                      )}

                      {/* Date Overlap Warning */}
                      {selectedRequest.care_type === 'pet' && dateOverlapWarning && (
                        <div className="md:col-span-2">
                          <div className="p-3 bg-yellow-50 border border-yellow-300 rounded-md">
                            <p className="text-sm text-yellow-800">
                              {dateOverlapWarning}
                            </p>
                          </div>
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
    </Header>
  );
}




