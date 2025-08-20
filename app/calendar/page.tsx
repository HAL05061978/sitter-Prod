'use client';

import { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import Header from '../components/Header';
import { supabase } from '../lib/supabase';
import { formatDateOnly, formatTime, parseDateSafely, normalizeDateForCalendar, formatDateForInput } from '../lib/date-utils';

interface ScheduledCare {
  id: string;
  group_name: string;
  care_date: string;
  start_time: string;
  end_time: string;
  care_type: string;
  status: string;
  notes: string;
  children_count: number;
  providing_parent_name: string;
  children_names: string[];
}

interface NewRequestData {
  type: 'care' | 'event' | 'ride';
  group_id: string;
  child_id: string;
  date: string;
  start_time: string;
  end_time: string;
  notes: string;
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [scheduledCare, setScheduledCare] = useState<ScheduledCare[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCare, setSelectedCare] = useState<ScheduledCare | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showOpenBlockModal, setShowOpenBlockModal] = useState(false);
  const [showNewRequestModal, setShowNewRequestModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [groups, setGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [children, setChildren] = useState<Array<{ id: string; name: string; group_id: string }>>([]);
  const [newRequestData, setNewRequestData] = useState<NewRequestData>({
    type: 'care',
    group_id: '',
    child_id: '',
    date: '',
    start_time: '',
    end_time: '',
    notes: ''
  });
  const [openBlockData, setOpenBlockData] = useState<{
    invitedParents: Array<{ id: string; name: string; children: Array<{ id: string; full_name: string }> }>;
    reciprocalTimes: Array<{ date: string; startTime: string; endTime: string; notes?: string }>;
    notes?: string;
  }>({
    invitedParents: [],
    reciprocalTimes: []
  });
  const [availableParents, setAvailableParents] = useState<Array<{ id: string; name: string; children: Array<{ id: string; full_name: string }> }>>([]);
  const [loadingParents, setLoadingParents] = useState(false);
  


  useEffect(() => {
    fetchScheduledCare();
    fetchUserGroups();
  }, [currentDate]);

  // Fetch children when group changes
  useEffect(() => {
    if (newRequestData.group_id) {
      fetchChildrenForGroup(newRequestData.group_id);
    } else {
      setChildren([]);
    }
  }, [newRequestData.group_id]);

  const fetchScheduledCare = async () => {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('User not authenticated');
        return;
      }
      
      const startDate = startOfMonth(currentDate);
      const endDate = endOfMonth(currentDate);

      const { data, error } = await supabase.rpc('get_scheduled_care_for_calendar', {
        parent_id: user.id,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0]
      });

      if (error) {
        console.error('Error fetching scheduled care:', error);
        setError('Failed to fetch scheduled care');
      return;
    }
    
      setScheduledCare(data || []);
    } catch (err) {
      console.error('Error:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => direction === 'next' ? addMonths(prev, 1) : subMonths(prev, 1));
  };

  const getScheduledCareForDay = (date: Date) => {
    const dayCare = scheduledCare.filter(care => {
      // FIXED: Use normalized date comparison to prevent timezone issues
      const normalizedCareDate = normalizeDateForCalendar(care.care_date);
      const normalizedTargetDate = formatDateForInput(date);
      
      return normalizedCareDate === normalizedTargetDate;
    });

    console.log('🔍 DEBUG: Raw day care data for', date.toDateString(), ':', dayCare);

    // Consolidate blocks that share the same time slot, care type, and group
    // This handles cases where open block acceptance creates multiple blocks for the same time
    const consolidatedCare = dayCare.reduce((acc: ScheduledCare[], care) => {
      // More flexible matching - focus on time, date, type, and group
      const existingBlock = acc.find(existing => 
        existing.care_date === care.care_date &&
        existing.start_time === care.start_time &&
        existing.end_time === care.end_time &&
        existing.care_type === care.care_type &&
        existing.group_name === care.group_name
      );

      if (existingBlock) {
        // Merge children counts and names
        existingBlock.children_count += care.children_count;
        existingBlock.children_names = Array.from(new Set([...existingBlock.children_names, ...care.children_names]));
        
        console.log('🔍 DEBUG: Consolidated block:', {
          date: care.care_date,
          time: `${care.start_time}-${care.end_time}`,
          type: care.care_type,
          group: care.group_name,
          totalChildren: existingBlock.children_count,
          allChildren: existingBlock.children_names,
          existingId: existingBlock.id,
          newId: care.id
        });
      } else {
        // Add new block
        acc.push({ ...care });
        console.log('🔍 DEBUG: New block added:', {
          date: care.care_date,
          time: `${care.start_time}-${care.end_time}`,
          type: care.care_type,
          group: care.group_name,
          children: care.children_count,
          childNames: care.children_names,
          id: care.id
        });
      }

      return acc;
    }, []);

    return consolidatedCare;
  };



  const handleOpenBlock = async (care: ScheduledCare) => {
    setShowDetailModal(false);
    setShowOpenBlockModal(true);
    await fetchAvailableParents(care.id);
  };

  const fetchAvailableParents = async (careBlockId: string) => {
    try {
      setLoadingParents(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // First, get the care block details to find the group_id
      const { data: careBlock, error: blockError } = await supabase
        .from('scheduled_care')
        .select('group_id, parent_id')
        .eq('id', careBlockId)
        .single();

      if (blockError) {
        console.error('Error fetching care block:', blockError);
        return;
      }

      console.log('🔍 DEBUG: Starting fetchAvailableParents');
      console.log('🔍 DEBUG: Care block ID:', careBlockId);
      console.log('🔍 DEBUG: Group ID:', careBlock.group_id);
      console.log('🔍 DEBUG: User ID:', user.id);
      
      // Get all children currently in this care block
      const { data: blockChildren, error: childrenError } = await supabase
        .from('scheduled_care_children')
        .select('child_id')
        .eq('scheduled_care_id', careBlockId);

      if (childrenError) {
        console.error('Error fetching block children:', childrenError);
        return;
      }

      const blockChildIds = blockChildren?.map(c => c.child_id) || [];
      console.log('🔍 DEBUG: Children already in this care block:', blockChildIds);

      // Get active children in this group from child_group_members
      const { data: activeChildIds, error: activeChildrenError } = await supabase
        .from('child_group_members')
        .select('child_id')
        .eq('group_id', careBlock.group_id)
        .eq('active', true);

      if (activeChildrenError) {
        console.error('Error fetching active children:', activeChildrenError);
        return;
      }

      const activeChildIdList = activeChildIds?.map(c => c.child_id) || [];
      console.log('🔍 DEBUG: Active child IDs in group:', activeChildIdList);

      // Get child details for active children with profile information
      const { data: groupChildren, error: groupChildrenError } = await supabase
        .from('children')
        .select(`
          id,
          full_name,
          parent_id,
          profiles!inner(id, full_name)
        `)
        .in('id', activeChildIdList);

      if (groupChildrenError) {
        console.error('Error fetching children details:', groupChildrenError);
        return;
      }

      console.log('🔍 DEBUG: Active children details:', groupChildren);
      // Debug: Log the first child to see the structure
      if (groupChildren && groupChildren.length > 0) {
        console.log('🔍 DEBUG: First child structure:', JSON.stringify(groupChildren[0], null, 2));
      }

      // Group children by parent and filter out current user and parents already in this care block
      const parentMap = new Map();
      groupChildren?.forEach(child => {
        if (child.parent_id !== user.id && !blockChildIds.includes(child.id)) {
          if (!parentMap.has(child.parent_id)) {
            parentMap.set(child.parent_id, {
              id: child.parent_id,
              name: (child.profiles as any)?.full_name || 'Unknown Parent',
              children: []
            });
          }
          parentMap.get(child.parent_id).children.push({
            id: child.id,
            full_name: child.full_name
          });
        }
      });

      const available = Array.from(parentMap.values());

      console.log('🔍 DEBUG: Available parents:', available);
      setAvailableParents(available);
    } catch (error) {
      console.error('Error fetching available parents:', error);
    } finally {
      setLoadingParents(false);
    }
  };

  const addReciprocalTime = () => {
    setOpenBlockData(prev => ({
      ...prev,
      reciprocalTimes: [...prev.reciprocalTimes, { date: '', startTime: '', endTime: '', notes: '' }]
    }));
  };

  const removeReciprocalTime = (index: number) => {
    setOpenBlockData(prev => ({
      ...prev,
      reciprocalTimes: prev.reciprocalTimes.filter((_, i) => i !== index)
    }));
  };

  const updateReciprocalTime = (index: number, field: string, value: string) => {
    setOpenBlockData(prev => ({
      ...prev,
      reciprocalTimes: prev.reciprocalTimes.map((time, i) => 
        i === index ? { ...time, [field]: value } : time
      )
    }));
  };

  const toggleParent = (parent: { id: string; name: string; children: Array<{ id: string; full_name: string }> }) => {
    setOpenBlockData(prev => {
      const isSelected = prev.invitedParents.some(p => p.id === parent.id);
      if (isSelected) {
        // Remove parent only (no time block association)
        return {
          ...prev,
          invitedParents: prev.invitedParents.filter(p => p.id !== parent.id)
        };
      } else {
        // Add parent only (no time block creation)
        return {
          ...prev,
          invitedParents: [...prev.invitedParents, parent]
        };
      }
    });
  };

  const handleCreateOpenBlock = async () => {
    if (!selectedCare || openBlockData.invitedParents.length === 0) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Call the Supabase function to create open block invitations
      const { data, error } = await supabase.rpc('create_open_block_invitation', {
        p_existing_block_id: selectedCare.id,
        p_inviting_parent_id: user.id,
        p_invited_parent_ids: openBlockData.invitedParents.map(p => p.id),
        p_reciprocal_dates: openBlockData.reciprocalTimes.map(t => t.date),
        p_reciprocal_start_times: openBlockData.reciprocalTimes.map(t => t.startTime),
        p_reciprocal_end_times: openBlockData.reciprocalTimes.map(t => t.endTime),
        p_notes: openBlockData.notes || ''
      });

      if (error) {
        alert('Error creating open block invitations: ' + error.message);
        return;
      }

      alert(`Successfully created ${data?.length || 0} open block invitations!`);
      setShowOpenBlockModal(false);
      setOpenBlockData({
        invitedParents: [],
        reciprocalTimes: []
      });
      
      // Refresh the calendar data
      await fetchScheduledCare();
    } catch (error) {
      console.error('Error creating open block:', error);
      alert('Error creating open block invitations');
    }
  };

  const formatTime = (time: string) => {
    return time.substring(0, 5); // Remove seconds, keep HH:MM format
  };

  const getCareTypeColor = (careType: string) => {
    switch (careType) {
      case 'provided':
        return 'bg-green-100 border-green-300 text-green-800';
      case 'needed':
        return 'bg-blue-100 border-blue-300 text-blue-800';
      default:
        return 'bg-gray-100 border-gray-300 text-gray-800';
    }
  };

  const fetchUserGroups = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: groupsData, error: groupsError } = await supabase
        .from('group_members')
        .select(`
          group_id,
          groups!inner(id, name)
        `)
        .eq('profile_id', user.id)
        .eq('status', 'active');
      
      if (groupsError) {
        console.error('Error fetching groups:', groupsError);
        return;
      }
      
      const userGroups = groupsData.map(item => ({
        id: item.groups.id,
        name: item.groups.name
      }));
      setGroups(userGroups);
    } catch (err) {
      console.error('Error fetching groups:', err);
    }
  };

  const fetchChildrenForGroup = async (groupId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('child_group_members')
        .select(`
          children!inner(id, full_name, parent_id),
          group_id
        `)
        .eq('group_id', groupId)
        .eq('active', true)
        .eq('children.parent_id', user.id);

      if (error) {
        console.error('Error fetching children:', error);
        return;
      }

      const groupChildren = data.map(item => ({
        id: item.children?.id,
        name: item.children?.full_name,
        group_id: item.group_id
      }));

      setChildren(groupChildren);
    } catch (err) {
      console.error('Error in fetchChildrenForGroup:', err);
    }
  };

  const handleDoubleClickEmptyCell = (date: Date) => {
    setSelectedDate(date);
    setNewRequestData({
      type: 'care',
      group_id: '',
      child_id: '',
      date: format(date, 'yyyy-MM-dd'),
      start_time: '',
      end_time: '',
      notes: ''
    });
    setShowNewRequestModal(true);
  };

  const handleCreateNewRequest = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (newRequestData.type === 'care') {
        // Create reciprocal care request
        const { data, error } = await supabase.rpc('create_reciprocal_care_request', {
          requester_id: user.id,
          group_id: newRequestData.group_id,
          requested_date: newRequestData.date,
          start_time: newRequestData.start_time,
          end_time: newRequestData.end_time,
          child_id: newRequestData.child_id,
          notes: newRequestData.notes || null
        });

        if (error) {
          alert('Error creating care request: ' + error.message);
          return;
        }

        // Send notifications to group members via messages
        if (data) {
          await supabase.rpc('send_care_request_notifications', {
            p_care_request_id: data
          });
        }

        alert('Care request created successfully! Messages sent to group members.');
      } else if (newRequestData.type === 'event') {
        // TODO: Implement event request creation
        alert('Event request functionality coming soon!');
        return;
      } else if (newRequestData.type === 'ride') {
        // TODO: Implement ride request creation
        alert('Ride request functionality coming soon!');
        return;
      }

      setShowNewRequestModal(false);
      setNewRequestData({
        type: 'care',
        group_id: '',
        child_id: '',
        date: '',
        start_time: '',
        end_time: '',
        notes: ''
      });
      
      // Refresh the calendar data
      await fetchScheduledCare();
    } catch (error) {
      console.error('Error creating request:', error);
      alert('Error creating request');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header currentPage="calendar" />
        <div className="p-6">
          <div className="max-w-7xl mx-auto">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-48 mb-6"></div>
              <div className="grid grid-cols-7 gap-4">
                {Array.from({ length: 35 }).map((_, i) => (
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
      <Header currentPage="calendar" />
        <div className="p-6">
          <div className="max-w-7xl mx-auto">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">{error}</p>
            <button
                onClick={fetchScheduledCare}
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

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Add padding days to start the calendar on the correct day of week
  const startPadding = monthStart.getDay();
  const endPadding = 6 - monthEnd.getDay();
  
  const allDays = [
    ...Array.from({ length: startPadding }, (_, i) => null),
    ...daysInMonth,
    ...Array.from({ length: endPadding }, (_, i) => null)
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header currentPage="calendar" />
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Calendar</h1>
        <div className="flex items-center space-x-4">
          <button
                onClick={() => navigateMonth('prev')}
                className="p-2 rounded-lg bg-white border border-gray-300 hover:bg-gray-50"
          >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
          </button>
              <h2 className="text-xl font-semibold text-gray-700">
                {format(currentDate, 'MMMM yyyy')}
          </h2>
          <button
                onClick={() => navigateMonth('next')}
                className="p-2 rounded-lg bg-white border border-gray-300 hover:bg-gray-50"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
            {/* Day Headers */}
            <div className="grid grid-cols-7 bg-gray-100">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="p-3 text-center text-sm font-medium text-gray-700">
              {day}
            </div>
          ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7">
              {allDays.map((day, index) => {
                if (!day) {
                  return <div key={index} className="min-h-[120px] bg-gray-50" />;
                }

                const dayCare = getScheduledCareForDay(day);
                const isToday = isSameDay(day, new Date());

                return (
            <div
              key={index}
                    className={`min-h-[120px] p-2 border-r border-b border-gray-200 ${
                      isToday ? 'bg-blue-50' : ''
                    }`}
                    onDoubleClick={() => handleDoubleClickEmptyCell(day)}
                  >
                    <div className={`text-sm font-medium mb-1 ${
                      isToday ? 'text-blue-600' : 'text-gray-900'
                    }`}>
                      {format(day, 'd')}
                  </div>
                    
                    {/* Scheduled Care Blocks */}
                    <div className="space-y-1">
                      {dayCare.map(care => (
                        <div
                          key={`${care.care_date}-${care.start_time}-${care.end_time}-${care.care_type}-${care.group_name}`}
                          className={`p-1 rounded text-xs border cursor-pointer hover:opacity-80 ${getCareTypeColor(care.care_type)}`}
                          title={`${care.group_name} - ${formatTime(care.start_time)} to ${formatTime(care.end_time)} - ${care.children_count} child${care.children_count !== 1 ? 'ren' : ''}`}
                          onDoubleClick={(e) => {
                            e.stopPropagation(); // Prevent triggering the cell's double-click
                            setSelectedCare(care);
                            setShowDetailModal(true);
                          }}
                        >
                          <div className="font-medium truncate">
                            {care.group_name}
                          </div>
                          <div className="text-xs opacity-75">
                            {formatTime(care.start_time)} - {formatTime(care.end_time)}
                          </div>
                          <div className="text-xs opacity-75 font-medium">
                            {care.care_type === 'provided' ? 'Providing Care' : 'Receiving Care'}
                          </div>
                          {care.children_count > 0 && (
                            <div className="text-xs opacity-75">
                              {care.children_count} child{care.children_count !== 1 ? 'ren' : ''}
                            </div>
                          )}
                          {care.children_names && care.children_names.length > 0 && (
                            <div className="text-xs opacity-60 truncate">
                              {care.children_names.slice(0, 2).join(', ')}
                              {care.children_names.length > 2 && '...'}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
                </div>
            </div>

          {/* Legend */}
          <div className="mt-6 flex items-center space-x-6 text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-blue-100 border border-blue-300 rounded"></div>
              <span>Receiving Care</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-green-100 border border-green-300 rounded"></div>
              <span>Providing Care</span>
            </div>
          </div>

          {/* Summary */}
          {scheduledCare.length > 0 && (
            <div className="mt-6 bg-white rounded-lg shadow p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-3">This Month's Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {scheduledCare.filter(care => care.care_type === 'needed').length}
                  </div>
                  <div className="text-sm text-gray-600">Receiving Care</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {scheduledCare.filter(care => care.care_type === 'provided').length}
                  </div>
                  <div className="text-sm text-gray-600">Providing Care</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-600">
                    {scheduledCare.length}
                  </div>
                  <div className="text-sm text-gray-600">Total Blocks</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Care Detail Modal */}
      {showDetailModal && selectedCare && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Care Details</h3>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="px-6 py-4">
              <div className="space-y-3">
                <div>
                  <span className="font-medium text-gray-700">Group:</span>
                  <span className="ml-2 text-gray-900">{selectedCare.group_name}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Date:</span>
                  <span className="ml-2 text-gray-900">{formatDateOnly(selectedCare.care_date)}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Time:</span>
                  <span className="ml-2 text-gray-900">{formatTime(selectedCare.start_time)} - {formatTime(selectedCare.end_time)}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Type:</span>
                  <span className={`ml-2 px-2 py-1 rounded text-xs ${
                    selectedCare.care_type === 'provided' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {selectedCare.care_type === 'provided' ? 'Providing Care' : 'Receiving Care'}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Status:</span>
                  <span className="ml-2 text-gray-900">{selectedCare.status}</span>
                </div>
                {selectedCare.providing_parent_name && (
                  <div>
                    <span className="font-medium text-gray-700">Provider:</span>
                    <span className="ml-2 text-gray-900">{selectedCare.providing_parent_name}</span>
                  </div>
                )}
                {selectedCare.children_names && selectedCare.children_names.length > 0 && (
                  <div>
                    <span className="font-medium text-gray-700">Children:</span>
                    <div className="ml-2 mt-1">
                      {selectedCare.children_names.map((childName, index) => (
                        <span key={index} className="inline-block bg-gray-100 rounded px-2 py-1 text-xs mr-1 mb-1">
                          {childName}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {selectedCare.notes && (
                  <div>
                    <span className="font-medium text-gray-700">Notes:</span>
                    <span className="ml-2 text-gray-900">{selectedCare.notes}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200">
              {/* Show Open Block button only for care blocks where user is providing care */}
              {selectedCare.care_type === 'provided' && (
                <button
                  onClick={() => handleOpenBlock(selectedCare)}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 mb-3"
                >
                  Open Block
                </button>
              )}
              <button
                onClick={() => setShowDetailModal(false)}
                className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Open Block Modal */}
      {showOpenBlockModal && selectedCare && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Open Block Invitation</h3>
                <button
                  onClick={() => setShowOpenBlockModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Invite other parents to join your care block on {formatDateOnly(selectedCare.care_date)} at {formatTime(selectedCare.start_time)} - {formatTime(selectedCare.end_time)}
              </p>
            </div>
            
            <div className="px-6 py-4 space-y-6">
              {/* Available Parents Selection */}
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">Select Parents to Invite</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {availableParents.map((parent) => {
                    const isSelected = openBlockData.invitedParents.some(p => p.id === parent.id);
                    return (
                      <div
                        key={parent.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          isSelected 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => toggleParent(parent)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{parent.name}</p>
                            <p className="text-sm text-gray-600">
                              {parent.children.length} child{parent.children.length !== 1 ? 'ren' : ''}
                            </p>
                          </div>
                          <div className={`w-4 h-4 rounded-full border-2 ${
                            isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                          }`}>
                            {isSelected && (
                              <div className="w-2 h-2 bg-white rounded-full m-0.5"></div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Reciprocal Times */}
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">Reciprocal Care Times Needed</h4>
                <p className="text-sm text-gray-600">
                  These time blocks will be offered to all invited parents on a first-come-first-serve basis.
                </p>
                
                {openBlockData.reciprocalTimes.map((timeBlock, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="font-medium">Time Block #{index + 1}</h5>
                      <button
                        onClick={() => removeReciprocalTime(index)}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                        <input
                          type="date"
                          value={timeBlock.date}
                          onChange={(e) => updateReciprocalTime(index, 'date', (e.target as HTMLInputElement).value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                        <input
                          type="time"
                          value={timeBlock.startTime}
                          onChange={(e) => updateReciprocalTime(index, 'startTime', (e.target as HTMLInputElement).value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                        <input
                          type="time"
                          value={timeBlock.endTime}
                          onChange={(e) => updateReciprocalTime(index, 'endTime', (e.target as HTMLInputElement).value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          required
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                      <textarea
                        value={timeBlock.notes || ''}
                        onChange={(e) => updateReciprocalTime(index, 'notes', (e.target as HTMLTextAreaElement).value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        rows={2}
                        placeholder="Any specific notes about this time block..."
                      />
                    </div>
                  </div>
                ))}
                
                <button
                  onClick={addReciprocalTime}
                  className="w-full px-4 py-2 border-2 border-dashed border-gray-300 text-gray-600 rounded-lg hover:border-gray-400 hover:text-gray-700"
                >
                  + Add Time Block
                </button>
              </div>

              {/* General Notes */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">General Notes (Optional)</label>
                <textarea
                  value={openBlockData.notes || ''}
                  onChange={(e) => setOpenBlockData(prev => ({ ...prev, notes: (e.target as HTMLTextAreaElement).value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows={3}
                  placeholder="Any additional notes about this open block invitation..."
                />
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200">
              <div className="flex gap-3">
                <button
                  onClick={() => setShowOpenBlockModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateOpenBlock}
                  disabled={openBlockData.invitedParents.length === 0}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  Send Invitations
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Request Modal */}
      {showNewRequestModal && selectedDate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Create New Request</h3>
                <button
                  onClick={() => setShowNewRequestModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Create a new request for {formatDateOnly(selectedDate.toISOString())}
              </p>
            </div>
            
            <div className="px-6 py-4 space-y-6">
              {/* Request Type Selection */}
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">Request Type</h4>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => setNewRequestData(prev => ({ ...prev, type: 'care' }))}
                    className={`p-3 border rounded-lg text-center transition-colors ${
                      newRequestData.type === 'care' 
                        ? 'border-blue-500 bg-blue-50 text-blue-700' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-lg mb-1">👶</div>
                    <div className="text-sm font-medium">Care Request</div>
                  </button>
                  <button
                    onClick={() => setNewRequestData(prev => ({ ...prev, type: 'event' }))}
                    className={`p-3 border rounded-lg text-center transition-colors ${
                      newRequestData.type === 'event' 
                        ? 'border-blue-500 bg-blue-50 text-blue-700' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-lg mb-1">🎉</div>
                    <div className="text-sm font-medium">Event Request</div>
                  </button>
                  <button
                    onClick={() => setNewRequestData(prev => ({ ...prev, type: 'ride' }))}
                    className={`p-3 border rounded-lg text-center transition-colors ${
                      newRequestData.type === 'ride' 
                        ? 'border-blue-500 bg-blue-50 text-blue-700' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-lg mb-1">🚗</div>
                    <div className="text-sm font-medium">Ride Request</div>
                  </button>
                </div>
              </div>

              {/* Request Details Form */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Request Details</h4>
                
                {/* Group Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Group</label>
                  <select
                    value={newRequestData.group_id}
                    onChange={(e) => setNewRequestData(prev => ({ ...prev, group_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  >
                    <option value="">Select a group</option>
                    {groups.map(group => (
                      <option key={group.id} value={group.id}>{group.name}</option>
                    ))}
                  </select>
                </div>

                {/* Child Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Child</label>
                  <select
                    value={newRequestData.child_id}
                    onChange={(e) => setNewRequestData(prev => ({ ...prev, child_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                    disabled={!newRequestData.group_id}
                  >
                    <option value="">Select a child</option>
                    {children.map(child => (
                      <option key={child.id} value={child.id}>{child.name}</option>
                    ))}
                  </select>
                </div>

                {/* Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={newRequestData.date}
                    onChange={(e) => setNewRequestData(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>

                {/* Time Range */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                    <input
                      type="time"
                      value={newRequestData.start_time}
                      onChange={(e) => setNewRequestData(prev => ({ ...prev, start_time: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                    <input
                      type="time"
                      value={newRequestData.end_time}
                      onChange={(e) => setNewRequestData(prev => ({ ...prev, end_time: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                  <textarea
                    value={newRequestData.notes}
                    onChange={(e) => setNewRequestData(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    rows={3}
                    placeholder="Any additional details about your request..."
                  />
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200">
              <div className="flex gap-3">
                <button
                  onClick={() => setShowNewRequestModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateNewRequest}
                  disabled={!newRequestData.group_id || !newRequestData.child_id || !newRequestData.date || !newRequestData.start_time || !newRequestData.end_time}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  Create Request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}