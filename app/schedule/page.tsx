"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import LogoutButton from "../components/LogoutButton";
import type { User } from "@supabase/supabase-js";

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

interface ScheduledBlock {
  id: string;
  group_id: string;
  parent_id: string;
  child_id: string;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  block_type: 'care_needed' | 'care_provided';
  status: string;
  request_id: string;
  notes: string | null;
  children?: {
    full_name: string;
  };
  care_group_id?: string;
}

interface BabysittingRequest {
  id: string;
  group_id: string;
  initiator_id: string;
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

interface RequestResponse {
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
  const [scheduledBlocks, setScheduledBlocks] = useState<ScheduledBlock[]>([]);
  const [requests, setRequests] = useState<BabysittingRequest[]>([]);
  const [responses, setResponses] = useState<RequestResponse[]>([]);
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
  const [selectedRequest, setSelectedRequest] = useState<BabysittingRequest | null>(null);
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
      
      for (const block of scheduledBlocks) {
        // For now, just show the child name for this specific block
        // This avoids the duplicate names issue
        newChildrenData[block.id] = [{ child_name: getChildName(block.child_id, undefined, block) }];
      }
      
      setChildrenInCareBlocks(newChildrenData);
    };
    
    if (scheduledBlocks.length > 0) {
      loadChildrenInCareBlocks();
    }
  }, [scheduledBlocks]);

  // Function to refresh active children data
  const refreshActiveChildren = async (userId: string, childrenData: Child[]) => {
    const { data: memberGroups } = await supabase
      .from("group_members")
      .select("group_id, status")
      .eq("profile_id", userId)
      .eq("status", "active");

    if (memberGroups) {
      const groupIds = memberGroups.map(mg => mg.group_id);
      const activeChildrenMap: {[groupId: string]: Child[]} = {};
      
      for (const groupId of groupIds) {
        const { data: childMemberships } = await supabase
          .from("child_group_members")
          .select("child_id")
          .eq("group_id", groupId);

        if (childMemberships) {
          const childIds = childMemberships.map(cm => cm.child_id);
          const activeChildren = childrenData?.filter(child => 
            childIds.includes(child.id)
          ) || [];
          activeChildrenMap[groupId] = activeChildren;
        }
      }
      setActiveChildrenPerGroup(activeChildrenMap);
    }
  };

  // Function to fetch all profiles for name resolution
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

        // Fetch scheduled blocks for the current month
        await fetchScheduledBlocks(data.user.id, currentDate);

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

  // Separate useEffect to handle date changes for scheduled blocks
  useEffect(() => {
    if (user) {
      fetchScheduledBlocks(user.id, currentDate);
    }
  }, [user, currentDate]);

  const fetchScheduledBlocks = async (userId: string, date: Date) => {
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    // First, get all groups the user is a member of
    const { data: userGroups } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("profile_id", userId);

    if (!userGroups || userGroups.length === 0) {
      setScheduledBlocks([]);
      return;
    }

    const groupIds = userGroups.map(g => g.group_id);

    // Get the user's children IDs for filtering
    const { data: userChildren } = await supabase
      .from("children")
      .select("id")
      .eq("parent_id", userId);

    const userChildIds = userChildren?.map(child => child.id) || [];

    // Fetch scheduled blocks that are relevant to the current user:
    // 1. Blocks where the user is the parent_id (they are providing or needing care)
    // 2. Blocks where the user's children need care (care_needed blocks only)
    
    // First, get blocks where the user is the parent_id with child data
    const { data: userBlocks, error: userError } = await supabase
      .from("scheduled_blocks")
      .select(`
        *,
        children:child_id (
          id,
          full_name,
          parent_id
        )
      `)
      .gte("scheduled_date", startOfMonth.toISOString().split('T')[0])
      .lte("scheduled_date", endOfMonth.toISOString().split('T')[0])
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
        .from("scheduled_blocks")
        .select(`
          *,
          children:child_id (
            id,
            full_name,
            parent_id
          )
        `)
        .gte("scheduled_date", startOfMonth.toISOString().split('T')[0])
        .lte("scheduled_date", endOfMonth.toISOString().split('T')[0])
        .in("group_id", groupIds)
        .eq("status", "confirmed")
        .eq("block_type", "care_needed") // Only care_needed blocks for user's children
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

    setScheduledBlocks(uniqueBlocks);
  };

  const fetchScheduledBlocksForRange = async (userId: string, startDate: Date, endDate: Date) => {
    // First, get all groups the user is a member of
    const { data: userGroups } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("profile_id", userId);

    if (!userGroups || userGroups.length === 0) {
      setScheduledBlocks([]);
      return;
    }

    const groupIds = userGroups.map(g => g.group_id);

    // Get the user's children IDs for filtering
    const { data: userChildren } = await supabase
      .from("children")
      .select("id")
      .eq("parent_id", userId);

    const userChildIds = userChildren?.map(child => child.id) || [];

    // Fetch scheduled blocks that are relevant to the current user:
    // 1. Blocks where the user is the parent_id (they are providing or needing care)
    // 2. Blocks where the user's children need care (care_needed blocks only)
    
    // First, get blocks where the user is the parent_id with child data
    const { data: userBlocks, error: userError } = await supabase
      .from("scheduled_blocks")
      .select(`
        *,
        children:child_id (
          id,
          full_name,
          parent_id
        )
      `)
      .gte("scheduled_date", startDate.toISOString().split('T')[0])
      .lte("scheduled_date", endDate.toISOString().split('T')[0])
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
        .from("scheduled_blocks")
        .select(`
          *,
          children:child_id (
            id,
            full_name,
            parent_id
          )
        `)
        .gte("scheduled_date", startDate.toISOString().split('T')[0])
        .lte("scheduled_date", endDate.toISOString().split('T')[0])
        .in("group_id", groupIds)
        .eq("status", "confirmed")
        .eq("block_type", "care_needed") // Only care_needed blocks for user's children
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

    setScheduledBlocks(uniqueBlocks);
  };

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
      .from("babysitting_requests")
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
        .from("request_responses")
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
    const { data: invitationsData } = await supabase
      .from("group_invitations")
      .select("*")
      .eq("invitee_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    setInvitations(invitationsData || []);
  };

  // Get active children for a specific group
  const getActiveChildrenForGroup = (groupId: string) => {
    return activeChildrenPerGroup[groupId] || [];
  };

  const createBabysittingRequest = async () => {
    if (!user || !requestForm.groupId || !requestForm.childId || !requestForm.requestedDate || !requestForm.startTime || !requestForm.endTime) {
      alert('Please fill in all required fields');
      return;
    }

    // Validate that the child is a member of the selected group
    const activeChildren = activeChildrenPerGroup[requestForm.groupId] || [];
    const isChildInGroup = activeChildren.some(child => child.id === requestForm.childId);

    if (!isChildInGroup) {
      alert('The selected child is not a member of this group. Please add the child to the group first.');
      return;
    }

    const startTime = new Date(`2000-01-01T${requestForm.startTime}`);
    const endTime = new Date(`2000-01-01T${requestForm.endTime}`);
    const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));

    const { data, error } = await supabase
      .from("babysitting_requests")
      .insert({
        group_id: requestForm.groupId,
        initiator_id: user.id,
        child_id: requestForm.childId,
        requested_date: requestForm.requestedDate,
        start_time: requestForm.startTime,
        end_time: requestForm.endTime,
        duration_minutes: durationMinutes,
        notes: requestForm.notes || null,
        status: 'active'
      })
      .select()
      .single();

    if (error) {
      alert('Error creating request: ' + error.message);
      return;
    }

    // Reset form and close modal
    setRequestForm({
      groupId: '',
      childId: '',
      requestedDate: '',
      startTime: '',
      endTime: '',
      notes: ''
    });
    setShowCreateRequest(false);

    // Refresh data
    await fetchRequestsAndResponses(user.id);
  };

  const respondToRequest = async () => {
    if (!user || !selectedRequest) {
      alert('Missing user or request data');
      return;
    }

    // Check if request is closed
    if (selectedRequest.status === 'closed') {
      alert('This request is closed and no longer accepting responses.');
      return;
    }

    let responseData: any = {
      request_id: selectedRequest.id,
      responder_id: user.id,
      response_type: responseType,
      notes: responseForm.notes || null,
      status: 'pending'
    };

    // Add reciprocal care data if agreeing
    if (responseType === 'agree') {
      if (responseForm.reciprocalDate && responseForm.reciprocalStartTime && responseForm.reciprocalEndTime && responseForm.reciprocalChildId) {
        const startTime = new Date(`2000-01-01T${responseForm.reciprocalStartTime}`);
        const endTime = new Date(`2000-01-01T${responseForm.reciprocalEndTime}`);
        const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));

        responseData.reciprocal_date = responseForm.reciprocalDate;
        responseData.reciprocal_start_time = responseForm.reciprocalStartTime;
        responseData.reciprocal_end_time = responseForm.reciprocalEndTime;
        responseData.reciprocal_duration_minutes = durationMinutes;
        responseData.reciprocal_child_id = responseForm.reciprocalChildId;
      }
    }

    const { data: createdResponse, error } = await supabase
      .from("request_responses")
      .insert(responseData)
      .select()
      .single();

    if (error) {
      alert('Error responding to request: ' + error.message);
      return;
    }

    // Reset form and close modal
    setResponseForm({
      reciprocalDate: '',
      reciprocalStartTime: '',
      reciprocalEndTime: '',
      reciprocalChildId: '',
      notes: ''
    });
    setShowResponseModal(false);
    setSelectedRequest(null);

    // Refresh data
    await fetchRequestsAndResponses(user.id);
  };

  const handleAgreeToRequest = async (request: BabysittingRequest) => {
    if (request.status === 'closed') {
      alert('This request is closed and no longer accepting responses.');
      return;
    }
    setSelectedRequest(request);
    setResponseType('agree');
    setShowResponseModal(true);
  };

  const handleRejectRequest = async (request: BabysittingRequest) => {
    if (request.status === 'closed') {
      alert('This request is closed and no longer accepting responses.');
      return;
    }
    setSelectedRequest(request);
    setResponseType('reject');
    setShowResponseModal(true);
  };

  const handleInviteOthers = async (request: BabysittingRequest) => {
    setSelectedRequest(request);
    
    // Fetch available group members (excluding the initiator)
    const { data: members, error } = await supabase.rpc('get_available_group_members_for_invitation', {
      p_group_id: request.group_id,
      p_initiator_id: request.initiator_id
    });
    
    if (error) {
      alert('Error fetching group members: ' + error.message);
      return;
    }
    
    setAvailableGroupMembers(members || []);
    setShowInviteModal(true);
  };

  const sendInvitations = async () => {
    if (!user || !selectedRequest) {
      alert('Missing user or request data');
      return;
    }

    if (inviteForm.selectedMembers.length === 0) {
      alert('Please select at least one member to invite');
      return;
    }

    if (inviteForm.timeBlocks.length !== inviteForm.selectedMembers.length) {
      alert('Number of time blocks must match number of selected members');
      return;
    }

    // Validate that all time blocks have required fields
    for (const block of inviteForm.timeBlocks) {
      if (!block.date || !block.startTime || !block.endTime) {
        alert('Please fill in all time block fields');
        return;
      }
    }

    // Convert time blocks to JSONB format
    const timeBlocksJson = inviteForm.timeBlocks.map(block => ({
      date: block.date,
      start_time: block.startTime,
      end_time: block.endTime
    }));

    const { error } = await supabase.rpc('invite_specific_parents_to_care', {
      p_request_id: selectedRequest.id,
      p_inviter_id: user.id,
      p_invitee_ids: inviteForm.selectedMembers,
      p_time_blocks: timeBlocksJson
    });

    if (error) {
      alert('Error sending invitations: ' + error.message);
      return;
    }

    // Reset form and close modal
    setInviteForm({
      selectedMembers: [],
      timeBlocks: [],
      notes: ''
    });
    setShowInviteModal(false);
    setSelectedRequest(null);

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
    if (!user || !selectedInvitation) {
      alert('Missing user or invitation data');
      return;
    }

    if (!selectedChildId) {
      alert('Please select a child for this care arrangement');
      return;
    }

    const { error } = await supabase.rpc('accept_group_invitation_with_time_block', {
      p_invitation_id: selectedInvitation.id,
      p_accepting_user_id: user.id,
      p_selected_time_block_index: selectedTimeBlockIndex,
      p_selected_child_id: selectedChildId
    });

    if (error) {
      alert('Error accepting invitation: ' + error.message);
      return;
    }

    // Refresh data
    await fetchRequestsAndResponses(user.id);
    await fetchInvitations(user.id);
    
    // Fetch blocks for a wider date range to include the invitation date
    const invitationDate = new Date(selectedInvitation.invitation_date);
    const startDate = new Date(Math.min(currentDate.getTime(), invitationDate.getTime()));
    const endDate = new Date(Math.max(currentDate.getTime(), invitationDate.getTime()));
    
    // Fetch blocks for the wider range
    await fetchScheduledBlocksForRange(user.id, startDate, endDate);

    // Close modal and reset state
    setShowAcceptInvitationModal(false);
    setSelectedInvitation(null);
    setAvailableTimeBlocks([]);
    setUserChildren([]);
    setSelectedChildId('');

    alert('Invitation accepted! Your schedule has been updated.');
  };

  // Helper functions for invitation form management
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
    setInviteForm(prev => {
      const isSelected = prev.selectedMembers.includes(memberId);
      const newSelectedMembers = isSelected 
        ? prev.selectedMembers.filter(id => id !== memberId)
        : [...prev.selectedMembers, memberId];
      
      // Adjust time blocks to match selected members
      const newTimeBlocks = [...prev.timeBlocks];
      while (newTimeBlocks.length < newSelectedMembers.length) {
        newTimeBlocks.push({ date: '', startTime: '', endTime: '' });
      }
      while (newTimeBlocks.length > newSelectedMembers.length) {
        newTimeBlocks.pop();
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
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    
    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    
    return days;
  };

  const getBlocksForDate = (date: Date) => {
    return scheduledBlocks.filter(block => {
      const blockDate = new Date(block.scheduled_date);
      return blockDate.toDateString() === date.toDateString();
    });
  };

  const getAllChildrenInBlock = async (block: ScheduledBlock) => {
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

  const getChildName = (childId: string, request?: BabysittingRequest, block?: ScheduledBlock, response?: RequestResponse) => {
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

  // Function to find the original request for a scheduled block
  const findOriginalRequestForBlock = (block: ScheduledBlock): BabysittingRequest | null => {
    // Find the request that matches this block's request_id
    // Note: Reciprocal blocks will have different times/dates than the original request
    return requests.find(request => 
      request.id === block.request_id
    ) || null;
  };

  // Function to handle double-click on a scheduled block
  const handleBlockDoubleClick = async (block: ScheduledBlock) => {
    if (!user) return;

    // Only allow Parent B (the one who provided care) to invite others
    if (block.block_type !== 'care_provided' || block.parent_id !== user.id) {
      return;
    }

    // Find the original request for this block
    const originalRequest = findOriginalRequestForBlock(block);
    if (!originalRequest) {
      alert('Could not find the original request for this scheduled block.');
      return;
    }

    // Check if this user has agreed to this request (Parent B)
    const userResponse = responses.find(resp => 
      resp.request_id === originalRequest.id && 
      resp.responder_id === user.id && 
      resp.response_type === 'agree'
    );

    if (!userResponse) {
      alert('You can only invite others to blocks you agreed to provide care for.');
      return;
    }

    // Open the invite modal with this request
    await handleInviteOthers(originalRequest);
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
      await fetchScheduledBlocks(user.id, currentDate);
      
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Schedule</h1>
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
        <button className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium">
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

      {/* Calendar Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Your Schedule</h2>
          <div className="flex gap-2">
            <button 
              onClick={handlePreviousMonth}
              className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 transition"
            >
              ←
            </button>
            <span className="px-4 py-1 font-medium">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </span>
            <button 
              onClick={handleNextMonth}
              className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 transition"
            >
              →
            </button>
          </div>
        </div>
        
        <div className="mb-4 p-3 bg-blue-50 rounded border border-blue-200">
          <p className="text-sm text-blue-800">
            💡 <strong>Tip:</strong> Double-click on any green "Providing Care" block (marked with a blue dot) to invite other group members to join that time slot.
          </p>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Day headers */}
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="p-2 text-center font-medium text-gray-600 bg-gray-50 rounded">
              {day}
            </div>
          ))}
          
          {/* Calendar days */}
          {days.map((day, index) => {
            const blocksForDay = day ? getBlocksForDate(day) : [];
            const isToday = day && day.toDateString() === new Date().toDateString();
            const isSelected = day && selectedDate && day.toDateString() === selectedDate.toDateString();
            
            return (
              <div
                key={index}
                className={`min-h-[100px] p-2 border border-gray-200 ${
                  isToday ? 'bg-blue-50 border-blue-300' : ''
                } ${isSelected ? 'bg-purple-50 border-purple-300' : ''}`}
                onClick={() => day && setSelectedDate(day)}
              >
                {day && (
                  <>
                    <div className="text-sm font-medium mb-1">{day.getDate()}</div>
                    <div className="space-y-1">
                      {blocksForDay.map(block => {
                        const childrenInBlock = childrenInCareBlocks[block.id] || [{ child_name: getChildName(block.child_id, undefined, block) }];
                        const childNames = childrenInBlock.map(c => c.child_name).join(', ');
                        
                        return (
                          <div
                            key={block.id}
                            className={`text-xs p-1 rounded cursor-pointer hover:opacity-80 transition-opacity relative ${
                              block.block_type === 'care_needed' 
                                ? 'bg-red-100 text-red-800' 
                                : 'bg-green-100 text-green-800'
                            }`}
                            onDoubleClick={() => handleBlockDoubleClick(block)}
                            title={block.block_type === 'care_provided' && block.parent_id === user?.id 
                              ? 'Double-click to invite other group members' 
                              : undefined}
                          >
                            <div className="font-medium">{childNames}</div>
                            <div>{formatTime(block.start_time)} - {formatTime(block.end_time)}</div>
                            <div className="text-xs opacity-75">
                              {block.block_type === 'care_needed' ? 'Care Needed' : 'Providing Care'}
                            </div>
                            {block.block_type === 'care_provided' && block.parent_id === user?.id && (
                              <div className="absolute top-0 right-0 w-2 h-2 bg-blue-500 rounded-full opacity-75"></div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Group Sections */}
      <div className="space-y-6">
        {groups.map(group => {
          const groupRequests = requests.filter(req => req.group_id === group.id);
          const groupResponses = responses.filter(resp => 
            groupRequests.some(req => req.id === resp.request_id)
          );

          return (
            <div key={group.id} className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4">{group.name}</h3>
              
              {groupRequests.length === 0 ? (
                <p className="text-gray-600">No babysitting requests in this group.</p>
              ) : (
                <div className="space-y-4">
                  {groupRequests.map(request => {
                    const requestResponses = groupResponses.filter(resp => resp.request_id === request.id);
                    const hasUserResponded = requestResponses.some(resp => resp.responder_id === user?.id);
                    const hasAgreedResponse = requestResponses.some(resp => 
                      resp.responder_id === user?.id && resp.response_type === 'agree'
                    );

                    return (
                      <div key={request.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-medium">
                              {getChildName(request.child_id, request)} needs care
                            </h4>
                            <p className="text-sm text-gray-600">
                              {parseLocalDate(request.requested_date).toLocaleDateString()} • {formatTime(request.start_time)} - {formatTime(request.end_time)}
                            </p>
                            {request.notes && (
                              <p className="text-sm text-gray-600 mt-1">{request.notes}</p>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(request.created_at).toLocaleDateString()}
                          </div>
                        </div>

                        {request.initiator_id === user?.id ? (
                          <div className="text-sm text-gray-600">
                            You initiated this request • {requestResponses.length} responses
                            {request.status === 'closed' && (
                              <span className="ml-2 text-red-600 font-medium">• CLOSED</span>
                            )}
                            {hasAgreedResponse && (
                              <button
                                onClick={() => handleInviteOthers(request)}
                                className="ml-2 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition"
                              >
                                Invite Others
                              </button>
                            )}
                          </div>
                        ) : hasUserResponded ? (
                          <div className="text-sm text-green-600">
                            You have responded to this request
                          </div>
                        ) : request.status === 'closed' ? (
                          <div className="text-sm text-red-600 font-medium">
                            This request is closed and no longer accepting responses
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button 
                              onClick={() => handleAgreeToRequest(request)}
                              className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition"
                            >
                              Agree
                            </button>
                            <button 
                              onClick={() => handleRejectRequest(request)}
                              className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition"
                            >
                              Reject
                            </button>
                          </div>
                        )}

                        {requestResponses.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <h5 className="text-sm font-medium mb-2">Responses:</h5>
                            
                            {/* Check if there are multiple pending responses */}
                            {(() => {
                              const pendingResponses = requestResponses.filter(r => r.response_type === 'agree' && r.status === 'pending');
                              const hasMultiplePending = pendingResponses.length > 1;
                              
                              if (hasMultiplePending) {
                                return (
                                  <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                                    <p className="text-sm text-yellow-800 mb-3">
                                      You have multiple pending responses. Please select one to accept:
                                    </p>
                                    <div className="space-y-2">
                                      {pendingResponses.map(response => (
                                        <div key={response.id} className="border border-yellow-300 bg-white p-3 rounded">
                                          <div className="flex justify-between items-start mb-2">
                                            <div>
                                              <span className="font-medium text-green-600">✅ Agreed</span>
                                              <span className="text-gray-500 ml-2">
                                                {new Date(response.created_at).toLocaleDateString()}
                                              </span>
                                            </div>
                                            <button
                                              onClick={async () => {
                                                try {
                                                  const { error } = await supabase.rpc('select_response_and_reject_others', {
                                                    p_response_id: response.id
                                                  });
                                                  
                                                  if (error) {
                                                    console.error('Error selecting response:', error);
                                                    alert('Error selecting response: ' + error.message);
                                                  } else {
                                                    // Refresh the data
                                                    if (user) {
                                                      await fetchRequestsAndResponses(user.id);
                                                      await fetchScheduledBlocks(user.id, currentDate);
                                                      // Also refresh children data to ensure we have latest child names
                                                      await refreshActiveChildren(user.id, children);
                                                    }
                                                  }
                                                } catch (error) {
                                                  console.error('Error:', error);
                                                  alert('Error selecting response');
                                                }
                                              }}
                                              className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition"
                                            >
                                              Select This Response
                                            </button>
                                          </div>
                                          {response.notes && (
                                            <p className="text-gray-600 text-sm">{response.notes}</p>
                                          )}
                                          {/* Reciprocal care is now handled through the group invitation system */}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              }
                              
                              // Show normal responses if no multiple pending responses
                              return (
                                <div className="space-y-2">
                                  {requestResponses.map(response => (
                                    <div key={response.id} className="text-sm bg-gray-50 p-2 rounded">
                                      <div className="flex justify-between items-start">
                                        <div>
                                          <span className={`px-2 py-1 text-xs rounded ${
                                            response.response_type === 'agree' ? 'bg-green-100 text-green-800' :
                                            response.response_type === 'reject' ? 'bg-red-100 text-red-800' :
                                            'bg-gray-100 text-gray-800'
                                          }`}>
                                            {response.response_type === 'agree' && response.status === 'accepted' && '✅ Accepted'}
                                            {response.response_type === 'agree' && response.status === 'pending' && '⏳ Pending'}
                                            {response.response_type === 'reject' && '❌ Rejected'}
                                          </span>
                                          <span className="text-gray-500 ml-2">
                                            {new Date(response.created_at).toLocaleDateString()}
                                          </span>
                                        </div>
                                        {/* Show accept button for pending agree responses if user is the request initiator */}
                                        {response.response_type === 'agree' && 
                                         response.status === 'pending' && 
                                         user && 
                                         request.initiator_id === user.id && (
                                          <button
                                            onClick={() => acceptResponse(response.id, request.id)}
                                            className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition"
                                          >
                                            Accept
                                          </button>
                                        )}
                                      </div>
                                      {response.notes && (
                                        <p className="text-gray-600 mt-1">{response.notes}</p>
                                      )}
                                      {response.response_type === 'agree' && response.reciprocal_date && (
                                        <p className="text-gray-600 mt-1">
                                          Reciprocal: {parseLocalDate(response.reciprocal_date).toLocaleDateString()} • {formatTime(response.reciprocal_start_time!)} - {formatTime(response.reciprocal_end_time!)}
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-gray-200 flex gap-2">
                <button 
                  onClick={() => setShowCreateRequest(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                >
                  New Babysitting Request
                </button>
                <button 
                  onClick={async () => {
                    if (user) {
                      await refreshActiveChildren(user.id, children);
                      await fetchRequestsAndResponses(user.id);
                    }
                  }}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition"
                  title="Refresh data (useful after activating/deactivating children)"
                >
                  ↻ Refresh
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Invitations Section */}
      {invitations.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4 text-green-600">Group Invitations</h2>
          <p className="text-gray-600 mb-4">
            You've been invited to join existing care arrangements.
          </p>
          
          <div className="space-y-4">
            {invitations.map(invitation => {
              const request = requests.find(r => r.id === invitation.request_id);
              const inviterName = allProfiles.find(p => p.id === invitation.inviter_id)?.full_name || 'Unknown Parent';
              const inviterChild = allGroupChildren.find(c => c.parent_id === invitation.inviter_id);
              
              return (
                <div key={invitation.id} className="border border-green-200 rounded-lg p-4 bg-green-50">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-medium text-green-800">
                        Invitation from {inviterName} to join care exchange
                      </h4>
                      
                      {/* Show the existing agreement between Parent A and Parent B */}
                      {request && (
                        <div className="mb-2 p-2 bg-blue-50 rounded border-l-4 border-blue-400">
                          <p className="text-sm font-medium text-blue-800">
                            {inviterName} is offering to provide care for the already agreed scheduled time with {getChildName(request.child_id, request)}:
                          </p>
                          <p className="text-sm text-blue-600">
                            {parseLocalDate(request.requested_date).toLocaleDateString()} • {formatTime(request.start_time)} - {formatTime(request.end_time)}
                          </p>
                        </div>
                      )}
                      
                      {/* Show when Parent B needs care for their own child */}
                      <div className="mb-2 p-2 bg-green-50 rounded border-l-4 border-green-400">
                        <p className="text-sm font-medium text-green-800">
                          {inviterName} needs care for {inviterChild ? inviterChild.full_name : 'their child'} on:
                        </p>
                        <p className="text-sm text-green-600">
                          {parseLocalDate(invitation.invitation_date).toLocaleDateString()} • {formatTime(invitation.invitation_start_time)} - {formatTime(invitation.invitation_end_time)}
                        </p>
                      </div>
                      
                      {invitation.notes && (
                        <p className="text-sm text-green-600 mt-1">{invitation.notes}</p>
                      )}
                    </div>
                    <div className="text-xs text-green-500">
                      {new Date(invitation.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleAcceptInvitation(invitation)}
                      className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition"
                    >
                      Accept Invitation
                    </button>
                    <button 
                      onClick={async () => {
                        const { error } = await supabase
                          .from("group_invitations")
                          .update({ status: 'declined' })
                          .eq("id", invitation.id);
                        
                        if (!error) {
                          await fetchInvitations(user!.id);
                        }
                      }}
                      className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Create Request Modal */}
      {showCreateRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Create Babysitting Request</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Group *</label>
                <select
                  value={requestForm.groupId}
                  onChange={async (e: React.ChangeEvent<HTMLSelectElement>) => {
                    const newGroupId = e.target.value;
                    setRequestForm({...requestForm, groupId: newGroupId, childId: ''});
                    
                    // Refresh active children data when group changes
                    if (newGroupId && user) {
                      await refreshActiveChildren(user.id, children);
                    }
                  }}
                  className="w-full p-2 border border-gray-300 rounded"
                  required
                >
                  <option value="">Select a group</option>
                  {groups.map(group => (
                    <option key={group.id} value={group.id}>{group.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Child *</label>
                <select
                  value={requestForm.childId}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setRequestForm({...requestForm, childId: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded"
                  required
                >
                  <option value="">Select a child</option>
                  {activeChildrenPerGroup[requestForm.groupId]?.map(child => (
                    <option key={child.id} value={child.id}>{child.full_name}</option>
                  )) || []}
                </select>
                {requestForm.groupId && (!activeChildrenPerGroup[requestForm.groupId] || activeChildrenPerGroup[requestForm.groupId].length === 0) && (
                  <p className="text-sm text-red-600 mt-1">
                    You don't have any children in this group. Please add a child to the group first.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Date *</label>
                <input
                  type="date"
                  value={requestForm.requestedDate}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRequestForm({...requestForm, requestedDate: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium mb-1">Start Time *</label>
                  <input
                    type="time"
                    value={requestForm.startTime}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRequestForm({...requestForm, startTime: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">End Time *</label>
                  <input
                    type="time"
                    value={requestForm.endTime}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRequestForm({...requestForm, endTime: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea
                  value={requestForm.notes}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRequestForm({...requestForm, notes: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded"
                  rows={3}
                  placeholder="Any additional details..."
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={createBabysittingRequest}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
              >
                Create Request
              </button>
              <button
                onClick={() => setShowCreateRequest(false)}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition"
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
            <h3 className="text-lg font-semibold mb-4">
              {responseType === 'agree' && 'Agree to Request'}
              {responseType === 'reject' && 'Reject Request'}
            </h3>
            
            <div className="mb-4 p-3 bg-gray-50 rounded">
              <p className="text-sm">
                <strong>{getChildName(selectedRequest.child_id, selectedRequest)}</strong> needs care on{' '}
                {parseLocalDate(selectedRequest.requested_date).toLocaleDateString()} from{' '}
                {formatTime(selectedRequest.start_time)} to {formatTime(selectedRequest.end_time)}
              </p>
            </div>

            <div className="space-y-4">
              {responseType === 'agree' && (
                <>
                  <div className="border-t pt-4 mt-4">
                    <h4 className="font-medium text-gray-700 mb-3">Reciprocal Care (Optional)</h4>
                    <p className="text-sm text-gray-600 mb-4">
                      If you'd like to arrange reciprocal care, specify when you need care for your child.
                    </p>
                    
                    <div>
                      <label className="block text-sm font-medium mb-1">Your Child</label>
                      <select
                        value={responseForm.reciprocalChildId}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setResponseForm({...responseForm, reciprocalChildId: e.target.value})}
                        className="w-full p-2 border border-gray-300 rounded"
                      >
                        <option value="">Select your child (optional)</option>
                        {children.map(child => (
                          <option key={child.id} value={child.id}>{child.full_name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">When you need care (Date)</label>
                      <input
                        type="date"
                        value={responseForm.reciprocalDate}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setResponseForm({...responseForm, reciprocalDate: e.target.value})}
                        className="w-full p-2 border border-gray-300 rounded"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-sm font-medium mb-1">Start Time</label>
                        <input
                          type="time"
                          value={responseForm.reciprocalStartTime}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setResponseForm({...responseForm, reciprocalStartTime: e.target.value})}
                          className="w-full p-2 border border-gray-300 rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">End Time</label>
                        <input
                          type="time"
                          value={responseForm.reciprocalEndTime}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setResponseForm({...responseForm, reciprocalEndTime: e.target.value})}
                          className="w-full p-2 border border-gray-300 rounded"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">
                  {responseType === 'reject' ? 'Reason for Rejection' : 'Notes'}
                </label>
                <textarea
                  value={responseForm.notes}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setResponseForm({...responseForm, notes: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded"
                  rows={3}
                  placeholder={responseType === 'reject' ? 'Why are you rejecting this request?' : 'Any additional notes...'}
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={respondToRequest}
                className={`flex-1 px-4 py-2 text-white rounded transition ${
                  responseType === 'agree' ? 'bg-green-600 hover:bg-green-700' :
                  'bg-red-600 hover:bg-red-700'
                }`}
              >
                {responseType === 'agree' && 'Agree'}
                {responseType === 'reject' && 'Reject'}
              </button>
              <button
                onClick={() => setShowResponseModal(false)}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Invite Modal */}
      {showInviteModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Invite Group Members</h3>
            
            <div className="mb-4 p-3 bg-blue-50 rounded">
              <p className="text-sm text-blue-800">
                Select group members to invite and specify time blocks for each. Each member will be able to choose which time block works for them.
              </p>
            </div>

            <div className="space-y-6">
              {/* Member Selection */}
              <div>
                <h4 className="font-medium text-gray-700 mb-3">Select Members to Invite</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {availableGroupMembers.map(member => (
                    <label key={member.profile_id} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={inviteForm.selectedMembers.includes(member.profile_id)}
                        onChange={() => toggleMemberSelection(member.profile_id)}
                        className="rounded"
                      />
                      <span className="text-sm">{member.full_name} ({member.email})</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Time Blocks */}
              {inviteForm.selectedMembers.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-700 mb-3">
                    Time Blocks ({inviteForm.selectedMembers.length} blocks needed)
                  </h4>
                  <div className="space-y-4">
                    {inviteForm.timeBlocks.map((block, index) => (
                      <div key={index} className="border border-gray-200 rounded p-4">
                        <div className="flex justify-between items-center mb-3">
                          <h5 className="font-medium text-sm">Time Block {index + 1}</h5>
                          <button
                            onClick={() => removeTimeBlock(index)}
                            className="text-red-600 text-sm hover:text-red-800"
                          >
                            Remove
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-sm font-medium mb-1">Date</label>
                            <input
                              type="date"
                              value={block.date}
                              onChange={(e) => updateTimeBlock(index, 'date', e.target.value)}
                              className="w-full p-2 border border-gray-300 rounded"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Start Time</label>
                            <input
                              type="time"
                              value={block.startTime}
                              onChange={(e) => updateTimeBlock(index, 'startTime', e.target.value)}
                              className="w-full p-2 border border-gray-300 rounded"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">End Time</label>
                            <input
                              type="time"
                              value={block.endTime}
                              onChange={(e) => updateTimeBlock(index, 'endTime', e.target.value)}
                              className="w-full p-2 border border-gray-300 rounded"
                              required
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea
                  value={inviteForm.notes}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInviteForm({...inviteForm, notes: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded"
                  rows={3}
                  placeholder="Any additional details for the invitations..."
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={sendInvitations}
                disabled={inviteForm.selectedMembers.length === 0 || inviteForm.timeBlocks.length !== inviteForm.selectedMembers.length}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Send Invitations
              </button>
              <button
                onClick={() => setShowInviteModal(false)}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Accept Invitation Modal */}
      {showAcceptInvitationModal && selectedInvitation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Accept Invitation</h3>
            
            <div className="mb-4 p-3 bg-green-50 rounded">
              <p className="text-sm text-green-800">
                Choose which time block works for you and select which child will participate. Once selected, other parents cannot choose the same time.
              </p>
            </div>

            {/* Child Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Select Your Child</label>
              <select
                value={selectedChildId}
                onChange={(e) => setSelectedChildId(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded"
                required
              >
                <option value="">Choose a child...</option>
                {userChildren.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-4">
              {availableTimeBlocks.map((block, index) => (
                <div key={index} className={`border rounded p-3 ${block.is_available ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-100'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Time Block {block.block_index + 1}</h4>
                      <p className="text-sm text-gray-600">
                        {block.block_date} • {formatTime(block.block_start_time)} - {formatTime(block.block_end_time)}
                      </p>
                    </div>
                    {block.is_available ? (
                      <button
                        onClick={() => acceptInvitation(block.block_index)}
                        disabled={!selectedChildId}
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                        Select
                      </button>
                    ) : (
                      <span className="text-sm text-gray-500">Already taken</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowAcceptInvitationModal(false)}
                className="w-full px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 