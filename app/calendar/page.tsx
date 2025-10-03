'use client';

import { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, eachDayOfInterval as eachDayOfWeek, addDays, isSameDay as isSameDayUtil } from 'date-fns';
import Header from '../components/Header';
import { supabase } from '../lib/supabase';
import { formatDateOnly, formatTime, parseDateSafely, normalizeDateForCalendar, formatDateForInput } from '../lib/date-utils';
import RescheduleModal from '../../components/care/RescheduleModal';

interface ScheduledCare {
  id: string;
  group_name: string;
  care_date: string;
  start_time: string;
  end_time: string;
  care_type: string;
  status: string;
  action_type?: string;
  notes: string;
  children_count: number;
  providing_parent_name: string;
  children_names: string[];
  group_id?: string;
  related_request_id?: string;
  children_data?: Array<{ id: string; full_name: string }>;
}

interface NewRequestData {
  type: 'care' | 'event';
  group_id: string;
  child_id: string;
  date: string;
  start_time: string;
  end_time: string;
  notes: string;
  event_title?: string;
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Utility function to extract actual end time from notes for next-day care
  const getActualEndTime = (notes: string, fallbackEndTime: string): string => {
    if (!notes) return fallbackEndTime;
    
    const match = notes.match(/\[Next-day care: Actual end time is ([0-9]{2}:[0-9]{2})\]/);
    return match ? match[1] : fallbackEndTime;
  };
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<'monthly' | 'weekly'>('monthly');
  const [scheduledCare, setScheduledCare] = useState<ScheduledCare[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCare, setSelectedCare] = useState<ScheduledCare | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showOpenBlockModal, setShowOpenBlockModal] = useState(false);
  const [showNewRequestModal, setShowNewRequestModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [groups, setGroups] = useState<Array<{ id: string; name: string; group_type: string }>>([]);
  const [children, setChildren] = useState<Array<{ id: string; name: string; group_id: string }>>([]);
  const [newRequestData, setNewRequestData] = useState<NewRequestData>({
    type: 'care',
    group_id: '',
    child_id: '',
    date: '',
    start_time: '',
    end_time: '',
    notes: '',
    event_title: ''
  });
  const [openBlockData, setOpenBlockData] = useState<{
    invitedParents: Array<{ id: string; name: string; children: Array<{ id: string; full_name: string }> }>;
    reciprocalTimes: Array<{ date: string; startTime: string; endTime: string; notes?: string; parentId?: string }>;
    notes?: string;
  }>({
    invitedParents: [],
    reciprocalTimes: []
  });
  const [availableParents, setAvailableParents] = useState<Array<{ id: string; name: string; children: Array<{ id: string; full_name: string }> }>>([]);
  const [loadingParents, setLoadingParents] = useState(false);
  const [timeValidationError, setTimeValidationError] = useState<string | null>(null);
  
  // Initialize with today's date selected
  useEffect(() => {
    setSelectedDate(new Date());
  }, []);





  // Auto-scroll to earliest scheduled block when hourly view loads
  useEffect(() => {
    if (viewMode === 'weekly' && selectedDate) {
      const dayCare = getScheduledCareForDay(selectedDate);
      const isToday = isSameDayUtil(selectedDate, new Date());
      
      let scrollToHour = 6; // Default to 6am
      
      if (dayCare.length > 0) {
        // Find the earliest scheduled time
        const earliestTime = dayCare.reduce((earliest, care) => {
          const careStartHour = parseInt(care.start_time.split(':')[0]);
          return Math.min(earliest, careStartHour);
        }, 24);
        
        // Scroll to the earliest scheduled block
        scrollToHour = earliestTime;
      } else if (isToday) {
        // For current day with no blocks, scroll to next hour
        const now = new Date();
        const currentHour = now.getHours();
        scrollToHour = Math.max(6, currentHour + 1); // Next hour, but not before 6am
      }
      
      console.log('🔍 Auto-scrolling to hour:', scrollToHour, 'for date:', selectedDate, 'isToday:', isToday);
      
      setTimeout(() => {
        const hourElement = document.getElementById(`hour-${scrollToHour}`);
        if (hourElement) {
          hourElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  }, [viewMode, selectedDate]);



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
        p_parent_id: user.id,
        p_start_date: startDate.toISOString().split('T')[0],
        p_end_date: endDate.toISOString().split('T')[0]
      });

      if (error) {
        setError('Error fetching scheduled care');
      return;
    }
    
      setScheduledCare(data || []);
    } catch (err) {
      setError('Error fetching scheduled care');
    } finally {
      setLoading(false);
    }
  };

  // Get weekly view dates for selected date
  const getWeeklyDates = (date: Date) => {
    const start = startOfWeek(date, { weekStartsOn: 0 }); // Sunday start
    const end = endOfWeek(date, { weekStartsOn: 0 });
    return eachDayOfWeek({ start, end });
  };

  // Get hourly schedule for selected date
  const getHourlySchedule = (date: Date) => {
    const dayCare = getScheduledCareForDay(date);
    
    // Always start at midnight (00:00) to allow full scrolling
    const startHour = 0;
    const hours = Array.from({ length: 24 - startHour }, (_, i) => startHour + i);
    
    // Create a map to track which hours are occupied by care blocks
    const occupiedHours = new Set<number>();
    
    // Process care blocks and mark occupied hours
    dayCare.forEach(care => {
      const careStart = parseInt(care.start_time.split(':')[0]);
      const careEnd = parseInt(care.end_time.split(':')[0]);
      
      for (let hour = careStart; hour < careEnd; hour++) {
        occupiedHours.add(hour);
      }
    });
    
    return hours.map(hour => {
      const hourStart = `${hour.toString().padStart(2, '0')}:00`;
      const hourEnd = `${(hour + 1).toString().padStart(2, '0')}:00`;
      
      // Find care blocks that start at this hour
      const startingCare = dayCare.filter(care => {
        const careStart = parseInt(care.start_time.split(':')[0]);
        return careStart === hour;
      });
      
      // Find care blocks that continue from previous hours
      const continuingCare = dayCare.filter(care => {
        const careStart = parseInt(care.start_time.split(':')[0]);
        const careEnd = parseInt(care.end_time.split(':')[0]);
        return careStart < hour && careEnd > hour;
      });
      
      return {
        hour,
        time: hourStart,
        startingCare,
        continuingCare,
        isOccupied: occupiedHours.has(hour)
      };
    });
  };

  // Handle double-click on hourly slot
  const handleHourlySlotDoubleClick = (hour: number, date: Date) => {
    const startTime = `${hour.toString().padStart(2, '0')}:00`;
    const endTime = `${(hour + 1).toString().padStart(2, '0')}:00`;
    
    setSelectedDate(date);
    setNewRequestData({
      type: 'care',
      group_id: '',
      child_id: '',
      date: format(date, 'yyyy-MM-dd'),
      start_time: startTime,
      end_time: endTime,
      notes: '',
      event_title: ''
    });
    setShowNewRequestModal(true);
  };

  // Handle day selection
  const handleDaySelect = (date: Date) => {
    setSelectedDate(date);
    setViewMode('weekly');
  };

  // Navigate to previous/next month
  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => direction === 'next' ? addMonths(prev, 1) : subMonths(prev, 1));
  };

  // Navigate to previous/next week
  const navigateWeek = (direction: 'prev' | 'next') => {
    if (selectedDate) {
      const newDate = direction === 'next' ? addDays(selectedDate, 7) : addDays(selectedDate, -7);
      setSelectedDate(newDate);
      setCurrentDate(newDate);
    }
  };

  const getScheduledCareForDay = (date: Date) => {
    const dayCare = scheduledCare.filter(care => {
      // FIXED: Use normalized date comparison to prevent timezone issues
      const normalizedCareDate = normalizeDateForCalendar(care.care_date);
      const normalizedTargetDate = formatDateForInput(date);
      
      return normalizedCareDate === normalizedTargetDate;
    });

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
        if (care.children_names && care.children_names.length > 0) {
          existingBlock.children_names = [...new Set([...existingBlock.children_names, ...care.children_names])];
        }
      } else {
        // Add as new block
        acc.push(care);
      }
      return acc;
    }, [] as ScheduledCare[]);

    return consolidatedCare;
  };



  const handleOpenBlock = async (care: ScheduledCare) => {
    setShowDetailModal(false);
    setShowOpenBlockModal(true);
    await fetchAvailableParents(care.id);
  };

  const handleReschedule = async (care: ScheduledCare) => {
    try {
      // Fetch the missing data needed for the reschedule modal
      const { data: careBlockData, error } = await supabase
        .from('scheduled_care')
        .select(`
          group_id,
          related_request_id,
          scheduled_care_children(
            child_id,
            children(id, full_name)
          )
        `)
        .eq('id', care.id)
        .single();

      if (error) {
        console.error('Error fetching care block data:', error);
        setError('Error loading care block details');
        return;
      }

      // Store the additional data in the selectedCare state
      const enhancedCare = {
        ...care,
        group_id: careBlockData.group_id,
        related_request_id: careBlockData.related_request_id,
        children_data: careBlockData.scheduled_care_children?.map((scc: any) => ({
          id: scc.children.id,
          full_name: scc.children.full_name
        })) || []
      };

      setSelectedCare(enhancedCare);
      setShowDetailModal(false);
      setShowRescheduleModal(true);
    } catch (err) {
      console.error('Error in handleReschedule:', err);
      setError('Error loading care block details');
    }
  };

  const handleRescheduleSuccess = async () => {
    setShowRescheduleModal(false);
    await fetchScheduledCare();
  };

  const fetchAvailableParents = async (careBlockId: string) => {
    try {
      setLoadingParents(true);
      console.log('🔍 Starting fetchAvailableParents for care block:', careBlockId);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('❌ No user found');
        return;
      }

      // First, get the care block details to find the group_id
      const { data: careBlock, error: blockError } = await supabase
        .from('scheduled_care')
        .select('group_id, parent_id')
        .eq('id', careBlockId)
        .single();

      if (blockError) {
        console.log('❌ Error fetching care block:', blockError);
        setError('Error fetching care block');
        return;
      }

      console.log('✅ Care block found:', careBlock);
      
      // Get children already in this care block
      const { data: blockChildren, error: childrenError } = await supabase
        .from('scheduled_care_children')
        .select('child_id')
        .eq('scheduled_care_id', careBlockId);

      if (childrenError) {
        console.log('❌ Error fetching block children:', childrenError);
        setError('Error fetching block children');
        return;
      }

      console.log('✅ Block children found:', blockChildren);

      const blockChildIds = new Set((blockChildren || []).map(c => c.child_id));

      // Get active children in the group
      const { data: activeChildren, error: activeChildrenError } = await supabase
        .from('child_group_members')
        .select('child_id')
        .eq('group_id', careBlock.group_id)
        .eq('active', true);

      if (activeChildrenError) {
        console.log('❌ Error fetching active children:', activeChildrenError);
        setError('Error fetching active children');
        return;
      }

      console.log('✅ Active children found:', activeChildren);

      const activeChildIdList = (activeChildren || []).map(c => c.child_id);

      // Get children details for the group
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
        console.log('❌ Error fetching children details:', groupChildrenError);
        setError('Error fetching children details');
        return;
      }

      console.log('✅ Group children details found:', groupChildren);

      // Filter out children already in the care block
      const availableChildren = groupChildren
        .filter(item => !Array.from(blockChildIds).includes(item.id))
        .map(item => ({
          id: item.id,
          full_name: item.full_name
        }));
      
      console.log('✅ Available children (not in block):', availableChildren);

      // Get available parents for these children
      const available = await Promise.all(
        availableChildren.map(async (child) => {
          console.log('🔍 Fetching parent for child:', child);
          
          // First, get the child's parent_id directly from the children table
          const { data: childData, error: childError } = await supabase
            .from('children')
            .select('parent_id')
            .eq('id', child.id)
            .single();
            
          if (childError) {
            console.log('❌ Error fetching child parent_id:', childError);
            return null;
          }
          
          console.log('✅ Child parent_id:', childData.parent_id);
          
          // Now get the parent's profile information
          const { data: parentData, error: parentError } = await supabase
            .from('profiles')
            .select('id, full_name')
            .eq('id', childData.parent_id)
            .single();
            
          if (parentError) {
            console.log('❌ Error fetching parent profile:', parentError);
            return null;
          }
          
          console.log('✅ Parent profile found:', parentData);
          
          // Check if this parent is an active member of the group
          const { data: groupMembership, error: membershipError } = await supabase
            .from('group_members')
            .select('status')
            .eq('group_id', careBlock.group_id)
            .eq('profile_id', parentData.id)
            .single();
            
          if (membershipError) {
            console.log('❌ Error checking group membership:', membershipError);
            return null;
          }
          
          console.log('✅ Group membership status:', groupMembership);
          
          // Only include parents who are active members of the group
          if (groupMembership.status === 'active') {
            return {
              id: parentData.id,
              name: parentData.full_name,
              children: [child]
            };
          } else {
            console.log('❌ Parent not active in group:', parentData.full_name);
            return null;
          }
        })
      );
      
      console.log('✅ Raw available parents data:', available);

      const filteredAvailable = available.filter((item): item is NonNullable<typeof item> => item !== null);
      console.log('✅ Final filtered available parents:', filteredAvailable);
      
      setAvailableParents(filteredAvailable);
    } catch (error) {
      console.log('❌ Error in fetchAvailableParents:', error);
      setError('Error fetching available parents');
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
    setOpenBlockData(prev => {
      const timeBlockToRemove = prev.reciprocalTimes[index];
      
      // If this is an auto-created time block (has parentId), also remove the parent
      if (timeBlockToRemove?.parentId) {
        return {
          ...prev,
          invitedParents: prev.invitedParents.filter(p => p.id !== timeBlockToRemove.parentId),
          reciprocalTimes: prev.reciprocalTimes.filter((_, i) => i !== index)
        };
      } else {
        // Just remove the manually added time block
        return {
          ...prev,
          reciprocalTimes: prev.reciprocalTimes.filter((_, i) => i !== index)
        };
      }
    });
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
        // Remove parent and their associated time block
        const parentIndex = prev.invitedParents.findIndex(p => p.id === parent.id);
        return {
          ...prev,
          invitedParents: prev.invitedParents.filter(p => p.id !== parent.id),
          reciprocalTimes: prev.reciprocalTimes.filter((_, index) => index !== parentIndex)
        };
      } else {
        // Add parent and automatically create a time block for them
        return {
          ...prev,
          invitedParents: [...prev.invitedParents, parent],
          reciprocalTimes: [...prev.reciprocalTimes, { 
            date: '', 
            startTime: '', 
            endTime: '', 
            notes: '',
            parentId: parent.id // Associate time block with parent
          }]
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
      setError('Error creating open block');
      alert('Error creating open block invitations');
    }
  };

  const formatTime = (time: string) => {
    return time.substring(0, 5); // Remove seconds, keep HH:MM format
  };


  // Helper function to calculate time duration and check if end time is next day
  const calculateTimeDuration = (startTime: string, endTime: string) => {
    if (!startTime || !endTime) return { duration: 0, isNextDay: false, error: null };
    
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;
    
    let durationMinutes: number;
    let isNextDay = false;
    
    if (endMinutes >= startMinutes) {
      // Same day
      durationMinutes = endMinutes - startMinutes;
    } else {
      // Next day
      durationMinutes = (24 * 60) - startMinutes + endMinutes;
      isNextDay = true;
    }
    
    const durationHours = durationMinutes / 60;
    
    // Check if duration exceeds 23 hours 59 minutes
    if (durationMinutes > 23 * 60 + 59) {
      return {
        duration: durationHours,
        isNextDay,
        error: 'Maximum duration is 23 hours and 59 minutes'
      };
    }
    
    return {
      duration: durationHours,
      isNextDay,
      error: null
    };
  };

  // Validate time inputs
  const validateTimes = (startTime: string, endTime: string) => {
    if (!startTime || !endTime) {
      setTimeValidationError(null);
      return true;
    }
    
    const result = calculateTimeDuration(startTime, endTime);
    
    if (result.error) {
      setTimeValidationError(result.error);
      return false;
    }
    
    setTimeValidationError(null);
    return true;
  };

  // Helper function to get the actual end date when time goes to next day
  const getEndDate = (startDate: string, startTime: string, endTime: string) => {
    if (!startDate || !startTime || !endTime) return null;
    
    const result = calculateTimeDuration(startTime, endTime);
    if (!result.isNextDay) return null;
    
    // Add one day to the start date
    const startDateObj = new Date(startDate + 'T00:00:00'); // Ensure we're working with the correct date
    const endDateObj = new Date(startDateObj.getTime() + 24 * 60 * 60 * 1000);
    return endDateObj;
  };

  // Get care type color styling
  const getCareTypeColor = (careType: string, actionType?: string, status?: string) => {
    // Check for rescheduled blocks first (highest priority)
    if (actionType === 'rescheduled' && status === 'rescheduled') {
      return 'bg-orange-100 border border-orange-300 text-orange-800';
    }
    
    // Then check regular care types
    switch (careType) {
      case 'needed':
        return 'bg-blue-100 border border-blue-300 text-blue-800';
      case 'provided':
        return 'bg-green-100 border border-green-300 text-green-800';
      case 'event':
        return 'bg-purple-100 border border-purple-300 text-purple-800';
      default:
        return 'bg-gray-100 border border-gray-300 text-gray-800';
    }
  };

  // Get care type background color for indicators (no border)
  const getCareTypeBgColor = (careType: string, actionType?: string, status?: string) => {
    // Check for rescheduled blocks first (highest priority)
    if (actionType === 'rescheduled' && status === 'rescheduled') {
      return 'bg-orange-200';
    }
    
    // Then check regular care types
    switch (careType) {
      case 'needed':
        return 'bg-blue-200';
      case 'provided':
        return 'bg-green-200';
      case 'event':
        return 'bg-purple-200';
      default:
        return 'bg-gray-200';
    }
  };

  // Get monthly days for calendar grid
  const getMonthlyDays = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Add padding days to start the calendar on the correct day of week
    const startPadding = monthStart.getDay();
    const endPadding = 6 - monthEnd.getDay();
    
    return [
      ...Array.from({ length: startPadding }, (_, i) => null),
      ...daysInMonth,
      ...Array.from({ length: endPadding }, (_, i) => null)
    ];
  };

  const fetchUserGroups = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: groupsData, error: groupsError } = await supabase
        .from('group_members')
        .select(`
          group_id,
          groups!inner(id, name, group_type)
        `)
        .eq('profile_id', user.id)
        .eq('status', 'active');
      
      if (groupsError) {
        setError('Error fetching groups');
        return;
      }
      
      const userGroups = groupsData.map(item => ({
        id: item.groups.id,
        name: item.groups.name,
        group_type: item.groups.group_type
      }));
      setGroups(userGroups);
    } catch (err) {
      setError('Error fetching groups');
    }
  };

  // Function to get filtered groups based on request type
  const getFilteredGroups = () => {
    const filtered = newRequestData.type === 'care' 
      ? groups.filter(group => group.group_type === 'care')
      : newRequestData.type === 'event'
      ? groups.filter(group => group.group_type === 'event')
      : groups;
    
    return filtered;
  };

  const fetchChildrenForGroup = async (groupId: string) => {
    try {
      console.log('🔍 Starting fetchChildrenForGroup for group:', groupId);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('❌ No user found');
        return;
      }

      // First, get the group type to determine how to fetch children
      const selectedGroup = groups.find(g => g.id === groupId);
      console.log('✅ Selected group:', selectedGroup);
      
      if (selectedGroup?.group_type === 'event') {
        // For event groups, get children from child_group_members
        // But only show the current user's children in this group
        const { data, error } = await supabase
          .from('child_group_members')
          .select(`
            child_id,
            children!inner(id, full_name, parent_id)
          `)
          .eq('group_id', groupId)
          .eq('active', true)
          .eq('parent_id', user.id); // Only show current user's children

        if (error) {
          console.log('❌ Error fetching children for event group:', error);
          setError('Error fetching children for event group');
          return;
        }

        console.log('✅ Children fetched for event group (user filtered):', data);
        const groupChildren = data?.map(item => ({
          id: item.children.id,
          full_name: item.children.full_name,
          parent_id: item.children.parent_id
        })) || [];

        setChildren(groupChildren);
      } else {
        // For care groups, also get children from child_group_members (same approach)
        // But only show the current user's children in this group
        const { data, error } = await supabase
          .from('child_group_members')
          .select(`
            child_id,
            children!inner(id, full_name, parent_id)
          `)
          .eq('group_id', groupId)
          .eq('active', true)
          .eq('parent_id', user.id); // Only show current user's children

        if (error) {
          console.log('❌ Error fetching children for care group:', error);
          setError('Error fetching children for care group');
          return;
        }

        console.log('✅ Children fetched for care group (user filtered):', data);
        const groupChildren = data?.map(item => ({
          id: item.children.id,
          full_name: item.children.full_name,
          parent_id: item.children.parent_id
        })) || [];

        setChildren(groupChildren);
      }
    } catch (err) {
      setError('Error in fetchChildren');
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
      notes: '',
      event_title: ''
    });
    setShowNewRequestModal(true);
  };

  const handleCreateNewRequest = async () => {
    // Validate times before submission
    if (!validateTimes(newRequestData.start_time, newRequestData.end_time)) {
      return; // Don't submit if validation fails
    }
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Calculate if this is a next-day scenario
      const timeResult = calculateTimeDuration(newRequestData.start_time, newRequestData.end_time);
      const isNextDay = timeResult.isNextDay;
      
      // For next-day scenarios, cap the end time at 23:59:59
      const dbEndTime = isNextDay ? '23:59:59' : newRequestData.end_time;
      
      // Add note about actual end time for next-day scenarios
      const enhancedNotes = isNextDay 
        ? `${newRequestData.notes || ''}\n\n[Next-day care: Actual end time is ${newRequestData.end_time}]`.trim()
        : newRequestData.notes;

      if (newRequestData.type === 'care') {
        // Create reciprocal care request
        const { data, error } = await supabase.rpc('create_reciprocal_care_request', {
          requester_id: user.id,
          group_id: newRequestData.group_id,
          requested_date: newRequestData.date,
          start_time: newRequestData.start_time,
          end_time: dbEndTime, // Use capped end time for database
          child_id: newRequestData.child_id,
          notes: enhancedNotes || null
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
        // Create event using create_event_blocks function
        if (!newRequestData.event_title) {
          alert('Event title is required for event requests');
          return;
        }

        // For events, we need to create an event request first
        // Since we don't have a separate events table, we'll create it directly in scheduled_care
        // We'll use the create_event_blocks function which handles the group member distribution
        
        const { data: eventData, error: eventError } = await supabase.rpc('create_event_blocks', {
          p_group_id: newRequestData.group_id,
          p_event_request_id: null, // We'll create this as a direct event for now
          p_child_id: newRequestData.child_id,
          p_care_date: newRequestData.date,
          p_start_time: newRequestData.start_time,
          p_end_time: dbEndTime, // Use capped end time for database
          p_event_title: newRequestData.event_title
        });

        if (eventError) {
          setError('Error creating event');
          alert('Error creating event: ' + eventError.message);
          return;
        }

        // Send notifications to group members
        // TODO: Implement event notifications using notify_group_event_members
        
        alert('Event created successfully! All group members have been invited.');
      }

      setShowNewRequestModal(false);
      setNewRequestData({
        type: 'care',
        group_id: '',
        child_id: '',
        date: '',
        start_time: '',
        end_time: '',
        notes: '',
        event_title: ''
      });
      
      // Refresh the calendar data
      await fetchScheduledCare();
    } catch (error) {
      setError('Error creating request');
      alert('Error creating request');
    }
  };

  // Go back to monthly view
  const goBackToMonthly = () => {
    setViewMode('monthly');
    setSelectedDate(null);
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

          {/* Calendar Views - Conditional Rendering */}
          {viewMode === 'monthly' ? (
            /* Monthly View */
            <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
            <div className="grid grid-cols-7 bg-gray-100">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="p-2 text-center text-xs font-medium text-gray-700">
              {day}
            </div>
          ))}
            </div>
            <div className="grid grid-cols-7">
                {getMonthlyDays().map((day, index) => {
                if (!day) {
                  return <div key={index} className="min-h-[120px] bg-gray-50" />;
                }

                const dayCare = getScheduledCareForDay(day);
                  const isToday = isSameDayUtil(day, new Date());
                  const isSelected = selectedDate && isSameDayUtil(day, selectedDate);

                return (
                  <div
                    key={index}
                      className={`min-h-[120px] p-3 border-r border-b border-gray-200 cursor-pointer hover:bg-gray-50 ${
                      isToday ? 'bg-blue-50' : ''
                      } ${isSelected ? 'bg-blue-100 border-blue-300' : ''}`}
                      onClick={() => handleDaySelect(day)}
                  >
                      <div className={`text-base font-medium mb-3 ${
                        isToday ? 'text-blue-600' : isSelected ? 'text-blue-800' : 'text-gray-900'
                    }`}>
                      {format(day, 'd')}
                    </div>
                    
                      {/* Detailed care blocks - like before */}
                      <div className="space-y-1.5">
                        {dayCare.slice(0, 2).map((care, careIndex) => (
                          <div
                            key={careIndex}
                            className={`p-1.5 rounded text-xs ${getCareTypeColor(care.care_type, care.action_type, care.status)} cursor-pointer hover:opacity-80`}
                            title={`${care.group_name} - ${formatTime(care.start_time)} to ${formatTime(getActualEndTime(care.notes || '', care.end_time))}`}
                            onClick={(e) => {
                              e.stopPropagation();
                            setSelectedCare(care);
                            setShowDetailModal(true);
                          }}
                        >
                          {care.action_type === 'rescheduled' && care.status === 'rescheduled' && (
                            <div className="text-xs font-semibold text-orange-600 mb-1">
                              🔄 RESCHEDULING
                            </div>
                          )}
                          <div className="font-medium truncate">
                            {care.care_type === 'event' && care.event_title ? care.event_title : care.group_name}
                          </div>
                          <div className="text-xs opacity-75">
                            {formatTime(care.start_time)} - {formatTime(getActualEndTime(care.notes || '', care.end_time))}
                          </div>
                          <div className="text-xs opacity-75 font-medium">
                            {care.care_type === 'event' ? 'Event' : 
                             care.care_type === 'provided' ? 'Providing Care' : 'Receiving Care'}
                          </div>
                            {care.providing_parent_name && (
                              <div className="text-xs opacity-75 truncate">
                                Provider: {care.providing_parent_name}
                              </div>
                            )}
                          {care.children_count > 0 && (
                            <div className="text-xs opacity-75">
                                {care.children_count} children
                            </div>
                          )}
                          {care.children_names && care.children_names.length > 0 && (
                              <div className="text-xs opacity-75 truncate">
                              {care.children_names.slice(0, 2).join(', ')}
                              {care.children_names.length > 2 && '...'}
                            </div>
                          )}
                        </div>
                      ))}
                        {dayCare.length > 2 && (
                          <div className="h-2 bg-gray-300 rounded-full opacity-80" title={`${dayCare.length - 2} more items`} />
                        )}
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          ) : (
            /* Weekly View */
            <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={goBackToMonthly}
                      className="p-2 rounded-lg bg-gray-200 hover:bg-gray-300 transition-colors"
                      title="Back to monthly view"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Week of {format(startOfWeek(selectedDate!, { weekStartsOn: 0 }), 'MMM d')} - {format(endOfWeek(selectedDate!, { weekStartsOn: 0 }), 'MMM d, yyyy')}
                    </h3>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => navigateWeek('prev')}
                      className="p-1 rounded hover:bg-gray-200"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => navigateWeek('next')}
                      className="p-1 rounded hover:bg-gray-200"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
            </div>
              
              <div className="grid grid-cols-7">
                {getWeeklyDates(selectedDate!).map((date, index) => {
                  const dayCare = getScheduledCareForDay(date);
                  const isToday = isSameDayUtil(date, new Date());
                  const isSelected = isSameDayUtil(date, selectedDate!);

                  return (
                    <div
                      key={index}
                      className={`min-h-[120px] p-3 border-r border-b border-gray-200 cursor-pointer hover:bg-gray-50 ${
                        isToday ? 'bg-blue-50' : ''
                      } ${isSelected ? 'bg-blue-100 border-blue-300' : ''}`}
                      onClick={() => handleDaySelect(date)}
                    >
                      <div className={`text-sm font-medium mb-2 ${
                        isToday ? 'text-blue-600' : isSelected ? 'text-blue-800' : 'text-gray-900'
                      }`}>
                        {format(date, 'EEE')}
                      </div>
                      <div className={`text-xl font-bold ${
                        isToday ? 'text-blue-600' : isSelected ? 'text-blue-800' : 'text-gray-900'
                      }`}>
                        {format(date, 'd')}
                      </div>
                      
                      {/* Simplified care indicators for weekly view */}
                      <div className="space-y-1.5 mt-3">
                        {dayCare.slice(0, 4).map((care, careIndex) => (
                          <div
                            key={careIndex}
                            className={`p-2 rounded text-xs ${getCareTypeColor(care.care_type, care.action_type, care.status)} cursor-pointer hover:opacity-80`}
                            title={`${care.group_name} - ${formatTime(care.start_time)} to ${formatTime(getActualEndTime(care.notes || '', care.end_time))}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCare(care);
                              setShowDetailModal(true);
                            }}
                          >
                            {care.action_type === 'rescheduled' && care.status === 'rescheduled' && (
                              <div className="text-xs font-semibold text-orange-600 mb-1">
                                🔄 RESCHEDULING
                              </div>
                            )}
                            <div className="font-medium truncate">
                              {care.providing_parent_name || 'Care Block'}
                            </div>
                            <div className="text-xs opacity-75">
                              {formatTime(care.start_time)} - {formatTime(getActualEndTime(care.notes || '', care.end_time))}
                            </div>
                          </div>
                        ))}
                        {dayCare.length > 4 && (
                          <div className="h-2.5 bg-gray-300 rounded-full opacity-80" title={`${dayCare.length - 4} more items`} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Hourly Schedule for Selected Day - Only show in weekly view */}
          {viewMode === 'weekly' && selectedDate && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                <h3 className="text-lg font-semibold text-gray-900">
                  {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                </h3>
                <p className="text-sm text-gray-600">
                  Double-click on any hour to schedule care or events
                </p>
              </div>
              
              <div className="max-h-96 overflow-y-auto">
                {getHourlySchedule(selectedDate).map((hourData) => (
                  <div
                    key={hourData.hour}
                    id={`hour-${hourData.hour}`}
                    className={`flex border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
                      hourData.isOccupied ? 'bg-blue-50' : ''
                    }`}
                    onDoubleClick={() => handleHourlySlotDoubleClick(hourData.hour, selectedDate)}
                  >
                    <div className="w-20 p-3 text-sm font-medium text-gray-600 border-r border-gray-100 bg-gray-50">
                      {hourData.time}
                    </div>
                    <div className="flex-1 p-3 min-h-[60px]">
                      {hourData.startingCare.length > 0 ? (
                        <div className="space-y-2">
                          {hourData.startingCare.map((care, index) => {
                            // Calculate block height based on actual duration
                            const startTime = new Date(`2000-01-01T${care.start_time}`);
                            const endTime = new Date(`2000-01-01T${care.end_time}`);
                            const durationMs = endTime.getTime() - startTime.getTime();
                            const durationHours = durationMs / (1000 * 60 * 60);
                            
                            // Calculate how many hours this block should span
                            const blockHeight = Math.max(60, Math.ceil(durationHours) * 60);
                            
                            // Calculate the starting position within the hour
                            const startMinutes = startTime.getMinutes();
                            const startOffset = (startMinutes / 60) * 60; // Offset in pixels
                            
                            return (
                              <div
                                key={`${care.id}-${index}`}
                                className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 relative"
                                style={{ 
                                  minHeight: `${blockHeight}px`,
                                  marginTop: `${startOffset}px`
                                }}
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedCare(care);
                                  setShowDetailModal(true);
                                }}
                              >
                                {/* Modal-style layout */}
                                <div className="space-y-3">
                                  {/* Group */}
                                  <div>
                                    <span className="font-medium text-gray-700">Group:</span>
                                    <span className="ml-2 text-gray-900">{care.group_name}</span>
                                  </div>
                                  
                                  {/* Date */}
                                  <div>
                                    <span className="font-medium text-gray-700">Date:</span>
                                    <span className="ml-2 text-gray-900">{format(selectedDate, 'MMM d, yyyy')}</span>
                                  </div>
                                  
                                  {/* Time */}
                                  <div>
                                    <span className="font-medium text-gray-700">Time:</span>
                                    <span className="ml-2 text-gray-900">{formatTime(care.start_time)} - {formatTime(getActualEndTime(care.notes || '', care.end_time))}</span>
                                  </div>
                                  
                                  {/* Type */}
                                  <div>
                                    <span className="font-medium text-gray-700">Type:</span>
                                    <span className={`ml-2 px-2 py-1 rounded text-xs ${getCareTypeColor(care.care_type, care.action_type, care.status)}`}>
                                      {care.care_type === 'event' ? 'Event' : 
                                       care.care_type === 'provided' ? 'Providing Care' : 'Receiving Care'}
                                    </span>
                                  </div>
                                  
                                  {/* Status */}
                                  <div>
                                    <span className="font-medium text-gray-700">Status:</span>
                                    <span className="ml-2 text-gray-900">{care.status}</span>
                                  </div>
                                  
                                  {/* Provider */}
                                  {care.providing_parent_name && (
                                    <div>
                                      <span className="font-medium text-gray-700">Provider:</span>
                                      <span className="ml-2 text-gray-900">{care.providing_parent_name}</span>
                                    </div>
                                  )}
                                  
                                  {/* Children */}
                                  {care.children_names && care.children_names.length > 0 && (
                                    <div>
                                      <span className="font-medium text-gray-700">Children:</span>
                                      <div className="ml-2 mt-1">
                                        {care.children_names.map((childName, childIndex) => (
                                          <span key={childIndex} className="inline-block bg-gray-100 rounded px-2 py-1 text-xs mr-1 mb-1">
                                            {childName}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Notes */}
                                  {care.notes && (
                                    <div>
                                      <span className="font-medium text-gray-700">Notes:</span>
                                      <span className="ml-2 text-gray-900">{care.notes}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : hourData.continuingCare.length > 0 ? (
                        // Show a subtle indicator for continuing blocks
                        <div className="text-gray-400 text-xs italic">
                          ← Continuing from previous hour
                        </div>
                      ) : (
                        <div className="text-gray-400 text-sm italic">
                          Double-click to schedule
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-purple-100 border border-purple-300 rounded"></div>
              <span>Events</span>
            </div>
          </div>

          {/* Summary */}
          {scheduledCare.length > 0 && (
            <div className="mt-6 bg-white rounded-lg shadow p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-3">This Month's Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                  <div className="text-2xl font-bold text-purple-600">
                    {scheduledCare.filter(care => care.care_type === 'event').length}
                  </div>
                  <div className="text-sm text-gray-600">Events</div>
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

          {/* Action Buttons */}
          <div className="mt-6 flex items-center space-x-4">
            {viewMode === 'monthly' ? (
              <button
                onClick={() => {
                  setNewRequestData({
                    type: 'care',
                    group_id: '',
                    child_id: '',
                    date: format(new Date(), 'yyyy-MM-dd'),
                    start_time: '',
                    end_time: '',
                    notes: '',
                    event_title: ''
                  });
                  setShowNewRequestModal(true);
                }}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Schedule Care/Event
              </button>
            ) : (
              <>
                <button
                  onClick={() => {
                    if (selectedDate) {
                      handleDoubleClickEmptyCell(selectedDate);
                    }
                  }}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Schedule for {selectedDate ? format(selectedDate, 'MMM d') : 'Selected Day'}
                </button>
                
                <button
                  onClick={() => {
                    if (selectedDate) {
                      setNewRequestData({
                        type: 'event',
                        group_id: '',
                        child_id: '',
                        date: format(selectedDate, 'yyyy-MM-dd'),
                        start_time: '',
                        end_time: '',
                        notes: '',
                        event_title: ''
                      });
                      setShowNewRequestModal(true);
                    }
                  }}
                  className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Create Event
                </button>
              </>
            )}
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
                  <span className="ml-2 text-gray-900">{formatTime(selectedCare.start_time)} - {formatTime(getActualEndTime(selectedCare.notes || '', selectedCare.end_time))}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Type:</span>
                      <span className={`ml-2 px-2 py-1 rounded text-xs ${getCareTypeColor(selectedCare.care_type, selectedCare.action_type, selectedCare.status)}`}>
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
              {selectedCare.care_type === 'provided' && (
                <>
                  <button
                    onClick={() => handleOpenBlock(selectedCare)}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 mb-3"
                  >
                    Open Block
                  </button>
                  <button
                    onClick={() => handleReschedule(selectedCare)}
                    className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 mb-3"
                  >
                    Reschedule
                  </button>
                </>
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

          {/* New Request Modal */}
          {showNewRequestModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {newRequestData.type === 'event' ? 'Create New Event' : 'Create New Care Request'}
                    </h3>
                    <button
                      onClick={() => setShowNewRequestModal(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                <div className="px-6 py-4 space-y-4">
                  {/* Request Type Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                    <div className="flex space-x-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="care"
                          checked={newRequestData.type === 'care'}
                          onChange={(e) => setNewRequestData(prev => ({ ...prev, type: e.target.value as 'care' | 'event' }))}
                          className="mr-2"
                        />
                        <span>Care Request</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="event"
                          checked={newRequestData.type === 'event'}
                          onChange={(e) => setNewRequestData(prev => ({ ...prev, type: e.target.value as 'care' | 'event' }))}
                          className="mr-2"
                        />
                        <span>Event</span>
                      </label>
                    </div>
                  </div>

                  {/* Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                    <input
                      type="date"
                      value={newRequestData.date}
                      onChange={(e) => setNewRequestData(prev => ({ ...prev, date: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  {/* Time */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
                      <input
                        type="time"
                        value={newRequestData.start_time}
                        onChange={(e) => {
                          const newStartTime = e.target.value;
                          setNewRequestData(prev => ({ ...prev, start_time: newStartTime }));
                          validateTimes(newStartTime, newRequestData.end_time);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        End Time
                        {newRequestData.start_time && newRequestData.end_time && 
                         calculateTimeDuration(newRequestData.start_time, newRequestData.end_time).isNextDay && (
                          <span className="ml-1 text-blue-600 font-semibold">+1</span>
                        )}
                      </label>
                      <input
                        type="time"
                        value={newRequestData.end_time}
                        onChange={(e) => {
                          const newEndTime = e.target.value;
                          setNewRequestData(prev => ({ ...prev, end_time: newEndTime }));
                          validateTimes(newRequestData.start_time, newEndTime);
                        }}
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                          timeValidationError 
                            ? 'border-red-500 focus:ring-red-500' 
                            : 'border-gray-300 focus:ring-blue-500'
                        }`}
                        required
                      />
                      {/* Show actual end date when +1 is triggered */}
                      {(() => {
                        const endDate = getEndDate(newRequestData.date, newRequestData.start_time, newRequestData.end_time);
                        return endDate ? (
                          <div className="mt-1 text-sm text-blue-600 font-medium">
                            Ends on: {formatDateOnly(endDate)}
                          </div>
                        ) : null;
                      })()}
                    </div>
                  </div>
                  
                  {/* Time Range Summary */}
                  {newRequestData.start_time && newRequestData.end_time && newRequestData.date && (
                    <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                      <div className="text-sm font-medium text-gray-700 mb-1">Time Range Summary:</div>
                      <div className="text-sm text-gray-600">
                        {(() => {
                          const result = calculateTimeDuration(newRequestData.start_time, newRequestData.end_time);
                          const endDate = getEndDate(newRequestData.date, newRequestData.start_time, newRequestData.end_time);
                          
                          if (result.isNextDay && endDate) {
                            return (
                              <span>
                                {formatDateOnly(new Date(newRequestData.date + 'T00:00:00'))} at {formatTime(newRequestData.start_time)} → {formatDateOnly(endDate)} at {formatTime(newRequestData.end_time)}
                                <span className="ml-2 text-blue-600 font-medium">({result.duration.toFixed(1)} hours)</span>
                              </span>
                            );
                          } else {
                            return (
                              <span>
                                {formatDateOnly(new Date(newRequestData.date + 'T00:00:00'))} from {formatTime(newRequestData.start_time)} to {formatTime(newRequestData.end_time)}
                                <span className="ml-2 text-gray-500">({result.duration.toFixed(1)} hours)</span>
                              </span>
                            );
                          }
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Time Validation Error */}
                  {timeValidationError && (
                    <div className="text-red-600 text-sm mt-1">
                      {timeValidationError}
                    </div>
                  )}

                  {/* Group Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Group</label>
                    <select
                      value={newRequestData.group_id}
                      onChange={(e) => setNewRequestData(prev => ({ ...prev, group_id: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select a group</option>
                      {getFilteredGroups().map(group => (
                        <option key={group.id} value={group.id}>
                          {group.name} ({group.group_type})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Child Selection */}
                  {newRequestData.group_id && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Child</label>
                      <select
                        value={newRequestData.child_id}
                        onChange={(e) => setNewRequestData(prev => ({ ...prev, child_id: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="">Select a child</option>
                        {children.map(child => (
                          <option key={child.id} value={child.id}>
                            {child.full_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Event Title (for events only) */}
                  {newRequestData.type === 'event' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Event Title</label>
                      <input
                        type="text"
                        value={newRequestData.event_title || ''}
                        onChange={(e) => setNewRequestData(prev => ({ ...prev, event_title: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter event title"
                        required
                      />
                    </div>
                  )}

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
                    <textarea
                      value={newRequestData.notes}
                      onChange={(e) => setNewRequestData(prev => ({ ...prev, notes: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                      placeholder="Any additional notes..."
                    />
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-gray-200">
                  <div className="flex space-x-3">
                    <button
                      onClick={handleCreateNewRequest}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Create {newRequestData.type === 'event' ? 'Event' : 'Care Request'}
                    </button>
                    <button
                      onClick={() => setShowNewRequestModal(false)}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
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
                Invite other parents to join your care block on {formatDateOnly(selectedCare.care_date)} at {formatTime(selectedCare.start_time)} - {formatTime(getActualEndTime(selectedCare.notes || '', selectedCare.end_time))}
              </p>
            </div>
            
            <div className="px-6 py-4 space-y-6">
              {/* Available Parents Selection */}
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">Select Parents to Invite</h4>
                
                {loadingParents ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-sm text-gray-600 mt-2">Loading available parents...</p>
                  </div>
                ) : availableParents.length > 0 ? (
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
                ) : (
                  <div className="text-center py-4 border-2 border-dashed border-gray-300 rounded-lg">
                    <p className="text-gray-500">No available parents found for this care block.</p>
                    <p className="text-sm text-gray-400 mt-1">All group members may already be involved or there are no eligible parents.</p>
                  </div>
                )}
                
                {/* Debug info - remove in production */}
                <div className="text-xs text-gray-400 mt-2">
                  Debug: {availableParents.length} parents available, {loadingParents ? 'loading' : 'loaded'}
                </div>
              </div>

              {/* Reciprocal Times */}
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">Reciprocal Care Times Needed</h4>
                <p className="text-sm text-gray-600">
                  These time blocks will be offered to all invited parents on a first-come-first-serve basis.
                </p>
                
                {openBlockData.reciprocalTimes.map((timeBlock, index) => {
                  const associatedParent = timeBlock.parentId 
                    ? openBlockData.invitedParents.find(p => p.id === timeBlock.parentId)
                    : null;
                  
                  return (
                    <div key={index} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h5 className="font-medium">
                          {associatedParent 
                            ? `Time Block for ${associatedParent.name}` 
                            : `Time Block #${index + 1}`
                          }
                        </h5>
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
                              onChange={(e) => updateReciprocalTime(index, 'date', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                        <input
                          type="time"
                          value={timeBlock.startTime}
                              onChange={(e) => updateReciprocalTime(index, 'startTime', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                        <input
                          type="time"
                          value={timeBlock.endTime}
                              onChange={(e) => updateReciprocalTime(index, 'endTime', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          required
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                      <textarea
                        value={timeBlock.notes || ''}
                            onChange={(e) => updateReciprocalTime(index, 'notes', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        rows={2}
                        placeholder="Any specific notes about this time block..."
                      />
                    </div>
                  </div>
                  );
                })}
                
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
                      onChange={(e) => setOpenBlockData(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows={3}
                      placeholder="Any general notes about this open block invitation..."
                />
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200">
                  <div className="flex space-x-3">
                <button
                  onClick={handleCreateOpenBlock}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  disabled={openBlockData.invitedParents.length === 0}
                >
                      Create Open Block Invitations
                </button>
                <button
                      onClick={() => setShowOpenBlockModal(false)}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                      Cancel
                </button>
              </div>
            </div>
                </div>
                  </div>
                )}

      {/* Reschedule Modal */}
      {showRescheduleModal && selectedCare && selectedCare.group_id && (
        <RescheduleModal
          isOpen={showRescheduleModal}
          onClose={() => setShowRescheduleModal(false)}
          careBlock={{
            id: selectedCare.id,
            group_id: selectedCare.group_id,
            care_date: selectedCare.care_date,
            start_time: selectedCare.start_time,
            end_time: selectedCare.end_time,
            related_request_id: selectedCare.related_request_id,
            group_name: selectedCare.group_name,
            children: selectedCare.children_data || []
          }}
          onRescheduleSuccess={handleRescheduleSuccess}
        />
      )}
                </div>
              </div>


    </div>
  );
}