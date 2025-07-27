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
  is_open_to_others: boolean;
  notes: string | null;
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
  response_type: 'agree' | 'counter' | 'reject';
  counter_date?: string;
  counter_start_time?: string;
  counter_end_time?: string;
  counter_duration_minutes?: number;
  notes?: string;
  status: string;
  created_at: string;
  // Reciprocal care fields
  reciprocal_date?: string;
  reciprocal_start_time?: string;
  reciprocal_end_time?: string;
  reciprocal_duration_minutes?: number;
  reciprocal_child_id?: string;
  keep_open_to_others?: boolean;
  initiator_agreed?: boolean;
  // Reciprocal child information
  reciprocal_children?: {
    full_name: string;
  };
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
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [activeChildrenPerGroup, setActiveChildrenPerGroup] = useState<{[groupId: string]: Child[]}>({});

  // Modal states
  const [showCreateRequest, setShowCreateRequest] = useState(false);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<BabysittingRequest | null>(null);
  const [responseType, setResponseType] = useState<'agree' | 'counter' | 'reject'>('agree');
  
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
    notes: '',
    counterDate: '',
    counterStartTime: '',
    counterEndTime: '',
    // Add fields for reciprocal care when agreeing
    reciprocalChildId: '',
    reciprocalDate: '',
    reciprocalStartTime: '',
    reciprocalEndTime: '',
    keepOpenToOthers: false
  });

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

        setLoading(false);
      }
    });
  }, [router, currentDate]);

  const fetchScheduledBlocks = async (userId: string, date: Date) => {
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    const { data: blocksData } = await supabase
      .from("scheduled_blocks")
      .select("*")
      .gte("scheduled_date", startOfMonth.toISOString().split('T')[0])
      .lte("scheduled_date", endOfMonth.toISOString().split('T')[0])
      .eq("parent_id", userId)
      .eq("status", "confirmed");

    setScheduledBlocks(blocksData || []);
  };

  const fetchRequestsAndResponses = async (userId: string) => {
    // Fetch active requests from user's groups with child information
    const { data: requestsData } = await supabase
      .from("babysitting_requests")
      .select(`
        *,
        children!inner(full_name)
      `)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    setRequests(requestsData || []);

    // Fetch responses for these requests with child information for reciprocal care
    if (requestsData && requestsData.length > 0) {
      const requestIds = requestsData.map(r => r.id);
      const { data: responsesData } = await supabase
        .from("request_responses")
        .select(`
          *,
          reciprocal_children:children!reciprocal_child_id(full_name)
        `)
        .in("request_id", requestIds)
        .order("created_at", { ascending: false });

      setResponses(responsesData || []);
    }
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

    let responseData: any = {
      request_id: selectedRequest.id,
      responder_id: user.id,
      response_type: responseType,
      notes: responseForm.notes || null,
      status: 'pending'
    };

    // Add counter data if countering
    if (responseType === 'counter') {
      if (!responseForm.counterDate || !responseForm.counterStartTime || !responseForm.counterEndTime) {
        alert('Please fill in all counter fields');
        return;
      }
      
      const startTime = new Date(`2000-01-01T${responseForm.counterStartTime}`);
      const endTime = new Date(`2000-01-01T${responseForm.counterEndTime}`);
      const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));

      responseData.counter_date = responseForm.counterDate;
      responseData.counter_start_time = responseForm.counterStartTime;
      responseData.counter_end_time = responseForm.counterEndTime;
      responseData.counter_duration_minutes = durationMinutes;
    }

    // Add reciprocal care data if agreeing
    if (responseType === 'agree') {
      if (!responseForm.reciprocalDate || !responseForm.reciprocalStartTime || !responseForm.reciprocalEndTime) {
        alert('Please fill in all reciprocal care fields');
        return;
      }

      // Validate that a child is selected for reciprocal care
      if (!responseForm.reciprocalChildId) {
        alert('Please select a child for reciprocal care');
        return;
      }

      // Add reciprocal care details to the response
      const reciprocalStartTime = new Date(`2000-01-01T${responseForm.reciprocalStartTime}`);
      const reciprocalEndTime = new Date(`2000-01-01T${responseForm.reciprocalEndTime}`);
      const reciprocalDurationMinutes = Math.round((reciprocalEndTime.getTime() - reciprocalStartTime.getTime()) / (1000 * 60));

      // Fix timezone issue by ensuring the date is stored as local date
      const localDate = new Date(responseForm.reciprocalDate + 'T00:00:00');
      const localDateString = localDate.toISOString().split('T')[0];

      responseData.reciprocal_date = localDateString;
      responseData.reciprocal_start_time = responseForm.reciprocalStartTime;
      responseData.reciprocal_end_time = responseForm.reciprocalEndTime;
      responseData.reciprocal_duration_minutes = reciprocalDurationMinutes;
      responseData.reciprocal_child_id = responseForm.reciprocalChildId;
      responseData.keep_open_to_others = responseForm.keepOpenToOthers;
    }

    const { error } = await supabase
      .from("request_responses")
      .insert(responseData);

    if (error) {
      alert('Error responding to request: ' + error.message);
      return;
    }

    // Reset form and close modal
    setResponseForm({
      notes: '',
      counterDate: '',
      counterStartTime: '',
      counterEndTime: '',
      reciprocalChildId: '',
      reciprocalDate: '',
      reciprocalStartTime: '',
      reciprocalEndTime: '',
      keepOpenToOthers: false
    });
    setShowResponseModal(false);
    setSelectedRequest(null);

    // Refresh data
    await fetchRequestsAndResponses(user.id);
  };

  const handleAgreeToRequest = async (request: BabysittingRequest) => {
    setSelectedRequest(request);
    setResponseType('agree');
    setShowResponseModal(true);
  };

  const handleCounterRequest = async (request: BabysittingRequest) => {
    setSelectedRequest(request);
    setResponseType('counter');
    setShowResponseModal(true);
  };

  const handleRejectRequest = async (request: BabysittingRequest) => {
    setSelectedRequest(request);
    setResponseType('reject');
    setShowResponseModal(true);
  };

  const handleAgreeToReciprocal = async (response: RequestResponse) => {
    if (!user || !response.reciprocal_date || !response.reciprocal_start_time || !response.reciprocal_end_time) {
      alert('Missing reciprocal care data');
      return;
    }

    // Update the response to mark initiator as agreed
    const { error: updateError } = await supabase
      .from("request_responses")
      .update({ initiator_agreed: true })
      .eq("id", response.id);

    if (updateError) {
      alert('Error updating response: ' + updateError.message);
      return;
    }

    // Get the original request
    const originalRequest = requests.find(r => r.id === response.request_id);
    if (!originalRequest) {
      alert('Original request not found');
      return;
    }

    // Create scheduled blocks for BOTH parents
    // Block 1: Initiator providing care to responder (reciprocal)
    const reciprocalStartTime = new Date(`2000-01-01T${response.reciprocal_start_time}`);
    const reciprocalEndTime = new Date(`2000-01-01T${response.reciprocal_end_time}`);
    const reciprocalDurationMinutes = Math.round((reciprocalEndTime.getTime() - reciprocalStartTime.getTime()) / (1000 * 60));

    const { error: reciprocalBlockError } = await supabase
      .from("scheduled_blocks")
      .insert({
        group_id: originalRequest.group_id,
        request_id: originalRequest.id,
        parent_id: user.id, // The initiator is providing care
        child_id: response.reciprocal_child_id!, // Caring for the responder's child
        scheduled_date: response.reciprocal_date,
        start_time: response.reciprocal_start_time,
        end_time: response.reciprocal_end_time,
        duration_minutes: reciprocalDurationMinutes,
        block_type: 'care_provided',
        status: 'confirmed',
        is_open_to_others: false,
        notes: `Reciprocal care for ${response.reciprocal_children?.full_name || 'Unknown child'}`
      });

    if (reciprocalBlockError) {
      alert('Error creating reciprocal care block: ' + reciprocalBlockError.message);
      return;
    }

    // Block 2: Initiator needing care (original request)
    const careStartTime = new Date(`2000-01-01T${originalRequest.start_time}`);
    const careEndTime = new Date(`2000-01-01T${originalRequest.end_time}`);
    const careDurationMinutes = Math.round((careEndTime.getTime() - careStartTime.getTime()) / (1000 * 60));

    const { error: careBlockError } = await supabase
      .from("scheduled_blocks")
      .insert({
        group_id: originalRequest.group_id,
        request_id: originalRequest.id,
        parent_id: user.id, // The initiator needs care
        child_id: originalRequest.child_id, // Their own child needs care
        scheduled_date: originalRequest.requested_date,
        start_time: originalRequest.start_time,
        end_time: originalRequest.end_time,
        duration_minutes: careDurationMinutes,
        block_type: 'care_needed',
        status: 'confirmed',
        is_open_to_others: false,
        notes: `Care needed for ${getChildName(originalRequest.child_id, originalRequest)}`
      });

    if (careBlockError) {
      alert('Error creating care block: ' + careBlockError.message);
      return;
    }

    // Block 3: Responder providing care to initiator (original request)
    const { error: responderCareBlockError } = await supabase
      .from("scheduled_blocks")
      .insert({
        group_id: originalRequest.group_id,
        request_id: originalRequest.id,
        parent_id: response.responder_id, // The responder is providing care
        child_id: originalRequest.child_id, // Caring for the initiator's child
        scheduled_date: originalRequest.requested_date,
        start_time: originalRequest.start_time,
        end_time: originalRequest.end_time,
        duration_minutes: careDurationMinutes,
        block_type: 'care_provided',
        status: 'confirmed',
        is_open_to_others: response.keep_open_to_others || false,
        notes: `Care provided for ${getChildName(originalRequest.child_id, originalRequest)}`
      });

    if (responderCareBlockError) {
      alert('Error creating responder care block: ' + responderCareBlockError.message);
      return;
    }

    // Block 4: Responder needing care (reciprocal)
    const { error: responderReciprocalBlockError } = await supabase
      .from("scheduled_blocks")
      .insert({
        group_id: originalRequest.group_id,
        request_id: originalRequest.id,
        parent_id: response.responder_id, // The responder needs care
        child_id: response.reciprocal_child_id!, // Their own child needs care
        scheduled_date: response.reciprocal_date,
        start_time: response.reciprocal_start_time,
        end_time: response.reciprocal_end_time,
        duration_minutes: reciprocalDurationMinutes,
        block_type: 'care_needed',
        status: 'confirmed',
        is_open_to_others: false,
        notes: `Reciprocal care needed for ${response.reciprocal_children?.full_name || 'Unknown child'}`
      });

    if (responderReciprocalBlockError) {
      alert('Error creating responder reciprocal care block: ' + responderReciprocalBlockError.message);
      return;
    }

    // Refresh data
    await fetchRequestsAndResponses(user.id);
    await fetchScheduledBlocks(user.id, currentDate);
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
    const dateStr = date.toISOString().split('T')[0];
    return scheduledBlocks.filter(block => block.scheduled_date === dateStr);
  };

  const formatTime = (time: string) => {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getChildName = (childId: string, request?: BabysittingRequest) => {
    // If we have the request with child data, use that first
    if (request?.children?.full_name) {
      return request.children.full_name;
    }
    
    // Fallback to local children array
    const child = children.find(c => c.id === childId);
    return child?.full_name || 'Unknown';
  };

  const getGroupName = (groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    return group?.name || 'Unknown Group';
  };

  const getInitiatorName = (initiatorId: string) => {
    // This would need to be fetched from profiles
    return 'Parent'; // Placeholder
  };

  const handlePreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
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
                      {blocksForDay.map(block => (
                        <div
                          key={block.id}
                          className={`text-xs p-1 rounded ${
                            block.block_type === 'care_needed' 
                              ? 'bg-red-100 text-red-800' 
                              : 'bg-green-100 text-green-800'
                          }`}
                        >
                          <div className="font-medium">{getChildName(block.child_id)}</div>
                          <div>{formatTime(block.start_time)} - {formatTime(block.end_time)}</div>
                          <div className="text-xs opacity-75">
                            {block.block_type === 'care_needed' ? 'Care Needed' : 'Providing Care'}
                          </div>
                        </div>
                      ))}
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
                <p className="text-gray-600">No active babysitting requests in this group.</p>
              ) : (
                <div className="space-y-4">
                  {groupRequests.map(request => {
                    const requestResponses = groupResponses.filter(resp => resp.request_id === request.id);
                    const hasUserResponded = requestResponses.some(resp => resp.responder_id === user?.id);

                    return (
                      <div key={request.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                                                         <h4 className="font-medium">
                               {getChildName(request.child_id, request)} needs care
                             </h4>
                            <p className="text-sm text-gray-600">
                              {new Date(request.requested_date).toLocaleDateString()} • {formatTime(request.start_time)} - {formatTime(request.end_time)}
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
                          </div>
                        ) : hasUserResponded ? (
                          <div className="text-sm text-green-600">
                            You have responded to this request
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
                              onClick={() => handleCounterRequest(request)}
                              className="px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 transition"
                            >
                              Counter
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
                            <div className="space-y-2">
                              {requestResponses.map(response => (
                                <div key={response.id} className="text-sm bg-gray-50 p-2 rounded">
                                  <div className="flex justify-between">
                                    <span className="font-medium">
                                      {response.response_type === 'agree' && '✅ Agreed'}
                                      {response.response_type === 'counter' && '🔄 Countered'}
                                      {response.response_type === 'reject' && '❌ Rejected'}
                                    </span>
                                    <span className="text-gray-500">
                                      {new Date(response.created_at).toLocaleDateString()}
                                    </span>
                                  </div>
                                  {response.notes && (
                                    <p className="text-gray-600 mt-1">{response.notes}</p>
                                  )}
                                                                     {response.response_type === 'counter' && response.counter_date && (
                                     <p className="text-gray-600 mt-1">
                                       Counter: {new Date(response.counter_date).toLocaleDateString()} • {formatTime(response.counter_start_time!)} - {formatTime(response.counter_end_time!)}
                                     </p>
                                   )}
                                   {response.response_type === 'agree' && response.reciprocal_date && (
                                     <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
                                       <p className="text-sm text-blue-800 font-medium">Reciprocal Care Request:</p>
                                                                               <p className="text-sm text-blue-700">
                                          {response.reciprocal_children?.full_name || 'Unknown child'} needs care on{' '}
                                          {new Date(response.reciprocal_date).toLocaleDateString()} from{' '}
                                          {formatTime(response.reciprocal_start_time!)} to {formatTime(response.reciprocal_end_time!)}
                                        </p>
                                       {!response.initiator_agreed && request.initiator_id === user?.id && (
                                         <button
                                           onClick={() => handleAgreeToReciprocal(response)}
                                           className="mt-2 px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition"
                                         >
                                           Agree to Reciprocal Care
                                         </button>
                                       )}
                                       {response.initiator_agreed && (
                                         <p className="text-sm text-green-600 mt-1">✅ Reciprocal care agreed - Scheduled!</p>
                                       )}
                                     </div>
                                   )}
                                </div>
                              ))}
                            </div>
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
              {responseType === 'counter' && 'Counter Request'}
              {responseType === 'reject' && 'Reject Request'}
            </h3>
            
            <div className="mb-4 p-3 bg-gray-50 rounded">
                             <p className="text-sm">
                 <strong>{getChildName(selectedRequest.child_id, selectedRequest)}</strong> needs care on{' '}
                 {new Date(selectedRequest.requested_date).toLocaleDateString()} from{' '}
                 {formatTime(selectedRequest.start_time)} to {formatTime(selectedRequest.end_time)}
               </p>
            </div>

                         <div className="space-y-4">
               {responseType === 'counter' && (
                 <>
                   <div>
                     <label className="block text-sm font-medium mb-1">Counter Date *</label>
                     <input
                       type="date"
                       value={responseForm.counterDate}
                       onChange={(e) => setResponseForm({...responseForm, counterDate: e.target.value})}
                       className="w-full p-2 border border-gray-300 rounded"
                       required
                     />
                   </div>
                   <div className="grid grid-cols-2 gap-2">
                     <div>
                       <label className="block text-sm font-medium mb-1">Counter Start Time *</label>
                       <input
                         type="time"
                         value={responseForm.counterStartTime}
                         onChange={(e) => setResponseForm({...responseForm, counterStartTime: e.target.value})}
                         className="w-full p-2 border border-gray-300 rounded"
                         required
                       />
                     </div>
                     <div>
                       <label className="block text-sm font-medium mb-1">Counter End Time *</label>
                       <input
                         type="time"
                         value={responseForm.counterEndTime}
                         onChange={(e) => setResponseForm({...responseForm, counterEndTime: e.target.value})}
                         className="w-full p-2 border border-gray-300 rounded"
                         required
                       />
                     </div>
                   </div>
                 </>
               )}

                               {responseType === 'agree' && (
                  <>
                    <div className="p-3 bg-blue-50 rounded border border-blue-200">
                      <p className="text-sm text-blue-800 mb-3">
                        <strong>Reciprocal Care Required:</strong> When you agree to provide care, you need to specify when you need care in return.
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-1">Which child needs care? *</label>
                      <select
                        value={responseForm.reciprocalChildId}
                        onChange={(e) => setResponseForm({...responseForm, reciprocalChildId: e.target.value})}
                        className="w-full p-2 border border-gray-300 rounded"
                        required
                      >
                        <option value="">Select a child</option>
                        {children.map(child => (
                          <option key={child.id} value={child.id}>{child.full_name}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-1">When do you need care? (Date) *</label>
                      <input
                        type="date"
                        value={responseForm.reciprocalDate}
                        onChange={(e) => setResponseForm({...responseForm, reciprocalDate: e.target.value})}
                        className="w-full p-2 border border-gray-300 rounded"
                        required
                      />
                    </div>
                   
                   <div className="grid grid-cols-2 gap-2">
                     <div>
                       <label className="block text-sm font-medium mb-1">Start Time *</label>
                       <input
                         type="time"
                         value={responseForm.reciprocalStartTime}
                         onChange={(e) => setResponseForm({...responseForm, reciprocalStartTime: e.target.value})}
                         className="w-full p-2 border border-gray-300 rounded"
                         required
                       />
                     </div>
                     <div>
                       <label className="block text-sm font-medium mb-1">End Time *</label>
                       <input
                         type="time"
                         value={responseForm.reciprocalEndTime}
                         onChange={(e) => setResponseForm({...responseForm, reciprocalEndTime: e.target.value})}
                         className="w-full p-2 border border-gray-300 rounded"
                         required
                       />
                     </div>
                   </div>
                   
                   <div className="flex items-center space-x-2">
                     <input
                       type="checkbox"
                       id="keepOpenToOthers"
                       checked={responseForm.keepOpenToOthers}
                       onChange={(e) => setResponseForm({...responseForm, keepOpenToOthers: e.target.checked})}
                       className="rounded border-gray-300"
                     />
                     <label htmlFor="keepOpenToOthers" className="text-sm text-gray-700">
                       Keep my care block open to other group members
                     </label>
                   </div>
                 </>
               )}

               <div>
                 <label className="block text-sm font-medium mb-1">
                   {responseType === 'reject' ? 'Reason for Rejection' : 'Notes'}
                 </label>
                 <textarea
                   value={responseForm.notes}
                   onChange={(e) => setResponseForm({...responseForm, notes: e.target.value})}
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
                  responseType === 'counter' ? 'bg-yellow-600 hover:bg-yellow-700' :
                  'bg-red-600 hover:bg-red-700'
                }`}
              >
                {responseType === 'agree' && 'Agree'}
                {responseType === 'counter' && 'Counter'}
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
    </div>
  );
} 