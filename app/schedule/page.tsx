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
  created_at: string;
  children?: {
    full_name: string;
  };
  // Event fields
  event_title?: string;
  event_description?: string;
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

  // State for modals
  const [showCreateRequest, setShowCreateRequest] = useState(false);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showAcceptInvitationModal, setShowAcceptInvitationModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<CareRequest | null>(null); // Updated type
  const [selectedInvitation, setSelectedInvitation] = useState<GroupInvitation | null>(null);
  const [responseType, setResponseType] = useState<'accept' | 'decline'>('accept');
  const [availableTimeBlocks, setAvailableTimeBlocks] = useState<InvitationTimeBlock[]>([]);
  const [availableGroupMembers, setAvailableGroupMembers] = useState<AvailableGroupMember[]>([]);
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
  }, [user, currentDate]);

  // Updated function name and table references
  const fetchScheduledCare = async (userId: string, date: Date) => {
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

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
      .gte("care_date", startOfMonth.toISOString().split('T')[0]) // Updated column name
      .lte("care_date", endOfMonth.toISOString().split('T')[0]) // Updated column name
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
        .gte("care_date", startOfMonth.toISOString().split('T')[0]) // Updated column name
        .lte("care_date", endOfMonth.toISOString().split('T')[0]) // Updated column name
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

    // Combine and deduplicate the results
    const allBlocks = [...(userBlocks || []), ...childCareNeededBlocks];
    const uniqueBlocks = allBlocks.filter((block, index, self) => 
      index === self.findIndex(b => b.id === block.id)
    );

    console.log('Fetched scheduled care blocks:', uniqueBlocks);
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

    // Fetch all requests (pending, active and closed) from user's groups with child data
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
      .in("status", ["pending", "active", "closed"])
      .order("created_at", { ascending: false });

    setRequests(requestsData || []);

    // Fetch responses for these requests
    if (requestsData && requestsData.length > 0) {
      const requestIds = requestsData.map(r => r.id);
      const { data: responsesData } = await supabase
        .from("care_responses") // Updated table name
        .select("*")
        .in("request_id", requestIds)
        .order("created_at", { ascending: false });

      setResponses(responsesData || []);
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

  const getActiveChildrenForGroup = (groupId: string) => {
    return activeChildrenPerGroup[groupId] || [];
  };

  // Updated function names and types
  const createCareRequest = async () => {
    if (!user || !requestForm.groupId || !requestForm.childId || !requestForm.requestedDate || !requestForm.startTime || !requestForm.endTime) {
      alert('Please fill in all required fields');
      return;
    }

    // Validate request type specific fields
    if (requestForm.requestType === 'event' && (!requestForm.eventTitle || !requestForm.eventDescription)) {
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
        request_type: requestForm.requestType,
        status: 'pending'
      };

      // Add request type specific fields
      if (requestForm.requestType === 'event') {
        requestData.event_title = requestForm.eventTitle;
        requestData.event_description = requestForm.eventDescription;
      }

      if (requestForm.requestType === 'open_block') {
        requestData.open_block_slots = requestForm.openBlockSlots;
        requestData.open_block_parent_id = user.id;
      }

      if (requestForm.requestType === 'reciprocal') {
        requestData.is_reciprocal = true;
      }

      const { error } = await supabase
        .from("care_requests")
        .insert(requestData);

      if (error) {
        console.error('Error creating care request:', error);
        alert('Error creating request: ' + error.message);
        return;
      }

      // Refresh data
      await fetchRequestsAndResponses(user.id);
      setShowCreateRequest(false);
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

  const handleInviteOthers = async (request: CareRequest) => {
    setSelectedRequest(request);
    setShowInviteModal(true);
  };

  const sendInvitations = async () => {
    // Implementation for sending invitations
    // This would need to be updated based on your invitation system
    alert('Invitations sent successfully!');
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

  const toggleMemberSelection = (memberId: string) => {
    setInviteForm(prev => ({
      ...prev,
      selectedMembers: prev.selectedMembers.includes(memberId)
        ? prev.selectedMembers.filter(id => id !== memberId)
        : [...prev.selectedMembers, memberId]
    }));
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
    return group?.name || 'Unknown Group';
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
    const profile = allProfiles.find(p => p.id === parentId);
    return profile?.full_name || `Parent (${parentId.slice(0, 8)}...)`;
  };

  const handlePreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // Updated function with new types
  const findOriginalRequestForBlock = (block: ScheduledCare): CareRequest | null => {
    return requests.find(request => request.id === block.related_request_id) || null;
  };

  const handleBlockDoubleClick = async (block: ScheduledCare) => { // Updated type
    const originalRequest = findOriginalRequestForBlock(block);
    if (originalRequest) {
      setSelectedRequest(originalRequest);
      setShowResponseModal(true);
    }
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

  const days = getDaysInMonth(currentDate);
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
          onClick={() => router.push('/groups')}
          className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition font-medium"
        >
          Groups
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
        <button
          onClick={handlePreviousMonth}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Previous
        </button>
        <h2 className="text-xl font-semibold text-gray-900">
          {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h2>
        <button
          onClick={handleNextMonth}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Next
        </button>
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
              className={`min-h-[120px] bg-white p-2 ${
                day ? 'hover:bg-gray-50' : 'bg-gray-100'
              }`}
            >
              {day && (
                <>
                  <div className="text-sm font-medium text-gray-900 mb-1">
                    {day.getDate()}
                  </div>
                  <div className="space-y-1">
                    {getBlocksForDate(day).map(block => {
                      console.log('Rendering block:', block);
                      const isUserProviding = block.parent_id === user?.id && block.care_type === 'provided';
                      const isUserNeeding = block.parent_id === user?.id && block.care_type === 'needed';
                      const isUserChildNeeding = block.care_type === 'needed' && children.some(c => c.id === block.child_id);
                      
                      // Determine the visual style based on user context
                      let blockStyle = '';
                      let blockText = '';
                      
                      if (isUserProviding) {
                        // User is providing care for someone else's child
                        blockStyle = 'bg-green-100 text-green-800 border border-green-300';
                        blockText = `Providing care for ${block.children?.full_name || getChildName(block.child_id, undefined, block)}`;
                      } else if (isUserNeeding) {
                        // User's child needs care
                        blockStyle = 'bg-red-100 text-red-800 border border-red-300';
                        blockText = `Need: ${block.children?.full_name || getChildName(block.child_id, undefined, block)}`;
                      } else if (isUserChildNeeding) {
                        // User's child needs care (but user is not the parent_id)
                        blockStyle = 'bg-orange-100 text-orange-800 border border-orange-300';
                        blockText = `Child: ${block.children?.full_name || getChildName(block.child_id, undefined, block)}`;
                      } else {
                        // Other care arrangements
                        if (block.care_type === 'needed') {
                          // For "needed" blocks, show who is providing care
                          const providingParentName = getParentName(block.parent_id);
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
      <div className="mt-6 flex space-x-4">
        <button
          onClick={() => setShowCreateRequest(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Create Care Request
        </button>
      </div>

             {/* Create Request Modal */}
       {showCreateRequest && (
         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
           <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
             <h3 className="text-lg font-medium mb-4">Create Care Request</h3>
             <div className="space-y-4">
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
                   <option value="simple">Simple Request</option>
                   <option value="reciprocal">Reciprocal Request</option>
                   <option value="event">Event Request</option>
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
                   onChange={(e: any) => setRequestForm(prev => ({ ...prev, groupId: e.target.value }))}
                   className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                 >
                   <option value="">Select a group</option>
                   {groups.map(group => (
                     <option key={group.id} value={group.id}>{group.name}</option>
                   ))}
                 </select>
               </div>
               
               <div>
                 <label className="block text-sm font-medium text-gray-700">Child</label>
                 <select
                   value={requestForm.childId}
                   onChange={(e: any) => setRequestForm(prev => ({ ...prev, childId: e.target.value }))}
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
                 onClick={() => setShowCreateRequest(false)}
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

             {/* Requests List */}
       <div className="mt-8">
         <h3 className="text-lg font-medium text-gray-900 mb-4">Active Care Requests</h3>
         <div className="space-y-4">
           {requests.map(request => (
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
                   {/* Only show Agree/Reject buttons if the logged-in user is not the creator AND no response has been submitted */}
                   {request.requester_id !== user?.id && !responses.some(r => r.request_id === request.id) && (
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
                   {request.request_type === 'open_block' && (
                     <button
                       onClick={() => handleInviteOthers(request)}
                       className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                     >
                       Join Block
                     </button>
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
    </div>
  );
} 