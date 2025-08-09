'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';
import Header from '../components/Header';

interface ScheduledCare {
  id: string;
  group_id: string;
  parent_id: string;
  child_id: string;
  care_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  care_type: 'needed' | 'provided' | 'event';
  status: string;
  related_request_id: string;
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

interface CareRequest {
  id: string;
  group_id: string;
  requester_id: string;
  child_id: string;
  requested_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  notes: string | null;
  request_type: 'simple' | 'reciprocal' | 'event' | 'open_block' | 'open_block_sent';
  status: string;
  responder_id?: string;
  response_notes?: string;
  created_at: string;
  children?: {
    full_name: string;
  };
}

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
  response_notes?: string;
  status: string;
  created_at: string;
}

interface Child {
  id: string;
  full_name: string;
  parent_id: string;
  status: string;
}

interface GroupMember {
  id: number;
  group_id: number;
  parent_id: string;
  parent_name: string;
  status: string;
}

export default function CalendarPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState<'weekly' | 'monthly'>('weekly');
  const [scheduledCare, setScheduledCare] = useState<ScheduledCare[]>([]);
  const [requests, setRequests] = useState<CareRequest[]>([]);
  const [responses, setResponses] = useState<CareResponse[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [showDailyScheduleModal, setShowDailyScheduleModal] = useState(false);
  const [selectedDateForDailyView, setSelectedDateForDailyView] = useState<Date | null>(null);
  const [selectedCareBlock, setSelectedCareBlock] = useState<ScheduledCare | null>(null);
  const [showOpenBlockModal, setShowOpenBlockModal] = useState(false);
  const [openBlockForm, setOpenBlockForm] = useState({
    date: '',
    startTime: '',
    endTime: '',
    notes: '',
    selectedParents: [] as string[]
  });
  const [availableParentsForOpenBlock, setAvailableParentsForOpenBlock] = useState<GroupMember[]>([]);
  const [childrenInCareBlocks, setChildrenInCareBlocks] = useState<{[blockId: string]: any[]}>({});

  const loadChildrenInCareBlocks = async () => {
    if (scheduledCare.length === 0) return;

    const childrenData: {[blockId: string]: any[]} = {};
    
    for (const block of scheduledCare) {
      try {
        // For now, use basic child information since we don't have the RPC function
        const childName = getChildName(block.child_id);
        childrenData[block.id] = [{ child_name: childName }];
      } catch (error) {
        console.error(`Error processing block ${block.id}:`, error);
        childrenData[block.id] = [];
      }
    }
    
    setChildrenInCareBlocks(childrenData);
  };

  useEffect(() => {
    if (scheduledCare.length > 0) {
      loadChildrenInCareBlocks();
    }
  }, [scheduledCare]);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      
      if (user) {
        setUser(user);
        // First fetch children and group members
        await fetchChildren(user.id);
        
        // Get the current children state after fetching
        const currentChildren = children.length > 0 ? children : await getCurrentChildren(user.id);
        
        await Promise.all([
          fetchGroupMembers(user.id),
          fetchScheduledCare(user.id, currentDate, currentChildren),
          fetchRequestsAndResponses(user.id)
        ]);
      } else {
        router.push('/auth');
      }
    } catch (error) {
      console.error('Error checking user:', error);
      router.push('/auth');
    } finally {
      setLoading(false);
    }
  };

  const fetchScheduledCare = async (userId: string, date: Date, userChildren?: Child[]) => {
    try {
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      
      console.log('=== FETCHING SCHEDULED CARE ===');
      console.log('User ID:', userId);
      console.log('Date range:', startOfMonth.toISOString().split('T')[0], 'to', endOfMonth.toISOString().split('T')[0]);
      
      // Get user's children IDs - use passed parameter or state
      const childrenToUse = userChildren || children;
      const userChildIds = childrenToUse.filter(c => c.parent_id === userId).map(c => c.id);
      console.log('Children to use:', childrenToUse);
      console.log('User child IDs:', userChildIds);
      
      // Fetch ALL scheduled care blocks where user is involved (either as provider OR where their child is being cared for)
      const promises = [
        // Blocks where user is providing care
        supabase
          .from('scheduled_care')
          .select('*')
          .eq('parent_id', userId)
          .gte('care_date', startOfMonth.toISOString().split('T')[0])
          .lte('care_date', endOfMonth.toISOString().split('T')[0])
      ];
      
      // Only add receiving blocks query if we have children
      if (userChildIds.length > 0) {
        promises.push(
          // Blocks where user's children are being cared for by others
          supabase
            .from('scheduled_care')
            .select('*')
            .in('child_id', userChildIds)
            .neq('parent_id', userId)
            .gte('care_date', startOfMonth.toISOString().split('T')[0])
            .lte('care_date', endOfMonth.toISOString().split('T')[0])
        );
      } else {
        console.log('No user children found, skipping receiving blocks query');
      }
      
      const results = await Promise.all(promises);
      const userProvidingRes = results[0];
      const userReceivingRes = results[1] || { data: [], error: null };

      if (userProvidingRes.error) throw userProvidingRes.error;
      if (userReceivingRes.error) throw userReceivingRes.error;

      // Combine and remove duplicates
      const allBlocks = [...(userProvidingRes.data || []), ...(userReceivingRes.data || [])];
      const uniqueBlocks = allBlocks.filter((block, index, self) => 
        index === self.findIndex(b => b.id === block.id)
      );
      
      console.log('User providing blocks:', userProvidingRes.data);
      console.log('User receiving blocks:', userReceivingRes.data);
      console.log('Combined unique blocks:', uniqueBlocks);
      
      uniqueBlocks.sort((a, b) => {
        const dateCompare = a.care_date.localeCompare(b.care_date);
        if (dateCompare === 0) {
          return a.start_time.localeCompare(b.start_time);
        }
        return dateCompare;
      });
      
      setScheduledCare(uniqueBlocks);
    } catch (error) {
      console.error('Error fetching scheduled care:', error);
    }
  };

  const fetchRequestsAndResponses = async (userId: string) => {
    try {
      const [requestsRes, responsesRes] = await Promise.all([
        supabase
          .from('care_requests')
          .select('*')
          .eq('requester_id', userId)
          .order('created_at', { ascending: false }),
        supabase
          .from('care_responses')
          .select('*')
          .eq('responder_id', userId)
          .order('created_at', { ascending: false })
      ]);

      if (requestsRes.error) throw requestsRes.error;
      if (responsesRes.error) throw responsesRes.error;

      setRequests(requestsRes.data || []);
      setResponses(responsesRes.data || []);
    } catch (error) {
      console.error('Error fetching requests and responses:', error);
    }
  };

  const getCurrentChildren = async (userId: string): Promise<Child[]> => {
    try {
      // Get ALL children from the database for name resolution
      const { data: allChildren, error } = await supabase
        .from('children')
        .select('*');

      if (error) throw error;
      return allChildren || [];
    } catch (error) {
      console.error('Error getting current children:', error);
      return [];
    }
  };

  const fetchChildren = async (userId: string) => {
    try {
      console.log('=== FETCHING CHILDREN ===');
      console.log('User ID:', userId);
      
      // First get the user's children
      const { data: userChildren, error: userError } = await supabase
        .from('children')
        .select('*')
        .eq('parent_id', userId);

      if (userError) throw userError;
      console.log('User children:', userChildren);

      // Get ALL children from the database for name resolution
      // This is safer than trying to use group members
      const { data: allChildren, error: allError } = await supabase
        .from('children')
        .select('*');

      if (allError) {
        console.error('Error fetching all children:', allError);
        setChildren(userChildren || []);
      } else {
        console.log('All children in database:', allChildren);
        // Use all children for name resolution
        setChildren(allChildren || []);
      }
    } catch (error) {
      console.error('Error fetching children:', error);
    }
  };

  const fetchGroupMembers = async (userId: string) => {
    try {
      console.log('=== FETCHING GROUP MEMBERS ===');
      console.log('User ID:', userId);
      
      // Get the user's group ID first (using correct table name)
      const { data: userGroups, error: userGroupError } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('profile_id', userId);
      
      console.log('User groups data:', userGroups);
      
      if (!userGroups || userGroups.length === 0) {
        console.log('No groups found for user');
        setGroupMembers([]);
        return;
      }
      
      // Get the first group ID (assuming user is in one primary group)
      const groupId = userGroups[0].group_id;
      console.log('Found group ID:', groupId);
      
      // Get all members in this group
      const { data: allGroupMembers, error: allError } = await supabase
        .from('group_members')
        .select('*')
        .eq('group_id', groupId);
      
      console.log('Group members found:', allGroupMembers);
      
      if (!allGroupMembers || allGroupMembers.length === 0) {
        console.log('No group members found');
        setGroupMembers([]);
        return;
      }
      
      // Get parent names from profiles
      const profileIds = allGroupMembers.map(m => m.profile_id);
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', profileIds);
      
      console.log('Profiles found:', profiles);
      
      // Create parent name lookup
      const parentNameLookup: {[key: string]: string} = {};
      (profiles || []).forEach(profile => {
        parentNameLookup[profile.id] = profile.full_name || `Parent ${profile.id.substring(0, 8)}...`;
      });
      
      // Add current user
      parentNameLookup[userId] = 'You';
      
      console.log('Parent name lookup:', parentNameLookup);
      
      // Transform the data to match expected format
      const transformedData = allGroupMembers.map(member => ({
        ...member,
        parent_id: member.profile_id, // Map profile_id to parent_id for compatibility
        parent_name: parentNameLookup[member.profile_id] || `Parent ${member.profile_id.substring(0, 8)}...`
      }));
      
      console.log('Final transformed group members:', transformedData);
      setGroupMembers(transformedData);
    } catch (error) {
      console.error('Error fetching group members:', error);
      setGroupMembers([]);
    }
  };

  useEffect(() => {
    if (user) {
      fetchScheduledCare(user.id, currentDate);
    }
  }, [user, currentDate]);

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getDaysInWeek = (date: Date) => {
    const startOfWeek = new Date(date);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day;
    startOfWeek.setDate(diff);
    
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const handlePreviousPeriod = () => {
    const newDate = new Date(currentDate);
    if (calendarView === 'monthly') {
      newDate.setMonth(currentDate.getMonth() - 1);
    } else {
      newDate.setDate(currentDate.getDate() - 7);
    }
    setCurrentDate(newDate);
  };

  const handleNextPeriod = () => {
    const newDate = new Date(currentDate);
    if (calendarView === 'monthly') {
      newDate.setMonth(currentDate.getMonth() + 1);
    } else {
      newDate.setDate(currentDate.getDate() + 7);
    }
    setCurrentDate(newDate);
  };

  const getDaysForView = () => {
    if (calendarView === 'weekly') {
      return getDaysInWeek(currentDate);
    } else {
      const daysInMonth = getDaysInMonth(currentDate);
      const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const startingDayOfWeek = firstDay.getDay();
      
      const days = [];
      
      // Add empty cells for days before the first day of the month
      for (let i = 0; i < startingDayOfWeek; i++) {
        days.push(null);
      }
      
      // Add all days of the month
      for (let day = 1; day <= daysInMonth; day++) {
        days.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), day));
      }
      
      return days;
    }
  };

  const getDisplayTitle = () => {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    if (calendarView === 'monthly') {
      return `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    } else {
      const weekDays = getDaysInWeek(currentDate);
      const start = weekDays[0];
      const end = weekDays[6];
      
      if (start.getMonth() === end.getMonth()) {
        return `${monthNames[start.getMonth()]} ${start.getDate()}-${end.getDate()}, ${start.getFullYear()}`;
      } else {
        return `${monthNames[start.getMonth()]} ${start.getDate()} - ${monthNames[end.getMonth()]} ${end.getDate()}, ${start.getFullYear()}`;
      }
    }
  };

  const getBlocksForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return scheduledCare.filter(block => block.care_date === dateStr);
  };

  const getChildName = (childId: string, childrenData?: Child[], block?: ScheduledCare) => {
    const childrenToSearch = childrenData || children;
    const child = childrenToSearch.find(c => c.id === childId);
    return child ? child.full_name : `Child ${childId}`;
  };

  const getParentName = (parentId: string) => {
    if (parentId === user?.id) return 'You';
    const member = groupMembers.find(m => m.parent_id === parentId);
    return member ? member.parent_name : `Parent ${parentId}`;
  };

  const findOriginalRequestForBlockSync = (block: ScheduledCare) => {
    if (!block.related_request_id) return null;
    return requests.find(req => req.id === block.related_request_id) || null;
  };

  const getEnhancedBlockText = (providingParentName: string, childNames: string, block: ScheduledCare) => {
    return `${providingParentName} caring for ${childNames}`;
  };

  const formatTime = (timeString: string) => {
    try {
      const [hours, minutes] = timeString.split(':');
      const hour = parseInt(hours, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    } catch (error) {
      return timeString;
    }
  };

  const handleBlockDoubleClick = async (block: ScheduledCare) => {
    // Check if this is an event block
    if (block.care_type === 'event') {
      // Handle event block
      return;
    }
    
    // Check if this is a provided care block where current user is the hosting parent
    if (block.care_type === 'provided' && block.parent_id === user?.id) {
      const shouldOpenBlock = confirm(
        `You are providing care for ${getChildName(block.child_id, undefined, block)} on ${block.care_date}.\n\nWould you like to open this care block to invite other group members?`
      );
      
      if (shouldOpenBlock) {
        await openBlockForInvitations(block);
        return;
      }
    }
    
    // Default behavior: Show daily schedule popup for the block's date
    console.log('Showing daily schedule modal instead');
    const blockDate = new Date(block.care_date + 'T00:00:00'); // Parse as local date
    setSelectedDateForDailyView(blockDate);
    setShowDailyScheduleModal(true);
  };

  const openBlockForInvitations = async (block: ScheduledCare) => {
    try {
      const availableParents = await getAvailableParentsForOpenBlock(block);
      setAvailableParentsForOpenBlock(availableParents);
      setSelectedCareBlock(block);
      setOpenBlockForm({
        date: block.care_date,
        startTime: block.start_time,
        endTime: block.end_time,
        notes: block.notes || '',
        selectedParents: []
      });
      setShowOpenBlockModal(true);
    } catch (error) {
      console.error('Error opening block for invitations:', error);
      alert('Error loading invitation options. Please try again.');
    }
  };

  const getAvailableParentsForOpenBlock = async (block: ScheduledCare) => {
    try {
      const { data: groupData, error: groupError } = await supabase
        .from('care_group_members_with_parent_names')
        .select('*')
        .eq('group_id', block.group_id)
        .eq('status', 'active')
        .neq('parent_id', user.id);

      if (groupError) throw groupError;

      const { data: existingInvitations, error: invError } = await supabase
        .from('open_block_invitations')
        .select('invited_parent_id')
        .eq('care_date', block.care_date)
        .eq('start_time', block.start_time)
        .eq('end_time', block.end_time)
        .eq('inviting_parent_id', user.id)
        .in('status', ['pending', 'accepted']);

      if (invError) throw invError;

      const alreadyInvitedIds = existingInvitations?.map(inv => inv.invited_parent_id) || [];
      
      return (groupData || []).filter(member => 
        !alreadyInvitedIds.includes(member.parent_id)
      );
    } catch (error) {
      console.error('Error fetching available parents:', error);
      return [];
    }
  };

  const handleOpenBlockSubmit = async () => {
    if (!selectedCareBlock || openBlockForm.selectedParents.length === 0) {
      alert('Please select at least one parent to invite.');
      return;
    }

    try {
      const invitations = openBlockForm.selectedParents.map(parentId => ({
        care_date: openBlockForm.date,
        start_time: openBlockForm.startTime,
        end_time: openBlockForm.endTime,
        inviting_parent_id: user.id,
        invited_parent_id: parentId,
        status: 'pending',
        notes: openBlockForm.notes,
        care_group_id: selectedCareBlock.group_id
      }));

      const { error } = await supabase
        .from('open_block_invitations')
        .insert(invitations);

      if (error) throw error;

      alert('Invitations sent successfully!');
      setShowOpenBlockModal(false);
      setSelectedCareBlock(null);
      setOpenBlockForm({
        date: '',
        startTime: '',
        endTime: '',
        notes: '',
        selectedParents: []
      });
    } catch (error) {
      console.error('Error sending invitations:', error);
      alert('Error sending invitations. Please try again.');
    }
  };

  const toggleParentSelection = (parentId: string) => {
    setOpenBlockForm(prev => ({
      ...prev,
      selectedParents: prev.selectedParents.includes(parentId)
        ? prev.selectedParents.filter(id => id !== parentId)
        : [...prev.selectedParents, parentId]
    }));
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  const days = getDaysForView();

  return (
    <div>
      <Header currentPage="calendar" />
      <div className="p-6 max-w-7xl mx-auto bg-white min-h-screen">
      
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Calendar</h1>
        <p className="text-gray-600">View your childcare schedule</p>
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
                      
                      // Get user's children IDs
                      const userChildIds = children.filter(c => c.parent_id === user?.id).map(c => c.id);
                      
                      const isUserChildNeeding = block.care_type === 'needed' && userChildIds.includes(block.child_id);
                      const isUserChildBeingCaredFor = block.care_type === 'provided' && 
                        userChildIds.includes(block.child_id) && 
                        block.parent_id !== user?.id;
                      
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
                      
                      const childNames = relevantChildren.map((child: any) => {
                        // Handle both data structures: childrenInCareBlocks format and fallback format
                        if (child.child_name) {
                          return child.child_name;
                        }
                        return child.children?.full_name || getChildName((child.child_id || ''), undefined, block);
                      }).join(', ');
                      
                      if (isUserProviding) {
                        // User is providing care for someone else's child
                        blockStyle = 'bg-green-100 text-green-800 border border-green-300';
                        blockText = `Providing care for ${childNames}`;
                      } else if (isUserChildBeingCaredFor) {
                        // Someone else is providing care for user's child
                        const providingParentName = getParentName(block.parent_id);
                        blockStyle = 'bg-blue-100 text-blue-800 border border-blue-300';
                        blockText = getEnhancedBlockText(providingParentName, childNames, block);
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
                          }
                        }
                        
                        blockStyle = 'bg-red-100 text-red-800 border border-red-300';
                        blockText = getEnhancedBlockText(providingParentName, childNames, block);
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
                          blockText = getEnhancedBlockText(providingParentName, childNames, block);
                        } else {
                          // For "provided" blocks, also show the parent name
                          const providingParentName = getParentName(block.parent_id);
                          blockStyle = 'bg-blue-100 text-blue-800 border border-blue-300'; // Make it blue like others
                          blockText = getEnhancedBlockText(providingParentName, childNames, block);
                        }
                      }
                      
                      return (
                        <div
                          key={block.id}
                          className={`text-xs p-1 rounded cursor-pointer ${blockStyle} relative`}
                          onDoubleClick={() => handleBlockDoubleClick(block)}
                          title={`${blockText} - ${formatTime(block.start_time)} to ${formatTime(block.end_time)}`}
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
                
                // Check if this is user's child being cared for by someone else
                const userChildIds = children.filter(c => c.parent_id === user?.id).map(c => c.id);
                const isUserChildBeingCaredFor = userChildIds.includes(block.child_id) && 
                  block.parent_id !== user?.id && 
                  block.care_type === 'provided';

                let badgeText = '';
                let badgeClass = '';

                if (isUserProviding) {
                  badgeText = 'Providing Care';
                  badgeClass = 'bg-green-100 text-green-800';
                } else if (isUserChildBeingCaredFor) {
                  badgeText = 'Receiving Care';
                  badgeClass = 'bg-blue-100 text-blue-800';
                } else {
                  badgeText = block.care_type === 'provided' ? 'Providing Care' : 'Receiving Care';
                  badgeClass = 'bg-gray-100 text-gray-800';
                }

                // Get group children for finding provider's child
                console.log('=== ALL GROUP CHILDREN DEBUG ===');
                console.log('Group members:', groupMembers);
                console.log('All children:', children);
                
                const allGroupChildren = groupMembers.reduce((acc: any[], member) => {
                  const memberChildren = children.filter(child => child.parent_id === member.parent_id);
                  console.log(`Children for parent ${member.parent_id} (${member.parent_name}):`, memberChildren);
                  return acc.concat(memberChildren);
                }, []);
                
                console.log('Combined group children:', allGroupChildren);
                console.log('=== END ALL GROUP CHILDREN DEBUG ===');

                return (
                  <div key={block.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badgeClass}`}>
                        {badgeText}
                      </span>
                    </div>
                    
                    <div className="text-sm text-gray-600 mb-2">
                      {formatTime(block.start_time)} - {formatTime(block.end_time)}
                    </div>

                    {/* Show detailed care arrangement info with dynamic colors */}
                    <div className={`mt-2 p-3 rounded-md border ${
                      isUserProviding 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-blue-50 border-blue-200'
                    }`}>
                      <div className="space-y-2">
                        {/* Show who is providing care */}
                        <div>
                          <p className={`text-xs font-medium ${
                            isUserProviding ? 'text-green-900' : 'text-blue-900'
                          }`}>Care Provider:</p>
                          <p className={`text-xs ${
                            isUserProviding ? 'text-green-800' : 'text-blue-800'
                          }`}>
                            {isUserProviding ? 'You are providing care' : `${getParentName(block.parent_id)} is providing care`}
                          </p>
                        </div>
                        
                        {/* Show all children in this care arrangement */}
                        <div>
                          <p className={`text-xs font-medium ${
                            isUserProviding ? 'text-green-900' : 'text-blue-900'
                          }`}>Children:</p>
                          <div className={`text-xs space-y-1 ${
                            isUserProviding ? 'text-green-800' : 'text-blue-800'
                          }`}>
                            {/* ALL children in this care arrangement */}
                            {(() => {
                              console.log('MODAL DEBUG: Children state:', children);
                              console.log('MODAL DEBUG: Children length:', children.length);
                              console.log('MODAL DEBUG: Block child_id:', block.child_id);
                              
                              // Check if children data is loaded
                              if (!children || children.length === 0) {
                                return <p>Loading children...</p>;
                              }
                              
                              // Get the receiving child
                              const receivingChild = children.find(child => child.id === block.child_id);
                              
                              // Show ALL children (remove status filter for now)
                              const allOtherChildren = children.filter(child => 
                                child.id !== block.child_id // Just exclude the receiving child to avoid duplicates
                              );
                              
                              console.log('CHILDREN DEBUG: Receiving child:', receivingChild);
                              console.log('CHILDREN DEBUG: All other children:', allOtherChildren);
                              
                              // Create a set to track unique children we've shown
                              const shownChildIds = new Set();
                              
                              return (
                                <>
                                  {/* Always show the receiving child first */}
                                  {receivingChild && (
                                    <>
                                      <p>• {receivingChild.full_name} (receiving care)</p>
                                      {(() => { shownChildIds.add(receivingChild.id); return null; })()}
                                    </>
                                  )}
                                  
                                  {/* Show other children (no status filter) */}
                                  {allOtherChildren.map((child, index) => (
                                    <p key={index}>• {child.full_name} (other child in group)</p>
                                  ))}
                                </>
                              );
                            })()}
                          </div>
                        </div>
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

      {/* Open Block Modal */}
      {showOpenBlockModal && selectedCareBlock && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Invite Group Members</h3>
              <button
                onClick={() => setShowOpenBlockModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                Date: {new Date(openBlockForm.date).toLocaleDateString()}
              </p>
              <p className="text-sm text-gray-600 mb-2">
                Time: {formatTime(openBlockForm.startTime)} - {formatTime(openBlockForm.endTime)}
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select parents to invite:
              </label>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {availableParentsForOpenBlock.map(parent => (
                  <label key={parent.parent_id} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={openBlockForm.selectedParents.includes(parent.parent_id)}
                      onChange={() => toggleParentSelection(parent.parent_id)}
                      className="mr-2"
                    />
                    <span className="text-sm">{parent.parent_name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes (optional):
              </label>
              <textarea
                value={openBlockForm.notes}
                onChange={(e) => setOpenBlockForm(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
            </div>

            <div className="flex space-x-3">
              <button
                onClick={handleOpenBlockSubmit}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Send Invitations
              </button>
              <button
                onClick={() => setShowOpenBlockModal(false)}
                className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}