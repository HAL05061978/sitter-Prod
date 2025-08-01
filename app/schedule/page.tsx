// Fixed Schedule Page - Updated for New 3-Table System
// This file replaces app/schedule/page.tsx with correct table references

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';
import LogoutButton from '../components/LogoutButton';

import type { User as SupabaseUser } from '@supabase/supabase-js';

interface User extends SupabaseUser {}

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface Child {
  id: string;
  full_name: string;
  parent_id: string;
}

interface Group {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  group_type: 'care' | 'event';
}

// Updated interface for new scheduled_care table
interface ScheduledCare {
  id: string;
  group_id: string;
  parent_id: string;
  child_id: string;
  care_date: string; // Changed from scheduled_date
  start_time: string;
  end_time: string;
  duration_minutes: number;
  care_type: 'needed' | 'provided' | 'event'; // Updated to match database schema
  status: string;
  related_request_id: string; // Updated to match database schema
  notes: string | null;
  children?: {
    full_name: string;
  };
  care_group_id?: string;
}

// Updated interface for new care_requests table
interface CareRequest {
  id: string;
  group_id: string;
  requester_id: string; // Changed from initiator_id
  child_id: string;
  requested_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  notes: string | null;
  request_type: 'simple' | 'reciprocal' | 'event' | 'open_block';
  status: string;
  responder_id?: string; // Who accepted the request
  response_notes?: string; // Notes from the responder
  created_at: string;
  children?: {
    full_name: string;
  };
  // Event fields
  event_title?: string;
  event_description?: string;
  event_rsvp_deadline?: string;
  event_location?: string;
  event_is_editable?: boolean;
  event_edit_deadline?: string;
  // Recurring event fields
  is_recurring?: boolean;
  recurrence_pattern?: 'weekly' | 'monthly' | 'yearly';
  recurrence_end_date?: string;
  parent_event_id?: string;
  // Open block fields
  open_block_slots?: number;
  open_block_slots_used?: number;
  open_block_parent_id?: string;
  // Reciprocal fields
  is_reciprocal?: boolean;
  reciprocal_parent_id?: string;
  reciprocal_child_id?: string;
  reciprocal_date?: string;
  reciprocal_start_time?: string;
  reciprocal_end_time?: string;
  reciprocal_status?: string;
}

// Updated interface for new care_responses table
interface CareResponse {
  id: string;
  request_id: string;
  responder_id: string;
  response_type: 'accept' | 'decline' | 'pending';
  reciprocal_date?: string;
  reciprocal_start_time?: string;
  reciprocal_end_time?: string;
  reciprocal_duration_minutes?: number;
  reciprocal_child_id?: string;
  response_notes?: string; // Fixed column name
  status: string;
  created_at: string;
}

interface GroupInvitation {
  id: string;
  group_id: string;
  inviter_id: string;
  invitee_id: string;
  request_id: string;
  invitation_date: string;
  invitation_start_time: string;
  invitation_end_time: string;
  invitation_duration_minutes: number;
  status: string;
  selected_time_block_index?: number;
  notes: string | null;
  created_at: string;
}

interface InvitationTimeBlock {
  block_index: number;
  block_date: string;
  block_start_time: string;
  block_end_time: string;
  block_duration_minutes: number;
  is_available: boolean;
}

interface AvailableGroupMember {
  profile_id: string;
  full_name: string;
  email: string;
}

interface AvailableChild {
  child_id: string;
  child_name: string;
  parent_id: string;
  parent_name: string;
}

// Event-specific interfaces
interface EventResponse {
  id: string;
  event_request_id: string;
  responder_id: string;
  response_type: 'going' | 'maybe' | 'not_going';
  response_notes?: string;
  created_at: string;
  updated_at: string;
  responder?: {
    full_name: string;
  };
}

