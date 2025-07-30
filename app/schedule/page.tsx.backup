// Fixed Schedule Page - Updated for New 3-Table System
// This file replaces app/schedule/page.tsx with correct table references

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

interface User {
  id: string;
  email: string;
}

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
  care_type: 'care_needed' | 'care_provided'; // Changed from block_type
  status: string;
  request_id: string;
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
  status: string;
  created_at: string;
  children?: {
    full_name: string;
  };
}

// Updated interface for new care_responses table
interface CareResponse {
  id: string;
  request_id: string;
  responder_id: string;
  response_type: 'agree' | 'reject';
  reciprocal_date?: string;
  reciprocal_start_time?: string;
  reciprocal_end_time?: string;
  reciprocal_duration_minutes?: number;
  reciprocal_child_id?: string;
  notes?: string;
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
  const [responseType, setResponseType] = useState<'agree' | 'reject'>('agree');
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
    notes: ''
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
        .eq("care_type", "care_needed") // Updated column name
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

    // Fetch all requests (active and closed) from user's groups with child data
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
      .in("status", ["active", "closed"])
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

    try {
      const { error } = await supabase
        .from("care_requests") // Updated table name
        .insert({
          group_id: requestForm.groupId,
          requester_id: user.id, // Updated column name
          child_id: requestForm.childId,
          requested_date: requestForm.requestedDate,
          start_time: requestForm.startTime,
          end_time: requestForm.endTime,
          notes: requestForm.notes,
          status: 'active'
        });

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
        notes: ''
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
          notes: responseForm.notes,
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
    setSelectedRequest(request);
    setResponseType('agree');
    setShowResponseModal(true);
  };

  const handleRejectRequest = async (request: CareRequest) => {
    setSelectedRequest(request);
    setResponseType('reject');
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
    return time;
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

  const handlePreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // Updated function with new types
  const findOriginalRequestForBlock = (block: ScheduledCare): CareRequest | null => {
    return requests.find(request => request.id === block.request_id) || null;
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
                    {getBlocksForDate(day).map(block => (
                      <div
                        key={block.id}
                        className={`text-xs p-1 rounded cursor-pointer ${
                          block.care_type === 'care_needed' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-green-100 text-green-800'
                        }`}
                        onDoubleClick={() => handleBlockDoubleClick(block)}
                        title={`${block.care_type === 'care_needed' ? 'Care Needed' : 'Care Provided'} - ${formatTime(block.start_time)} to ${formatTime(block.end_time)}`}
                      >
                        {formatTime(block.start_time)} - {formatTime(block.end_time)}
                      </div>
                    ))}
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
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">Create Care Request</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Group</label>
                <select
                  value={requestForm.groupId}
                  onChange={(e) => setRequestForm(prev => ({ ...prev, groupId: e.target.value }))}
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
                  onChange={(e) => setRequestForm(prev => ({ ...prev, childId: e.target.value }))}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="">Select a child</option>
                  {children.map(child => (
                    <option key={child.id} value={child.id}>{child.full_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Date</label>
                <input
                  type="date"
                  value={requestForm.requestedDate}
                  onChange={(e) => setRequestForm(prev => ({ ...prev, requestedDate: e.target.value }))}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Start Time</label>
                  <input
                    type="time"
                    value={requestForm.startTime}
                    onChange={(e) => setRequestForm(prev => ({ ...prev, startTime: e.target.value }))}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">End Time</label>
                  <input
                    type="time"
                    value={requestForm.endTime}
                    onChange={(e) => setRequestForm(prev => ({ ...prev, endTime: e.target.value }))}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  value={requestForm.notes}
                  onChange={(e) => setRequestForm(prev => ({ ...prev, notes: e.target.value }))}
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
                  onChange={(e) => setResponseType(e.target.value as 'agree' | 'reject')}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="agree">Agree</option>
                  <option value="reject">Reject</option>
                </select>
              </div>
              {responseType === 'agree' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Reciprocal Date</label>
                    <input
                      type="date"
                      value={responseForm.reciprocalDate}
                      onChange={(e) => setResponseForm(prev => ({ ...prev, reciprocalDate: e.target.value }))}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Start Time</label>
                      <input
                        type="time"
                        value={responseForm.reciprocalStartTime}
                        onChange={(e) => setResponseForm(prev => ({ ...prev, reciprocalStartTime: e.target.value }))}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">End Time</label>
                      <input
                        type="time"
                        value={responseForm.reciprocalEndTime}
                        onChange={(e) => setResponseForm(prev => ({ ...prev, reciprocalEndTime: e.target.value }))}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Reciprocal Child</label>
                    <select
                      value={responseForm.reciprocalChildId}
                      onChange={(e) => setResponseForm(prev => ({ ...prev, reciprocalChildId: e.target.value }))}
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
                  onChange={(e) => setResponseForm(prev => ({ ...prev, notes: e.target.value }))}
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
                <div>
                  <h4 className="font-medium text-gray-900">
                    Care Request for {getChildName(request.child_id, request)}
                  </h4>
                  <p className="text-sm text-gray-600">
                    {request.requested_date} • {formatTime(request.start_time)} - {formatTime(request.end_time)}
                  </p>
                  <p className="text-sm text-gray-600">
                    Group: {getGroupName(request.group_id)} • Requested by: {getInitiatorName(request.requester_id)}
                  </p>
                  {request.notes && (
                    <p className="text-sm text-gray-600 mt-1">{request.notes}</p>
                  )}
                </div>
                <div className="flex space-x-2">
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
                  <button
                    onClick={() => handleInviteOthers(request)}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Invite Others
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 