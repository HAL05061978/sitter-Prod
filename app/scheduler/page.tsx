// Scheduler Page - Care Requests and Events Management
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';
import Header from '../components/Header';

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
  request_type: 'simple' | 'reciprocal' | 'event' | 'open_block' | 'open_block_sent';
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
  // Sent invitation fields
  original_invitation_id?: string;
  invited_parent_id?: string;
  block_time_id?: string;
  open_block_id?: string;
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

export default function SchedulerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [requests, setRequests] = useState<CareRequest[]>([]);
  const [responses, setResponses] = useState<CareResponse[]>([]);
  const [allGroupChildren, setAllGroupChildren] = useState<Child[]>([]);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);

  // State for modals
  const [showCreateCareRequest, setShowCreateCareRequest] = useState(false);
  const [showCreateEventRequest, setShowCreateEventRequest] = useState(false);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<CareRequest | null>(null);

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
    isRecurring: false,
    recurrencePattern: 'weekly' as 'weekly' | 'monthly' | 'yearly',
    recurrenceEndDate: '',
    openBlockSlots: 1
  });

  const [responseForm, setResponseForm] = useState({
    responseType: 'accept' as 'accept' | 'decline',
    reciprocalTimeSlots: [{ date: '', startTime: '', endTime: '' }],
    childId: '',
    notes: ''
  });

  // Helper functions
  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getChildName = (childId: string, request?: CareRequest) => {
    // First try to get from the request children data
    if (request?.children?.full_name) {
      return request.children.full_name;
    }
    
    // Then try to get from allGroupChildren
    const child = allGroupChildren.find(c => c.id === childId);
    if (child) {
      return child.full_name;
    }
    
    // Then try to get from user's own children
    const userChild = children.find(c => c.id === childId);
    if (userChild) {
      return userChild.full_name;
    }
    
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
    const parent = allProfiles.find(p => p.id === parentId);
    return parent?.full_name || `Parent (${parentId.slice(0, 8)}...)`;
  };

  const getGroupsByType = (type: 'care' | 'event') => {
    return groups.filter(group => group.group_type === type);
  };

  // Fetch functions
  const fetchRequestsAndResponses = async (userId: string) => {
    try {
      // Get user's groups first
      const { data: userGroups, error: groupsError } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('profile_id', userId)
        .eq('status', 'active');
      
      if (groupsError) {
        console.error('Error fetching user groups:', groupsError);
        return;
      }
      
      if (!userGroups || userGroups.length === 0) {
        setRequests([]);
        setResponses([]);
        return;
      }
      
      const groupIds = userGroups.map(g => g.group_id);
      
      // Fetch care requests
      const { data: requestsData, error: requestsError } = await supabase
        .from('care_requests')
        .select(`
          *,
          children:child_id(full_name)
        `)
        .in('group_id', groupIds)
        .order('created_at', { ascending: false });
      
      if (requestsError) {
        console.error('Error fetching care requests:', requestsError);
        return;
      }
      
      setRequests(requestsData || []);
      
      // Fetch care responses
      const { data: responsesData, error: responsesError } = await supabase
        .from('care_responses')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (responsesError) {
        console.error('Error fetching care responses:', responsesError);
        return;
      }
      
      setResponses(responsesData || []);
      
    } catch (error) {
      console.error('Error in fetchRequestsAndResponses:', error);
    }
  };

  const fetchAllProfiles = async () => {
    try {
      const { data: profilesData, error } = await supabase
        .from('profiles')
        .select('id, full_name, email');
      
      if (error) {
        console.error('Error fetching all profiles:', error);
        return;
      }
      
      setAllProfiles(profilesData || []);
    } catch (error) {
      console.error('Error in fetchAllProfiles:', error);
    }
  };

  const fetchUserGroups = async (userId: string) => {
    try {
      const { data: userGroups, error: userGroupsError } = await supabase
        .from('group_members')
        .select(`
          group_id,
          groups:group_id(*)
        `)
        .eq('profile_id', userId)
        .eq('status', 'active');
      
      if (userGroupsError) {
        console.error('Error fetching user groups:', userGroupsError);
        return;
      }
      
      const groupsData = userGroups?.map(ug => ug.groups).filter(Boolean) || [];
      setGroups(groupsData);
      
      // Fetch all children in user's groups
      if (groupsData.length > 0) {
        const groupIds = groupsData.map(g => g.id);
        
        const { data: allMembersData, error: allMembersError } = await supabase
          .from('group_members')
          .select(`
            profile_id,
            groups:group_id(id, name)
          `)
          .in('group_id', groupIds)
          .eq('status', 'active');
        
        if (allMembersError) {
          console.error('Error fetching all group members:', allMembersError);
          return;
        }
        
        // Get all unique profile IDs from group members
        const allProfileIds = [...new Set(allMembersData?.map(m => m.profile_id) || [])];
        
        // Fetch children for all group members
        const { data: groupChildrenData, error: groupChildrenError } = await supabase
          .from('children')
          .select('*')
          .in('parent_id', allProfileIds);
        
        if (groupChildrenError) {
          console.error('Error fetching group children:', groupChildrenError);
        } else {
          setAllGroupChildren(groupChildrenData);
        }
      }
    } catch (error) {
      console.error('Error in fetchUserGroups:', error);
    }
  };

  const fetchUserChildren = async (userId: string) => {
    try {
      const { data: childrenData, error } = await supabase
        .from('children')
        .select('*')
        .eq('parent_id', userId);
      
      if (error) {
        console.error('Error fetching user children:', error);
        return;
      }
      
      setChildren(childrenData || []);
    } catch (error) {
      console.error('Error in fetchUserChildren:', error);
    }
  };

  // Create Care Request
  const createCareRequest = async () => {
    if (!user) {
      alert('You must be logged in to create a request');
      return;
    }

    if (!requestForm.groupId || !requestForm.childId || !requestForm.requestedDate || 
        !requestForm.startTime || !requestForm.endTime) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const startTime = `${requestForm.startTime}:00`;
      const endTime = `${requestForm.endTime}:00`;
      
      // Calculate duration
      const start = new Date(`2000-01-01T${startTime}`);
      const end = new Date(`2000-01-01T${endTime}`);
      const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);

      const requestData = {
        group_id: requestForm.groupId,
        requester_id: user.id,
        child_id: requestForm.childId,
        requested_date: requestForm.requestedDate,
        start_time: startTime,
        end_time: endTime,
        duration_minutes: durationMinutes,
        notes: requestForm.notes || null,
        request_type: requestForm.requestType,
        status: 'pending'
      };

      const { data, error } = await supabase
        .from('care_requests')
        .insert([requestData])
        .select()
        .single();

      if (error) {
        console.error('Error creating care request:', error);
        alert('Error creating care request');
        return;
      }

      // Refresh requests
      if (user) {
        await fetchRequestsAndResponses(user.id);
      }

      // Reset form
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
      alert('Care request created successfully!');
      setShowCreateCareRequest(false);

    } catch (error) {
      console.error('Error creating care request:', error);
      alert('Error creating care request');
    }
  };

  // Respond to Care Request
  const respondToCareRequest = async (request: CareRequest) => {
    if (!user) {
      alert('You must be logged in to respond');
      return;
    }

    try {
      const responseData = {
        request_id: request.id,
        responder_id: user.id,
        response_type: responseForm.responseType,
        status: 'pending'
      };

      const { data, error } = await supabase
        .from('care_responses')
        .insert([responseData])
        .select()
        .single();

      if (error) {
        console.error('Error submitting response:', error);
        alert('Error submitting response');
        return;
      }

      // Refresh data
      if (user) {
        await fetchRequestsAndResponses(user.id);
      }

      // Reset form
      setResponseForm({
        responseType: 'accept',
        reciprocalTimeSlots: [{ date: '', startTime: '', endTime: '' }],
        childId: '',
        notes: ''
      });
      setShowResponseModal(false);
      alert('Response submitted successfully!');

    } catch (error) {
      console.error('Error responding to care request:', error);
      alert('Error submitting response');
    }
  };

  // Initialize the component
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data, error }) => {
      if (error || !data.user) {
        console.error('Error fetching user:', error);
        router.replace("/auth");
      } else {
        setUser(data.user);
        
        // Fetch user profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();
        
        setProfile(profileData);
        
        // Fetch all required data
        await Promise.all([
          fetchAllProfiles(),
          fetchUserGroups(data.user.id),
          fetchUserChildren(data.user.id),
          fetchRequestsAndResponses(data.user.id)
        ]);
        
        setLoading(false);
      }
    });
  }, [router]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  return (
    <div>
      <Header currentPage="scheduler" />
      <div className="p-6 max-w-7xl mx-auto bg-white min-h-screen">
      
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Scheduler</h1>
        <p className="text-gray-600">Manage your childcare requests and events</p>
      </div>

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
          {requests.filter(request => 
            request.request_type !== 'event' && 
            request.status !== 'cancelled' &&
            (request.request_type === 'open_block' ? request.status === 'active' : true) &&
            (request.request_type === 'open_block_sent' ? request.status === 'active' : true)
          ).map(request => (
            <div key={request.id} className="bg-white rounded-lg border p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-medium text-gray-900">
                      {request.request_type === 'open_block_sent'
                        ? getGroupName(request.group_id)
                        : `Care Request for ${getChildName(request.child_id, request)}`
                      }
                    </h4>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      request.request_type === 'simple' ? 'bg-blue-100 text-blue-800' :
                      request.request_type === 'reciprocal' ? 'bg-purple-100 text-purple-800' :
                      request.request_type === 'open_block_sent' ? 'bg-purple-100 text-purple-800' :
                      'bg-orange-100 text-orange-800'
                    }`}>
                      {request.request_type === 'simple' ? 'Simple' :
                       request.request_type === 'reciprocal' ? 'Reciprocal' :
                       request.request_type === 'open_block_sent' ? 'Sent' : 'Open Block'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {request.requested_date} • {formatTime(request.start_time)} - {formatTime(request.end_time)}
                  </p>
                  {request.request_type !== 'open_block_sent' && (
                    <p className="text-sm text-gray-600">
                      Group: {getGroupName(request.group_id)} • Requested by: {getInitiatorName(request.requester_id)}
                    </p>
                  )}
                  {request.notes && (
                    <p className="text-sm text-gray-600 mt-1">{request.notes}</p>
                  )}
                </div>
                <div className="flex space-x-2 ml-4">
                  {/* Show different buttons based on request type and user role */}
                  {request.requester_id !== user?.id && request.status === 'pending' && (
                    <button
                      onClick={() => {
                        setSelectedRequest(request);
                        setShowResponseModal(true);
                      }}
                      className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Respond
                    </button>
                  )}
                  {request.requester_id === user?.id && (
                    <button
                      onClick={() => {
                        setSelectedRequest(request);
                        setRequestForm({
                          groupId: request.group_id,
                          childId: request.child_id,
                          requestedDate: request.requested_date,
                          startTime: request.start_time.slice(0, 5),
                          endTime: request.end_time.slice(0, 5),
                          notes: request.notes || '',
                          requestType: request.request_type as 'simple' | 'reciprocal' | 'event' | 'open_block',
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
                        setShowEditModal(true);
                      }}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {requests.filter(request => 
            request.request_type !== 'event' && 
            request.status !== 'cancelled'
          ).length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No care requests found. Create your first care request above.
            </div>
          )}
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
          {requests.filter(request => request.request_type === 'event').map(request => (
            <div key={request.id} className="bg-white rounded-lg border p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-medium text-gray-900">
                      {request.event_title || 'Untitled Event'}
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
                  {request.event_rsvp_deadline && (
                    <p className="text-sm text-gray-600 mt-1">
                      <span className="font-medium">RSVP Deadline:</span> {new Date(request.event_rsvp_deadline).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex space-x-2 ml-4">
                  {request.requester_id === user?.id && (
                    <button
                      onClick={() => {
                        setSelectedRequest(request);
                        setRequestForm({
                          groupId: request.group_id,
                          childId: request.child_id,
                          requestedDate: request.requested_date,
                          startTime: request.start_time.slice(0, 5),
                          endTime: request.end_time.slice(0, 5),
                          notes: request.notes || '',
                          requestType: 'event',
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
                        setShowEditModal(true);
                      }}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {requests.filter(request => request.request_type === 'event').length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No events found. Create your first event above.
            </div>
          )}
        </div>
      </div>

      {/* Create Care Request Modal */}
      {showCreateCareRequest && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-2/3 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Create Care Request</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Group</label>
                  <select
                    value={requestForm.groupId}
                    onChange={(e) => setRequestForm({...requestForm, groupId: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="">Select a group</option>
                    {getGroupsByType('care').map(group => (
                      <option key={group.id} value={group.id}>{group.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Child</label>
                  <select
                    value={requestForm.childId}
                    onChange={(e) => setRequestForm({...requestForm, childId: e.target.value})}
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
                    onChange={(e) => setRequestForm({...requestForm, requestedDate: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Start Time</label>
                    <input
                      type="time"
                      value={requestForm.startTime}
                      onChange={(e) => setRequestForm({...requestForm, startTime: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">End Time</label>
                    <input
                      type="time"
                      value={requestForm.endTime}
                      onChange={(e) => setRequestForm({...requestForm, endTime: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Request Type</label>
                  <select
                    value={requestForm.requestType}
                    onChange={(e) => setRequestForm({...requestForm, requestType: e.target.value as 'simple' | 'reciprocal' | 'event' | 'open_block'})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="simple">Simple</option>
                    <option value="reciprocal">Reciprocal</option>
                    <option value="open_block">Open Block</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Notes</label>
                  <textarea
                    value={requestForm.notes}
                    onChange={(e) => setRequestForm({...requestForm, notes: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    rows={3}
                    placeholder="Optional notes..."
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={createCareRequest}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Create Request
              </button>
              <button
                onClick={() => setShowCreateCareRequest(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Response Modal */}
      {showResponseModal && selectedRequest && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-2/3 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Respond to Care Request
              </h3>
              
              <div className="bg-gray-50 p-4 rounded-md mb-4">
                <h4 className="font-medium">{getChildName(selectedRequest.child_id, selectedRequest)}</h4>
                <p className="text-sm text-gray-600">
                  {selectedRequest.requested_date} • {formatTime(selectedRequest.start_time)} - {formatTime(selectedRequest.end_time)}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Response</label>
                  <select
                    value={responseForm.responseType}
                    onChange={(e) => setResponseForm({...responseForm, responseType: e.target.value as 'accept' | 'decline'})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="accept">Accept</option>
                    <option value="decline">Decline</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Notes</label>
                  <textarea
                    value={responseForm.notes}
                    onChange={(e) => setResponseForm({...responseForm, notes: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    rows={3}
                    placeholder="Optional notes..."
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => respondToCareRequest(selectedRequest)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Submit Response
              </button>
              <button
                onClick={() => setShowResponseModal(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
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