interface EventNotification {
  id: string;
  event_request_id: string;
  notification_type: 'event_created' | 'event_updated' | 'event_cancelled' | 'rsvp_reminder';
  recipient_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export default function SchedulePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [scheduledCare, setScheduledCare] = useState<ScheduledCare[]>([]); // Updated variable name
  const [requests, setRequests] = useState<CareRequest[]>([]); // Updated type
  const [responses, setResponses] = useState<CareResponse[]>([]); // Updated type
  const [invitations, setInvitations] = useState<GroupInvitation[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [activeChildrenPerGroup, setActiveChildrenPerGroup] = useState<{[groupId: string]: Child[]}>({});
  const [allGroupChildren, setAllGroupChildren] = useState<Child[]>([]);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [calendarView, setCalendarView] = useState<'weekly' | 'monthly'>('weekly');

  // State for modals
  const [showCreateRequest, setShowCreateRequest] = useState(false);
  const [showCreateCareRequest, setShowCreateCareRequest] = useState(false);
  const [showCreateEventRequest, setShowCreateEventRequest] = useState(false);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showAcceptInvitationModal, setShowAcceptInvitationModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<CareRequest | null>(null); // Updated type
  const [selectedInvitation, setSelectedInvitation] = useState<GroupInvitation | null>(null);
  const [showDailyScheduleModal, setShowDailyScheduleModal] = useState(false);
  const [selectedDateForDailyView, setSelectedDateForDailyView] = useState<Date | null>(null);

  const [responseType, setResponseType] = useState<'accept' | 'decline'>('accept');
  const [availableTimeBlocks, setAvailableTimeBlocks] = useState<InvitationTimeBlock[]>([]);
  const [availableGroupMembers, setAvailableGroupMembers] = useState<AvailableGroupMember[]>([]);
  const [availableChildren, setAvailableChildren] = useState<AvailableChild[]>([]);
  const [userChildren, setUserChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  
  // Form states
  const [requestForm, setRequestForm] = useState({
    groupId: '',
    childId: '',
    requestedDate: '',
    startTime: '',
    endTime: '',
    notes: '',
    requestType: 'simple' as 'simple' | 'reciprocal' | 'event' | 'open_block',
    eventTitle: '',
    eventDescription: '',
    eventLocation: '',
    eventRSVPDeadline: '',
    eventEditDeadline: '',
    // Recurring event fields
    isRecurring: false,
    recurrencePattern: 'weekly' as 'weekly' | 'monthly' | 'yearly',
    recurrenceEndDate: '',
    openBlockSlots: 1
  });

  const [responseForm, setResponseForm] = useState({
    reciprocalDate: '',
    reciprocalStartTime: '',
    reciprocalEndTime: '',
    reciprocalChildId: '',
    notes: ''
  });

  const [inviteForm, setInviteForm] = useState({
    selectedMembers: [] as string[],
    timeBlocks: [] as Array<{
      date: string;
      startTime: string;
      endTime: string;
    }>,
    notes: ''
  });

  const [childrenInCareBlocks, setChildrenInCareBlocks] = useState<{[blockId: string]: {child_name: string}[]}>({});

  // Event-specific state
  const [eventResponses, setEventResponses] = useState<EventResponse[]>([]);
  const [eventNotifications, setEventNotifications] = useState<EventNotification[]>([]);
  const [showEventRSVPModal, setShowEventRSVPModal] = useState(false);
  const [selectedEventRequest, setSelectedEventRequest] = useState<CareRequest | null>(null);
  const [eventRSVPForm, setEventRSVPForm] = useState({
    responseType: 'going' as 'going' | 'maybe' | 'not_going',
    notes: ''
  });
  const [showEventEditModal, setShowEventEditModal] = useState(false);
  const [eventEditForm, setEventEditForm] = useState({
    eventTitle: '',
    eventDescription: '',
            eventLocation: '',
        eventRSVPDeadline: '',
    eventEditDeadline: ''
  });

  // Load children data for care blocks
  useEffect(() => {
    const loadChildrenInCareBlocks = async () => {
      const newChildrenData: {[blockId: string]: {child_name: string}[]} = {};
      
      for (const block of scheduledCare) { // Updated variable name
        // For now, just show the child name for this specific block
        // This avoids the duplicate names issue
        newChildrenData[block.id] = [{ child_name: getChildName(block.child_id, undefined, block) }];
      }
      
      setChildrenInCareBlocks(newChildrenData);
    };
    
    if (scheduledCare.length > 0) { // Updated variable name
      loadChildrenInCareBlocks();
    }
  }, [scheduledCare]); // Updated dependency

  // Function to refresh active children data
  const refreshActiveChildren = async (userId: string, childrenData: Child[]) => {
    const newActiveChildren: {[groupId: string]: Child[]} = {};
    
    for (const group of groups) {
      const { data: childGroupMembers } = await supabase
        .from("child_group_members")
        .select("child_id")
        .eq("group_id", group.id);

      if (childGroupMembers) {
        const childIds = childGroupMembers.map(cgm => cgm.child_id);
        const groupChildren = childrenData.filter(child => childIds.includes(child.id));
        newActiveChildren[group.id] = groupChildren;
      }
    }
    
    setActiveChildrenPerGroup(newActiveChildren);
  };

  const fetchAllProfiles = async () => {
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, full_name, email");
    setAllProfiles(profilesData || []);
  };

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.replace("/auth");
      } else {
        setUser(data.user);
        
        // Fetch user profile
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .eq("id", data.user.id)
          .single();
        setProfile(profileData);

        // Fetch user's children
        const { data: childrenData } = await supabase
          .from("children")
          .select("*")
          .eq("parent_id", data.user.id);
        setChildren(childrenData || []);

        // Fetch groups where user is a member
        const { data: memberGroups } = await supabase
          .from("group_members")
          .select("group_id, status")
          .eq("profile_id", data.user.id)
          .eq("status", "active");

        if (memberGroups) {
          const groupIds = memberGroups.map(mg => mg.group_id);
          const { data: groupsData } = await supabase
            .from("groups")
            .select("*")
            .in("id", groupIds);
          setGroups(groupsData || []);

          // Fetch active children for each group
          await refreshActiveChildren(data.user.id, childrenData || []);
        }

        // Fetch scheduled care for the current month
        await fetchScheduledCare(data.user.id, currentDate); // Updated function name

        // Fetch active requests and responses
        await fetchRequestsAndResponses(data.user.id);

        // Fetch invitations
        await fetchInvitations(data.user.id);

        // Fetch all event responses for the current user
        await fetchAllEventResponses(data.user.id);

        // Fetch all profiles for name resolution
        await fetchAllProfiles();

        setLoading(false);
      }
    });
  }, [router]); // Removed currentDate from dependencies

  // Separate useEffect to handle date changes for scheduled care
  useEffect(() => {
    if (user) {
      fetchScheduledCare(user.id, currentDate); // Updated function name
    }
  }, [user, currentDate, calendarView]);

  // Updated function name and table references
  // Helper function to format date as YYYY-MM-DD in local timezone
  const formatDateForDB = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const fetchScheduledCare = async (userId: string, date: Date) => {
    // Determine the date range based on calendar view
    let startDate: Date;
    let endDate: Date;
    
    if (calendarView === 'weekly') {
      // For weekly view, get the week containing the current date
      const weekDays = getDaysInWeek(date);
      startDate = weekDays[0]; // Sunday
      endDate = weekDays[6];   // Saturday
    } else {
      // For monthly view, get the entire month
      startDate = new Date(date.getFullYear(), date.getMonth(), 1);
      endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    }

    // First, get all groups the user is a member of
    const { data: userGroups } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("profile_id", userId);

    if (!userGroups || userGroups.length === 0) {
      setScheduledCare([]); // Updated variable name
      return;
    }

    const groupIds = userGroups.map(g => g.group_id);

    // Get the user's children IDs for filtering
    const { data: userChildren } = await supabase
      .from("children")
      .select("id")
      .eq("parent_id", userId);

    const userChildIds = userChildren?.map(child => child.id) || [];

    // Fetch scheduled care that is relevant to the current user:
    // 1. Blocks where the user is the parent_id (they are providing or needing care)
    // 2. Blocks where the user's children need care (care_needed blocks only)
    
    // First, get blocks where the user is the parent_id with child data
    const { data: userBlocks, error: userError } = await supabase
      .from("scheduled_care") // Updated table name
      .select(`
        *,
        children:child_id (
          id,
          full_name,
          parent_id
        )
      `)
      .gte("care_date", formatDateForDB(startDate)) // Use local date formatting
      .lte("care_date", formatDateForDB(endDate)) // Use local date formatting
      .in("group_id", groupIds)
      .eq("status", "confirmed")
      .eq("parent_id", userId);

    if (userError) {
      console.error('Error fetching user blocks:', userError);
    }

    // Then, get care_needed blocks where the user's children are involved with child data
    let childCareNeededBlocks: any[] = [];
    if (userChildIds.length > 0) {
      const { data: childBlocksData, error: childError } = await supabase
        .from("scheduled_care") // Updated table name
        .select(`
          *,
          children:child_id (
            id,
            full_name,
            parent_id
          )
        `)
        .gte("care_date", formatDateForDB(startDate)) // Use local date formatting
        .lte("care_date", formatDateForDB(endDate)) // Use local date formatting
        .in("group_id", groupIds)
        .eq("status", "confirmed")
        .eq("care_type", "needed") // Updated to match database schema
        .in("child_id", userChildIds);

      if (childError) {
        console.error('Error fetching child care needed blocks:', childError);
      } else {
        childCareNeededBlocks = childBlocksData || [];
      }
    }

    // Also fetch event blocks for all group members (since events create blocks for everyone)
    const { data: eventBlocks, error: eventError } = await supabase
      .from("scheduled_care")
      .select(`
        *,
        children:child_id (
          id,
          full_name,
          parent_id
        )
      `)
      .gte("care_date", formatDateForDB(startDate))
      .lte("care_date", formatDateForDB(endDate))
      .in("group_id", groupIds)
      .eq("status", "confirmed")
      .eq("care_type", "event");

    if (eventError) {
      console.error('Error fetching event blocks:', eventError);
    }

    // Combine and deduplicate the results
    const allBlocks = [...(userBlocks || []), ...childCareNeededBlocks, ...(eventBlocks || [])];
    const uniqueBlocks = allBlocks.filter((block, index, self) => 
      index === self.findIndex(b => b.id === block.id)
    );

    console.log('Fetched scheduled care blocks:', {
      userBlocks: userBlocks?.length || 0,
      childCareNeededBlocks: childCareNeededBlocks.length,
      eventBlocks: eventBlocks?.length || 0,
      totalUnique: uniqueBlocks.length,
      blocks: uniqueBlocks
    });
    setScheduledCare(uniqueBlocks); // Updated variable name
  };

  // Updated function with new table names
  const fetchRequestsAndResponses = async (userId: string) => {
    // First, get all groups the user is a member of
    const { data: userGroups } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("profile_id", userId);

    if (!userGroups || userGroups.length === 0) {
      setRequests([]);
      setResponses([]);
      return;
    }

    const groupIds = userGroups.map(g => g.group_id);

    // Fetch all requests from user's groups with child data (including all statuses)
    const { data: requestsData } = await supabase
      .from("care_requests") // Updated table name
      .select(`
        *,
        children:child_id (
          id,
          full_name,
          parent_id
        )
      `)
      .in("group_id", groupIds)
      .order("created_at", { ascending: false });



    setRequests(requestsData || []);

    // Fetch responses for these requests (including all statuses)
    if (requestsData && requestsData.length > 0) {
      const requestIds = requestsData.map(r => r.id);
      const { data: responsesData } = await supabase
        .from("care_responses") // Updated table name
        .select("*")
        .in("request_id", requestIds)
        .order("created_at", { ascending: false });



      setResponses(responsesData || []);
    } else {
      setResponses([]);
    }

    // Fetch all children in the user's groups for name resolution
    const { data: childGroupMembers } = await supabase
      .from("child_group_members")
      .select("child_id")
      .in("group_id", groupIds);

    if (childGroupMembers && childGroupMembers.length > 0) {
      const childIds = childGroupMembers.map(cgm => cgm.child_id);
      
      const { data: groupChildrenData } = await supabase
        .from("children")
        .select("id, full_name, parent_id")
        .in("id", childIds);

      if (groupChildrenData) {
        setAllGroupChildren(groupChildrenData);
      }
    }
  };

  const fetchInvitations = async (userId: string) => {
    // Implementation for invitations (if needed)
    // This would need to be updated based on your invitation system
  };

  // Event-specific functions
  const fetchEventResponses = async (eventRequestId: string) => {
    const { data: responsesData } = await supabase
      .from("event_responses")
      .select(`
        *,
        responder:profiles(full_name)
      `)
      .eq("event_request_id", eventRequestId);
    setEventResponses(responsesData || []);
  };

  const fetchAllEventResponses = async (userId: string) => {
    const { data: responsesData } = await supabase
      .from("event_responses")
      .select(`
        *,
        responder:profiles(full_name)
      `)
      .eq("responder_id", userId);
    setEventResponses(responsesData || []);
  };

  const fetchEventNotifications = async (userId: string) => {
    const { data: notificationsData } = await supabase
      .from("event_notifications")
      .select("*")
      .eq("recipient_id", userId)
      .eq("is_read", false)
      .order("created_at", { ascending: false });
    setEventNotifications(notificationsData || []);
  };

  const submitEventRSVP = async () => {
    if (!user || !selectedEventRequest) {
      alert('User or event not found');
      return;
    }

    try {
      const { error } = await supabase.rpc('update_event_response', {
        p_event_request_id: selectedEventRequest.id,
        p_responder_id: user.id,
        p_response_type: eventRSVPForm.responseType,
        p_response_notes: eventRSVPForm.notes || null
      });

      if (error) {
        console.error('Error submitting event RSVP:', error);
        alert('Error submitting RSVP: ' + error.message);
        return;
      }

      // Refresh event responses
      await fetchEventResponses(selectedEventRequest.id);
      setShowEventRSVPModal(false);
      setEventRSVPForm({
        responseType: 'going',
        notes: ''
      });
      alert('RSVP submitted successfully!');
    } catch (error) {
      console.error('Error submitting event RSVP:', error);
      alert('Error submitting RSVP. Please try again.');
    }
  };

  const handleEventBlockDoubleClick = async (block: ScheduledCare) => {
    // Find the original event request for this block
    const eventRequest = requests.find(req => 
      req.id === block.related_request_id && 
      req.request_type === 'event'
    );

    if (eventRequest) {
      // Add child data from the block to the event request for display
      const eventRequestWithChild = {
        ...eventRequest,
        children: block.children
      };
      console.log('Event block clicked:', {
        block,
        eventRequest,
        eventRequestWithChild,
        childName: getChildName(eventRequest.child_id, eventRequestWithChild)
      });
      setSelectedEventRequest(eventRequestWithChild);
      await fetchEventResponses(eventRequest.id);
      setShowEventRSVPModal(true);
    }
  };

  const canEditEvent = (eventRequest: CareRequest): boolean => {
    if (!user) return false;
    if (eventRequest.requester_id !== user.id) return false;
    if (!eventRequest.event_is_editable) return false;
    
    // Check if event date has passed
    const eventDate = new Date(eventRequest.requested_date);
    if (eventDate < new Date()) return false;
    
    // Check edit deadline if set
    if (eventRequest.event_edit_deadline) {
      const editDeadline = new Date(eventRequest.event_edit_deadline);
      if (new Date() > editDeadline) return false;
    }
    
    return true;
  };

  const getActiveChildrenForGroup = (groupId: string) => {
    return activeChildrenPerGroup[groupId] || [];
  };

  const getGroupsByType = (type: 'care' | 'event') => {
    return groups.filter(group => group.group_type === type);
  };

  // Updated function names and types
  const createCareRequest = async () => {
    if (!user || !requestForm.groupId || !requestForm.childId || !requestForm.requestedDate || !requestForm.startTime || !requestForm.endTime) {
      alert('Please fill in all required fields');
      return;
    }

    // Determine request type based on which modal is open
    const isEventRequest = showCreateEventRequest;
    const requestType = isEventRequest ? 'event' : requestForm.requestType;

    // Validate request type specific fields
    if (requestType === 'event' && (!requestForm.eventTitle || !requestForm.eventDescription)) {
      alert('Please fill in event title and description for event requests');
      return;
    }

    if (requestForm.requestType === 'open_block' && requestForm.openBlockSlots < 1) {
      alert('Open block must have at least 1 slot available');
      return;
    }

    try {
      // Convert local date to UTC for database storage
      const localDate = new Date(requestForm.requestedDate + 'T00:00:00');
      const utcDate = localDate.toISOString().split('T')[0];

      const requestData: any = {
        group_id: requestForm.groupId,
        requester_id: user.id,
        child_id: requestForm.childId,
        requested_date: utcDate,
        start_time: requestForm.startTime,
        end_time: requestForm.endTime,
        notes: requestForm.notes,
        request_type: requestType,
        status: 'pending'
      };

      // Add request type specific fields
      if (requestType === 'event') {
        requestData.event_title = requestForm.eventTitle;
        requestData.event_description = requestForm.eventDescription;
        // Add additional event fields if they exist in the form
        if (requestForm.eventLocation) {
          requestData.event_location = requestForm.eventLocation;
        }


        
        // Add recurring event fields if this is a recurring event
        if (requestForm.isRecurring) {
          requestData.is_recurring = true;
          requestData.recurrence_pattern = requestForm.recurrencePattern;
          if (requestForm.recurrenceEndDate) {
            requestData.recurrence_end_date = requestForm.recurrenceEndDate;
          }
        }
      }

      if (requestForm.requestType === 'open_block') {
        requestData.open_block_slots = requestForm.openBlockSlots;
        requestData.open_block_parent_id = user.id;
      }

      if (requestForm.requestType === 'reciprocal') {
        requestData.is_reciprocal = true;
      }

      const { data: newRequest, error } = await supabase
        .from("care_requests")
        .insert(requestData)
        .select()
        .single();

      if (error) {
        console.error('Error creating care request:', error);
        alert('Error creating request: ' + error.message);
        return;
      }

      // For events, create scheduled care blocks for all group members
      if (requestType === 'event' && newRequest) {
        try {
          // Use the database function to create event blocks (bypasses RLS)
          const { error: blocksError } = await supabase
            .rpc('create_event_blocks', {
              p_group_id: requestForm.groupId,
              p_event_request_id: newRequest.id,
              p_child_id: requestForm.childId,
              p_care_date: utcDate,
              p_start_time: requestForm.startTime,
              p_end_time: requestForm.endTime,
              p_event_title: requestForm.eventTitle
            });

          if (blocksError) {
            console.error('Error creating event blocks:', blocksError);
          }
        } catch (error) {
          console.error('Error creating event blocks:', error);
        }
      }

      // Refresh data
      await fetchRequestsAndResponses(user.id);
      setShowCreateCareRequest(false);
      setShowCreateEventRequest(false);
      setRequestForm({
        groupId: '',
        childId: '',
        requestedDate: '',
        startTime: '',
        endTime: '',
        notes: '',
        requestType: 'simple',
        eventTitle: '',
        eventDescription: '',
        eventLocation: '',
        eventRSVPDeadline: '',
        eventEditDeadline: '',
        // Recurring event fields
        isRecurring: false,
        recurrencePattern: 'weekly',
        recurrenceEndDate: '',
        openBlockSlots: 1
      });
      alert('Care request created successfully!');
    } catch (error) {
      console.error('Error creating care request:', error);
      alert('Error creating request. Please try again.');
    }
  };

  // Updated function names and types
  const respondToCareRequest = async () => {
    if (!user || !selectedRequest || !responseForm.reciprocalDate || !responseForm.reciprocalStartTime || !responseForm.reciprocalEndTime || !responseForm.reciprocalChildId) {
      alert('Please fill in all required fields');
      return;
    }

    // Prevent users from responding to their own requests
    if (selectedRequest.requester_id === user.id) {
      alert('You cannot respond to your own request');
      return;
    }

    try {
      const { error } = await supabase
        .from("care_responses") // Updated table name
        .insert({
          request_id: selectedRequest.id,
          responder_id: user.id,
          response_type: responseType,
          reciprocal_date: responseForm.reciprocalDate,
          reciprocal_start_time: responseForm.reciprocalStartTime,
          reciprocal_end_time: responseForm.reciprocalEndTime,
          reciprocal_child_id: responseForm.reciprocalChildId,
          response_notes: responseForm.notes, // Fixed column name
          status: 'pending'
        });

      if (error) {
        console.error('Error creating response:', error);
        alert('Error creating response: ' + error.message);
        return;
      }

      // Refresh data
      await fetchRequestsAndResponses(user.id);
      setShowResponseModal(false);
      setResponseForm({
        reciprocalDate: '',
        reciprocalStartTime: '',
        reciprocalEndTime: '',
        reciprocalChildId: '',
        notes: ''
      });
      alert('Response submitted successfully!');
    } catch (error) {
      console.error('Error creating response:', error);
      alert('Error creating response. Please try again.');
    }
  };

  // Updated function names and types
  const handleAgreeToRequest = async (request: CareRequest) => {
    // Prevent users from responding to their own requests
    if (request.requester_id === user?.id) {
      alert('You cannot respond to your own request');
      return;
    }
    
    setSelectedRequest(request);
    setResponseType('accept');
    setShowResponseModal(true);
  };

  const handleRejectRequest = async (request: CareRequest) => {
    // Prevent users from responding to their own requests
    if (request.requester_id === user?.id) {
      alert('You cannot respond to your own request');
      return;
    }
    
    setSelectedRequest(request);
    setResponseType('decline');
    setShowResponseModal(true);
  };

  const handleEventRSVP = async (request: CareRequest, responseType: 'going' | 'maybe' | 'not_going') => {
    if (!user) return;
    
    try {
      // Use the database function to update event response
      const { data, error } = await supabase
        .rpc('update_event_response', {
          p_event_request_id: request.id,
          p_responder_id: user.id,
          p_response_type: responseType
        });
      
      if (error) throw error;
      
      // Refresh data
      await fetchRequestsAndResponses(user.id);
      await fetchAllEventResponses(user.id);
      await fetchEventResponses(request.id);
    } catch (error) {
      console.error('Error submitting event RSVP:', error);
    }
  };

  const handleInviteOthers = async (request: CareRequest) => {
    setSelectedRequest(request);
    setShowInviteModal(true);
  };

  const handleInviteOthersFromResponse = async (response: CareResponse, request: CareRequest) => {
    // Create a new open block request based on the accepted response
    const openBlockRequest: CareRequest = {
      ...request,
      id: '', // Will be generated by the database
      request_type: 'open_block',
      open_block_parent_id: response.responder_id, // The care provider
      open_block_slots: 3, // Default to 3 slots, can be made configurable
      open_block_slots_used: 0
    };
    
    setSelectedRequest(openBlockRequest);
    setShowInviteModal(true);
  };

  const sendInvitations = async () => {
    if (!user || !selectedRequest) {
      alert('User or request not found');
      return;
    }

    try {
      // Create open block requests for each selected child
      for (let i = 0; i < inviteForm.selectedMembers.length; i++) {
        const childId = inviteForm.selectedMembers[i];
        const timeBlock = inviteForm.timeBlocks[i];
        
        if (!timeBlock.date || !timeBlock.startTime || !timeBlock.endTime) {
          alert(`Please fill in all time slot details for child ${i + 1}`);
          return;
        }

        // Find the child details
        const selectedChild = availableChildren.find(child => child.child_id === childId);
        if (!selectedChild) {
          alert(`Child not found for selection ${i + 1}`);
          return;
        }

        // Create a new care request for this child
        const { error: createError } = await supabase
          .from('care_requests')
          .insert({
            group_id: selectedRequest.group_id,
            requester_id: user.id, // The care provider is requesting reciprocal care
            child_id: childId, // Use the selected child's ID
            requested_date: timeBlock.date,
            start_time: timeBlock.startTime,
            end_time: timeBlock.endTime,
            request_type: 'open_block',
            status: 'pending',
            open_block_parent_id: user.id,
            open_block_slots: 1,
            open_block_slots_used: 0,
            notes: inviteForm.notes || `Reciprocal care request from ${getParentName(user.id)} for ${selectedChild.child_name}`
          });

        if (createError) {
          console.error('Error creating open block request:', createError);
          alert('Error creating invitation: ' + createError.message);
          return;
        }
      }

      // Close the modal and show success message
      setShowInviteModal(false);
      setInviteForm({
        selectedMembers: [],
        timeBlocks: [],
        notes: ''
      });
      setAvailableChildren([]);
      
      // Refresh data to show new requests
      await fetchRequestsAndResponses(user.id);
      
      alert('Invitations sent successfully! New care requests have been created for the selected children.');
    } catch (error) {
      console.error('Error sending invitations:', error);
      alert('Error sending invitations. Please try again.');
    }
  };

  const handleAcceptInvitation = async (invitation: GroupInvitation) => {
    setSelectedInvitation(invitation);
    
    // Fetch available time blocks for this invitation
    const { data: timeBlocks, error } = await supabase.rpc('get_available_time_blocks_for_invitation', {
      p_invitation_id: invitation.id
    });
    
    if (error) {
      alert('Error fetching time blocks: ' + error.message);
      return;
    }
    
    // Fetch user's children for this group
    const { data: children, error: childrenError } = await supabase.rpc('get_user_children_for_group', {
      p_user_id: user!.id,
      p_group_id: invitation.group_id
    });
    
    if (childrenError) {
      alert('Error fetching children: ' + childrenError.message);
      return;
    }
    
    setAvailableTimeBlocks(timeBlocks || []);
    setUserChildren(children || []);
    setSelectedChildId(''); // Reset selected child
    setShowAcceptInvitationModal(true);
  };

  const acceptInvitation = async (selectedTimeBlockIndex: number) => {
    // Implementation for accepting invitations
    // This would need to be updated based on your invitation system
    alert('Invitation accepted successfully!');
  };

  const addTimeBlock = () => {
    setInviteForm(prev => ({
      ...prev,
      timeBlocks: [...prev.timeBlocks, { date: '', startTime: '', endTime: '' }]
    }));
  };

  const removeTimeBlock = (index: number) => {
    setInviteForm(prev => ({
      ...prev,
      timeBlocks: prev.timeBlocks.filter((_, i) => i !== index)
    }));
  };

  const updateTimeBlock = (index: number, field: string, value: string) => {
    setInviteForm(prev => ({
      ...prev,
      timeBlocks: prev.timeBlocks.map((block, i) => 
        i === index ? { ...block, [field]: value } : block
      )
    }));
  };

  const toggleMemberSelection = (childId: string) => {
    setInviteForm(prev => {
      const isCurrentlySelected = prev.selectedMembers.includes(childId);
      const newSelectedMembers = isCurrentlySelected
        ? prev.selectedMembers.filter(id => id !== childId)
        : [...prev.selectedMembers, childId];
      
      // Calculate how many time slots we need
      const requiredTimeSlots = newSelectedMembers.length;
      let newTimeBlocks = [...prev.timeBlocks];
      
      if (isCurrentlySelected) {
        // Removing a child - remove the last time slot
        if (newTimeBlocks.length > requiredTimeSlots) {
          newTimeBlocks = newTimeBlocks.slice(0, requiredTimeSlots);
        }
      } else {
        // Adding a child - add a new time slot if needed
        while (newTimeBlocks.length < requiredTimeSlots) {
          newTimeBlocks.push({
            date: '',
            startTime: '',
            endTime: ''
          });
        }
      }
      
      return {
        ...prev,
        selectedMembers: newSelectedMembers,
        timeBlocks: newTimeBlocks
      };
    });
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    
    return days;
  };

  // New function to get days for a week
  const getDaysInWeek = (date: Date) => {
    const currentDay = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const days = [];
    
    // Get the start of the week (Sunday)
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - currentDay);
    
    // Generate 7 days starting from Sunday
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push(day);
    }
    
    return days;
  };

  // Updated navigation functions to work with both monthly and weekly views
  const handlePreviousPeriod = () => {
    if (calendarView === 'weekly') {
      // Go to previous week
      const newDate = new Date(currentDate);
      newDate.setDate(currentDate.getDate() - 7);
      setCurrentDate(newDate);
    } else {
      // Go to previous month
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    }
  };

  const handleNextPeriod = () => {
    if (calendarView === 'weekly') {
      // Go to next week
      const newDate = new Date(currentDate);
      newDate.setDate(currentDate.getDate() + 7);
      setCurrentDate(newDate);
    } else {
      // Go to next month
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    }
  };

  // Function to get the appropriate days based on view
  const getDaysForView = () => {
    if (calendarView === 'weekly') {
      return getDaysInWeek(currentDate);
    } else {
      return getDaysInMonth(currentDate);
    }
  };

  // Function to get the display title based on view
  const getDisplayTitle = () => {
    if (calendarView === 'weekly') {
      const weekDays = getDaysInWeek(currentDate);
      const startDate = weekDays[0];
      const endDate = weekDays[6];
      
      // If start and end are in the same month
      if (startDate.getMonth() === endDate.getMonth()) {
        return `${monthNames[startDate.getMonth()]} ${startDate.getDate()} - ${endDate.getDate()}, ${startDate.getFullYear()}`;
      } else if (startDate.getFullYear() === endDate.getFullYear()) {
        // Different months, same year
        return `${monthNames[startDate.getMonth()]} ${startDate.getDate()} - ${monthNames[endDate.getMonth()]} ${endDate.getDate()}, ${startDate.getFullYear()}`;
      } else {
        // Different years
        return `${monthNames[startDate.getMonth()]} ${startDate.getDate()}, ${startDate.getFullYear()} - ${monthNames[endDate.getMonth()]} ${endDate.getDate()}, ${endDate.getFullYear()}`;
      }
    } else {
      return `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    }
  };



  const getBlocksForDate = (date: Date) => {
    return scheduledCare.filter(block => { // Updated variable name
      const blockDate = parseLocalDate(block.care_date); // Updated column name
      return blockDate.toDateString() === date.toDateString();
    });
  };

  const getAllChildrenInBlock = async (block: ScheduledCare) => { // Updated type
    if (!block.care_group_id) {
      return [{ child_name: getChildName(block.child_id, undefined, block) }];
    }
    
    const { data: children, error } = await supabase.rpc('get_children_in_care_block', {
      p_care_group_id: block.care_group_id
    });
    
    if (error) {
      console.error('Error fetching children in care block:', error);
      return [{ child_name: getChildName(block.child_id, undefined, block) }];
    }
    
    return children || [{ child_name: getChildName(block.child_id, undefined, block) }];
  };

  const formatTime = (time: string) => {
    // Convert military time (HH:MM:SS) to AM/PM format (H:MM AM/PM)
    if (!time) return '';
    
    // Remove seconds if present
    const timeWithoutSeconds = time.split(':').slice(0, 2).join(':');
    
    // Parse the time
    const [hours, minutes] = timeWithoutSeconds.split(':').map(Number);
    
    // Convert to 12-hour format
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    
    // Format with leading zero for minutes
    const displayMinutes = minutes.toString().padStart(2, '0');
    
    return `${displayHours}:${displayMinutes} ${period}`;
  };

  // Helper function to parse date strings as local dates (not UTC)
  const parseLocalDate = (dateString: string) => {
    // Split the date string into year, month, day
    const [year, month, day] = dateString.split('-').map(Number);
    // Create a date object using local timezone (month is 0-indexed in JS Date)
    return new Date(year, month - 1, day);
  };

  // Updated function with new types
  const getChildName = (childId: string, request?: CareRequest, block?: ScheduledCare, response?: CareResponse) => {
    // If we have the block with child data, use that first
    if (block?.children?.full_name) {
      return block.children.full_name;
    }
    
    // If we have the request with child data, use that
    if (request?.children?.full_name) {
      return request.children.full_name;
    }
    
    // Try to find the child in all group children (for name resolution)
    const groupChild = allGroupChildren.find(c => c.id === childId);
    if (groupChild?.full_name) {
      return groupChild.full_name;
    }
    
    // Fallback to local children array (user's own children)
    const child = children.find(c => c.id === childId);
    if (child?.full_name) {
      return child.full_name;
    }
    
    // If we still don't have the name, try to fetch it directly from the database
    // This is a fallback for when the child data wasn't loaded with the blocks
    const fetchChildName = async () => {
      try {
        const { data: childData, error } = await supabase
          .from('children')
          .select('full_name')
          .eq('id', childId)
          .single();
        
        if (!error && childData?.full_name) {
          return childData.full_name;
        }
      } catch (err) {
        console.error('Error fetching child name:', err);
      }
      return `Child (${childId.slice(0, 8)}...)`;
    };
    
    // For now, return the fallback and we'll handle async fetching in the UI
    return `Child (${childId.slice(0, 8)}...)`;
  };

  const getGroupName = (groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return 'Unknown Group';
    return `${group.name} (${group.group_type === 'care' ? 'Care' : 'Event'} Group)`;
  };

  const getInitiatorName = (initiatorId: string) => {
    const profile = allProfiles.find(p => p.id === initiatorId);
    return profile?.full_name || `User (${initiatorId.slice(0, 8)}...)`;
  };

  const getResponderName = (responderId: string) => {
    const profile = allProfiles.find(p => p.id === responderId);
    return profile?.full_name || `User (${responderId.slice(0, 8)}...)`;
  };

  const getParentName = (parentId: string) => {
    // If allProfiles is empty, try to fetch it again
    if (allProfiles.length === 0) {
      fetchAllProfiles();
      return `Parent (${parentId.slice(0, 8)}...)`;
    }
    
    const profile = allProfiles.find(p => p.id === parentId);
    return profile?.full_name || `Parent (${parentId.slice(0, 8)}...)`;
  };



  // Updated function with new types
  const findOriginalRequestForBlock = (block: ScheduledCare): CareRequest | null => {
    const foundRequest = requests.find(request => request.id === block.related_request_id);
    return foundRequest || null;
  };

  const handleBlockDoubleClick = async (block: ScheduledCare) => { // Updated type
    
    // Check if this is an event block
    if (block.care_type === 'event') {
      await handleEventBlockDoubleClick(block);
      return;
    }
    
    // Check if the logged-in user is the responder (care provider) of the original request
    const originalRequest = findOriginalRequestForBlock(block);
    if (originalRequest) {
      // Find the accepted response for this request
      const acceptedResponse = responses.find(r => 
        r.request_id === originalRequest.id && r.status === 'accepted'
      );
      
      // Only show invite option if the logged-in user is the responder (Parent B)
      if (acceptedResponse && acceptedResponse.responder_id === user?.id && block.care_type === 'provided') {
        const shouldInviteOthers = confirm(
          `You are providing care for ${getChildName(block.child_id, undefined, block)} on ${block.care_date}.\n\nWould you like to invite other group members to join this care block?`
        );
        
        if (shouldInviteOthers) {
          // For now, use all profiles except the current user and original requester
          const availableProfiles = allProfiles.filter(profile => 
            profile.id !== user?.id && profile.id !== originalRequest.requester_id
          );
          
          if (availableProfiles.length === 0) {
            alert('No other group members available to invite.');
            return;
          }
          
          // Create an open block request based on this care block
          const openBlockRequest: CareRequest = {
            ...originalRequest,
            id: '', // Will be generated by the database
            request_type: 'open_block',
            open_block_parent_id: block.parent_id, // The care provider
            open_block_slots: Math.min(availableProfiles.length, 3), // Limit to available profiles or 3, whichever is smaller
            open_block_slots_used: 0
          };
          
          setSelectedRequest(openBlockRequest);
          setAvailableChildren(availableProfiles.map(profile => ({
            child_id: profile.id, // Using profile ID as child ID for now
            child_name: profile.full_name || 'Unknown',
            parent_id: profile.id,
            parent_name: profile.full_name || 'Unknown'
          })));
          setShowInviteModal(true);
          return;
        }
      }
    }
    
    // Default behavior: Show daily schedule popup for the block's date
    // Fix timezone issue by parsing the date properly
    const blockDate = parseLocalDate(block.care_date);
    setSelectedDateForDailyView(blockDate);
    setShowDailyScheduleModal(true);
  };

  const acceptResponse = async (responseId: string, requestId: string) => {
    if (!user) {
      alert('User not found');
      return;
    }

    try {
      // Call the create_care_exchange function to accept the response and create blocks
      const { error: exchangeError } = await supabase.rpc('create_care_exchange', {
        p_request_id: requestId,
        p_response_id: responseId
      });

      if (exchangeError) {
        console.error('Error creating care exchange:', exchangeError);
        alert('Error accepting response: ' + exchangeError.message);
        return;
      }

      // Refresh data to show the new scheduled blocks
      await fetchRequestsAndResponses(user.id);
      await fetchScheduledCare(user.id, currentDate); // Updated function name
      
      alert('Response accepted successfully! Care blocks have been created.');
    } catch (error) {
      console.error('Error accepting response:', error);
      alert('Error accepting response. Please try again.');
    }
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  const days = getDaysForView();
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-end mb-6">
        <LogoutButton />
      </div>
      
      {/* Navigation Buttons */}
      <div className="flex flex-wrap gap-4 mb-8">
        <button 
          onClick={() => router.push('/dashboard')}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
        >
          Profile
        </button>
        <button 
          onClick={() => router.push('/messages')}
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
        >
          Messages
        </button>
        <button 
          onClick={() => router.push('/schedule')}
          className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium"
        >
          Schedule
        </button>

        <button 
          onClick={() => router.push('/chats')}
          className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
        >
          Chats
        </button>
        <button 
          onClick={() => router.push('/activities')}
          className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium"
        >
          Activities
        </button>
      </div>
      
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Schedule</h1>
        <p className="text-gray-600">Manage your childcare schedule and requests</p>
      </div>

      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={handlePreviousPeriod}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Previous
          </button>
          <h2 className="text-xl font-semibold text-gray-900">
            {getDisplayTitle()}
          </h2>
          <button
            onClick={handleNextPeriod}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Next
          </button>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setCalendarView('weekly')}
            className={`px-3 py-1 text-sm font-medium rounded-md ${
              calendarView === 'weekly'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Weekly
          </button>
          <button
            onClick={() => setCalendarView('monthly')}
            className={`px-3 py-1 text-sm font-medium rounded-md ${
              calendarView === 'monthly'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Monthly
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="grid grid-cols-7 gap-px bg-gray-200">
          {/* Day headers */}
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="bg-gray-50 px-3 py-2 text-sm font-medium text-gray-900 text-center">
              {day}
            </div>
          ))}
          
          {/* Calendar days */}
          {days.map((day, index) => (
            <div
              key={index}
              className={`${calendarView === 'weekly' ? 'min-h-[200px]' : 'min-h-[120px]'} bg-white p-2 ${
                day ? 'hover:bg-gray-50' : 'bg-gray-100'
              }`}
            >
              {day && (
                <>
                  <div className="text-sm font-medium text-gray-900 mb-1">
                    {day.getDate()}
                    {calendarView === 'weekly' && (
                      <span className="text-xs text-gray-500 ml-1">
                        {day.toLocaleDateString('en-US', { month: 'short' })}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {getBlocksForDate(day).map(block => {
  
                      const isUserProviding = block.parent_id === user?.id && block.care_type === 'provided';
                      const isUserChildNeeding = block.care_type === 'needed' && children.some(c => c.id === block.child_id);
                      
                      // Determine the visual style based on user context
                      let blockStyle = '';
                      let blockText = '';
                      
                      if (isUserProviding) {
                        // User is providing care for someone else's child
                        blockStyle = 'bg-green-100 text-green-800 border border-green-300';
                        blockText = `Providing care for ${block.children?.full_name || getChildName(block.child_id, undefined, block)}`;
                      } else if (isUserChildNeeding) {
                        // User's child needs care (someone else is providing)
                        // For "needed" blocks, we need to find the providing parent from the related request/response
                        const originalRequest = findOriginalRequestForBlock(block);
                        
                        let providingParentName = 'Unknown Parent'; // Default to 'Unknown Parent'
                        
                        if (originalRequest) {
                          
                          // Find the accepted response for this request
                          const acceptedResponse = responses.find(r => 
                            r.request_id === originalRequest.id && r.status === 'accepted'
                          );
                          if (acceptedResponse) {
                            // Determine the providing parent based on who the logged-in user is
                            let providingParentId: string;
                            
                            if (user?.id === acceptedResponse.responder_id) {
                              // Logged-in user is the responder (accepted the request)
                              // So the providing parent is the requester
                              providingParentId = originalRequest.requester_id;
                              } else if (user?.id === originalRequest.requester_id) {
                              // Logged-in user is the requester (made the request)
                              // So the providing parent is the responder
                              providingParentId = acceptedResponse.responder_id;
                              } else {
                              // Fallback: use responder_id as providing parent
                              providingParentId = acceptedResponse.responder_id;
                              }
                            
                            providingParentName = getParentName(providingParentId);
                          } else {
                            // No accepted response found
                          }
                        }
                        
                        blockStyle = 'bg-red-100 text-red-800 border border-red-300';
                        blockText = `${providingParentName} providing care for ${block.children?.full_name || getChildName(block.child_id, undefined, block)}`;
                        } else {
                        // Other care arrangements
                        if (block.care_type === 'needed') {
                          // For "needed" blocks, show who is providing care
                          const originalRequest = findOriginalRequestForBlock(block);
                          
                          let providingParentName = 'Unknown Parent'; // Default to 'Unknown Parent'
                          
                          if (originalRequest) {
                            // Find the accepted response for this request
                            const acceptedResponse = responses.find(r => 
                              r.request_id === originalRequest.id && r.status === 'accepted'
                            );
                            if (acceptedResponse) {
                              // Determine the providing parent based on who the logged-in user is
                              let providingParentId: string;
                              
                              if (user?.id === acceptedResponse.responder_id) {
                                // Logged-in user is the responder (accepted the request)
                                // So the providing parent is the requester
                                providingParentId = originalRequest.requester_id;
                                } else if (user?.id === originalRequest.requester_id) {
                                // Logged-in user is the requester (made the request)
                                // So the providing parent is the responder
                                providingParentId = acceptedResponse.responder_id;
                                } else {
                                // Fallback: use responder_id as providing parent
                                providingParentId = acceptedResponse.responder_id;
                                }
                              
                              providingParentName = getParentName(providingParentId);
                            }
                          }
                          
                          blockStyle = 'bg-blue-100 text-blue-800 border border-blue-300';
                          blockText = `${providingParentName} providing care for ${block.children?.full_name || getChildName(block.child_id, undefined, block)}`;
                        } else {
                          // For "provided" blocks
                          blockStyle = 'bg-gray-100 text-gray-800 border border-gray-300';
                          blockText = `Providing care for ${block.children?.full_name || getChildName(block.child_id, undefined, block)}`;
                        }
                      }
                      
                      return (
                        <div
                          key={block.id}
                          className={`text-xs p-1 rounded cursor-pointer ${blockStyle}`}
                          onDoubleClick={() => handleBlockDoubleClick(block)}
                          title={`${block.care_type === 'needed' ? 'Care Needed' : 'Care Provided'} - ${formatTime(block.start_time)} to ${formatTime(block.end_time)} - ${block.children?.full_name || getChildName(block.child_id, undefined, block)}`}
                        >
                          <div className="font-medium truncate">
                            {blockText}
                          </div>
                          <div className="text-xs opacity-75">
                            {formatTime(block.start_time)} - {formatTime(block.end_time)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}


             {/* Create Care Request Modal */}
       {showCreateCareRequest && (
         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
           <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
             <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Create Care Request</h3>
        <button
                onClick={() => setShowCreateCareRequest(false)}
                className="text-gray-400 hover:text-gray-600"
        >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
        </button>
      </div>
             <div className="space-y-4">
               <div>
                 <label className="block text-sm font-medium text-gray-700">Request Type</label>
                                   <select
                    value={requestForm.requestType}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setRequestForm(prev => ({ 
                      ...prev, 
                     requestType: e.target.value as 'simple' | 'reciprocal' | 'open_block' 
                    }))}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                   <option value="simple">Simple Request</option>
                   <option value="reciprocal">Reciprocal Request</option>
                   <option value="open_block">Open Block Request</option>
                 </select>
                 <p className="text-xs text-gray-500 mt-1">
                   {requestForm.requestType === 'simple' && 'Direct request for care'}
                   {requestForm.requestType === 'reciprocal' && 'Request with reciprocal care exchange'}
                   {requestForm.requestType === 'event' && 'Group event or activity'}
                   {requestForm.requestType === 'open_block' && 'Open time block to other group members'}
                 </p>
               </div>
               
               <div>
                 <label className="block text-sm font-medium text-gray-700">Group</label>
                 <select
                   value={requestForm.groupId}
                   onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setRequestForm(prev => ({ ...prev, groupId: e.target.value }))}
                   className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                 >
                   <option value="">Select a group</option>
                   {getGroupsByType('care').map(group => (
                     <option key={group.id} value={group.id}>{group.name} (Care Group)</option>
                   ))}
                 </select>
                 {getGroupsByType('care').length === 0 && (
                   <p className="text-xs text-red-500 mt-1">No care groups available. Create a care group first.</p>
                 )}
               </div>
               
               <div>
                 <label className="block text-sm font-medium text-gray-700">Child</label>
                 <select
                   value={requestForm.childId}
                   onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setRequestForm(prev => ({ ...prev, childId: e.target.value }))}
                   className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                 >
                   <option value="">Select a child</option>
                   {children.map(child => (
                     <option key={child.id} value={child.id}>{child.full_name}</option>
                   ))}
                 </select>
               </div>
               
               <div>
                 <label className="block text-sm font-medium text-gray-700">Date (Local Time)</label>
                 <input
                   type="date"
                   value={requestForm.requestedDate}
                   onChange={(e: any) => setRequestForm(prev => ({ ...prev, requestedDate: e.target.value }))}
                   className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                 />
                 <p className="text-xs text-gray-500 mt-1">Date will be stored in your local timezone</p>
               </div>
               
               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="block text-sm font-medium text-gray-700">Start Time</label>
                   <input
                     type="time"
                     value={requestForm.startTime}
                     onChange={(e: any) => setRequestForm(prev => ({ ...prev, startTime: e.target.value }))}
                     className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                   />
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-gray-700">End Time</label>
                   <input
                     type="time"
                     value={requestForm.endTime}
                     onChange={(e: any) => setRequestForm(prev => ({ ...prev, endTime: e.target.value }))}
                     className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                   />
                 </div>
               </div>

               {/* Event-specific fields */}
               {requestForm.requestType === 'event' && (
                 <>
                   <div>
                     <label className="block text-sm font-medium text-gray-700">Event Title</label>
                     <input
                       type="text"
                       value={requestForm.eventTitle}
                       onChange={(e: any) => setRequestForm(prev => ({ ...prev, eventTitle: e.target.value }))}
                       className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                       placeholder="e.g., Basketball Game, Park Playdate"
                     />
                   </div>
                   <div>
                     <label className="block text-sm font-medium text-gray-700">Event Description</label>
                     <textarea
                       value={requestForm.eventDescription}
                       onChange={(e: any) => setRequestForm(prev => ({ ...prev, eventDescription: e.target.value }))}
                       className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                       rows={3}
                       placeholder="Describe the event or activity..."
                     />
                   </div>
                   <div>
                     <label className="block text-sm font-medium text-gray-700">Event Location</label>
                     <input
                       type="text"
                       value={requestForm.eventLocation}
                       onChange={(e: any) => setRequestForm(prev => ({ ...prev, eventLocation: e.target.value }))}
                       className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                       placeholder="e.g., Central Park, Community Center"
                     />
                   </div>

                   
                   {/* Recurring Event Options */}
                   <div>
                     <label className="flex items-center">
                       <input
                         type="checkbox"
                         checked={requestForm.isRecurring}
                         onChange={(e: any) => setRequestForm(prev => ({ ...prev, isRecurring: e.target.checked }))}
                         className="mr-2"
                       />
                       <span className="text-sm font-medium text-gray-700">Make this a recurring event</span>
                     </label>
                   </div>
                   
                   {requestForm.isRecurring && (
                     <>
                       <div>
                         <label className="block text-sm font-medium text-gray-700">Recurrence Pattern</label>
                         <select
                           value={requestForm.recurrencePattern}
                           onChange={(e: any) => setRequestForm(prev => ({ ...prev, recurrencePattern: e.target.value as 'weekly' | 'monthly' | 'yearly' }))}
                           className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                         >
                           <option value="weekly">Weekly</option>
                           <option value="monthly">Monthly</option>
                           <option value="yearly">Yearly</option>
                         </select>
                       </div>
                       <div>
                         <label className="block text-sm font-medium text-gray-700">End Date</label>
                         <input
                           type="date"
                           value={requestForm.recurrenceEndDate}
                           onChange={(e: any) => setRequestForm(prev => ({ ...prev, recurrenceEndDate: e.target.value }))}
                           className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                           min={requestForm.requestedDate}
                     />
                   </div>
                     </>
                   )}
                 </>
               )}

               {/* Open Block specific fields */}
               {requestForm.requestType === 'open_block' && (
                 <div>
                   <label className="block text-sm font-medium text-gray-700">Available Slots</label>
                   <input
                     type="number"
                     min="1"
                     max="10"
                     value={requestForm.openBlockSlots}
                     onChange={(e: any) => setRequestForm(prev => ({ ...prev, openBlockSlots: parseInt(e.target.value) || 1 }))}
                     className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                   />
                   <p className="text-xs text-gray-500 mt-1">How many additional children can join this time block</p>
                 </div>
               )}

               <div>
                 <label className="block text-sm font-medium text-gray-700">Notes</label>
                 <textarea
                   value={requestForm.notes}
                   onChange={(e: any) => setRequestForm(prev => ({ ...prev, notes: e.target.value }))}
                   className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                   rows={3}
                   placeholder="Additional notes or special instructions..."
                 />
               </div>
             </div>
             <div className="mt-6 flex space-x-3">
               <button
                 onClick={createCareRequest}
                 className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
               >
                 Create Request
               </button>
               <button
                 onClick={() => setShowCreateCareRequest(false)}
                 className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
               >
                 Cancel
               </button>
             </div>
           </div>
         </div>
       )}

      {/* Create Event Request Modal */}
      {showCreateEventRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Create Event</h3>
              <button
                onClick={() => setShowCreateEventRequest(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Group</label>
                <select
                  value={requestForm.groupId}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setRequestForm(prev => ({ ...prev, groupId: e.target.value }))}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="">Select a group</option>
                  {getGroupsByType('event').map(group => (
                    <option key={group.id} value={group.id}>{group.name} (Event Group)</option>
                  ))}
                </select>
                {getGroupsByType('event').length === 0 && (
                  <p className="text-xs text-red-500 mt-1">No event groups available. Create an event group first.</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Child</label>
                <select
                  value={requestForm.childId}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setRequestForm(prev => ({ ...prev, childId: e.target.value }))}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="">Select a child</option>
                  {children.map(child => (
                    <option key={child.id} value={child.id}>{child.full_name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Date (Local Time)</label>
                <input
                  type="date"
                  value={requestForm.requestedDate}
                  onChange={(e: any) => setRequestForm(prev => ({ ...prev, requestedDate: e.target.value }))}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                />
                <p className="text-xs text-gray-500 mt-1">Date will be stored in your local timezone</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Start Time</label>
                  <input
                    type="time"
                    value={requestForm.startTime}
                    onChange={(e: any) => setRequestForm(prev => ({ ...prev, startTime: e.target.value }))}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">End Time</label>
                  <input
                    type="time"
                    value={requestForm.endTime}
                    onChange={(e: any) => setRequestForm(prev => ({ ...prev, endTime: e.target.value }))}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
              </div>

              {/* Event-specific fields */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Event Title</label>
                <input
                  type="text"
                  value={requestForm.eventTitle}
                  onChange={(e: any) => setRequestForm(prev => ({ ...prev, eventTitle: e.target.value }))}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="e.g., Basketball Game, Park Playdate"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Event Description</label>
                <textarea
                  value={requestForm.eventDescription}
                  onChange={(e: any) => setRequestForm(prev => ({ ...prev, eventDescription: e.target.value }))}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  rows={3}
                  placeholder="Describe the event or activity..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Event Location</label>
                <input
                  type="text"
                  value={requestForm.eventLocation}
                  onChange={(e: any) => setRequestForm(prev => ({ ...prev, eventLocation: e.target.value }))}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="e.g., Central Park, Community Center"
                />
              </div>

              {/* Recurring event options */}
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={requestForm.isRecurring}
                    onChange={(e: any) => setRequestForm(prev => ({ ...prev, isRecurring: e.target.checked }))}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">Make this a recurring event</span>
                </label>
              </div>

              {requestForm.isRecurring && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Recurrence Pattern</label>
                    <select
                      value={requestForm.recurrencePattern}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setRequestForm(prev => ({ 
                        ...prev, 
                        recurrencePattern: e.target.value as 'weekly' | 'monthly' | 'yearly' 
                      }))}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    >
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">End Date</label>
                    <input
                      type="date"
                      value={requestForm.recurrenceEndDate}
                      onChange={(e: any) => setRequestForm(prev => ({ ...prev, recurrenceEndDate: e.target.value }))}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  value={requestForm.notes}
                  onChange={(e: any) => setRequestForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  rows={3}
                />
              </div>
            </div>
            <div className="mt-6 flex space-x-3">
              <button
                onClick={createCareRequest}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Create Event
              </button>
              <button
                onClick={() => setShowCreateEventRequest(false)}
                 className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
               >
                 Cancel
               </button>
             </div>
           </div>
         </div>
       )}

      {/* Response Modal */}
      {showResponseModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">Respond to Care Request</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Response Type</label>
                                 <select
                   value={responseType}
                   onChange={(e: any) => setResponseType(e.target.value as 'accept' | 'decline')}
                   className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                 >
                                       <option value="accept">Accept</option>
                    <option value="decline">Decline</option>
                 </select>
               </div>
                                 {responseType === 'accept' && (
                 <>
                   <div>
                     <label className="block text-sm font-medium text-gray-700">Reciprocal Date</label>
                     <input
                       type="date"
                       value={responseForm.reciprocalDate}
                       onChange={(e: any) => setResponseForm(prev => ({ ...prev, reciprocalDate: e.target.value }))}
                       className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                     />
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                     <div>
                       <label className="block text-sm font-medium text-gray-700">Start Time</label>
                       <input
                         type="time"
                         value={responseForm.reciprocalStartTime}
                         onChange={(e: any) => setResponseForm(prev => ({ ...prev, reciprocalStartTime: e.target.value }))}
                         className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                       />
                     </div>
                     <div>
                       <label className="block text-sm font-medium text-gray-700">End Time</label>
                       <input
                         type="time"
                         value={responseForm.reciprocalEndTime}
                         onChange={(e: any) => setResponseForm(prev => ({ ...prev, reciprocalEndTime: e.target.value }))}
                         className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                       />
                     </div>
                   </div>
                   <div>
                     <label className="block text-sm font-medium text-gray-700">Reciprocal Child</label>
                     <select
                       value={responseForm.reciprocalChildId}
                       onChange={(e: any) => setResponseForm(prev => ({ ...prev, reciprocalChildId: e.target.value }))}
                       className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                     >
                       <option value="">Select a child</option>
                       {children.map(child => (
                         <option key={child.id} value={child.id}>{child.full_name}</option>
                       ))}
                     </select>
                   </div>
                 </>
               )}
               <div>
                 <label className="block text-sm font-medium text-gray-700">Notes</label>
                 <textarea
                   value={responseForm.notes}
                   onChange={(e: any) => setResponseForm(prev => ({ ...prev, notes: e.target.value }))}
                   className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                   rows={3}
                 />
               </div>
            </div>
            <div className="mt-6 flex space-x-3">
              <button
                onClick={respondToCareRequest}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Submit Response
              </button>
              <button
                onClick={() => setShowResponseModal(false)}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

             {/* Care Requests Section */}
       <div className="mt-8">
               <div className="flex justify-between items-center mb-4">
                 <h3 className="text-lg font-medium text-gray-900">Care Requests</h3>
                 <button
                   onClick={() => setShowCreateCareRequest(true)}
                   className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                 >
                   Create Care Request
                 </button>
               </div>
         <div className="space-y-4">
                 {requests.filter(request => request.request_type !== 'event').map(request => (
             <div key={request.id} className="bg-white rounded-lg border p-4">
               <div className="flex justify-between items-start">
                 <div className="flex-1">
                   <div className="flex items-center gap-2 mb-2">
                     <h4 className="font-medium text-gray-900">
                       {request.request_type === 'event' && request.event_title 
                         ? request.event_title 
                         : `Care Request for ${getChildName(request.child_id, request)}`
                       }
                     </h4>
                     <span className={`px-2 py-1 text-xs rounded-full ${
                       request.request_type === 'simple' ? 'bg-blue-100 text-blue-800' :
                       request.request_type === 'reciprocal' ? 'bg-purple-100 text-purple-800' :
                       request.request_type === 'event' ? 'bg-green-100 text-green-800' :
                       'bg-orange-100 text-orange-800'
                     }`}>
                       {request.request_type === 'simple' ? 'Simple' :
                        request.request_type === 'reciprocal' ? 'Reciprocal' :
                        request.request_type === 'event' ? 'Event' : 'Open Block'}
                     </span>
                   </div>
                   <p className="text-sm text-gray-600">
                     {request.requested_date} • {formatTime(request.start_time)} - {formatTime(request.end_time)}
                   </p>
                   <p className="text-sm text-gray-600">
                     Group: {getGroupName(request.group_id)} • Requested by: {getInitiatorName(request.requester_id)}
                   </p>
                   {request.request_type === 'event' && request.event_description && (
                     <p className="text-sm text-gray-600 mt-1">{request.event_description}</p>
                   )}
                   {request.request_type === 'event' && request.event_location && (
                     <p className="text-sm text-gray-600 mt-1">
                       <span className="font-medium">Location:</span> {request.event_location}
                     </p>
                   )}

                   {request.request_type === 'event' && request.event_rsvp_deadline && (
                     <p className="text-sm text-gray-600 mt-1">
                       <span className="font-medium">RSVP Deadline:</span> {new Date(request.event_rsvp_deadline).toLocaleString()}
                     </p>
                   )}
                   {request.request_type === 'open_block' && request.open_block_slots && (
                     <p className="text-sm text-gray-600 mt-1">
                       Available slots: {request.open_block_slots - (request.open_block_slots_used || 0)}/{request.open_block_slots}
                     </p>
                   )}
                   {request.notes && (
                     <p className="text-sm text-gray-600 mt-1">{request.notes}</p>
                   )}
                 </div>
                 <div className="flex space-x-2 ml-4">
                   {/* Show different buttons based on request type */}
                   {request.requester_id !== user?.id && (
                     <>
                       {request.request_type === 'event' ? (
                         <>
                           {(() => {
                             const userResponse = eventResponses.find(r => r.event_request_id === request.id && r.responder_id === user?.id);
                             return (
                               <>
                                 <button
                                   onClick={() => handleEventRSVP(request, 'going')}
                                   className={`px-3 py-1 text-sm rounded ${
                                     userResponse?.response_type === 'going' 
                                       ? 'bg-green-600 text-white' 
                                       : userResponse?.response_type === 'maybe' || userResponse?.response_type === 'not_going'
                                       ? 'bg-gray-300 text-gray-700 hover:bg-green-600 hover:text-white'
                                       : 'bg-green-600 text-white hover:bg-green-700'
                                   }`}
                                 >
                                   Going
                                 </button>
                                 <button
                                   onClick={() => handleEventRSVP(request, 'maybe')}
                                   className={`px-3 py-1 text-sm rounded ${
                                     userResponse?.response_type === 'maybe' 
                                       ? 'bg-yellow-600 text-white' 
                                       : userResponse?.response_type === 'going' || userResponse?.response_type === 'not_going'
                                       ? 'bg-gray-300 text-gray-700 hover:bg-yellow-600 hover:text-white'
                                       : 'bg-yellow-600 text-white hover:bg-yellow-700'
                                   }`}
                                 >
                                   Maybe
                                 </button>
                                 <button
                                   onClick={() => handleEventRSVP(request, 'not_going')}
                                   className={`px-3 py-1 text-sm rounded ${
                                     userResponse?.response_type === 'not_going' 
                                       ? 'bg-red-600 text-white' 
                                       : userResponse?.response_type === 'going' || userResponse?.response_type === 'maybe'
                                       ? 'bg-gray-300 text-gray-700 hover:bg-red-600 hover:text-white'
                                       : 'bg-red-600 text-white hover:bg-red-700'
                                   }`}
                                 >
                                   Not Going
                                 </button>
                               </>
                             );
                           })()}
                         </>
                       ) : (
                         <>
                           {!responses.some(r => r.request_id === request.id) && (
                     <>
                       <button
                         onClick={() => handleAgreeToRequest(request)}
                         className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                       >
                         Agree
                       </button>
                       <button
                         onClick={() => handleRejectRequest(request)}
                         className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                       >
                         Reject
                       </button>
                     </>
                   )}
                         </>
                       )}
                     </>
                   )}
                 </div>
               </div>
             </div>
           ))}
         </div>
       </div>

       {/* Events Section */}
       <div className="mt-8">
         <div className="flex justify-between items-center mb-4">
           <h3 className="text-lg font-medium text-gray-900">Events</h3>
           <button
             onClick={() => {
               setShowCreateEventRequest(true);
               setRequestForm({
                 groupId: '',
                 childId: '',
                 requestedDate: '',
                 startTime: '',
                 endTime: '',
                 notes: '',
                 requestType: 'event',
                 eventTitle: '',
                 eventDescription: '',
                 eventLocation: '',
                 eventRSVPDeadline: '',
                 eventEditDeadline: '',
                 isRecurring: false,
                 recurrencePattern: 'weekly',
                 recurrenceEndDate: '',
                 openBlockSlots: 1
               });
             }}
             className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
           >
             Create Event
           </button>
                 </div>
         <div className="space-y-4">
           {requests.filter(request => request.request_type === 'event').map(request => (
             <div key={request.id} className="bg-white rounded-lg border p-4">
               <div className="flex justify-between items-start">
                 <div className="flex-1">
                   <div className="flex items-center gap-2 mb-2">
                     <h4 className="font-medium text-gray-900">
                       {request.event_title || `Event for ${getChildName(request.child_id, request)}`}
                     </h4>
                     <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                       Event
                     </span>
                   </div>
                   <p className="text-sm text-gray-600">
                     {request.requested_date} • {formatTime(request.start_time)} - {formatTime(request.end_time)}
                   </p>
                   <p className="text-sm text-gray-600">
                     Group: {getGroupName(request.group_id)} • Created by: {getInitiatorName(request.requester_id)}
                   </p>
                   {request.event_description && (
                     <p className="text-sm text-gray-600 mt-1">{request.event_description}</p>
                   )}
                   {request.event_location && (
                     <p className="text-sm text-gray-600 mt-1">
                       <span className="font-medium">Location:</span> {request.event_location}
                     </p>
                   )}
                   {request.notes && (
                     <p className="text-sm text-gray-600 mt-1">{request.notes}</p>
                   )}
                 </div>
                 <div className="flex space-x-2 ml-4">
                   {(() => {
                     const userResponse = eventResponses.find(r => r.event_request_id === request.id && r.responder_id === user?.id);
                     return (
                       <>
                         <button
                           onClick={() => handleEventRSVP(request, 'going')}
                           className={`px-3 py-1 text-sm rounded ${
                             userResponse?.response_type === 'going' 
                               ? 'bg-green-600 text-white' 
                               : userResponse?.response_type === 'maybe' || userResponse?.response_type === 'not_going'
                               ? 'bg-gray-300 text-gray-700 hover:bg-green-600 hover:text-white'
                               : 'bg-green-600 text-white hover:bg-green-700'
                           }`}
                         >
                           Going
                         </button>
                         <button
                           onClick={() => handleEventRSVP(request, 'maybe')}
                           className={`px-3 py-1 text-sm rounded ${
                             userResponse?.response_type === 'maybe' 
                               ? 'bg-yellow-600 text-white' 
                               : userResponse?.response_type === 'going' || userResponse?.response_type === 'not_going'
                               ? 'bg-gray-300 text-gray-700 hover:bg-yellow-600 hover:text-white'
                               : 'bg-yellow-600 text-white hover:bg-yellow-700'
                           }`}
                         >
                           Maybe
                         </button>
                         <button
                           onClick={() => handleEventRSVP(request, 'not_going')}
                           className={`px-3 py-1 text-sm rounded ${
                             userResponse?.response_type === 'not_going' 
                               ? 'bg-red-600 text-white' 
                               : userResponse?.response_type === 'going' || userResponse?.response_type === 'maybe'
                               ? 'bg-gray-300 text-gray-700 hover:bg-red-600 hover:text-white'
                               : 'bg-red-600 text-white hover:bg-red-700'
                           }`}
                         >
                           Not Going
                         </button>
                       </>
                     );
                   })()}
                 </div>
               </div>
             </div>
           ))}
         </div>
       </div>

       {/* Responses List - Show responses for requests where the logged-in user is the creator */}
       {responses.length > 0 && (
         <div className="mt-8">
           <h3 className="text-lg font-medium text-gray-900 mb-4">Responses to Your Requests</h3>
           <div className="space-y-4">
             {responses
               .filter(response => {
                 const request = requests.find(r => r.id === response.request_id);
                 return request && request.requester_id === user?.id;
               })
               .map(response => {
                 const request = requests.find(r => r.id === response.request_id);
                 if (!request) return null;
                 
                 return (
                   <div key={response.id} className="bg-white rounded-lg border p-4">
                     <div className="flex justify-between items-start">
                       <div className="flex-1">
                         <div className="flex items-center gap-2 mb-2">
                           <h4 className="font-medium text-gray-900">
                             Response from {getResponderName(response.responder_id)}
                           </h4>
                           <span className={`px-2 py-1 text-xs rounded-full ${
                             response.response_type === 'accept' ? 'bg-green-100 text-green-800' :
                             response.response_type === 'decline' ? 'bg-red-100 text-red-800' :
                             'bg-yellow-100 text-yellow-800'
                           }`}>
                             {response.response_type === 'accept' ? 'Accepted' :
                              response.response_type === 'decline' ? 'Declined' : 'Pending'}
                           </span>
                         </div>
                         <p className="text-sm text-gray-600">
                           For: {getChildName(request.child_id, request)} on {request.requested_date} • {formatTime(request.start_time)} - {formatTime(request.end_time)}
                         </p>
                         {response.response_type === 'accept' && response.reciprocal_date && (
                           <div className="mt-2 p-3 bg-blue-50 rounded-md">
                             <p className="text-sm font-medium text-blue-900">Reciprocal Care Offered:</p>
                             <p className="text-sm text-blue-700">
                               {getChildName(response.reciprocal_child_id || '', undefined, undefined, response)} on {response.reciprocal_date} • {formatTime(response.reciprocal_start_time || '')} - {formatTime(response.reciprocal_end_time || '')}
                             </p>
                           </div>
                         )}
                         {response.response_notes && (
                           <p className="text-sm text-gray-600 mt-1">Notes: {response.response_notes}</p>
                         )}
                       </div>
                       <div className="flex space-x-2 ml-4">
                         {response.response_type === 'accept' && response.status === 'pending' && (
                           <button
                             onClick={() => acceptResponse(response.id, response.request_id)}
                             className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                           >
                             Accept Response
                           </button>
                         )}

                       </div>
                     </div>
                   </div>
                 );
               })}
           </div>
         </div>
       )}

      {/* Daily Schedule Modal */}
      {showDailyScheduleModal && selectedDateForDailyView && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">
                Daily Schedule - {selectedDateForDailyView.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </h3>
              <button
                onClick={() => setShowDailyScheduleModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              {getBlocksForDate(selectedDateForDailyView).map(block => {
                const isUserProviding = block.parent_id === user?.id && block.care_type === 'provided';
                const isUserChildNeeding = block.care_type === 'needed' && children.some(c => c.id === block.child_id);
                
                let blockStyle = '';
                let blockText = '';
                
                if (isUserProviding) {
                  blockStyle = 'bg-green-100 text-green-800 border border-green-300';
                  blockText = `Providing care for ${block.children?.full_name || getChildName(block.child_id, undefined, block)}`;
                } else if (isUserChildNeeding) {
                  // For "needed" blocks, we need to find the providing parent from the related request/response
                  const originalRequest = findOriginalRequestForBlock(block);
                  
                  let providingParentName = 'Unknown Parent'; // Default to 'Unknown Parent'
                  
                  if (originalRequest) {
                    // Find the accepted response for this request
                    const acceptedResponse = responses.find(r => 
                      r.request_id === originalRequest.id && r.status === 'accepted'
                    );
                    if (acceptedResponse) {
                      providingParentName = getParentName(acceptedResponse.responder_id);
                    }
                  }
                  
                  blockStyle = 'bg-red-100 text-red-800 border border-red-300';
                  blockText = `${providingParentName} providing care for ${block.children?.full_name || getChildName(block.child_id, undefined, block)}`;
                } else {
                  if (block.care_type === 'needed') {
                    // For "needed" blocks, show who is providing care
                    const originalRequest = findOriginalRequestForBlock(block);
                    
                    let providingParentName = 'Unknown Parent'; // Default to 'Unknown Parent'
                    
                    if (originalRequest) {
                      // Find the accepted response for this request
                      const acceptedResponse = responses.find(r => 
                        r.request_id === originalRequest.id && r.status === 'accepted'
                      );
                      if (acceptedResponse) {
                        providingParentName = getParentName(acceptedResponse.responder_id);
                      }
                    }
                    
                    blockStyle = 'bg-blue-100 text-blue-800 border border-blue-300';
                    blockText = `${providingParentName} providing care for ${block.children?.full_name || getChildName(block.child_id, undefined, block)}`;
                  } else {
                    blockStyle = 'bg-gray-100 text-gray-800 border border-gray-300';
                    blockText = `Providing care for ${block.children?.full_name || getChildName(block.child_id, undefined, block)}`;
                  }
                }
                
                return (
                  <div key={block.id} className={`p-4 rounded-lg ${blockStyle}`}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-medium text-sm mb-1">{blockText}</div>
                        <div className="text-sm opacity-75">
                          {formatTime(block.start_time)} - {formatTime(block.end_time)}
                        </div>
                        {block.notes && (
                          <div className="text-sm mt-2 p-2 bg-white bg-opacity-50 rounded">
                            Notes: {block.notes}
                          </div>
                        )}
                      </div>
                      <div className="text-xs opacity-75 ml-4">
                        {block.care_type === 'needed' ? 'Care Needed' : 'Care Provided'}
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {getBlocksForDate(selectedDateForDailyView).length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No scheduled care for this date
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Invite Others Modal */}
      {showInviteModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">
                Invite Others to Care Block
              </h3>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Care Block Details</h4>
                <div className="bg-gray-50 p-3 rounded-md">
                  <p className="text-sm text-gray-600">
                    <strong>Date:</strong> {selectedRequest.requested_date}
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Time:</strong> {formatTime(selectedRequest.start_time)} - {formatTime(selectedRequest.end_time)}
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Child:</strong> {getChildName(selectedRequest.child_id, selectedRequest)}
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Group:</strong> {getGroupName(selectedRequest.group_id)}
                  </p>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-2">Select Children to Invite</h4>
                <div className="space-y-2">
                  {availableChildren.length > 0 ? (
                    availableChildren.map(child => (
                      <label key={child.child_id} className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={inviteForm.selectedMembers.includes(child.child_id)}
                          onChange={() => toggleMemberSelection(child.child_id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">
                          {child.child_name} (Parent: {child.parent_name})
                        </span>
                      </label>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">No children available for this time slot.</p>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-2">
                  Available Time Slots ({inviteForm.selectedMembers.length} selected children = {inviteForm.selectedMembers.length} time slots)
                </h4>
                <div className="space-y-2">
                  {inviteForm.timeBlocks.map((block, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <input
                        type="date"
                        value={block.date}
                        onChange={(e) => updateTimeBlock(index, 'date', e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1 text-sm"
                      />
                      <input
                        type="time"
                        value={block.startTime}
                        onChange={(e) => updateTimeBlock(index, 'startTime', e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1 text-sm"
                      />
                      <span className="text-sm text-gray-500">to</span>
                      <input
                        type="time"
                        value={block.endTime}
                        onChange={(e) => updateTimeBlock(index, 'endTime', e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1 text-sm"
                      />
                      <button
                        onClick={() => removeTimeBlock(index)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  {inviteForm.selectedMembers.length > inviteForm.timeBlocks.length && (
                    <button
                      onClick={addTimeBlock}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      + Add Time Slot ({inviteForm.selectedMembers.length - inviteForm.timeBlocks.length} more needed)
                    </button>
                  )}
                  {inviteForm.selectedMembers.length === inviteForm.timeBlocks.length && (
                    <div className="text-sm text-green-600">
                      ✓ Time slots match selected members
                    </div>
                  )}
                  {inviteForm.selectedMembers.length < inviteForm.timeBlocks.length && (
                    <div className="text-sm text-orange-600">
                      ⚠ Too many time slots for selected members
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  value={inviteForm.notes}
                  onChange={(e) => setInviteForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  rows={3}
                  placeholder="Optional notes for the invitation..."
                />
              </div>
            </div>

            <div className="mt-6 flex space-x-3">
              <button
                onClick={sendInvitations}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Send Invitations
              </button>
              <button
                onClick={() => setShowInviteModal(false)}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Event RSVP Modal */}
      {showEventRSVPModal && selectedEventRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium mb-4">Event RSVP</h3>
            
            {/* Event Details */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">{selectedEventRequest.event_title}</h4>
              {selectedEventRequest.event_description && (
                <p className="text-sm text-gray-600 mb-2">{selectedEventRequest.event_description}</p>
              )}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Date:</span> {selectedEventRequest.requested_date}
                </div>
                <div>
                  <span className="font-medium">Time:</span> {formatTime(selectedEventRequest.start_time)} - {formatTime(selectedEventRequest.end_time)}
                </div>
                {selectedEventRequest.event_location && (
                  <div>
                    <span className="font-medium">Location:</span> {selectedEventRequest.event_location}
                  </div>
                )}

              </div>
            </div>



            

            {/* Child Attendance */}
            <div className="mb-6">
              <h4 className="font-medium text-gray-900 mb-3">Child Attendance</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div>
                    <span className="font-medium text-sm">{getChildName(selectedEventRequest.child_id, selectedEventRequest)}</span>
                    <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                      (() => {
                        const userResponse = eventResponses.find(r => r.responder_id === user?.id);
                        if (!userResponse) return 'bg-gray-100 text-gray-800';
                        switch (userResponse.response_type) {
                          case 'going': return 'bg-green-100 text-green-800';
                          case 'maybe': return 'bg-yellow-100 text-yellow-800';
                          case 'not_going': return 'bg-red-100 text-red-800';
                          default: return 'bg-gray-100 text-gray-800';
                        }
                      })()
                    }`}>
                      {(() => {
                        const userResponse = eventResponses.find(r => r.responder_id === user?.id);
                        if (!userResponse) return 'Not Responded';
                        switch (userResponse.response_type) {
                          case 'going': return 'Going';
                          case 'maybe': return 'Maybe';
                          case 'not_going': return 'Not Going';
                          default: return 'Not Responded';
                        }
                      })()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Close Button */}
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowEventRSVPModal(false)}
                className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
              >
                Close
              </button>
            </div>
 
          </div>
        </div>
      )}

    </div>
  );
} 