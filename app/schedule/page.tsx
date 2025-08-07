// Fixed Schedule Page - Updated for New 3-Table System
// This file replaces app/schedule/page.tsx with correct table references

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';
import Header from '../components/Header';
import LogoutButton from '../components/LogoutButton';
import OpenBlockDebugger from '../components/OpenBlockDebugger';

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
  allChildren?: Array<{
    child_id: string;
    providing_parent_id: string;
    children?: {
      full_name: string;
    };
    notes?: string;
  }>;
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
  const [showEditModal, setShowEditModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showAcceptInvitationModal, setShowAcceptInvitationModal] = useState(false);
  const [showDailyScheduleModal, setShowDailyScheduleModal] = useState(false);
  const [showOpenBlockModal, setShowOpenBlockModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<CareRequest | null>(null); // Updated type
  const [selectedInvitation, setSelectedInvitation] = useState<GroupInvitation | null>(null);
  const [selectedDateForDailyView, setSelectedDateForDailyView] = useState<Date | null>(null);
  const [selectedCareBlock, setSelectedCareBlock] = useState<ScheduledCare | null>(null);

  const [responseType, setResponseType] = useState<'accept' | 'decline'>('accept');
  const [availableTimeBlocks, setAvailableTimeBlocks] = useState<InvitationTimeBlock[]>([]);
  const [availableGroupMembers, setAvailableGroupMembers] = useState<AvailableGroupMember[]>([]);
  const [availableChildren, setAvailableChildren] = useState<AvailableChild[]>([]);
  const [userChildren, setUserChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  
  // Proposal management state
  const [invitationProposals, setInvitationProposals] = useState<any[]>([]);
  const [showProposalsModal, setShowProposalsModal] = useState(false);
  const [selectedInvitationForProposals, setSelectedInvitationForProposals] = useState<GroupInvitation | null>(null);
  
  // Form states
  const [requestForm, setRequestForm] = useState({
    groupId: '',
    childId: '',
    requestedDate: '',
    startTime: '',
    endTime: '',
    notes: '',
    requestType: 'reciprocal' as 'simple' | 'reciprocal' | 'event' | 'open_block',
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

  // Open block form state
  const [openBlockForm, setOpenBlockForm] = useState({
    invitedParentIds: [] as string[],
    reciprocalTimeSlots: [
      { date: '', startTime: '', endTime: '' }
    ] as Array<{ date: string; startTime: string; endTime: string }>,
    notes: ''
  });
  const [availableParentsForOpenBlock, setAvailableParentsForOpenBlock] = useState<Profile[]>([]);

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
  const refreshActiveChildren = async (userId: string, childrenData: Child[], groupsData?: Group[]) => {
    const newActiveChildren: {[groupId: string]: Child[]} = {};
    
    // Use passed groups data or fall back to state
    const groupsToUse = groupsData || groups;
    
    for (const group of groupsToUse) {
      // Get all active children in this group that belong to the logged-in user
      const { data: childGroupMembers, error } = await supabase
        .from("child_group_members")
        .select(`
          child_id,
          parent_id,
          children(
            id,
            full_name,
            parent_id
          )
        `)
        .eq("group_id", group.id)
        .eq("active", true)
        .eq("parent_id", userId); // Use the new parent_id column directly

      if (error) {
        console.error('Error fetching child group members:', error);
        continue;
      }
      
      if (childGroupMembers) {
        // Extract the children data from the joined query and flatten the array
        const groupChildren = childGroupMembers
          .map(cgm => cgm.children)
          .flat()
          .filter(Boolean) as Child[];
        
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

  const fetchAllGroupChildren = async (userId: string) => {
    console.log('fetchAllGroupChildren called with userId:', userId);
    
    if (!userId) {
      console.log('No user ID available, skipping fetchAllGroupChildren');
      setAllGroupChildren([]);
      return;
    }
    
    // Get all children in all groups where the current user is a member
    const { data: memberGroups, error: memberError } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("profile_id", userId)
      .eq("status", "active");

    if (memberError) {
      console.error('Error fetching member groups:', memberError);
      setAllGroupChildren([]);
      return;
    }

    if (!memberGroups || memberGroups.length === 0) {
      console.log('No member groups found for user:', userId);
      setAllGroupChildren([]);
      return;
    }

    const groupIds = memberGroups.map(mg => mg.group_id);
    console.log('Group IDs for user:', groupIds);
    
    // Get all active children in these groups
    const { data: childGroupMembers, error } = await supabase
      .from("child_group_members")
      .select(`
        child_id,
        parent_id,
        children(
          id,
          full_name,
          parent_id
        )
      `)
      .in("group_id", groupIds)
      .eq("active", true);

    if (error) {
      console.error('Error fetching all group children:', error);
      setAllGroupChildren([]);
      return;
    }

    if (childGroupMembers) {
      // Extract the children data from the joined query and flatten the array
      const allChildren = childGroupMembers
        .map(cgm => cgm.children)
        .flat()
        .filter(Boolean) as Child[];
      
      console.log('Fetched all group children:', allChildren);
      setAllGroupChildren(allChildren);
    } else {
      console.log('No child group members found');
      setAllGroupChildren([]);
    }
  };

  useEffect(() => {
    console.log('Main useEffect starting - checking authentication...');
    supabase.auth.getUser().then(async ({ data, error }) => {
      console.log('Auth getUser result:', { data, error });
      
      if (!data.user) {
        console.log('No user found, redirecting to auth');
        router.replace("/auth");
      } else {
        console.log('User authenticated:', data.user.id);
        setUser(data.user);
        
        // Fetch user profile
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .eq("id", data.user.id)
          .single();
        setProfile(profileData);
        console.log('Profile data:', profileData);

        // Fetch user's children
        const { data: childrenData } = await supabase
          .from("children")
          .select("*")
          .eq("parent_id", data.user.id);
        setChildren(childrenData || []);
        console.log('Children data:', childrenData);

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
          console.log('Groups data:', groupsData);

          // Fetch active children for each group - pass groupsData directly
          await refreshActiveChildren(data.user.id, childrenData || [], groupsData || []);
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

                         // Fetch all group children for open block functionality
                 console.log('About to call fetchAllGroupChildren with user ID:', data.user.id);
                 await fetchAllGroupChildren(data.user.id);

        setLoading(false);
        console.log('Main useEffect completed');
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

    // SIMPLIFIED: Fetch all blocks where the user is involved OR their children are involved
    const { data: allUserBlocks, error: allUserBlocksError } = await supabase
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
      .or(`parent_id.eq.${userId},child_id.in.(${userChildIds.join(',')})`);

    if (allUserBlocksError) {
      console.error('Error fetching all user blocks:', allUserBlocksError);
    }

    // Also fetch blocks where the user's children are involved via scheduled_care_children
    let userChildrenViaCareChildrenBlocks: any[] = [];
    if (userChildIds.length > 0) {
      const { data: careChildrenData, error: careChildrenError } = await supabase
        .from("scheduled_care_children")
        .select(`
          scheduled_care_id,
          scheduled_care!inner(
          *,
          children:child_id (
            id,
            full_name,
            parent_id
            )
          )
        `)
        .in("child_id", userChildIds)
        .gte("scheduled_care.care_date", formatDateForDB(startDate))
        .lte("scheduled_care.care_date", formatDateForDB(endDate))
        .eq("scheduled_care.status", "confirmed");

      if (careChildrenError) {
        console.error('Error fetching user children via care children blocks:', careChildrenError);
      } else {
        userChildrenViaCareChildrenBlocks = (careChildrenData || []).map(item => item.scheduled_care);
      }
    }

    // Also fetch blocks where the user is providing care for others via scheduled_care_children
    let userProvidingCareBlocks: any[] = [];
    if (user?.id) {
      const { data: providingCareData, error: providingCareError } = await supabase
        .from("scheduled_care_children")
        .select(`
          scheduled_care_id,
          scheduled_care!inner(
          *,
          children:child_id (
            id,
            full_name,
            parent_id
            )
          )
        `)
        .eq("providing_parent_id", user.id)
        .gte("scheduled_care.care_date", formatDateForDB(startDate))
        .lte("scheduled_care.care_date", formatDateForDB(endDate))
        .eq("scheduled_care.status", "confirmed");

      if (providingCareError) {
        console.error('Error fetching user providing care blocks:', providingCareError);
      } else {
        userProvidingCareBlocks = (providingCareData || []).map(item => item.scheduled_care);
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
    const allBlocks = [...(allUserBlocks || []), ...userChildrenViaCareChildrenBlocks, ...userProvidingCareBlocks, ...(eventBlocks || [])];
    const uniqueBlocks = allBlocks.filter((block, index, self) => 
      index === self.findIndex(b => b.id === block.id)
    );

    // Now fetch additional children for each care block from scheduled_care_children table
    const blocksWithAllChildren = await Promise.all(
      uniqueBlocks.map(async (block) => {
        const { data: additionalChildren, error: childrenError } = await supabase
          .from("scheduled_care_children")
          .select(`
            child_id,
            providing_parent_id,
            notes,
            children:child_id (
              id,
              full_name,
              parent_id
            )
          `)
          .eq("scheduled_care_id", block.id);

        if (childrenError) {
          console.error('Error fetching additional children for block:', childrenError);
          return block;
        }

        // Add the additional children to the block
        const allChildren = [
          // Original child from the block
          {
            child_id: block.child_id,
            providing_parent_id: block.parent_id,
            children: block.children
          },
          // Additional children from scheduled_care_children
          ...(additionalChildren || []).map(child => ({
            child_id: child.child_id,
            providing_parent_id: child.providing_parent_id,
            children: child.children,
            notes: child.notes
          }))
        ];

        return {
          ...block,
          allChildren: allChildren
        };
      })
    );

    console.log('=== fetchScheduledCare DEBUG ===');
    console.log('All user blocks (user involved OR children involved):', allUserBlocks?.length || 0);
    console.log('User children via care children blocks:', userChildrenViaCareChildrenBlocks?.length || 0);
    console.log('User providing care blocks:', userProvidingCareBlocks?.length || 0);
    console.log('Event blocks:', eventBlocks?.length || 0);
    console.log('Total unique blocks:', uniqueBlocks?.length || 0);
    console.log('Blocks with all children:', blocksWithAllChildren?.length || 0);
    
    setScheduledCare(blocksWithAllChildren); // Updated variable name
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
    const { data: allRequestsData } = await supabase
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

    // First, fetch all responses for all requests to use in filtering
    const { data: allResponsesData } = await supabase
      .from("care_responses")
      .select("*")
      .in("request_id", (allRequestsData || []).map(r => r.id))
      .order("created_at", { ascending: false });

    // Fetch open block invitations for the current user
    const { data: openBlockInvitations } = await supabase
      .from("open_block_invitations")
      .select(`
        *,
        scheduled_care!inner(
          *,
          children:child_id (
            id,
            full_name,
            parent_id
          )
        )
      `)
      .eq("invited_parent_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    console.log('=== fetchRequestsAndResponses DEBUG ===');
    console.log('Total requests before filtering:', (allRequestsData || []).length);
    console.log('Open block invitations for user:', (openBlockInvitations || []).length);
    console.log('Current user ID:', userId);
    
    // Convert open block invitations to care request format for display
    const openBlockRequests = (openBlockInvitations || []).map(invitation => {
      const scheduledCare = invitation.scheduled_care;
      
      return {
        id: invitation.id,
        group_id: scheduledCare.group_id,
        requester_id: scheduledCare.parent_id, // Parent B (who created the original care block)
        child_id: scheduledCare.child_id,
        requested_date: scheduledCare.care_date,
        start_time: scheduledCare.start_time,
        end_time: scheduledCare.end_time,
        duration_minutes: scheduledCare.duration_minutes,
        notes: invitation.notes,
        request_type: 'open_block',
        status: invitation.status,
        created_at: invitation.created_at,
        children: scheduledCare.children,
        // Open block specific fields
        reciprocal_date: invitation.reciprocal_date,
        reciprocal_start_time: invitation.reciprocal_start_time,
        reciprocal_end_time: invitation.reciprocal_end_time,
        open_block_parent_id: scheduledCare.parent_id, // Parent B
        block_time_id: invitation.block_time_id,
        open_block_id: invitation.open_block_id
      };
    });
    
    const filteredRequests = (allRequestsData || []).filter(request => {
      // For reciprocal requests, only keep if they're not completed (not accepted/rejected)
      if (request.request_type === 'reciprocal') {
      return request.status !== 'accepted' && request.status !== 'rejected';
      }
      
      // Keep all other request types (simple, event, etc.)
      return true;
    });
    
    // Combine regular requests with open block requests
    const allRequests = [...filteredRequests, ...openBlockRequests];
    
    console.log('Total requests after filtering:', filteredRequests.length);
    console.log('Open block requests converted:', openBlockRequests.length);
    console.log('Total combined requests:', allRequests.length);
    console.log('=== fetchRequestsAndResponses DEBUG END ===');

    setRequests(allRequests);

    // Filter responses to only include responses for the filtered requests
    const filteredRequestIds = filteredRequests.map((r: CareRequest) => r.id);
    const filteredResponses = (allResponsesData || []).filter(response =>
      filteredRequestIds.includes(response.request_id)
    );
    setResponses(filteredResponses);

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
    try {
      // Since we're not using a separate group_invitations table,
      // we'll fetch invitations from care_responses where the response_notes contains invitation data
      // We want to show all invitations to all parents in the group
      // BUT we should NOT include reciprocal requests - those should be handled as regular care requests
      const { data: responsesData, error } = await supabase
        .from("care_responses")
        .select(`
          *,
          care_requests!inner(*)
        `)
        .ilike('response_notes', '%Invitation ID:%')
        .neq('care_requests.request_type', 'reciprocal') // Exclude reciprocal requests from invitations
        .order("created_at", { ascending: false });

      if (error) {
        console.error('Error fetching invitations:', error);
        return;
      }

      // Convert care_responses to GroupInvitation format
      const invitations: GroupInvitation[] = (responsesData || []).map(response => {
        // Parse invitation data from response_notes
        const notes = response.response_notes || '';
        const inviterMatch = notes.match(/Inviter: ([^|]+)/);
        const invitationIdMatch = notes.match(/Invitation ID: ([^|]+)/);
        const dateMatch = notes.match(/Invitation Date: ([^|]+)/);
        const timeMatch = notes.match(/Invitation Time: ([^|]+)/);
        
        const inviterId = inviterMatch ? inviterMatch[1].trim() : '';
        const invitationId = invitationIdMatch ? invitationIdMatch[1].trim() : '';
        const invitationDate = dateMatch ? dateMatch[1].trim() : '';
        const invitationTime = timeMatch ? timeMatch[1].trim() : '';
        
        const [startTime, endTime] = invitationTime.split('-').map((t: string) => t.trim());
        
        return {
          id: invitationId || response.id,
          group_id: response.care_requests.group_id,
          inviter_id: inviterId,
          invitee_id: response.responder_id,
          request_id: response.request_id,
          invitation_date: invitationDate,
          invitation_start_time: startTime || '',
          invitation_end_time: endTime || '',
          invitation_duration_minutes: 0,
          status: response.status,
          notes: notes,
          created_at: response.created_at
        };
      });

      setInvitations(invitations);
    } catch (error) {
      console.error('Error fetching invitations:', error);
    }
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
      
      // Dispatch custom event to update header count
      window.dispatchEvent(new CustomEvent('careRequestUpdated'));
      
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
    const children = activeChildrenPerGroup[groupId] || [];
    console.log(`getActiveChildrenForGroup(${groupId}):`, children);
    return children;
  };

  const getGroupsByType = (type: 'care' | 'event') => {
    return groups.filter(group => group.group_type === type);
  };

  // Updated function names and types
  const createCareRequest = async () => {
    console.log('createCareRequest called');
    
    if (!user || !requestForm.groupId || !requestForm.childId || !requestForm.requestedDate || !requestForm.startTime || !requestForm.endTime) {
      alert('Please fill in all required fields');
      return;
    }

    // Determine request type based on which modal is open
    const isEventRequest = showCreateEventRequest;
    const requestType = isEventRequest ? 'event' : (showCreateCareRequest ? 'reciprocal' : requestForm.requestType);

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

      if (requestType === 'open_block') {
        requestData.open_block_slots = requestForm.openBlockSlots;
        requestData.open_block_parent_id = user.id;
      }

      if (requestType === 'reciprocal') {
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
      
      // Dispatch custom event to update header count
      window.dispatchEvent(new CustomEvent('careRequestUpdated'));
      
      setShowCreateCareRequest(false);
      setShowCreateEventRequest(false);
      setRequestForm({
        groupId: '',
        childId: '',
        requestedDate: '',
        startTime: '',
        endTime: '',
        notes: '',
        requestType: 'reciprocal',
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
  const respondToCareRequest = async (request?: CareRequest) => {
    const requestToUse = request || selectedRequest;
    console.log('respondToCareRequest called with request type:', requestToUse?.request_type);
    
    // For open block requests, automatically accept and create care blocks
    if (requestToUse?.request_type === 'open_block') {
      if (!user || !requestToUse) {
        return;
      }

      // Prevent users from responding to their own requests
      if (requestToUse.requester_id === user.id) {
        return;
      }

      try {
        console.log('Processing open block acceptance automatically');
        
        // Create the care response
        const { data: responseData, error: responseError } = await supabase
          .from("care_responses")
          .insert({
            request_id: requestToUse.id,
            responder_id: user.id,
            response_type: 'accept',
            status: 'accepted', // Automatically accepted
            response_notes: 'Accepted open block invitation'
          })
          .select()
          .single();

        if (responseError) {
          console.error('Error creating open block response:', responseError);
          alert('Error accepting open block: ' + responseError.message);
          return;
        }

        // Create the two care blocks automatically
        // 1. Parent B (open block creator) provides care for Parent C's child (reciprocal time)
        // 2. Parent C provides care for Parent B's child (original time)
        
        // Calculate duration for the first block (Parent B's care time)
        const startTime1 = new Date(`2000-01-01T${requestToUse.start_time}`);
        const endTime1 = new Date(`2000-01-01T${requestToUse.end_time}`);
        const durationMinutes1 = Math.round((endTime1.getTime() - startTime1.getTime()) / (1000 * 60));

        // First block: Parent B provides care for Parent C's child
        const { error: careError1 } = await supabase
          .from("scheduled_care")
          .insert({
            group_id: requestToUse.group_id,
            parent_id: requestToUse.open_block_parent_id, // Parent B (open block creator)
            child_id: requestToUse.child_id, // Parent B's child who needs care
            care_date: requestToUse.requested_date,
            start_time: requestToUse.start_time,
            end_time: requestToUse.end_time,
            duration_minutes: durationMinutes1,
            care_type: 'provided',
            status: 'confirmed',
            related_request_id: requestToUse.id,
            notes: `Open block: ${getParentName(requestToUse.open_block_parent_id || '')} providing care for ${getChildName(requestToUse.child_id, requestToUse, undefined)}`
          });

        if (careError1) {
          console.error('Error creating first care block:', careError1);
          alert('Error creating care block: ' + careError1.message);
          return;
        }

        // Calculate duration for the second block (Parent C's care time)
        const startTime2 = new Date(`2000-01-01T${requestToUse.reciprocal_start_time}`);
        const endTime2 = new Date(`2000-01-01T${requestToUse.reciprocal_end_time}`);
        const durationMinutes2 = Math.round((endTime2.getTime() - startTime2.getTime()) / (1000 * 60));

        // Second block: Parent C provides care for Parent B's child (reciprocal time)
        const { error: careError2 } = await supabase
          .from("scheduled_care")
          .insert({
            group_id: requestToUse.group_id,
            parent_id: user.id, // Parent C (acceptor)
            child_id: requestToUse.reciprocal_child_id, // Parent C's child who needs care
            care_date: requestToUse.reciprocal_date,
            start_time: requestToUse.reciprocal_start_time,
            end_time: requestToUse.reciprocal_end_time,
            duration_minutes: durationMinutes2,
            care_type: 'provided',
            status: 'confirmed',
            related_request_id: requestToUse.id,
            notes: `Open block: ${getParentName(user.id)} providing care for ${getChildName(requestToUse.reciprocal_child_id || '', requestToUse, undefined)}`
          });

        if (careError2) {
          console.error('Error creating second care block:', careError2);
          alert('Error creating care block: ' + careError2.message);
          return;
        }

        // Update the request status to accepted
        const { error: requestUpdateError } = await supabase
          .from("care_requests")
          .update({ 
            status: 'accepted',
            responder_id: user.id
          })
          .eq('id', requestToUse.id);

        if (requestUpdateError) {
          console.error('Error updating request status:', requestUpdateError);
        }

        // Refresh data
        await fetchRequestsAndResponses(user.id);
        await fetchScheduledCare(user.id, currentDate);
        
        // Dispatch custom event to update header count
        window.dispatchEvent(new CustomEvent('careRequestUpdated'));
        
        setShowResponseModal(false);
        return;
      } catch (error) {
        console.error('Error accepting open block:', error);
        return;
      }
    }

    // For regular requests (reciprocal, simple, etc.)
    if (!user || !selectedRequest || !responseForm.reciprocalDate || !responseForm.reciprocalStartTime || !responseForm.reciprocalEndTime || !responseForm.reciprocalChildId) {
      return;
    }

    // Prevent users from responding to their own requests
    if (selectedRequest.requester_id === user.id) {
      return;
    }

    try {
      console.log('Creating care response for request type:', selectedRequest.request_type);
      console.log('Response data:', {
        request_id: selectedRequest.id,
        responder_id: user.id,
        response_type: selectedRequest.request_type === 'reciprocal' ? 'pending' : responseType,
        reciprocal_date: responseForm.reciprocalDate,
        reciprocal_start_time: responseForm.reciprocalStartTime,
        reciprocal_end_time: responseForm.reciprocalEndTime,
        reciprocal_child_id: responseForm.reciprocalChildId,
        response_notes: responseForm.notes,
        status: 'pending'
      });
      
      const { error } = await supabase
        .from("care_responses") // Updated table name
        .insert({
          request_id: selectedRequest.id,
          responder_id: user.id,
          response_type: selectedRequest.request_type === 'reciprocal' ? 'pending' : responseType,
          reciprocal_date: responseForm.reciprocalDate,
          reciprocal_start_time: responseForm.reciprocalStartTime,
          reciprocal_end_time: responseForm.reciprocalEndTime,
          reciprocal_child_id: responseForm.reciprocalChildId,
          response_notes: responseForm.notes, // Fixed column name
          status: 'pending' // Always set to pending so Parent A can choose
        });

      if (error) {
        console.error('Error creating response:', error);
        return;
      }

      // Refresh data
      await fetchRequestsAndResponses(user.id);
      
      // Dispatch custom event to update header count
      window.dispatchEvent(new CustomEvent('careRequestUpdated'));
      
      setShowResponseModal(false);
      setResponseForm({
        reciprocalDate: '',
        reciprocalStartTime: '',
        reciprocalEndTime: '',
        reciprocalChildId: '',
        notes: ''
      });
      // Success - no popup needed
    } catch (error) {
      console.error('Error creating response:', error);
      return;
    }
  };

  // Updated function names and types
  const handleAgreeToRequest = async (request: CareRequest) => {
    // Prevent users from responding to their own requests
    if (request.requester_id === user?.id) {
      alert('You cannot respond to your own request');
      return;
    }
    
    // For open block requests, process directly without modal
    if (request.request_type === 'open_block') {
      console.log('handleAgreeToRequest: Processing open block request directly');
      setSelectedRequest(request);
      setResponseType('accept');
      // Call respondToCareRequest directly for open block requests
      try {
        await respondToCareRequest(request);
        console.log('handleAgreeToRequest: respondToCareRequest completed');
      } catch (error) {
        console.error('handleAgreeToRequest: Error calling respondToCareRequest:', error);
      }
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
    
    // For reciprocal requests, don't allow rejections - just don't respond
    if (request.request_type === 'reciprocal') {
      alert('For reciprocal requests, you can provide reciprocal care times or simply not respond.');
      return;
    }
    
    setSelectedRequest(request);
    setResponseType('decline');
    setShowResponseModal(true);
  };

  const handleEditRequest = async (request: CareRequest) => {
    // Only allow creators to edit their own requests
    if (request.request_type === 'open_block') {
      // For open block requests, check if user is the open block creator
      if (request.open_block_parent_id !== user?.id) {
        alert('You can only edit your own open block requests');
        return;
      }
    } else {
      // For other request types, check if user is the requester
    if (request.requester_id !== user?.id) {
      alert('You can only edit your own requests');
      return;
      }
    }
    
    // Populate the form with existing request data
    setRequestForm({
      groupId: request.group_id,
      childId: request.child_id,
      requestedDate: request.requested_date,
      startTime: request.start_time,
      endTime: request.end_time,
      notes: request.notes || '',
      requestType: request.request_type,
      eventTitle: request.event_title || '',
      eventDescription: request.event_description || '',
      eventLocation: request.event_location || '',
      eventRSVPDeadline: request.event_rsvp_deadline || '',
      eventEditDeadline: request.event_edit_deadline || '',
      isRecurring: request.is_recurring || false,
      recurrencePattern: request.recurrence_pattern || 'weekly',
      recurrenceEndDate: request.recurrence_end_date || '',
      openBlockSlots: request.open_block_slots || 1
    });
    
    setSelectedRequest(request);
    setShowEditModal(true);
  };

  const handleCancelRequest = async (request: CareRequest) => {
    // Only allow creators to cancel their own requests
    if (request.request_type === 'open_block') {
      // For open block requests, check if user is the open block creator
      if (request.open_block_parent_id !== user?.id) {
        alert('You can only cancel your own open block requests');
        return;
      }
    } else {
      // For other request types, check if user is the requester
    if (request.requester_id !== user?.id) {
      alert('You can only cancel your own requests');
      return;
      }
    }
    
    if (!confirm('Are you sure you want to cancel this request? This action cannot be undone.')) {
      return;
    }
    
    try {
      console.log('Attempting to cancel request:', request.id);
      
      const { data, error } = await supabase
        .from('care_requests')
        .update({ status: 'cancelled' })
        .eq('id', request.id)
        .select();
      
      if (error) {
        console.error('Database error cancelling request:', error);
        alert('Error cancelling request: ' + error.message);
        return;
      }
      
      console.log('Request cancelled successfully:', data);
      
      // Refresh data
      if (user) {
        await fetchRequestsAndResponses(user.id);
      }
      
      // Dispatch custom event to update header count
      window.dispatchEvent(new CustomEvent('careRequestUpdated'));
      
      alert('Request cancelled successfully');
    } catch (error) {
      console.error('Error cancelling request:', error);
      alert('Error cancelling request: ' + (error as any).message);
    }
  };

  const updateCareRequest = async () => {
    if (!user || !selectedRequest || !requestForm.groupId || !requestForm.childId || !requestForm.requestedDate || !requestForm.startTime || !requestForm.endTime) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      // Convert local date to UTC for database storage
      const localDate = new Date(requestForm.requestedDate + 'T00:00:00');
      const utcDate = localDate.toISOString().split('T')[0];

      const updateData: any = {
        group_id: requestForm.groupId,
        child_id: requestForm.childId,
        requested_date: utcDate,
        start_time: requestForm.startTime,
        end_time: requestForm.endTime,
        notes: requestForm.notes,
        request_type: requestForm.requestType
      };

      // Add request type specific fields
      if (requestForm.requestType === 'event') {
        updateData.event_title = requestForm.eventTitle;
        updateData.event_description = requestForm.eventDescription;
        if (requestForm.eventLocation) {
          updateData.event_location = requestForm.eventLocation;
        }
        if (requestForm.eventRSVPDeadline) {
          updateData.event_rsvp_deadline = requestForm.eventRSVPDeadline;
        }
        if (requestForm.eventEditDeadline) {
          updateData.event_edit_deadline = requestForm.eventEditDeadline;
        }
        
        // Add recurring event fields if this is a recurring event
        if (requestForm.isRecurring) {
          updateData.is_recurring = true;
          updateData.recurrence_pattern = requestForm.recurrencePattern;
          if (requestForm.recurrenceEndDate) {
            updateData.recurrence_end_date = requestForm.recurrenceEndDate;
          }
        }
      }

      if (requestForm.requestType === 'open_block') {
        updateData.open_block_slots = requestForm.openBlockSlots;
      }

      if (requestForm.requestType === 'reciprocal') {
        updateData.is_reciprocal = true;
      }

      const { error } = await supabase
        .from("care_requests")
        .update(updateData)
        .eq('id', selectedRequest.id);

      if (error) {
        console.error('Error updating care request:', error);
        alert('Error updating request: ' + error.message);
        return;
      }

      // Refresh data
      await fetchRequestsAndResponses(user.id);
      
      // Dispatch custom event to update header count
      window.dispatchEvent(new CustomEvent('careRequestUpdated'));
      
      // Close modal and reset form
      setShowEditModal(false);
      setSelectedRequest(null);
      setRequestForm({
        groupId: '',
        childId: '',
        requestedDate: '',
        startTime: '',
        endTime: '',
        notes: '',
        requestType: 'reciprocal',
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

      alert('Request updated successfully');
    } catch (error) {
      console.error('Error updating care request:', error);
      alert('Error updating request: ' + (error as any).message);
    }
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
      
      // Dispatch custom event to update header count
      window.dispatchEvent(new CustomEvent('careRequestUpdated'));
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
      return;
    }

    // Validate that all selected children have time blocks
    if (inviteForm.selectedMembers.length !== inviteForm.timeBlocks.length) {
      return;
    }

    // Validate that all time blocks have required fields
    for (let i = 0; i < inviteForm.timeBlocks.length; i++) {
      const timeBlock = inviteForm.timeBlocks[i];
      if (!timeBlock.date || !timeBlock.startTime || !timeBlock.endTime) {
        return;
      }
    }

    try {
      // Create open block requests for each selected child
      for (let i = 0; i < inviteForm.selectedMembers.length; i++) {
        const childId = inviteForm.selectedMembers[i];
        const timeBlock = inviteForm.timeBlocks[i];
        
        // Find the child details
        const selectedChild = availableChildren.find(child => child.child_id === childId);
        if (!selectedChild) {
          return;
        }

        // Create a new care request for this child with the specified time block
        const { error: createError } = await supabase
          .from('care_requests')
          .insert({
            group_id: selectedRequest.group_id,
            requester_id: user.id, // Parent B is requesting to care for additional children
            child_id: childId, // Use the selected child's ID
            requested_date: timeBlock.date, // Use the specified date (new time Parent B is offering)
            start_time: timeBlock.startTime, // Use the specified start time
            end_time: timeBlock.endTime, // Use the specified end time
            request_type: 'open_block',
            status: 'pending',
            open_block_parent_id: user.id,
            open_block_slots: 1,
            open_block_slots_used: 0,
            // Store the original care block information in reciprocal fields
            reciprocal_parent_id: user.id, // Parent B
            reciprocal_child_id: selectedRequest.child_id, // Parent B's child
            reciprocal_date: selectedRequest.requested_date, // Original care block date
            reciprocal_start_time: selectedRequest.start_time, // Original care block start time
            reciprocal_end_time: selectedRequest.end_time, // Original care block end time
            reciprocal_status: 'pending',
            notes: inviteForm.notes || `Open block invitation: ${getParentName(user.id)} is offering to care for ${selectedChild.child_name} from ${formatTime(timeBlock.startTime)} to ${formatTime(timeBlock.endTime)} on ${timeBlock.date}`
          });

        if (createError) {
          console.error('Error creating open block request:', createError);
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
      
      // Dispatch custom event to update header count
      window.dispatchEvent(new CustomEvent('careRequestUpdated'));
      
      // Success - no popup needed
    } catch (error) {
      console.error('Error sending invitations:', error);
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
    if (!user || !selectedInvitation || !selectedChildId) {
      alert('Missing required information');
      return;
    }

    try {
      // Submit a response instead of directly accepting
      const { data: responseId, error } = await supabase.rpc('submit_invitation_response', {
        p_accepting_user_id: user.id,
        p_request_id: selectedInvitation.request_id,
        p_inviter_id: selectedInvitation.inviter_id,
        p_selected_time_block_index: selectedTimeBlockIndex,
        p_selected_child_id: selectedChildId,
        p_invitation_date: selectedInvitation.invitation_date,
        p_invitation_start_time: selectedInvitation.invitation_start_time,
        p_invitation_end_time: selectedInvitation.invitation_end_time,
        p_notes: 'Response submitted via invitation acceptance'
      });

      if (error) {
        console.error('Error submitting response:', error);
        alert('Error submitting response: ' + error.message);
        return;
      }

      // Close the modal
      setShowAcceptInvitationModal(false);
      setSelectedInvitation(null);
      setAvailableTimeBlocks([]);
      setUserChildren([]);
      setSelectedChildId('');

      // Refresh data
      await fetchRequestsAndResponses(user.id);
      await fetchInvitations(user.id);
      
      alert('Response submitted successfully! The original inviter will review your response.');
    } catch (error) {
      console.error('Error submitting response:', error);
      alert('Error submitting response. Please try again.');
    }
  };

  const handleViewResponses = async (invitation: GroupInvitation) => {
    setSelectedInvitationForProposals(invitation);
    
    try {
      const { data: responses, error } = await supabase.rpc('get_invitation_responses', {
        p_inviter_id: invitation.inviter_id,
        p_request_id: invitation.request_id
      });

      if (error) {
        console.error('Error fetching responses:', error);
        alert('Error fetching responses: ' + error.message);
        return;
      }

      setInvitationProposals(responses || []);
      setShowProposalsModal(true);
    } catch (error) {
      console.error('Error fetching responses:', error);
      alert('Error fetching responses. Please try again.');
    }
  };

  const acceptInvitationResponse = async (responseId: string) => {
    if (!user) {
      alert('User not found');
      return;
    }

    try {
      const { error } = await supabase.rpc('accept_invitation_response', {
        p_response_id: responseId,
        p_acceptor_id: user.id
      });

      if (error) {
        console.error('Error accepting response:', error);
        alert('Error accepting response: ' + error.message);
        return;
      }

      // Close the modal
      setShowProposalsModal(false);
      setSelectedInvitationForProposals(null);
      setInvitationProposals([]);

      // Refresh data
      await fetchRequestsAndResponses(user.id);
      await fetchInvitations(user.id);
      await fetchScheduledCare(user.id, currentDate);
      
      alert('Response accepted successfully! Care blocks have been created.');
    } catch (error) {
      console.error('Error accepting response:', error);
      alert('Error accepting response. Please try again.');
    }
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



  // Synchronous version for render logic
  const findOriginalRequestForBlockSync = (block: ScheduledCare): CareRequest | null => {
    return requests.find(request => request.id === block.related_request_id) || null;
  };

  // Async version for open block functionality
  const findOriginalRequestForBlock = async (block: ScheduledCare): Promise<CareRequest | null> => {
    console.log('=== findOriginalRequestForBlock DEBUG START ===');
    console.log('Block related_request_id:', block.related_request_id);
    console.log('Local requests count:', requests.length);
    
    // First try to find in local requests array
    const foundRequest = requests.find(request => request.id === block.related_request_id);
    console.log('Found in local requests:', foundRequest);
    
    if (foundRequest) {
      console.log('=== findOriginalRequestForBlock DEBUG END (found locally) ===');
      return foundRequest;
    }
    
    // If not found locally, fetch from database (this handles completed reciprocal requests)
    if (block.related_request_id) {
      console.log('Not found locally, fetching from database...');
      try {
        const { data: requestData, error } = await supabase
          .from('care_requests')
          .select(`
            *,
            children:child_id (
              id,
              full_name,
              parent_id
            )
          `)
          .eq('id', block.related_request_id)
          .single();
        
        console.log('Database query result:', { data: requestData, error });
        
        if (error) {
          console.error('Error fetching original request:', error);
          console.log('=== findOriginalRequestForBlock DEBUG END (error) ===');
          return null;
        }
        
        console.log('=== findOriginalRequestForBlock DEBUG END (found in database) ===');
        return requestData;
      } catch (error) {
        console.error('Error fetching original request:', error);
        console.log('=== findOriginalRequestForBlock DEBUG END (exception) ===');
        return null;
      }
    }
    
    console.log('No related_request_id found');
    console.log('=== findOriginalRequestForBlock DEBUG END (no related_request_id) ===');
    return null;
  };

  const handleBlockDoubleClick = async (block: ScheduledCare) => { // Updated type
    console.log('handleBlockDoubleClick called with block:', block);
    console.log('Current user ID:', user?.id);
    
    // Check if this is an event block
    if (block.care_type === 'event') {
      console.log('This is an event block, calling handleEventBlockDoubleClick');
      await handleEventBlockDoubleClick(block);
      return;
    }
    
    // Check if this is a provided care block with reciprocal notes (indicating it's from a reciprocal request)
    if (block.care_type === 'provided' && 
        block.parent_id === user?.id && 
        block.notes && 
        block.notes.toLowerCase().includes('reciprocal')) {
      console.log('=== RECIPROCAL BLOCK DETECTED ===');
      console.log('Block details:', {
        care_type: block.care_type,
        parent_id: block.parent_id,
        user_id: user?.id,
        notes: block.notes,
        child_id: block.child_id,
        care_date: block.care_date,
        related_request_id: block.related_request_id
      });
      
      // Find the original reciprocal request to determine if current user is Parent B (responder)
      const originalRequest = await findOriginalRequestForBlock(block);
      console.log('Original request found:', originalRequest);
      
      if (originalRequest && originalRequest.request_type === 'reciprocal') {
        // Check if current user is the responder (Parent B) of the original reciprocal request
        // Only Parent B should be able to open blocks, not Parent A (initiator)
        if (originalRequest.responder_id === user?.id) {
          console.log('Current user is Parent B (responder) - allowing open block');
          
      const shouldOpenBlock = confirm(
        `You are providing care for ${getChildName(block.child_id, undefined, block)} on ${block.care_date}.\n\nWould you like to open this care block to invite other group members?`
      );
      
      if (shouldOpenBlock) {
            console.log('User chose to open block - setting up modal...');
        // Set up the open block modal
        setSelectedCareBlock(block);
        setOpenBlockForm({
                           invitedParentIds: [],
                           reciprocalTimeSlots: [{ date: '', startTime: '', endTime: '' }],
          notes: ''
        });
            
            console.log('Calling getAvailableParentsForOpenBlock...');
            // Fetch available parents for open block
            const availableParents = await getAvailableParentsForOpenBlock(block);
            console.log('getAvailableParentsForOpenBlock returned:', availableParents);
            setAvailableParentsForOpenBlock(availableParents);
            
        setShowOpenBlockModal(true);
            console.log('Modal should now be visible');
        return;
          }
        } else {
          console.log('Current user is Parent A (initiator) - showing details only');
          // Parent A should just see the details, not be able to open the block
          alert(`Care Block Details:\n\nYou are providing care for ${getChildName(block.child_id, undefined, block)} on ${block.care_date} from ${formatTime(block.start_time)} to ${formatTime(block.end_time)}.\n\nThis is part of a reciprocal care agreement.`);
          return;
        }
      } else {
        console.log('No original reciprocal request found or not a reciprocal request');
      }
    }
    
    // Default behavior: Show daily schedule popup for the block's date
    console.log('Showing daily schedule modal instead');
    // Fix timezone issue by parsing the date properly
    const blockDate = parseLocalDate(block.care_date);
    setSelectedDateForDailyView(blockDate);
    setShowDailyScheduleModal(true);
  };

  const handleOpenBlockSubmit = async () => {
    if (!user || !selectedCareBlock || openBlockForm.invitedParentIds.length === 0) {
      alert('Please select at least one parent to invite');
      return;
    }

    try {
      const invitations = [];
      
      // Create invitations for each time slot
      for (let timeSlotIndex = 0; timeSlotIndex < openBlockForm.reciprocalTimeSlots.length; timeSlotIndex++) {
        const timeSlot = openBlockForm.reciprocalTimeSlots[timeSlotIndex];
        const blockTimeId = crypto.randomUUID(); // Generate unique block time ID for this time slot
        
        // First, create the actual care block in scheduled_care table for this time slot
        const { data: newCareBlock, error: careBlockError } = await supabase
          .from('scheduled_care')
          .insert({
            group_id: selectedCareBlock.group_id,
            parent_id: user.id, // Parent B (the inviting parent)
            child_id: selectedCareBlock.child_id, // Parent B's child
            care_date: selectedCareBlock.care_date,
            start_time: selectedCareBlock.start_time,
            end_time: selectedCareBlock.end_time,
            care_type: 'provided',
            status: 'confirmed',
            notes: 'Open block invitation - Parent B offering care slot'
          })
          .select()
          .single();

        if (careBlockError) {
          console.error('Error creating care block for open block invitation:', careBlockError);
          alert('Error creating care block: ' + careBlockError.message);
          return;
        }

        console.log('Created care block for open block invitation:', newCareBlock.id);
        console.log('Care block details:', {
          id: newCareBlock.id,
          parent_id: newCareBlock.parent_id,
          child_id: newCareBlock.child_id,
          care_date: newCareBlock.care_date,
          start_time: newCareBlock.start_time,
          end_time: newCareBlock.end_time,
          care_type: newCareBlock.care_type,
          status: newCareBlock.status,
          notes: newCareBlock.notes
        });
        
        // Create invitation for each parent for this time slot
        for (const parentId of openBlockForm.invitedParentIds) {
          const { data: invitation, error: createError } = await supabase
            .from('open_block_invitations')
          .insert({
              open_block_id: newCareBlock.id, // Link to the newly created care block
              block_time_id: blockTimeId, // Same block time ID for all parents for this time slot
              invited_parent_id: parentId, // Single parent per invitation
              reciprocal_date: timeSlot.date,
              reciprocal_start_time: timeSlot.startTime,
              reciprocal_end_time: timeSlot.endTime,
              status: 'active',
              notes: `In exchange, they need care for their child on ${timeSlot.date} from ${timeSlot.startTime} to ${timeSlot.endTime}.`
            })
            .select()
            .single();

        if (createError) {
            console.error('Error creating open block invitation for parent', parentId, 'time slot:', timeSlot, ':', createError);
            alert('Error creating open block invitation: ' + createError.message);
          return;
        }

          invitations.push(invitation);
        }

        // Note: Messages will be sent when invitations are accepted/declined, not when created
      }

      // Close the modal and show success message
      setShowOpenBlockModal(false);
      setOpenBlockForm({
        invitedParentIds: [],
        reciprocalTimeSlots: [{ date: '', startTime: '', endTime: '' }],
        notes: ''
      });
      setSelectedCareBlock(null);
      
      // Refresh data to show new invitations and care blocks
      await fetchRequestsAndResponses(user.id);
      await fetchScheduledCare(user.id, new Date());
      
      // Dispatch custom event to update header count
      window.dispatchEvent(new CustomEvent('careRequestUpdated'));
      window.dispatchEvent(new CustomEvent('newMessageSent'));
      
      alert(`Open block invitations created successfully! ${invitations.length} invitation(s) sent. It's first-come-first-serve - the first parent to accept gets the slot.`);
    } catch (error) {
      console.error('Error creating open block invitation:', error);
      alert('Error creating open block invitation. Please try again.');
    }
  };

  const toggleParentSelection = (parentId: string) => {
    setOpenBlockForm(prev => {
      const newInvitedParentIds = prev.invitedParentIds.includes(parentId)
        ? prev.invitedParentIds.filter(id => id !== parentId)
        : [...prev.invitedParentIds, parentId];
      
      // Automatically adjust time slots based on number of selected parents
      const newTimeSlots = [];
      for (let i = 0; i < newInvitedParentIds.length; i++) {
        newTimeSlots.push({ date: '', startTime: '', endTime: '' });
      }
      
      return {
        ...prev,
        invitedParentIds: newInvitedParentIds,
        reciprocalTimeSlots: newTimeSlots.length > 0 ? newTimeSlots : [{ date: '', startTime: '', endTime: '' }]
      };
    });
  };

  const addReciprocalTimeSlot = () => {
    setOpenBlockForm(prev => ({
      ...prev,
      reciprocalTimeSlots: [...prev.reciprocalTimeSlots, { date: '', startTime: '', endTime: '' }]
    }));
  };

  const removeReciprocalTimeSlot = (index: number) => {
    setOpenBlockForm(prev => ({
      ...prev,
      reciprocalTimeSlots: prev.reciprocalTimeSlots.filter((_, i) => i !== index)
    }));
  };

  const updateReciprocalTimeSlot = (index: number, field: 'date' | 'startTime' | 'endTime', value: string) => {
    setOpenBlockForm(prev => ({
      ...prev,
      reciprocalTimeSlots: prev.reciprocalTimeSlots.map((slot, i) => 
        i === index ? { ...slot, [field]: value } : slot
      )
    }));
  };



  const getAvailableParentsForOpenBlock = async (block?: ScheduledCare) => {
    console.log('=== getAvailableParentsForOpenBlock DEBUG START ===');
    console.log('allProfiles length:', allProfiles.length);
    console.log('selectedCareBlock:', selectedCareBlock);
    console.log('Passed block parameter:', block);
    console.log('Current user ID:', user?.id);
    
    // Use passed block parameter if available, otherwise fall back to selectedCareBlock
    const targetBlock = block || selectedCareBlock;
    
    if (!targetBlock) {
      console.log('No selected care block');
      return [];
    }
    
    // Get all group members except the current user and the original requester
    console.log('Calling findOriginalRequestForBlock...');
    const originalRequest = await findOriginalRequestForBlock(targetBlock);
    console.log('findOriginalRequestForBlock result:', originalRequest);
    
    if (!originalRequest) {
      console.log('No original request found for block');
      return [];
    }
    
    console.log('Original request:', originalRequest);
    console.log('Original requester:', originalRequest.requester_id);
    console.log('Selected care block group_id:', targetBlock.group_id);
    
    // Get all active group members for this specific group
    console.log('Fetching group members from database...');
    const { data: groupMembers, error } = await supabase
      .from('group_members')
      .select('profile_id')
      .eq('group_id', targetBlock.group_id)
      .eq('status', 'active');
    
    console.log('Group members query result:', { data: groupMembers, error });
    
    if (error) {
      console.error('Error fetching group members:', error);
      return [];
    }
    
    if (!groupMembers || groupMembers.length === 0) {
      console.log('No group members found');
      return [];
    }
    
    const profileIds = groupMembers.map(member => member.profile_id);
    console.log('Profile IDs found:', profileIds);
    
    // Get the actual profile data for these members
    console.log('Fetching profiles from database...');
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', profileIds);
    
    console.log('Profiles query result:', { data: profilesData, error: profilesError });
    
    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      return [];
    }
    
    console.log('Profiles found:', profilesData);
    
    // Filter profiles to only include active group members, excluding current user and original requester
    console.log('Filtering profiles...');
    const availableParents = (profilesData || [])
      .filter(profile => {
        console.log(`Checking profile: ${profile.full_name} (ID: ${profile.id})`);
        console.log(`Current user ID: ${user?.id}, Original requester ID: ${originalRequest.requester_id}`);
        
      // Exclude current user and original requester
      if (profile.id === user?.id || profile.id === originalRequest.requester_id) {
        console.log(`Excluding ${profile.full_name} (current user or original requester)`);
        return false;
      }
      
        console.log(`Including ${profile.full_name} as available parent`);
        return true;
      });
    
    console.log('Final available parents:', availableParents);
    console.log('=== getAvailableParentsForOpenBlock DEBUG END ===');
    return availableParents;
  };

  const getChildrenForParent = (parentId: string) => {
    return allGroupChildren.filter(child => child.parent_id === parentId);
  };

  // Function to send notifications to responders about their response status
  const sendResponseNotifications = async (requestId: string, acceptedResponseId: string, acceptedResponderId?: string) => {
    try {
      // Get the request details
                 const { data: requestData } = await supabase
             .from("care_requests")
             .select("id, requester_id, child_id, requested_date, start_time, end_time, notes, group_id")
             .eq("id", requestId)
             .single();

      if (!requestData) return;

      // Get the requester's name
      const { data: requesterData } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", requestData.requester_id)
        .single();

      const requesterName = requesterData?.full_name || "Unknown Parent";

      // Get all responses for this request
      const { data: allResponses } = await supabase
        .from("care_responses")
        .select("id, responder_id, status, response_type")
        .eq("request_id", requestId);

      if (!allResponses) return;

      // Send notifications to each responder
      for (const response of allResponses) {
        const isAccepted = response.id === acceptedResponseId;
        const status = isAccepted ? 'accepted' : 'rejected';
        
        // Get responder's name
        const { data: responderData } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", response.responder_id)
          .single();

        const responderName = responderData?.full_name || "Unknown Parent";

        // Create notification message
                     const messageContent = isAccepted
               ? `Your response to ${requesterName}'s care request has been accepted! The care exchange has been scheduled for ${requestData.requested_date} from ${requestData.start_time} to ${requestData.end_time}.`
               : `Your response to ${requesterName}'s care request was not selected. The request for ${requestData.requested_date} from ${requestData.start_time} to ${requestData.end_time} has been fulfilled by another parent.`;

        const messageSubject = isAccepted 
          ? "Care Request Response Accepted"
          : "Care Request Response Not Selected";

        // Insert notification message
                                        const { error: messageError } = await supabase
                   .from("messages")
                   .insert({
                     group_id: requestData.group_id, // Use the group from the original request
                     sender_id: requestData.requester_id, // From the requester
                     recipient_id: response.responder_id, // To the responder
                     subject: messageSubject,
                     content: messageContent,
                     role: 'notification'
                   });

        if (messageError) {
          console.error('Error sending notification to responder:', messageError);
        }
               }
         
         // Dispatch event to update message count in header
         window.dispatchEvent(new CustomEvent('newMessageSent'));
       } catch (error) {
         console.error('Error sending response notifications:', error);
       }
     };

  const acceptResponse = async (responseId: string, requestId: string) => {
    // For open block requests, handle differently
    const request = requests.find(r => r.id === requestId);
    if (request?.request_type === 'open_block') {
      try {
        // Get the response details
        const response = responses.find(r => r.id === responseId);
        if (!response) {
          alert('Response not found');
          return;
        }

        // For open block requests, we need to create two care blocks:
        // 1. Parent B (open block creator) provides care for Parent C's child (reciprocal time)
        // 2. Parent C provides care for Parent B's child (original time)

        // First block: Parent B provides care for Parent C's child
        const { error: careError1 } = await supabase
          .from("scheduled_care")
          .insert({
            group_id: request.group_id,
            parent_id: request.requester_id, // Parent B (open block creator)
            child_id: request.reciprocal_child_id || request.child_id, // Use reciprocal_child_id if available, otherwise fallback
            care_date: request.requested_date,
            start_time: request.start_time,
            end_time: request.end_time,
            duration_minutes: request.duration_minutes,
            care_type: 'provided',
            status: 'confirmed',
            related_request_id: request.id,
            notes: `Open block: ${getParentName(request.requester_id)} providing care for ${getChildName(request.reciprocal_child_id || request.child_id, request)}`
          });

        if (careError1) {
          console.error('Error creating first care block:', careError1);
          alert('Error creating care block: ' + careError1.message);
          return;
        }

        // Second block: Parent C provides care for Parent B's child (original reciprocal time)
        const { error: careError2 } = await supabase
          .from("scheduled_care")
          .insert({
            group_id: request.group_id,
            parent_id: response.responder_id, // Parent C (responder)
            child_id: request.reciprocal_child_id || request.child_id, // Child Parent C will care for
            care_date: request.reciprocal_date || request.requested_date,
            start_time: request.reciprocal_start_time || request.start_time,
            end_time: request.reciprocal_end_time || request.end_time,
            duration_minutes: request.duration_minutes,
            care_type: 'provided',
            status: 'confirmed',
            related_request_id: request.id,
            notes: `Open block: ${getParentName(response.responder_id)} providing care for ${getChildName(request.reciprocal_child_id || request.child_id, request)}`
          });

        if (careError2) {
          console.error('Error creating second care block:', careError2);
          alert('Error creating care block: ' + careError2.message);
          return;
        }

        // Update the response status to accepted
        const { error: updateError } = await supabase
          .from("care_responses")
          .update({ status: 'accepted' })
          .eq('id', responseId);

        if (updateError) {
          console.error('Error updating response:', updateError);
          alert('Error updating response: ' + updateError.message);
          return;
        }

        // Update the open block slots used
        const { error: slotError } = await supabase
          .from("care_requests")
          .update({ 
            open_block_slots_used: (request.open_block_slots_used || 0) + 1 
          })
          .eq('id', requestId);

        if (slotError) {
          console.error('Error updating slots used:', slotError);
        }

        // Refresh data
        await fetchRequestsAndResponses(user?.id || '');
        await fetchScheduledCare(user?.id || '', new Date());
        
        alert('Open block request approved! Both care blocks have been created.');
        return;
      } catch (error) {
        console.error('Error approving open block response:', error);
        alert('Error approving open block response. Please try again.');
        return;
      }
    }
    console.log('acceptResponse called with:', { responseId, requestId, userId: user?.id });
    
    if (!user) {
      alert('User not found');
      return;
    }

    // Prevent multiple acceptances of the same response
    const response = responses.find(r => r.id === responseId);
    if (response && response.status !== 'pending') {
      console.log('Response already accepted, ignoring duplicate call');
      return;
    }

    try {
      // Call the simple_care_exchange function to accept the response and create blocks
      console.log('Calling simple_care_exchange RPC...');
      const { error: exchangeError } = await supabase.rpc('simple_care_exchange', {
        p_request_id: requestId,
        p_response_id: responseId
      });

      if (exchangeError) {
        console.error('Error creating care exchange:', exchangeError);
        alert('Error accepting response: ' + exchangeError.message);
        return;
      }

      console.log('create_care_exchange completed successfully');

      // Update the accepted response status
      const { data: responseUpdateData, error: responseUpdateError } = await supabase
        .from("care_responses")
        .update({ 
          status: 'accepted',
          response_type: 'accept'
        })
        .eq('id', responseId)
        .select();

      if (responseUpdateError) {
        console.error('Error updating response status:', responseUpdateError);
      }
      
      // Update the request status to accepted
      const { error: requestUpdateError } = await supabase
        .from("care_requests")
        .update({ 
          status: 'accepted',
          responder_id: response?.responder_id
        })
        .eq('id', requestId);

      if (requestUpdateError) {
        console.error('Error updating request status:', requestUpdateError);
      }

      // Reject all other pending responses for this request
      const { error: rejectOthersError } = await supabase
        .from("care_responses")
        .update({ 
          status: 'rejected',
          response_type: 'decline'
        })
        .eq('request_id', requestId)
        .neq('id', responseId)
        .eq('status', 'pending');

      if (rejectOthersError) {
        console.error('Error rejecting other responses:', rejectOthersError);
      }

      // Send notifications to all responders about their response status
      await sendResponseNotifications(requestId, responseId, response?.responder_id);

      // Refresh data to show the new scheduled blocks and updated statuses
      await fetchRequestsAndResponses(user.id);
      await fetchScheduledCare(user.id, currentDate);
      
      // The completed reciprocal request will now be filtered out and won't show in the UI
      
      // Dispatch event to update header count
      window.dispatchEvent(new CustomEvent('responseStatusUpdated'));
      
      alert('Response accepted successfully! Care blocks have been created.');
    } catch (error) {
      console.error('Error accepting response:', error);
      alert('Error accepting response. Please try again.');
    }
  };

  // Open block response state
  const [showOpenBlockResponseModal, setShowOpenBlockResponseModal] = useState(false);
  const [selectedOpenBlockInvitation, setSelectedOpenBlockInvitation] = useState<any>(null);
  const [openBlockResponseType, setOpenBlockResponseType] = useState<'accept' | 'decline'>('accept');
  const [openBlockResponseChildId, setOpenBlockResponseChildId] = useState('');
  const [openBlockResponseNotes, setOpenBlockResponseNotes] = useState('');
  const [showDebugger, setShowDebugger] = useState(false);

  // Handle open block invitation responses
  const handleOpenBlockResponse = async (invitationId: string, response: 'accept' | 'decline', childId?: string) => {
    try {
      // Check if a response already exists for this invitation and parent
      const { data: existingResponse, error: checkError } = await supabase
        .from("open_block_responses")
        .select("*")
        .eq("invitation_id", invitationId)
        .eq("parent_id", user!.id)
        .single();

      if (existingResponse) {
        console.log("Response already exists for this invitation:", existingResponse);
        // Close the modal and refresh data
        setShowOpenBlockResponseModal(false);
        await fetchRequestsAndResponses(user!.id);
        await fetchScheduledCare(user!.id, new Date());
        window.dispatchEvent(new CustomEvent('careRequestUpdated'));
        return;
      }

      // Create a response record
      const { data: responseRecord, error: createError } = await supabase
        .from("open_block_responses")
        .insert({
          invitation_id: invitationId,
          parent_id: user!.id,
          response: response,
          child_id: childId,
          notes: response === 'accept' ? 'Accepted open block invitation' : 'Declined open block invitation'
        })
        .select()
        .single();

      if (createError) {
        console.error("Error creating open block response:", createError);
        return;
      }

      // If accepted, handle the acceptance logic directly
      if (response === 'accept') {
        console.log("Processing open block acceptance...");
        
        // Get the invitation details
        const { data: invitation, error: fetchError } = await supabase
          .from("open_block_invitations")
          .select(`
            *,
            scheduled_care!inner(*)
          `)
          .eq("id", invitationId)
          .single();

        if (fetchError || !invitation) {
          console.error("Error fetching invitation:", fetchError);
          return;
        }

        const scheduledCare = invitation.scheduled_care;
        console.log("Found invitation:", invitation);
        console.log("Original care block:", scheduledCare);

        // Update the invitation status to accepted
        const { error: updateError } = await supabase
          .from("open_block_invitations")
          .update({
            status: 'accepted',
            accepted_parent_id: user!.id,
            updated_at: new Date().toISOString()
          })
          .eq("id", invitationId);

        if (updateError) {
          console.error("Error updating invitation status:", updateError);
          return;
        }

        console.log("Updated invitation status to accepted");

        // Get the original child ID (Parent B's child)
        const { data: originalChild, error: childError } = await supabase
          .from("children")
          .select("id")
          .eq("parent_id", scheduledCare.parent_id)
          .limit(1)
          .single();

        if (childError || !originalChild) {
          console.error("Error getting original child:", childError);
          return;
        }

        console.log("Original child ID:", originalChild.id);

        // Add the accepting child to the original care block
        const { error: addChildError } = await supabase
          .from("scheduled_care_children")
          .insert({
            scheduled_care_id: scheduledCare.id,
            child_id: childId!,
            providing_parent_id: scheduledCare.parent_id, // Parent B providing care
            notes: 'Open block acceptance - accepting child'
          });

        if (addChildError) {
          console.error("Error adding accepting child to care block:", addChildError);
          return;
        }

        console.log("Added accepting child to original care block");

                     // Create reciprocal care block for the accepting parent
             const { data: reciprocalCare, error: reciprocalError } = await supabase
               .from("scheduled_care")
               .insert({
                 group_id: scheduledCare.group_id,
                 parent_id: user!.id,
                 child_id: originalChild.id,
                 care_date: invitation.reciprocal_date,
                 start_time: invitation.reciprocal_start_time,
                 end_time: invitation.reciprocal_end_time,
                 care_type: 'provided',
                 status: 'confirmed',
                 notes: 'Open block acceptance - reciprocal care'
               })
               .select()
               .single();

        if (reciprocalError) {
          console.error("Error creating reciprocal care block:", reciprocalError);
          return;
        }

        console.log("Created reciprocal care block:", reciprocalCare.id);

        // Add the original child to the reciprocal care block
        const { error: addReciprocalError } = await supabase
          .from("scheduled_care_children")
          .insert({
            scheduled_care_id: reciprocalCare.id,
            child_id: originalChild.id,
            providing_parent_id: user!.id, // Parent C providing care
            notes: 'Open block acceptance - reciprocal child'
          });

        if (addReciprocalError) {
          console.error("Error adding reciprocal child to care block:", addReciprocalError);
          return;
        }

        console.log("Added reciprocal child to care block");

        // Expire other invitations for the same block_time_id (first-come-first-serve)
        const { error: expireError } = await supabase
          .from("open_block_invitations")
          .update({
            status: 'expired',
            updated_at: new Date().toISOString()
          })
          .eq("block_time_id", invitation.block_time_id)
          .neq("id", invitationId)
          .eq("status", 'active');

        if (expireError) {
          console.error("Error expiring other invitations:", expireError);
        } else {
          console.log("Expired other invitations for this open block");
        }

        // Send notification to the open block creator (Parent B)
        const { error: messageError } = await supabase
          .from("messages")
          .insert({
            group_id: scheduledCare.group_id,
            sender_id: user!.id,
            recipient_id: scheduledCare.parent_id, // Parent B (who created the original care block)
            subject: "Open Block Accepted",
            content: `${getParentName(user!.id)} has accepted your open block invitation for ${invitation.reciprocal_date} from ${invitation.reciprocal_start_time} to ${invitation.reciprocal_end_time}.`,
            role: 'notification'
          });

        if (messageError) {
          console.error('Error sending notification:', messageError);
        }

        // Send notification to the accepting parent (Parent C) about their reciprocal obligation
        const { error: reciprocalMessageError } = await supabase
          .from("messages")
          .insert({
            group_id: scheduledCare.group_id,
            sender_id: user!.id,
            recipient_id: user!.id, // Parent C (who accepted the invitation)
            subject: "Reciprocal Care Block Created",
            content: `You have agreed to provide care for ${getParentName(scheduledCare.parent_id)}'s child on ${invitation.reciprocal_date} from ${invitation.reciprocal_start_time} to ${invitation.reciprocal_end_time}. This care block has been added to your schedule.`,
            role: 'notification'
          });

        if (reciprocalMessageError) {
          console.error('Error sending reciprocal notification:', reciprocalMessageError);
        }

        console.log("Open block acceptance process completed successfully");
      }

      // Close the modal
      setShowOpenBlockResponseModal(false);
      
      // Refresh data
      await fetchRequestsAndResponses(user!.id);
      await fetchScheduledCare(user!.id, new Date());

      // Dispatch custom event to update header count
      window.dispatchEvent(new CustomEvent('careRequestUpdated'));
    } catch (error) {
      console.error("Error responding to open block invitation:", error);
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
    <div>
      <Header currentPage="schedule" />
      <div className="p-6 max-w-7xl mx-auto bg-white min-h-screen">
      
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
          <button
            onClick={() => setShowDebugger(true)}
            className="px-3 py-1 text-sm font-medium bg-red-500 text-white rounded-md hover:bg-red-600"
          >
            Debug Open Block
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
                      const isUserChildBeingCaredFor = block.care_type === 'provided' && children.some(c => c.id === block.child_id);
                      
                      // Determine the visual style based on user context
                      let blockStyle = '';
                      let blockText = '';
                      
                      // Get all children for this block (including additional children from open block acceptances)
                      const allChildren = block.allChildren || [{ child_id: block.child_id, providing_parent_id: block.parent_id, children: block.children }];
                      
                      // For the original block (Parent B's block), show ALL children being cared for
                      // For reciprocal blocks (Parent C's providing care), show only the children they're providing care for
                      let relevantChildren;
                      if (block.care_type === 'provided' && block.parent_id === user?.id) {
                        // This is a "providing care" block for the current user - show only children they're caring for
                        relevantChildren = allChildren.filter((child: any) => 
                          child.providing_parent_id === block.parent_id
                        );
                      } else {
                        // This is either the original block or a "being cared for" block - show ALL children
                        relevantChildren = allChildren;
                      }
                      
                      const childNames = relevantChildren.map((child: any) => child.children?.full_name || getChildName((child.child_id || ''), undefined, block)).join(', ');
                      
                      if (isUserProviding) {
                        // User is providing care for someone else's child
                        blockStyle = 'bg-green-100 text-green-800 border border-green-300';
                        blockText = `Providing care for ${childNames}`;
                      } else if (isUserChildBeingCaredFor) {
                        // Someone else is providing care for user's child
                        const providingParentName = getParentName(block.parent_id);
                        blockStyle = 'bg-blue-100 text-blue-800 border border-blue-300';
                        blockText = `${providingParentName} providing care for ${childNames}`;
                      } else if (isUserChildNeeding) {
                        // User's child needs care (someone else is providing)
                        // For "needed" blocks, we need to find the providing parent from the related request/response
                        const originalRequest = findOriginalRequestForBlockSync(block);
                        
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
                        blockText = `${providingParentName} providing care for ${childNames}`;
                        } else {
                        // Other care arrangements
                        if (block.care_type === 'needed') {
                          // For "needed" blocks, show who is providing care
                          const originalRequest = findOriginalRequestForBlockSync(block);
                          
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
                          blockText = `${providingParentName} providing care for ${childNames}`;
                        } else {
                          // For "provided" blocks
                          blockStyle = 'bg-gray-100 text-gray-800 border border-gray-300';
                          blockText = `Providing care for ${childNames}`;
                        }
                      }
                      
                      return (
                        <div
                          key={block.id}
                          className={`text-xs p-1 rounded cursor-pointer ${blockStyle} relative`}
                          onDoubleClick={() => handleBlockDoubleClick(block)}
                          title={`${block.care_type === 'needed' ? 'Care Needed' : 'Care Provided'} - ${formatTime(block.start_time)} to ${formatTime(block.end_time)} - ${childNames}`}
                        >
                          <div className="font-medium truncate">
                            {blockText}
                          </div>
                          <div className="text-xs opacity-75">
                            {formatTime(block.start_time)} - {formatTime(block.end_time)}
                          </div>
                          {relevantChildren.length > 1 && (
                            <div className="text-xs opacity-60 mt-1">
                              {relevantChildren.length} children
                            </div>
                          )}
                          

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

      {/* Invitations Section */}
      {invitations.length > 0 && (
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Group Invitations</h3>
          <div className="space-y-4">
            {invitations.map((invitation) => (
              <div key={invitation.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">
                      Invitation from {getParentName(invitation.inviter_id)}
                    </h4>
                    <p className="text-sm text-gray-600">
                      Date: {invitation.invitation_date} | Time: {formatTime(invitation.invitation_start_time)} - {formatTime(invitation.invitation_end_time)}
                    </p>
                    <p className="text-sm text-gray-600">
                      Group: {getGroupName(invitation.group_id)} | Status: {invitation.status}
                    </p>
                    {invitation.notes && (
                      <p className="text-sm text-gray-600 mt-1">Notes: {invitation.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    {invitation.inviter_id === user?.id ? (
                      // Original inviter - show proposals button
                      <button
                        onClick={() => handleViewResponses(invitation)}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                      >
                        View Responses
                      </button>
                    ) : invitation.inviter_id !== user?.id && invitation.status === 'pending' ? (
                      // Any other parent in the group can respond
                      <button
                        onClick={() => handleAcceptInvitation(invitation)}
                        className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                      >
                        Accept Invitation
                      </button>
                    ) : (
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        invitation.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        invitation.status === 'accepted' ? 'bg-green-100 text-green-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {invitation.status}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
               {/* Request Type - Hidden, defaults to reciprocal */}
               <input type="hidden" value="reciprocal" />
               <div className="p-3 bg-blue-50 rounded-md">
                 <p className="text-sm text-blue-900">
                   <strong>Reciprocal Care Request:</strong> This will create a request for reciprocal care exchange.
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
                   {requestForm.groupId && getActiveChildrenForGroup(requestForm.groupId).map(child => (
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

               {/* Notes */}
               <div>
                 <label className="block text-sm font-medium text-gray-700">Notes</label>
                 <textarea
                   value={requestForm.notes}
                   onChange={(e: any) => setRequestForm(prev => ({ ...prev, notes: e.target.value }))}
                   className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                   rows={3}
                   placeholder="Additional notes..."
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
                 onClick={() => {
                   setShowCreateCareRequest(false);
                   setRequestForm({
                     groupId: '',
                     childId: '',
                     requestedDate: '',
                     startTime: '',
                     endTime: '',
                     notes: '',
                     requestType: 'reciprocal',
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
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
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
              {selectedRequest?.request_type !== 'reciprocal' && (
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
              )}
                            {selectedRequest?.request_type === 'reciprocal' && (
                <div className="p-3 bg-blue-50 rounded-md">
                  <p className="text-sm text-blue-900">
                    <strong>Reciprocal Request:</strong> You can provide reciprocal care times below.
                  </p>
                </div>
              )}
              {selectedRequest?.request_type === 'open_block' && (
                <div className="p-3 bg-green-50 rounded-md">
                  <p className="text-sm text-green-900">
                    <strong>Open Block Request:</strong> Accept to create the reciprocal care arrangement.
                  </p>
                </div>
              )}
              {responseType === 'accept' && selectedRequest?.request_type !== 'open_block' && (
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
                       {selectedRequest && getActiveChildrenForGroup(selectedRequest.group_id).map(child => (
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
                onClick={() => respondToCareRequest()}
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
                 {requests.filter(request => request.request_type !== 'event' && request.status !== 'cancelled').map(request => (
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
                   {request.request_type === 'open_block' && (
                     <div className="mt-2 p-3 bg-green-50 rounded-md">
                       <p className="text-sm text-green-900 font-medium">
                         Open Block Invitation from {getParentName(request.requester_id)}
                       </p>
                       <p className="text-sm text-green-800 mt-1">
                         <strong>Care Offer:</strong> {request.requested_date} from {formatTime(request.start_time)} to {formatTime(request.end_time)}
                       </p>
                       <p className="text-sm text-green-700 mt-1">
                         <strong>What happens when you accept:</strong> Two care blocks will be created:
                       </p>
                       <ul className="text-sm text-green-700 mt-1 ml-4">
                         <li>• {getParentName(request.requester_id)} will care for your child during the time above ({request.requested_date} from {formatTime(request.start_time)} to {formatTime(request.end_time)})</li>
                         <li>• You will care for {getParentName(request.requester_id)}'s child during their original care block time ({request.reciprocal_date} from {formatTime(request.reciprocal_start_time)} to {formatTime(request.reciprocal_end_time)})</li>
                       </ul>
                     </div>
                   )}
                   {request.notes && (
                     <p className="text-sm text-gray-600 mt-1">{request.notes}</p>
                   )}
                 </div>
                 <div className="flex space-x-2 ml-4">
                   {/* Show different buttons based on request type and user role */}
                   {request.request_type === 'open_block' ? (
                     // Special handling for open block requests
                     <>
                       {request.open_block_parent_id === user?.id ? (
                         // Parent B (creator) can edit/cancel their open block requests
                         <>
                           <button
                             onClick={() => handleEditRequest(request)}
                             className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                           >
                             Edit
                           </button>
                           <button
                             onClick={() => handleCancelRequest(request)}
                             className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                           >
                             Cancel
                           </button>
                         </>
                       ) : (
                         // Parent C/D (invited parents) can accept/decline
                         <>
                           <button
                             onClick={() => {
                               setSelectedOpenBlockInvitation(request);
                               setOpenBlockResponseType('accept');
                               setOpenBlockResponseChildId('');
                               setOpenBlockResponseNotes('');
                               setShowOpenBlockResponseModal(true);
                             }}
                             className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                           >
                             Accept
                           </button>
                           <button
                             onClick={() => {
                               setSelectedOpenBlockInvitation(request);
                               setOpenBlockResponseType('decline');
                               setOpenBlockResponseChildId('');
                               setOpenBlockResponseNotes('');
                               setShowOpenBlockResponseModal(true);
                             }}
                             className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                           >
                             Decline
                           </button>
                         </>
                       )}
                     </>
                   ) : request.requester_id !== user?.id ? (
                     // Non-creators can accept/reject requests (for non-open-block requests)
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
                           {(() => {
                             const shouldShowButtons = !responses.some(r => r.request_id === request.id && r.responder_id === user?.id) && 
                               request.status !== 'accepted';
                             
                             return shouldShowButtons;
                           })() && (
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
                   ) : (
                     // Creators can edit/cancel their own requests (for non-open-block requests)
                     <>
                       <button
                         onClick={() => handleEditRequest(request)}
                         className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                       >
                         Edit
                       </button>
                       <button
                         onClick={() => handleCancelRequest(request)}
                         className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                       >
                         Cancel
                       </button>
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
             className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
           >
             Create Event
           </button>
                 </div>
         <div className="space-y-4">
           {requests.filter(request => request.request_type === 'event' && request.status !== 'cancelled').map(request => (
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
                   {request.requester_id !== user?.id ? (
                     // Non-creators can RSVP to events
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
                     // Creators can edit/cancel their own events
                     <>
                       <button
                         onClick={() => handleEditRequest(request)}
                         className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                       >
                         Edit
                       </button>
                       <button
                         onClick={() => handleCancelRequest(request)}
                         className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                       >
                         Cancel
                       </button>
                     </>
                   )}
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
             {(() => {
               const filteredResponses = responses.filter(response => {
                 const request = requests.find(r => r.id === response.request_id);
                 return request && request.requester_id === user?.id;
               });
               
               console.log('Filtered responses for user requests:', filteredResponses.map(r => ({
                 id: r.id,
                 request_id: r.request_id,
                 responder_id: r.responder_id,
                 response_type: r.response_type,
                 status: r.status
               })));
               
               return filteredResponses.map(response => {
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
                             (response.response_type === 'accept' || (response.response_type === 'pending' && request.request_type === 'reciprocal')) && request.request_type === 'reciprocal' ? 'bg-blue-100 text-blue-800' :
                             response.response_type === 'accept' ? 'bg-green-100 text-green-800' :
                             response.response_type === 'decline' ? 'bg-red-100 text-red-800' :
                             'bg-yellow-100 text-yellow-800'
                           }`}>
                             {(response.response_type === 'accept' || (response.response_type === 'pending' && request.request_type === 'reciprocal')) && request.request_type === 'reciprocal' ? 'Reciprocal Offered' :
                              response.response_type === 'accept' ? 'Accepted' :
                              response.response_type === 'decline' ? 'Declined' : 'Pending'}
                           </span>
                         </div>
                         <p className="text-sm text-gray-600">
                           For: {getChildName(request.child_id, request)} on {request.requested_date} • {formatTime(request.start_time)} - {formatTime(request.end_time)}
                         </p>
                         {(response.response_type === 'accept' || (response.response_type === 'pending' && request.request_type === 'reciprocal')) && response.reciprocal_date && (
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
                         {(response.response_type === 'accept' || (response.response_type === 'pending' && request.request_type === 'reciprocal')) && response.status === 'pending' && (
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
               });
             })()}
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
                  const originalRequest = findOriginalRequestForBlockSync(block);
                  
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
                    const originalRequest = findOriginalRequestForBlockSync(block);
                    
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

              {/* Dynamic Time Blocks Section - Only show if children are selected */}
              {inviteForm.selectedMembers.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">
                    Time Blocks for Reciprocal Care ({inviteForm.selectedMembers.length} selected)
                  </h4>
                  <div className="space-y-4">
                    {inviteForm.selectedMembers.map((childId, index) => {
                      const selectedChild = availableChildren.find(child => child.child_id === childId);
                      const timeBlock = inviteForm.timeBlocks[index] || { date: '', startTime: '', endTime: '' };
                      
                      return (
                        <div key={childId} className="border border-gray-200 rounded-lg p-4">
                          <h5 className="font-medium text-gray-800 mb-3">
                            Reciprocal Care for {selectedChild?.child_name}
                          </h5>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Date
                              </label>
                              <input
                                type="date"
                                value={timeBlock.date}
                                onChange={(e) => updateTimeBlock(index, 'date', e.target.value)}
                                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Start Time
                              </label>
                              <input
                                type="time"
                                value={timeBlock.startTime}
                                onChange={(e) => updateTimeBlock(index, 'startTime', e.target.value)}
                                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                End Time
                              </label>
                              <input
                                type="time"
                                value={timeBlock.endTime}
                                onChange={(e) => updateTimeBlock(index, 'endTime', (e.target as HTMLInputElement).value)}
                                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                                required
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <h4 className="font-medium text-gray-900 mb-2">Open Block Invitation Information</h4>
                <div className="bg-blue-50 p-3 rounded-md">
                  <p className="text-sm text-blue-900">
                    <strong>You are creating open block invitations for reciprocal care:</strong>
                  </p>
                  <p className="text-sm text-blue-700 mt-1">
                    <strong>Your Original Care Block:</strong> {selectedRequest.requested_date} from {formatTime(selectedRequest.start_time)} to {formatTime(selectedRequest.end_time)}
                  </p>
                  <p className="text-sm text-blue-700 mt-2">
                    <strong>How it works:</strong> For each child you select, you'll specify a time block where you're offering to care for their child. When they accept, both care blocks will be created automatically - you caring for their child during your specified time, and them caring for your child during your original care block time.
                  </p>
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

      {/* Edit Care Request Modal */}
      {showEditModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium mb-4">Edit Care Request</h3>
            
            <div className="space-y-4">
              {/* Group Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Group</label>
                <select
                  value={requestForm.groupId}
                  onChange={(e: any) => setRequestForm(prev => ({ ...prev, groupId: e.target.value }))}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="">Select a group</option>
                  {getGroupsByType('care').map(group => (
                    <option key={group.id} value={group.id}>{group.name}</option>
                  ))}
                </select>
              </div>

              {/* Child Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Child</label>
                <select
                  value={requestForm.childId}
                  onChange={(e: any) => setRequestForm(prev => ({ ...prev, childId: e.target.value }))}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="">Select a child</option>
                  {requestForm.groupId && getActiveChildrenForGroup(requestForm.groupId).map(child => (
                    <option key={child.id} value={child.id}>{child.full_name}</option>
                  ))}
                </select>
              </div>

              {/* Request Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Request Type</label>
                <select
                  value={requestForm.requestType}
                  onChange={(e: any) => setRequestForm(prev => ({ 
                    ...prev, 
                    requestType: e.target.value as 'simple' | 'reciprocal' | 'event' | 'open_block' 
                  }))}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="simple">Simple Care Request</option>
                  <option value="reciprocal">Reciprocal Care Request</option>
                  <option value="event">Event</option>
                  <option value="open_block">Open Block</option>
                </select>
              </div>

              {/* Date and Time */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Date</label>
                  <input
                    type="date"
                    value={requestForm.requestedDate}
                    onChange={(e: any) => setRequestForm(prev => ({ ...prev, requestedDate: e.target.value }))}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
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
                      placeholder="Enter event title"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Event Description</label>
                    <textarea
                      value={requestForm.eventDescription}
                      onChange={(e: any) => setRequestForm(prev => ({ ...prev, eventDescription: e.target.value }))}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      rows={3}
                      placeholder="Enter event description"
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
                </>
              )}

              {/* Open Block fields */}
              {requestForm.requestType === 'open_block' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Number of Slots</label>
                  <input
                    type="number"
                    min="1"
                    value={requestForm.openBlockSlots}
                    onChange={(e: any) => setRequestForm(prev => ({ ...prev, openBlockSlots: parseInt(e.target.value) }))}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  value={requestForm.notes}
                  onChange={(e: any) => setRequestForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  rows={3}
                  placeholder="Additional notes..."
                />
              </div>
            </div>

            <div className="mt-6 flex space-x-3">
              <button
                onClick={updateCareRequest}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Update Request
              </button>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedRequest(null);
                        setRequestForm({
        groupId: '',
        childId: '',
        requestedDate: '',
        startTime: '',
        endTime: '',
        notes: '',
        requestType: 'reciprocal',
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
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Proposals Modal */}
      {showProposalsModal && selectedInvitationForProposals && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium mb-4">Invitation Responses</h3>
            
            {/* Invitation Details */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Invitation Details</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Date:</span> {selectedInvitationForProposals.invitation_date}
                </div>
                <div>
                  <span className="font-medium">Time:</span> {formatTime(selectedInvitationForProposals.invitation_start_time)} - {formatTime(selectedInvitationForProposals.invitation_end_time)}
                </div>
                <div>
                  <span className="font-medium">Group:</span> {getGroupName(selectedInvitationForProposals.group_id)}
                </div>
                <div>
                  <span className="font-medium">Status:</span> {selectedInvitationForProposals.status}
                </div>
              </div>
            </div>

            {/* Proposals List */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Responses ({invitationProposals.length})</h4>
              
              {invitationProposals.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No responses received yet.
                </div>
              ) : (
                invitationProposals.map((proposal) => (
                  <div key={proposal.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h5 className="font-medium text-gray-900">{proposal.proposer_name}</h5>
                        <p className="text-sm text-gray-600">Child: {proposal.selected_child_name}</p>
                        <p className="text-sm text-gray-600">Time Block: {proposal.selected_time_block_index}</p>
                        <p className="text-sm text-gray-600">Submitted: {new Date(proposal.created_at).toLocaleString()}</p>
                        {proposal.notes && (
                          <p className="text-sm text-gray-600 mt-1">Notes: {proposal.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          proposal.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          proposal.status === 'accepted' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {proposal.status}
                        </span>
                        {proposal.status === 'pending' && (
                                                  <button
                          onClick={() => acceptInvitationResponse(proposal.id)}
                          className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                        >
                          Accept
                        </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  setShowProposalsModal(false);
                  setSelectedInvitationForProposals(null);
                  setInvitationProposals([]);
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Open Block Modal */}
      {showOpenBlockModal && selectedCareBlock && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          {console.log('Open Block Modal is rendering')}
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">
                Open Block Invitation
              </h3>
              <button
                onClick={() => setShowOpenBlockModal(false)}
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
                    <strong>Date:</strong> {selectedCareBlock.care_date}
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Time:</strong> {formatTime(selectedCareBlock.start_time)} - {formatTime(selectedCareBlock.end_time)}
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Child:</strong> {getChildName(selectedCareBlock.child_id, undefined, selectedCareBlock)}
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Group:</strong> {getGroupName(selectedCareBlock.group_id)}
                  </p>
                </div>
              </div>



              <div>
                <h4 className="font-medium text-gray-900 mb-2">Select Parents to Invite</h4>
                <div className="space-y-2">
                  {(() => {
                    console.log('Available parents for open block:', availableParentsForOpenBlock);
                    console.log('All profiles:', allProfiles.length);
                    console.log('All group children:', allGroupChildren.length);
                    
                    if (availableParentsForOpenBlock.length > 0) {
                      return availableParentsForOpenBlock.map(parent => (
                        <label key={parent.id} className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            checked={openBlockForm.invitedParentIds.includes(parent.id)}
                            onChange={() => toggleParentSelection(parent.id)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">
                            {parent.full_name}
                          </span>
                        </label>
                      ));
                    } else {
                      return (
                        <div className="text-sm text-gray-500">
                          <p>No parents available for this time slot.</p>
                          <p className="mt-1 text-xs">Debug info: {allProfiles.length} profiles, {allGroupChildren.length} group children</p>
                        </div>
                      );
                    }
                  })()}
                </div>
              </div>

              {/* Selected Parents Summary */}
              {openBlockForm.invitedParentIds.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">
                    Selected Parents ({openBlockForm.invitedParentIds.length} selected)
                  </h4>
                  <div className="bg-green-50 p-3 rounded-md">
                    <p className="text-sm text-green-800">
                      You have selected {openBlockForm.invitedParentIds.length} parent(s) to invite to your open block.
                    </p>
                    <p className="text-sm text-green-700 mt-1">
                      When they accept, they will choose which of their children will receive care during your specified time.
                    </p>
                  </div>
                </div>
              )}

              {/* Multiple Reciprocal Care Time Slots */}
              {openBlockForm.invitedParentIds.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium text-gray-900 mb-2">
                    When You Need Care for Your Child
                  </h4>
                  <p className="text-sm text-gray-600 mb-3">
                    Specify time slots for when you need each invited parent to take care of your child in exchange for your care block. One time slot will be created for each selected parent.
                  </p>
                  
                  {/* Time Slot List */}
                  <div className="space-y-3">
                    {openBlockForm.reciprocalTimeSlots.map((slot, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex justify-between items-center mb-2">
                          <h5 className="font-medium text-gray-800">Time Slot {index + 1} (for Parent {index + 1})</h5>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Date
                              </label>
                              <input
                                type="date"
                              value={slot.date}
                              onChange={(e) => updateReciprocalTimeSlot(index, 'date', (e.target as HTMLInputElement).value)}
                                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Start Time
                              </label>
                              <input
                                type="time"
                              value={slot.startTime}
                              onChange={(e) => updateReciprocalTimeSlot(index, 'startTime', (e.target as HTMLInputElement).value)}
                                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                End Time
                              </label>
                              <input
                                type="time"
                              value={slot.endTime}
                              onChange={(e) => updateReciprocalTimeSlot(index, 'endTime', (e.target as HTMLInputElement).value)}
                                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                                required
                              />
                            </div>
                            </div>
                          </div>
                    ))}
                        </div>
                  
                  {/* Time Slots Info */}
                  <div className="mt-3 bg-yellow-50 p-3 rounded-md">
                    <p className="text-sm text-yellow-800">
                      <strong>Time Slots:</strong> {openBlockForm.reciprocalTimeSlots.length} time slot(s) will be created - one for each selected parent.
                    </p>
                  </div>
                  
                  <div className="mt-3 bg-blue-50 p-3 rounded-md">
                    <p className="text-sm text-blue-800">
                      <strong>Exchange:</strong> You will care for their child during your block, 
                      and they will care for your child during one of the time slots you specify above.
                    </p>
                    <p className="text-sm text-blue-700 mt-1">
                      <strong>How it works:</strong> Each invited parent will see their assigned time slot. When one parent accepts their slot, 
                      that slot becomes unavailable to other parents.
                    </p>
                  </div>
                </div>
              )}

              <div>
                <h4 className="font-medium text-gray-900 mb-2">Open Block Invitation Information</h4>
                <div className="bg-blue-50 p-3 rounded-md">
                  <p className="text-sm text-blue-900">
                    <strong>You are creating open block invitations for reciprocal care:</strong>
                  </p>
                  <p className="text-sm text-blue-700 mt-1">
                    <strong>Your Original Care Block:</strong> {selectedCareBlock.care_date} from {formatTime(selectedCareBlock.start_time)} to {formatTime(selectedCareBlock.end_time)}
                  </p>
                  <p className="text-sm text-blue-700 mt-2">
                    <strong>How it works:</strong> For each parent you select, you'll specify a time block where you're offering to care for their child. When they accept the invitation, they will choose which of their children will receive care during your specified time, and you will care for their child during your original care block time.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  value={openBlockForm.notes}
                  onChange={(e) => setOpenBlockForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  rows={3}
                  placeholder="Optional notes for the invitation..."
                />
              </div>
            </div>

            <div className="mt-6 flex space-x-3">
              <button
                onClick={handleOpenBlockSubmit}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Send Invitations
              </button>
              <button
                onClick={() => setShowOpenBlockModal(false)}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Open Block Response Modal */}
      {showOpenBlockResponseModal && selectedOpenBlockInvitation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">Respond to Open Block Invitation</h3>
            <div className="space-y-4">
              <div className="p-3 bg-green-50 rounded-md">
                <p className="text-sm text-green-900">
                  <strong>Open Block Invitation:</strong> You can accept or decline this invitation.
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Response</label>
                <select
                  value={openBlockResponseType}
                  onChange={(e) => setOpenBlockResponseType(e.target.value as 'accept' | 'decline')}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="accept">Accept</option>
                  <option value="decline">Decline</option>
                </select>
              </div>

              {openBlockResponseType === 'accept' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Your Child to Add to Care</label>
                  <p className="text-xs text-gray-600 mb-2">Select which of your children will be cared for during this time</p>
                  <select
                    value={openBlockResponseChildId}
                    onChange={(e) => setOpenBlockResponseChildId(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="">Select a child</option>
                    {children.map(child => (
                      <option key={child.id} value={child.id}>{child.full_name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  value={openBlockResponseNotes}
                  onChange={(e) => setOpenBlockResponseNotes(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  rows={3}
                  placeholder="Optional notes..."
                />
              </div>
            </div>
            <div className="mt-6 flex space-x-3">
              <button
                onClick={() => handleOpenBlockResponse(selectedOpenBlockInvitation.id, openBlockResponseType, openBlockResponseChildId)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Submit Response
              </button>
              <button
                onClick={() => setShowOpenBlockResponseModal(false)}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Debugger Modal */}
      {showDebugger && (
        <OpenBlockDebugger onClose={() => setShowDebugger(false)} />
      )}
      </div>
    </div>
  );
} 