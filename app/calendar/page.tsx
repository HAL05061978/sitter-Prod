'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, eachDayOfInterval as eachDayOfWeek, addDays, isSameDay as isSameDayUtil } from 'date-fns';
import Header from '../components/Header';
import { supabase } from '../lib/supabase';
import { formatDateOnly, formatTime, parseDateSafely, normalizeDateForCalendar, formatDateForInput } from '../lib/date-utils';
import RescheduleModal from '../../components/care/RescheduleModal';
import LocationTrackingPanel from '../../components/care/LocationTrackingPanel';

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
  providing_parent_id?: string; // Add for location tracking
  receiving_parent_id?: string; // Add for location tracking
  receiving_parent_name?: string; // Add for location tracking
  children_names: string[];
  group_id?: string;
  related_request_id?: string;
  children_data?: Array<{ id: string; full_name: string }>;
  is_host?: boolean;
  photo_urls?: string[];
  care_category?: 'child' | 'pet'; // Distinguish child vs pet care
  pet_name?: string; // For pet care blocks
  pet_species?: string; // For pet care blocks
}

interface NewRequestData {
  type: 'care' | 'hangout' | 'sleepover';
  group_id: string;
  child_id: string;
  pet_id?: string; // For pet care requests
  date: string;
  start_time: string;
  end_time: string;
  end_date: string;
  hosting_child_ids: string[];
  invited_child_ids: string[];
  notes: string;
}

// Helper component for location tracking
// SIMPLIFIED: Just pass the current user and care block info
function LocationTrackingComponent({ selectedCare }: { selectedCare: ScheduledCare }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUser(user);
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!user || loading) return (
    <div className="mt-6 pt-6 border-t border-gray-200 text-center py-4">
      <p className="text-gray-500">Loading location tracking...</p>
    </div>
  );

  // Determine if current user is provider or receiver based on care_type
  const isProvider = selectedCare.care_type === 'provided';

  return (
    <div className="mt-6 pt-6 border-t border-gray-200">
      <LocationTrackingPanel
        scheduledCareId={selectedCare.id}
        currentUserId={user.id}
        isProvider={isProvider}
        careDate={formatDateOnly(selectedCare.care_date)}
        startTime={formatTime(selectedCare.start_time)}
        endTime={formatTime(selectedCare.end_time)}
      />
    </div>
  );
}

function CalendarPageContent() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [careFilter, setCareFilter] = useState<'all' | 'children' | 'pets'>('all'); // Filter for displaying blocks

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
  const [notesModified, setNotesModified] = useState(false);
  const [showOpenBlockModal, setShowOpenBlockModal] = useState(false);
  const [showNewRequestModal, setShowNewRequestModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [groups, setGroups] = useState<Array<{ id: string; name: string; group_type: string }>>([]);
  const [children, setChildren] = useState<Array<{ id: string; name: string; group_id: string }>>([]);
  const [pets, setPets] = useState<Array<{ id: string; name: string; group_id: string; species?: string }>>([]);
  const [groupChildren, setGroupChildren] = useState<Array<{ id: string; name: string; group_id: string; parent_id?: string }>>([]);
  const [newRequestData, setNewRequestData] = useState<NewRequestData>({
    type: 'care',
    group_id: '',
    child_id: '',
    date: '',
    start_time: '',
    end_time: '',
    end_date: '',
    hosting_child_ids: [],
    invited_child_ids: [],
    notes: ''
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
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Get search params for navigation from scheduler
  const searchParams = useSearchParams();

  // Initialize with today's date selected OR date from query params
  useEffect(() => {
    const dateParam = searchParams.get('date');
    if (dateParam) {
      const targetDate = new Date(dateParam);
      setSelectedDate(targetDate);
      setCurrentDate(targetDate);
    } else {
      setSelectedDate(new Date());
    }
  }, [searchParams]);

  // Handle selectBlock parameter to auto-open detail modal
  useEffect(() => {
    const selectBlockParam = searchParams.get('selectBlock');
    if (selectBlockParam && scheduledCare.length > 0) {
      // Find the block with this ID
      const block = scheduledCare.find(care => care.id === selectBlockParam);
      if (block) {
        setSelectedCare(block);
        setShowDetailModal(true);
      }
    }
  }, [searchParams, scheduledCare]);





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
  }, [currentDate]); // Re-fetch when month changes

  // Mark all calendar acceptances as "seen" after user has viewed calendar for 2 seconds
  useEffect(() => {
    if (loading || scheduledCare.length === 0) return;

    // Wait 2 seconds to give user time to see the counter, then mark everything as seen
    const timer = setTimeout(async () => {
      const savedSeenAcceptances = localStorage.getItem('seenCalendarAcceptances');
      const seenAcceptances = savedSeenAcceptances ? new Set(JSON.parse(savedSeenAcceptances)) : new Set<string>();

      // Mark all current blocks as seen
      // Note: We don't have direct access to the notification/invitation data here,
      // so we'll mark blocks based on their IDs and related_request_id
      scheduledCare.forEach(block => {
        // For reciprocal care blocks
        if (block.related_request_id) {
          seenAcceptances.add(`reciprocal-${block.related_request_id}`);
        }
        // For general blocks
        seenAcceptances.add(`block-${block.id}`);
      });

      // Save to localStorage
      localStorage.setItem('seenCalendarAcceptances', JSON.stringify(Array.from(seenAcceptances)));

      // Clear the calendar counter since user has now viewed the blocks
      localStorage.setItem('newCalendarBlocksCount', '0');

      // Mark care_accepted notifications as read in the database
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', user.id)
            .eq('type', 'care_accepted')
            .eq('is_read', false);

          if (error) {
            console.error('Error marking care_accepted notifications as read:', error);
          } else {
            console.log('✅ Marked care_accepted notifications as read');
          }
        }
      } catch (error) {
        console.error('Error updating notifications:', error);
      }

      // Trigger counter update
      window.dispatchEvent(new Event('calendarCountUpdated'));

      console.log('📅 Marked calendar blocks as seen');
    }, 2000); // 2 second delay

    return () => clearTimeout(timer);
  }, [loading, scheduledCare]);

  // Listen for care notes updates from other users
  useEffect(() => {
    const handleCareNotesUpdated = (event: CustomEvent) => {
      console.log('Received care notes update event:', event.detail);
      // Refresh the calendar data when notes are updated
      fetchScheduledCare();
    };

    window.addEventListener('careNotesUpdated', handleCareNotesUpdated as EventListener);
    
    return () => {
      window.removeEventListener('careNotesUpdated', handleCareNotesUpdated as EventListener);
    };
  }, []);

  // Set up real-time subscription for scheduled_care table changes
  useEffect(() => {
    const channel = supabase
      .channel('scheduled_care_changes')
      .on('postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'scheduled_care' 
        }, 
        (payload) => {
          console.log('Real-time update received:', payload);
          // Refresh the calendar data when scheduled_care records are updated
          fetchScheduledCare();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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

      // Fetch BOTH child and pet care blocks
      const [childCareResult, petCareResult] = await Promise.all([
        supabase.rpc('get_scheduled_care_for_calendar', {
          p_parent_id: user.id,
          p_start_date: startDate.toISOString().split('T')[0],
          p_end_date: endDate.toISOString().split('T')[0]
        }),
        supabase.rpc('get_scheduled_pet_care_for_calendar', {
          p_parent_id: user.id,
          p_start_date: startDate.toISOString().split('T')[0],
          p_end_date: endDate.toISOString().split('T')[0]
        })
      ]);

      if (childCareResult.error) {
        console.error('Error fetching child care:', childCareResult.error);
      }
      if (petCareResult.error) {
        console.error('Error fetching pet care:', petCareResult.error);
      }

      // Combine both results with care_category property
      const childBlocks = (childCareResult.data || []).map(block => ({
        ...block,
        care_category: 'child' as const
      }));
      const petBlocks = (petCareResult.data || []).map(block => ({
        ...block,
        care_category: 'pet' as const
      }));

      const combinedBlocks = [...childBlocks, ...petBlocks];
      setScheduledCare(combinedBlocks);
    } catch (err) {
      setError('Error fetching scheduled care');
      console.error('Error fetching scheduled care:', err);
    } finally {
      setLoading(false);
    }
  };

  // Image compression function
  const compressImage = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1920;
          const MAX_HEIGHT = 1920;
          let width = img.width;
          let height = img.height;

          // Calculate new dimensions while maintaining aspect ratio
          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round((width * MAX_HEIGHT) / height);
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to blob with 0.8 quality (good balance between size and quality)
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error('Failed to compress image'));
              }
            },
            'image/jpeg',
            0.8
          );
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  // Upload photo to Supabase Storage
  const handlePhotoUpload = async (file: File) => {
    if (!selectedCare) return;

    setUploadingPhoto(true);
    setPhotoError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setPhotoError('Please log in to upload photos');
        return;
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        setPhotoError('Please select an image file');
        return;
      }

      // Validate file size (max 10MB before compression)
      if (file.size > 10 * 1024 * 1024) {
        setPhotoError('Image file is too large. Please select an image under 10MB.');
        return;
      }

      // Compress the image
      const compressedBlob = await compressImage(file);
      const compressedFile = new File(
        [compressedBlob],
        file.name,
        { type: 'image/jpeg' }
      );

      // Upload to Supabase Storage
      const fileName = `${user.id}/${selectedCare.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('care-photos')
        .upload(fileName, compressedFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        setPhotoError('Failed to upload photo. Please try again.');
        return;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('care-photos')
        .getPublicUrl(fileName);

      // Update scheduled_care record with new photo URL
      const currentPhotos = selectedCare.photo_urls || [];
      const updatedPhotos = [...currentPhotos, publicUrl];

      const { error: updateError } = await supabase
        .from('scheduled_care')
        .update({ photo_urls: updatedPhotos })
        .eq('id', selectedCare.id);

      if (updateError) {
        console.error('Error updating photo URLs:', updateError);
        setPhotoError('Failed to save photo reference. Please try again.');
        return;
      }

      // Update local state
      setSelectedCare(prev => prev ? { ...prev, photo_urls: updatedPhotos } : null);
      await fetchScheduledCare();

      // Send notification to receiving parents/attendees
      try {
        const { error: notifyError } = await supabase.rpc('notify_photo_upload', {
          p_scheduled_care_id: selectedCare.id,
          p_uploader_id: user.id,
          p_photo_count: updatedPhotos.length
        });

        if (notifyError) {
          console.error('Error sending notification:', notifyError);
          // Don't fail the upload if notification fails
        }
      } catch (notifyError) {
        console.error('Error sending notification:', notifyError);
      }

      alert('Photo uploaded successfully!');
    } catch (error) {
      console.error('Photo upload error:', error);
      setPhotoError('Failed to upload photo. Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Delete photo from storage and database
  const handleDeletePhoto = async (photoUrl: string) => {
    if (!selectedCare) return;

    if (!confirm('Are you sure you want to delete this photo?')) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Extract file path from URL
      const urlParts = photoUrl.split('/care-photos/');
      if (urlParts.length < 2) return;
      const filePath = urlParts[1];

      // Delete from storage
      const { error: deleteError } = await supabase.storage
        .from('care-photos')
        .remove([filePath]);

      if (deleteError) {
        console.error('Error deleting photo:', deleteError);
        alert('Failed to delete photo. Please try again.');
        return;
      }

      // Update database
      const updatedPhotos = (selectedCare.photo_urls || []).filter(url => url !== photoUrl);
      const { error: updateError } = await supabase
        .from('scheduled_care')
        .update({ photo_urls: updatedPhotos })
        .eq('id', selectedCare.id);

      if (updateError) {
        console.error('Error updating photo URLs:', updateError);
        return;
      }

      // Update local state
      setSelectedCare(prev => prev ? { ...prev, photo_urls: updatedPhotos } : null);
      await fetchScheduledCare();

      alert('Photo deleted successfully!');
    } catch (error) {
      console.error('Photo deletion error:', error);
      alert('Failed to delete photo. Please try again.');
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

      // Apply date filter
      let matchesDate = normalizedCareDate === normalizedTargetDate;

      // FOR MULTI-DAY PET CARE: Check if date falls within the care range
      if (care.care_category === 'pet' && care.end_date) {
        const normalizedEndDate = normalizeDateForCalendar(care.end_date);
        const targetDate = new Date(normalizedTargetDate);
        const startDate = new Date(normalizedCareDate);
        const endDate = new Date(normalizedEndDate);

        // Date is within range if it's >= start AND <= end
        matchesDate = targetDate >= startDate && targetDate <= endDate;
      }

      // Apply care category filter
      const matchesFilter =
        careFilter === 'all' ||
        (careFilter === 'children' && care.care_category === 'child') ||
        (careFilter === 'pets' && care.care_category === 'pet');

      return matchesDate && matchesFilter;
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

      // Get parent IDs of children already in the block
      const parentsWithChildrenInBlock = new Set(
        groupChildren
          .filter(item => Array.from(blockChildIds).includes(item.id))
          .map(item => item.parent_id)
      );

      console.log('✅ Parents with children already in block:', Array.from(parentsWithChildrenInBlock));
      console.log('✅ Current user (block creator):', user.id);
      console.log('✅ Care block parent_id:', careBlock.parent_id);

      // Also add the current user (creator of the block) to excluded parents
      parentsWithChildrenInBlock.add(user.id);
      parentsWithChildrenInBlock.add(careBlock.parent_id);

      // Filter out children whose parents already have a child in the care block OR are the current user
      const availableChildren = groupChildren
        .filter(item => !Array.from(blockChildIds).includes(item.id))
        .filter(item => !parentsWithChildrenInBlock.has(item.parent_id))
        .filter(item => item.parent_id !== user.id) // Extra safety check
        .map(item => ({
          id: item.id,
          full_name: item.full_name
        }));

      console.log('✅ Available children (not in block and parent not in block):', availableChildren);

      // Get available parents for these children
      const available = await Promise.all(
        availableChildren.map(async (child) => {
          console.log('🔍 Fetching parent for child:', child);
          
          // CRITICAL FIX: First check if the child is still active in the group
          const { data: childGroupStatus, error: childGroupError } = await supabase
            .from('child_group_members')
            .select('active')
            .eq('child_id', child.id)
            .eq('group_id', careBlock.group_id)
            .single();
            
          if (childGroupError) {
            console.log('❌ Error checking child group status:', childGroupError);
            return null;
          }
          
          if (!childGroupStatus.active) {
            console.log('❌ Child is not active in group:', child.full_name);
            return null;
          }
          
          console.log('✅ Child is active in group:', child.full_name);
          
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

    // Validate all reciprocal times are in the future
    const now = new Date();
    for (const timeBlock of openBlockData.reciprocalTimes) {
      const inputDateTime = new Date(`${timeBlock.date}T${timeBlock.startTime}:00`);
      if (inputDateTime <= now) {
        alert('Cannot schedule reciprocal care in the past. Please select future dates and times for all reciprocal time blocks.');
        return;
      }
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      console.log('🚀 Creating open block invitations with data:', {
        existingBlockId: selectedCare.id,
        invitingParentId: user.id,
        invitedParentIds: openBlockData.invitedParents.map(p => p.id),
        reciprocalDates: openBlockData.reciprocalTimes.map(t => t.date),
        reciprocalStartTimes: openBlockData.reciprocalTimes.map(t => t.startTime),
        reciprocalEndTimes: openBlockData.reciprocalTimes.map(t => t.endTime),
        notes: openBlockData.notes || ''
      });

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

      console.log('✅ RPC response:', { data, error });

      if (error) {
        console.error('❌ Error creating open block invitations:', error);
        alert('Error creating open block invitations: ' + error.message);
        return;
      }

      console.log(`✅ Successfully created ${data || 0} open block invitations`);
      alert('Open block invitations have been sent');
      setShowOpenBlockModal(false);
      setShowDetailModal(false); // Close the detail modal and return to calendar
      setSelectedCare(null); // Clear the selected care block
      setOpenBlockData({
        invitedParents: [],
        reciprocalTimes: []
      });

      // Refresh the calendar data
      console.log('🔄 Refreshing calendar data...');
      await fetchScheduledCare();
      console.log('✅ Calendar data refreshed');
    } catch (error) {
      console.error('❌ Exception in handleCreateOpenBlock:', error);
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

  // Helper to determine multi-day pet block position
  const getMultiDayInfo = (care: any, currentDate: Date) => {
    if (care.care_category !== 'pet' || !care.end_date) {
      return { isMultiDay: false, isFirstDay: false, isLastDay: false, dayNumber: 1, totalDays: 1 };
    }

    const normalizedCareDate = normalizeDateForCalendar(care.care_date);
    const normalizedEndDate = normalizeDateForCalendar(care.end_date);
    const normalizedCurrentDate = formatDateForInput(currentDate);

    const startDate = new Date(normalizedCareDate);
    const endDate = new Date(normalizedEndDate);
    const current = new Date(normalizedCurrentDate);

    const isFirstDay = current.getTime() === startDate.getTime();
    const isLastDay = current.getTime() === endDate.getTime();

    // Calculate day number and total days
    const daysDiff = Math.floor((current.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    return {
      isMultiDay: true,
      isFirstDay,
      isLastDay,
      dayNumber: daysDiff + 1,
      totalDays
    };
  };

  // Get care type color styling
  const getCareTypeColor = (careType: string, actionType?: string, status?: string, isHost?: boolean, careCategory?: 'child' | 'pet') => {
    // Check for rescheduled blocks first (highest priority)
    if (actionType === 'rescheduled') {
      return 'bg-orange-100 border border-orange-300 text-orange-800';
    }

    // Pet care blocks: purple for receiving, orange for providing
    if (careCategory === 'pet') {
      if (careType === 'provided') {
        return 'bg-orange-100 border border-orange-300 text-orange-800';
      } else {
        return 'bg-purple-100 border border-purple-300 text-purple-800';
      }
    }

    // Handle hangout/sleepover blocks with proper colors
    if (careType === 'hangout' || careType === 'sleepover') {
      // If host (hosting) -> green, if not host (attending) -> blue
      if (isHost) {
        return 'bg-green-100 border border-green-300 text-green-800';
      } else {
        return 'bg-blue-100 border border-blue-300 text-blue-800';
      }
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
  const getCareTypeBgColor = (careType: string, actionType?: string, status?: string, isHost?: boolean) => {
    // Check for rescheduled blocks first (highest priority)
    if (actionType === 'rescheduled') {
      return 'bg-orange-200';
    }

    // Handle hangout/sleepover blocks with proper colors
    if (careType === 'hangout' || careType === 'sleepover') {
      // If host (hosting) -> green, if not host (attending) -> blue
      if (isHost) {
        return 'bg-green-200';
      } else {
        return 'bg-blue-200';
      }
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
      
      const userGroups = groupsData.map((item: any) => ({
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
    // Filter groups based on request type
    if (newRequestData.type === 'pet_care') {
      // Pet care: only show pet groups
      return groups.filter(group => group.group_type === 'pet');
    } else if (newRequestData.type === 'care' || newRequestData.type === 'hangout') {
      // Child care (Care Request & Hangout): only show care groups
      return groups.filter(group => group.group_type === 'care');
    }
    return groups;
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
            children(id, full_name, parent_id)
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
          id: item.children[0]?.id || '',
          name: item.children[0]?.full_name || '',
          group_id: item.child_id
        })) || [];

        setChildren(groupChildren);
      } else {
        // For care groups, also get children from child_group_members (same approach)
        // But only show the current user's children in this group
        // First get all child_group_members for this group that are active
        const { data: memberships, error: membershipsError } = await supabase
          .from('child_group_members')
          .select(`
            child_id,
            group_id
          `)
          .eq('group_id', groupId)
          .eq('active', true);

        if (membershipsError) {
          console.log('❌ Error fetching memberships:', membershipsError);
          setError('Error fetching memberships');
          return;
        }

        if (!memberships || memberships.length === 0) {
          setChildren([]);
          return;
        }

        // Get the child IDs
        const childIds = memberships.map(m => m.child_id);

        // Now get the children details, filtering by parent_id
        const { data, error } = await supabase
          .from('children')
          .select('id, full_name, parent_id')
          .in('id', childIds)
          .eq('parent_id', user.id);

        if (error) {
          console.log('❌ Error fetching children for care group:', error);
          setError('Error fetching children for care group');
          return;
        }

        console.log('✅ Children fetched for care group (user filtered):', data);
        const groupChildren = data?.map(child => ({
          id: child.id,
          name: child.full_name,
          group_id: groupId
        })) || [];

        setChildren(groupChildren);
      }
    } catch (err) {
      setError('Error in fetchChildren');
    }
  };

  const fetchPetsForGroup = async (groupId: string) => {
    try {
      console.log('🔍 Starting fetchPetsForGroup for group:', groupId);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('❌ No user found');
        return;
      }

      // Get pets from pet_group_members
      // Only show the current user's pets in this group
      const { data: memberships, error: membershipsError } = await supabase
        .from('pet_group_members')
        .select(`
          pet_id,
          group_id
        `)
        .eq('group_id', groupId)
        .eq('active', true);

      if (membershipsError) {
        console.log('❌ Error fetching pet memberships:', membershipsError);
        setError('Error fetching pet memberships');
        return;
      }

      if (!memberships || memberships.length === 0) {
        setPets([]);
        return;
      }

      // Get the pet IDs
      const petIds = memberships.map(m => m.pet_id);

      // Now get the pets details, filtering by parent_id (owner)
      const { data, error } = await supabase
        .from('pets')
        .select('id, name, species, parent_id')
        .in('id', petIds)
        .eq('parent_id', user.id);

      if (error) {
        console.log('❌ Error fetching pets for group:', error);
        setError('Error fetching pets for group');
        return;
      }

      console.log('✅ Pets fetched for group (user filtered):', data);
      const groupPets = data?.map(pet => ({
        id: pet.id,
        name: pet.name,
        species: pet.species || undefined,
        group_id: groupId
      })) || [];

      setPets(groupPets);
    } catch (err) {
      setError('Error in fetchPets');
    }
  };

  const fetchAllGroupChildren = async (groupId: string) => {
    try {
      const { data, error } = await supabase
        .from('child_group_members')
        .select(`
          child_id,
          children!inner(id, full_name, parent_id)
        `)
        .eq('group_id', groupId)
        .eq('active', true);

      if (error) {
        console.error('Error fetching all group children:', error);
        return;
      }

      if (!data || data.length === 0) {
        setGroupChildren([]);
        return;
      }

      const allChildren = data.map(item => ({
        id: item.children.id,
        name: item.children.full_name,
        group_id: groupId,
        parent_id: item.children.parent_id
      }));

      console.log('✅ All children fetched for group:', allChildren);
      setGroupChildren(allChildren);
    } catch (err) {
      console.error('Error in fetchAllGroupChildren:', err);
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
      end_date: '',
      hosting_child_ids: [],
      invited_child_ids: [],
      notes: ''
    });
    setShowNewRequestModal(true);
  };

  const handleCreateNewRequest = async () => {
    // Validate times before submission
    if (!validateTimes(newRequestData.start_time, newRequestData.end_time)) {
      return; // Don't submit if validation fails
    }

    // Validate date and time are not in the past
    const inputDateTime = new Date(`${newRequestData.date}T${newRequestData.start_time}:00`);
    const now = new Date();

    if (inputDateTime <= now) {
      alert('Cannot schedule care in the past. Please select a future date and time.');
      return;
    }

    // Validate end date for multi-day care
    if (newRequestData.end_date) {
      const endDateTime = new Date(`${newRequestData.end_date}T${newRequestData.end_time}:00`);
      if (endDateTime <= now) {
        alert('End date and time cannot be in the past. Please select a future date and time.');
        return;
      }
      if (endDateTime <= inputDateTime) {
        alert('End date and time must be after start date and time.');
        return;
      }
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
        // Create reciprocal child care request
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
      } else if (newRequestData.type === 'pet_care') {
        // Create reciprocal pet care request
        if (!newRequestData.pet_id) {
          alert('Please select a pet');
          return;
        }

        // VALIDATION: Check for existing scheduled care that would conflict
        const requestStart = new Date(newRequestData.date);
        const requestEnd = new Date(newRequestData.end_date || newRequestData.date);

        const conflictingBlocks = scheduledCare.filter(block => {
          if (block.care_category !== 'pet') return false; // Only check pet care blocks

          const blockStart = new Date(block.care_date);
          const blockEnd = new Date(block.end_date || block.care_date);

          // Check if date ranges overlap
          return blockStart <= requestEnd && blockEnd >= requestStart;
        });

        if (conflictingBlocks.length > 0) {
          const conflictDates = conflictingBlocks.map(b =>
            b.end_date
              ? `${formatDateOnly(b.care_date)} - ${formatDateOnly(b.end_date)}`
              : formatDateOnly(b.care_date)
          ).join(', ');

          alert(`Cannot create pet care request: You already have scheduled pet care during these dates (${conflictDates}). Please choose different dates.`);
          return;
        }

        const { data, error } = await supabase.rpc('create_pet_care_request', {
          requester_id: user.id,
          group_id: newRequestData.group_id,
          requested_date: newRequestData.date,
          start_time: newRequestData.start_time,
          end_time: newRequestData.end_time,
          pet_id: newRequestData.pet_id,
          end_date: newRequestData.end_date || null,
          notes: newRequestData.notes || null
        });

        if (error) {
          alert('Error creating pet care request: ' + error.message);
          return;
        }

        alert('Pet care request created successfully! Group members have been notified.');
      } else if (newRequestData.type === 'hangout') {
        // Create hangout invitation
        if (newRequestData.hosting_child_ids.length === 0) {
          alert('Please select at least one hosting child');
          return;
        }
        if (newRequestData.invited_child_ids.length === 0) {
          alert('Please select at least one child to invite');
          return;
        }

        const { data, error } = await supabase.rpc('create_hangout_invitation', {
          p_requesting_parent_id: user.id,
          p_group_id: newRequestData.group_id,
          p_care_date: newRequestData.date,
          p_start_time: newRequestData.start_time,
          p_end_time: newRequestData.end_time,
          p_hosting_child_ids: newRequestData.hosting_child_ids,
          p_invited_child_ids: newRequestData.invited_child_ids,
          p_notes: newRequestData.notes || null
        });

        if (error) {
          alert('Error creating hangout: ' + error.message);
          return;
        }

        alert('Hangout created successfully! Invitations sent.');
      } else if (newRequestData.type === 'sleepover') {
        // Create sleepover invitation
        if (newRequestData.hosting_child_ids.length === 0) {
          alert('Please select at least one hosting child');
          return;
        }
        if (newRequestData.invited_child_ids.length === 0) {
          alert('Please select at least one child to invite');
          return;
        }

        // Use end_date if set (auto-calculated or manual), otherwise use same day
        const effectiveEndDate = newRequestData.end_date || newRequestData.date;

        const { data, error } = await supabase.rpc('create_sleepover_invitation', {
          p_requesting_parent_id: user.id,
          p_group_id: newRequestData.group_id,
          p_care_date: newRequestData.date,
          p_start_time: newRequestData.start_time,
          p_end_date: effectiveEndDate,
          p_end_time: newRequestData.end_time,
          p_hosting_child_ids: newRequestData.hosting_child_ids,
          p_invited_child_ids: newRequestData.invited_child_ids,
          p_notes: newRequestData.notes || null
        });

        if (error) {
          alert('Error creating sleepover: ' + error.message);
          return;
        }

        alert('Sleepover created successfully! Invitations sent.');
      }

      setShowNewRequestModal(false);
      setNewRequestData({
        type: 'care',
        group_id: '',
        child_id: '',
        date: '',
        start_time: '',
        end_time: '',
        end_date: '',
        hosting_child_ids: [],
        invited_child_ids: [],
        notes: ''
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
      <div className="p-3 sm:p-4 md:p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6 w-full sm:w-auto">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Calendar</h1>

              {/* Filter Controls */}
              <div className="flex items-center bg-white rounded-lg border border-gray-300 p-1">
                <button
                  onClick={() => setCareFilter('all')}
                  className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                    careFilter === 'all'
                      ? 'bg-gray-600 text-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setCareFilter('children')}
                  className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                    careFilter === 'children'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Children
                </button>
                <button
                  onClick={() => setCareFilter('pets')}
                  className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                    careFilter === 'pets'
                      ? 'bg-purple-600 text-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Pets
                </button>
              </div>
            </div>
        <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto justify-between sm:justify-start">
          <button
            onClick={() => navigateMonth('prev')}
            className="p-1.5 sm:p-2 rounded-lg bg-white border border-gray-300 hover:bg-gray-50"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2
            className={`text-base sm:text-lg md:text-xl font-semibold text-gray-700 whitespace-nowrap ${
              viewMode === 'weekly' ? 'cursor-pointer hover:text-blue-600 transition-colors' : ''
            }`}
            onClick={() => {
              if (viewMode === 'weekly') {
                goBackToMonthly();
              }
            }}
            title={viewMode === 'weekly' ? 'Click to return to monthly view' : ''}
          >
            {format(currentDate, 'MMMM yyyy')}
          </h2>
          <button
            onClick={() => navigateMonth('next')}
            className="p-1.5 sm:p-2 rounded-lg bg-white border border-gray-300 hover:bg-gray-50"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => (
                  <div key={day} className="p-1 sm:p-2 text-center text-[10px] sm:text-xs font-medium text-gray-700">
              <span className="hidden sm:inline">{day}</span>
              <span className="sm:hidden">{day.charAt(0)}</span>
            </div>
          ))}
            </div>
            <div className="grid grid-cols-7">
                {getMonthlyDays().map((day, index) => {
                if (!day) {
                  return <div key={index} className="min-h-[60px] sm:min-h-[80px] md:min-h-[120px] bg-gray-50" />;
                }

                const dayCare = getScheduledCareForDay(day);
                  const isToday = isSameDayUtil(day, new Date());
                  const isSelected = selectedDate && isSameDayUtil(day, selectedDate);

                return (
                  <div
                    key={index}
                      className={`min-h-[60px] sm:min-h-[80px] md:min-h-[120px] p-1 sm:p-2 md:p-3 border-r border-b border-gray-200 cursor-pointer hover:bg-gray-50 ${
                      isToday ? 'bg-blue-50' : ''
                      } ${isSelected ? 'bg-blue-100 border-blue-300' : ''}`}
                      onClick={() => handleDaySelect(day)}
                  >
                      <div className={`text-sm sm:text-base font-medium mb-1 sm:mb-2 md:mb-3 ${
                        isToday ? 'text-blue-600' : isSelected ? 'text-blue-800' : 'text-gray-900'
                    }`}>
                      {format(day, 'd')}
                    </div>

                      {/* Simplified care blocks - show only care type and time */}
                      <div className="space-y-0.5 sm:space-y-1 md:space-y-1.5">
                        {dayCare.slice(0, 2).map((care, careIndex) => {
                          const multiDayInfo = getMultiDayInfo(care, day);

                          return (
                          <div
                            key={careIndex}
                            className={`p-0.5 sm:p-1 md:p-1.5 text-[9px] sm:text-[10px] md:text-xs leading-tight ${getCareTypeColor(care.care_type, care.action_type, care.status, care.is_host, care.care_category)} cursor-pointer hover:opacity-80 ${
                              multiDayInfo.isMultiDay
                                ? multiDayInfo.isFirstDay
                                  ? 'rounded-l border-r-0'
                                  : multiDayInfo.isLastDay
                                    ? 'rounded-r border-l-0'
                                    : 'rounded-none border-x-0'
                                : 'rounded'
                            }`}
                            title={`${care.group_name} - ${formatTime(care.start_time)} to ${formatTime(getActualEndTime(care.notes || '', care.end_time))}${multiDayInfo.isMultiDay ? ` (Day ${multiDayInfo.dayNumber} of ${multiDayInfo.totalDays})` : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                            setSelectedCare(care);
                            setNotesModified(false);
                            setShowDetailModal(true);
                          }}
                        >
                          {/* Care type label */}
                          <div className="font-semibold truncate text-[9px] sm:text-[10px] md:text-xs">
                            {multiDayInfo.isMultiDay ? (
                              multiDayInfo.isFirstDay ? (
                                `🐾 ${care.action_type === 'rescheduled' && care.status === 'rescheduled' ? 'Rescheduling' :
                                 care.care_type === 'provided' ? 'Providing' : 'Receiving'} →`
                              ) : multiDayInfo.isLastDay ? (
                                `→ ${care.action_type === 'rescheduled' && care.status === 'rescheduled' ? 'Rescheduling' :
                                 care.care_type === 'provided' ? 'Providing' : 'Receiving'} ●`
                              ) : (
                                `→ ${care.action_type === 'rescheduled' && care.status === 'rescheduled' ? 'Rescheduling' :
                                 care.care_type === 'provided' ? 'Providing' : 'Receiving'} →`
                              )
                            ) : (
                              care.action_type === 'rescheduled' && care.status === 'rescheduled' ? 'Rescheduling' :
                              care.care_type === 'event' ? 'Event' :
                              care.care_type === 'provided' ? 'Providing' :
                              care.care_type === 'hangout' ? 'Hangout' :
                              care.care_type === 'sleepover' ? 'Sleepover' :
                              care.care_type === 'open_block' ? 'Open' : 'Receiving'
                            )}
                          </div>

                          {/* Time range - truncated to fit (or day indicator for multi-day) */}
                          <div className="opacity-90 truncate text-[8px] sm:text-[9px] md:text-[10px]">
                            {multiDayInfo.isMultiDay ? (
                              `Day ${multiDayInfo.dayNumber}/${multiDayInfo.totalDays}`
                            ) : (
                              `${formatTime(care.start_time).replace(' ', '')}-${formatTime(getActualEndTime(care.notes || '', care.end_time)).replace(' ', '')}`
                            )}
                          </div>
                        </div>
                        );
                      })}
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
              <div className="grid grid-cols-7">
                {getWeeklyDates(selectedDate!).map((date, index) => {
                  const dayCare = getScheduledCareForDay(date);
                  const isToday = isSameDayUtil(date, new Date());
                  const isSelected = isSameDayUtil(date, selectedDate!);

                  return (
                    <div
                      key={index}
                      className={`relative min-h-[60px] sm:min-h-[80px] md:min-h-[120px] p-1 sm:p-2 md:p-3 border-r border-b border-gray-200 cursor-pointer hover:bg-gray-50 ${
                        isToday ? 'bg-blue-50' : ''
                      } ${isSelected ? 'bg-blue-100 border-blue-300' : ''}`}
                      onClick={() => handleDaySelect(date)}
                    >
                      <div className={`text-[10px] sm:text-xs md:text-sm font-medium mb-1 sm:mb-2 ${
                        isToday ? 'text-blue-600' : isSelected ? 'text-blue-800' : 'text-gray-900'
                      }`}>
                        {format(date, 'EEE')}
                      </div>
                      <div className={`text-base sm:text-lg md:text-xl font-bold ${
                        isToday ? 'text-blue-600' : isSelected ? 'text-blue-800' : 'text-gray-900'
                      }`}>
                        {format(date, 'd')}
                      </div>

                      {/* Simplified care indicators for weekly view */}
                      <div className="space-y-0.5 sm:space-y-1 md:space-y-1.5 mt-1 sm:mt-2 md:mt-3">
                        {dayCare.slice(0, 4).map((care, careIndex) => {
                          const multiDayInfo = getMultiDayInfo(care, date);

                          return (
                          <div
                            key={careIndex}
                            className={`p-0.5 sm:p-1 md:p-2 text-[9px] sm:text-[10px] md:text-xs leading-tight ${getCareTypeColor(care.care_type, care.action_type, care.status, care.is_host, care.care_category)} cursor-pointer hover:opacity-80 ${
                              multiDayInfo.isMultiDay
                                ? multiDayInfo.isFirstDay
                                  ? 'rounded-l border-r-0'
                                  : multiDayInfo.isLastDay
                                    ? 'rounded-r border-l-0'
                                    : 'rounded-none border-x-0'
                                : 'rounded'
                            }`}
                            title={`${care.group_name} - ${formatTime(care.start_time)} to ${formatTime(getActualEndTime(care.notes || '', care.end_time))}${multiDayInfo.isMultiDay ? ` (Day ${multiDayInfo.dayNumber} of ${multiDayInfo.totalDays})` : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCare(care);
                              setNotesModified(false);
                              setShowDetailModal(true);
                            }}
                          >
                            {/* Care type label */}
                            <div className="font-semibold truncate text-[9px] sm:text-[10px] md:text-xs">
                              {multiDayInfo.isMultiDay ? (
                                multiDayInfo.isFirstDay ? (
                                  `🐾 ${care.action_type === 'rescheduled' && care.status === 'rescheduled' ? 'Rescheduling' :
                                   care.care_type === 'provided' ? 'Providing' : 'Receiving'} →`
                                ) : multiDayInfo.isLastDay ? (
                                  `→ ${care.action_type === 'rescheduled' && care.status === 'rescheduled' ? 'Rescheduling' :
                                   care.care_type === 'provided' ? 'Providing' : 'Receiving'} ●`
                                ) : (
                                  `→ ${care.action_type === 'rescheduled' && care.status === 'rescheduled' ? 'Rescheduling' :
                                   care.care_type === 'provided' ? 'Providing' : 'Receiving'} →`
                                )
                              ) : (
                                care.action_type === 'rescheduled' && care.status === 'rescheduled' ? 'Rescheduling' :
                                care.care_type === 'event' ? 'Event' :
                                care.care_type === 'provided' ? 'Providing' :
                                care.care_type === 'hangout' ? 'Hangout' :
                                care.care_type === 'sleepover' ? 'Sleepover' :
                                care.care_type === 'open_block' ? 'Open' : 'Receiving'
                              )}
                            </div>

                            {/* Time range - truncated to fit (or day indicator for multi-day) */}
                            <div className="opacity-90 truncate text-[8px] sm:text-[9px] md:text-[10px]">
                              {multiDayInfo.isMultiDay ? (
                                `Day ${multiDayInfo.dayNumber}/${multiDayInfo.totalDays}`
                              ) : (
                                `${formatTime(care.start_time).replace(' ', '')}-${formatTime(getActualEndTime(care.notes || '', care.end_time)).replace(' ', '')}`
                              )}
                            </div>
                          </div>
                          );
                        })}
                        {dayCare.length > 4 && (
                          <div className="h-2.5 bg-gray-300 rounded-full opacity-80" title={`${dayCare.length - 4} more items`} />
                        )}
                      </div>

                      {/* Week navigation arrows at bottom corners */}
                      {index === 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigateWeek('prev');
                          }}
                          className="absolute bottom-1 left-1 text-gray-600 hover:text-blue-600 text-xl sm:text-2xl font-bold transition-colors"
                          title="Previous week"
                        >
                          &lt;
                        </button>
                      )}
                      {index === 6 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigateWeek('next');
                          }}
                          className="absolute bottom-1 right-1 text-gray-600 hover:text-blue-600 text-xl sm:text-2xl font-bold transition-colors"
                          title="Next week"
                        >
                          &gt;
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Hourly Schedule for Selected Day - Only show in weekly view */}
          {viewMode === 'weekly' && selectedDate && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-3 sm:px-4 py-2 sm:py-3 border-b border-gray-200 bg-gray-50">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                  {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                </h3>
                <p className="text-xs sm:text-sm text-gray-600">
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
                    <div className="w-14 sm:w-16 md:w-20 p-1.5 sm:p-2 md:p-3 text-[10px] sm:text-xs md:text-sm font-medium text-gray-600 border-r border-gray-100 bg-gray-50">
                      {hourData.time}
                    </div>
                    <div className="flex-1 p-2 sm:p-3 min-h-[50px] sm:min-h-[60px]">
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
                                  setNotesModified(false);
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
                                    <span className={`ml-2 px-2 py-1 rounded text-xs ${getCareTypeColor(care.care_type, care.action_type, care.status, care.is_host, care.care_category)}`}>
                                      {care.care_type === 'event' ? 'Event' :
                                       care.care_type === 'provided' ? 'Providing Care' :
                                       care.care_type === 'hangout' ? 'Hangout' :
                                       care.care_type === 'sleepover' ? 'Sleepover' :
                                       care.care_type === 'open_block' ? 'Open Block' : 'Receiving Care'}
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
                                  
                                  {/* Children or Pet */}
                                  {care.children_names && care.children_names.length > 0 && (
                                    <div>
                                      <span className="font-medium text-gray-700">{care.pet_id ? 'Pet:' : 'Children:'}</span>
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
          <div className="mt-6 flex flex-wrap items-center gap-4 sm:gap-6 text-sm">
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
              <span>Pet Care</span>
            </div>
          </div>

          {/* Action Buttons - Only show in weekly view */}
          {viewMode === 'weekly' && (
            <div className="mt-6 flex items-center space-x-4">
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
            </div>
          )}

      {/* Care Detail Modal */}
      {showDetailModal && selectedCare && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
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
            <div className="px-6 py-4 overflow-y-auto flex-1">
              <div className="space-y-3">
                <div>
                  <span className="font-medium text-gray-700">Group:</span>
                  <span className="ml-2 text-gray-900">{selectedCare.group_name}</span>
                </div>
                {/* Pet care uses Drop off / Pick up format, others use Date / Time */}
                {selectedCare.care_category === 'pet' ? (
                  <>
                    <div>
                      <span className="font-medium text-gray-700">Drop off:</span>
                      <span className="ml-2 text-gray-900">
                        {formatDateOnly(selectedCare.care_date)} at {formatTime(selectedCare.start_time)}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Pick up:</span>
                      <span className="ml-2 text-gray-900">
                        {formatDateOnly(selectedCare.end_date || selectedCare.care_date)} at {formatTime(getActualEndTime(selectedCare.notes || '', selectedCare.end_time))}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <span className="font-medium text-gray-700">Date:</span>
                      <span className="ml-2 text-gray-900">{formatDateOnly(selectedCare.care_date)}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Time:</span>
                      <span className="ml-2 text-gray-900">{formatTime(selectedCare.start_time)} - {formatTime(getActualEndTime(selectedCare.notes || '', selectedCare.end_time))}</span>
                    </div>
                  </>
                )}
                <div>
                  <span className="font-medium text-gray-700">Type:</span>
                      <span className={`ml-2 px-2 py-1 rounded text-xs ${getCareTypeColor(selectedCare.care_type, selectedCare.action_type, selectedCare.status, selectedCare.is_host, selectedCare.care_category)}`}>
                    {selectedCare.care_type === 'event' ? 'Event' :
                     selectedCare.care_type === 'provided' ? 'Providing Care' :
                     selectedCare.care_type === 'hangout' ? 'Hangout' :
                     selectedCare.care_type === 'sleepover' ? 'Sleepover' :
                     selectedCare.care_type === 'open_block' ? 'Open Block' : 'Receiving Care'}
                  </span>
                </div>
                {selectedCare.providing_parent_name && (
                  <div>
                    <span className="font-medium text-gray-700">Provider:</span>
                    <span className="ml-2 text-gray-900">{selectedCare.providing_parent_name}</span>
                  </div>
                )}
                {selectedCare.children_names && selectedCare.children_names.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-700">{selectedCare.pet_id ? 'Pet:' : 'Children:'}</span>
                      {selectedCare.care_type === 'provided' && !selectedCare.pet_id && (
                        <button
                          onClick={() => handleOpenBlock(selectedCare)}
                          className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center gap-1"
                          title="Open this block to other children"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          <span>Open Block</span>
                        </button>
                      )}
                    </div>
                    <div className="ml-2 mt-1">
                      {selectedCare.children_names.map((childName, index) => (
                        <span key={index} className="inline-block bg-gray-100 rounded px-2 py-1 text-xs mr-1 mb-1">
                          {childName}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <span className="font-medium text-gray-700">Notes:</span>
                  {/* Editable notes for: provided care OR host of hangout/sleepover */}
                  {(selectedCare.care_type === 'provided' ||
                    ((selectedCare.care_type === 'hangout' || selectedCare.care_type === 'sleepover') && selectedCare.is_host)) ? (
                    <div className="mt-1">
                      <textarea
                        value={selectedCare.notes || ''}
                        onChange={(e) => {
                          // Update the selectedCare object with new notes
                          setSelectedCare(prev => prev ? { ...prev, notes: e.target.value } : null);
                          setNotesModified(true);
                        }}
                        placeholder={
                          selectedCare.care_type === 'provided'
                            ? "Add your care plans and details here..."
                            : "Add details about this event (shared with all participants)..."
                        }
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        rows={3}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {selectedCare.care_type === 'provided'
                          ? "Share your care plans and any important details for the receiving parent."
                          : "These notes will be visible to all participants (host and attending families)."}
                      </p>
                    </div>
                  ) : (
                    <div className="mt-1">
                      <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-sm text-gray-700">
                        {selectedCare.notes ||
                          (selectedCare.care_type === 'hangout' || selectedCare.care_type === 'sleepover'
                            ? 'No notes provided by the host.'
                            : 'No notes provided by the care provider.')}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {selectedCare.care_type === 'hangout' || selectedCare.care_type === 'sleepover'
                          ? "Event details from the host."
                          : "Care plans and details from the provider."}
                      </p>
                    </div>
                  )}
                </div>

                {/* Photo Upload Section - For providing care, hangouts, and sleepovers (host only) */}
                {(selectedCare.care_type === 'provided' ||
                  ((selectedCare.care_type === 'hangout' || selectedCare.care_type === 'sleepover') && selectedCare.is_host)) && (
                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Photos
                      </label>

                      {/* Single Add Photo Button */}
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handlePhotoUpload(file);
                            e.target.value = '';
                          }}
                          className="hidden"
                          disabled={uploadingPhoto}
                        />
                        <div
                          className={`p-2 rounded-lg transition ${
                            uploadingPhoto
                              ? 'bg-gray-200 cursor-not-allowed'
                              : 'bg-blue-500 hover:bg-blue-600'
                          }`}
                          title="Add Photo"
                        >
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </div>
                      </label>
                    </div>

                    {/* Upload Status Messages */}
                    {uploadingPhoto && (
                      <p className="text-sm text-blue-600 mb-2">Uploading photo...</p>
                    )}
                    {photoError && (
                      <p className="text-sm text-red-600 mb-2">{photoError}</p>
                    )}

                    {/* Display Uploaded Photos */}
                    {selectedCare.photo_urls && selectedCare.photo_urls.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {selectedCare.photo_urls.map((photoUrl, index) => (
                          <div key={index} className="relative group">
                            <img
                              src={photoUrl}
                              alt={`Care photo ${index + 1}`}
                              className="w-full h-32 sm:h-40 object-cover rounded-lg border border-gray-200"
                              onClick={() => window.open(photoUrl, '_blank')}
                              style={{ cursor: 'pointer' }}
                            />
                            <button
                              onClick={() => handleDeletePhoto(photoUrl)}
                              className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                              title="Delete photo"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <p className="text-xs text-gray-500 mt-2">
                      {selectedCare.care_type === 'provided'
                        ? 'Upload photos to share with the receiving parent. Max 10MB per photo. Photos are automatically compressed.'
                        : 'Upload photos to share with all participants. Max 10MB per photo. Photos are automatically compressed.'}
                    </p>
                  </div>
                )}

                {/* Photo Display Section - For receiving care, and non-host hangout/sleepover attendees (read-only) */}
                {((selectedCare.care_type === 'needed') ||
                  ((selectedCare.care_type === 'hangout' || selectedCare.care_type === 'sleepover') && !selectedCare.is_host)) &&
                  selectedCare.photo_urls && selectedCare.photo_urls.length > 0 && (
                  <div className="mt-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {selectedCare.care_type === 'needed'
                        ? 'Photos from Care Provider'
                        : 'Photos from Host'}
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {selectedCare.photo_urls.map((photoUrl, index) => (
                        <div key={index} className="relative">
                          <img
                            src={photoUrl}
                            alt={`Care photo ${index + 1}`}
                            className="w-full h-32 sm:h-40 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-90 transition"
                            onClick={() => window.open(photoUrl, '_blank')}
                          />
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Click on any photo to view full size.
                    </p>
                  </div>
                )}

                {/* Location Tracking Section - For reciprocal care only (provided/needed) */}
                {(() => {
                  // Only show for reciprocal care (provided or needed)
                  if (selectedCare.care_type === 'provided' || selectedCare.care_type === 'needed') {
                    return (
                      <LocationTrackingComponent selectedCare={selectedCare} />
                    );
                  }
                  return null;
                })()}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex-shrink-0">
              {/* Save Notes button for hangout/sleepover (host only) */}
              {(selectedCare.care_type === 'hangout' || selectedCare.care_type === 'sleepover') && selectedCare.is_host && (
                <button
                  onClick={async () => {
                    // Save notes for hangout/sleepover and propagate to all participants
                    if (selectedCare.notes !== undefined) {
                      try {
                        const { data: { user } } = await supabase.auth.getUser();
                        if (!user) {
                          alert('Please log in to update notes');
                          return;
                        }

                        const { data, error } = await supabase.rpc('update_hangout_sleepover_notes', {
                          p_scheduled_care_id: selectedCare.id,
                          p_parent_id: user.id,
                          p_new_notes: selectedCare.notes || ''
                        });

                        if (error) {
                          console.error('Error saving notes:', error);
                          alert('Failed to save notes. Please try again.');
                          return;
                        }

                        // Refresh the calendar data to show updated notes
                        await fetchScheduledCare();
                        setNotesModified(false);

                        alert(data[0]?.message || 'Notes saved and shared with all participants!');
                      } catch (error) {
                        console.error('Error saving notes:', error);
                        alert('Failed to save notes. Please try again.');
                      }
                    }
                  }}
                  disabled={!notesModified}
                  className={`w-full px-4 py-2 rounded-lg mb-3 ${
                    notesModified
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {notesModified ? 'Save Notes (Share with All)' : 'No Changes'}
                </button>
              )}

              {/* Save Notes button for reciprocal care (provider only) */}
              {selectedCare.care_type === 'provided' && (
                <>
                  {/* Hide Reschedule button for pet care */}
                  {selectedCare.care_category !== 'pet' && (
                    <button
                      onClick={() => handleReschedule(selectedCare)}
                      className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 mb-3"
                    >
                      Reschedule
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      // Save notes for reciprocal care and propagate to receiver
                      if (selectedCare.notes !== undefined) {
                        try {
                          const { data: { user } } = await supabase.auth.getUser();
                          if (!user) {
                            alert('Please log in to update notes');
                            return;
                          }

                          console.log('=== Saving Reciprocal Care Notes ===');
                          console.log('Scheduled Care ID:', selectedCare.id);
                          console.log('Parent ID:', user.id);
                          console.log('New Notes:', selectedCare.notes);
                          console.log('Care Type:', selectedCare.care_type);
                          console.log('Care Category:', selectedCare.care_category);
                          console.log('Related Request ID:', selectedCare.related_request_id);

                          // Use the correct RPC function based on care category
                          const functionName = selectedCare.care_category === 'pet'
                            ? 'update_pet_care_notes'
                            : 'update_reciprocal_care_notes';

                          console.log('Using function:', functionName);

                          const { data, error } = await supabase.rpc(functionName, {
                            p_scheduled_care_id: selectedCare.id,
                            p_parent_id: user.id,
                            p_new_notes: selectedCare.notes || ''
                          });

                          console.log('Function Response:', { data, error });

                          if (error) {
                            console.error('Error saving notes:', error);
                            alert(`Failed to save notes: ${error.message}`);
                            return;
                          }

                          if (!data || data.length === 0) {
                            console.error('No data returned from function');
                            alert('Failed to save notes - no response from server');
                            return;
                          }

                          console.log('Success:', data[0]);

                          // Refresh the calendar data to show updated notes
                          await fetchScheduledCare();
                          setNotesModified(false);

                          alert(data[0]?.message || 'Notes saved and shared with receiver!');
                        } catch (error) {
                          console.error('Error saving notes:', error);
                          alert(`Failed to save notes: ${error}`);
                        }
                      }
                    }}
                    disabled={!notesModified}
                    className={`w-full px-4 py-2 rounded-lg ${
                      notesModified
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {notesModified ? 'Save Notes (Share with Receiver)' : 'No Changes'}
                  </button>
                </>
              )}
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
                      Create New {newRequestData.type === 'pet_care' ? 'Pet Care Request' :
                        (newRequestData.type === 'care' ? 'Care Request' : newRequestData.type.charAt(0).toUpperCase() + newRequestData.type.slice(1))}
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
                      <div className="grid grid-cols-3 gap-3">
                        <button
                          type="button"
                          onClick={() => setNewRequestData(prev => ({ ...prev, type: 'care', hosting_child_ids: [], invited_child_ids: [], end_date: '' }))}
                          className={`px-4 py-3 rounded-md border-2 transition-all ${
                            newRequestData.type === 'care'
                              ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                              : 'border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          Care Request
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewRequestData(prev => ({ ...prev, type: 'hangout', child_id: '', end_date: '' }))}
                          className={`px-4 py-3 rounded-md border-2 transition-all ${
                            newRequestData.type === 'hangout'
                              ? 'border-green-500 bg-green-50 text-green-700 font-semibold'
                              : 'border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          Hangout
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewRequestData(prev => ({ ...prev, type: 'pet_care', child_id: '', pet_id: '', hosting_child_ids: [], invited_child_ids: [] }))}
                          className={`px-4 py-3 rounded-md border-2 transition-all ${
                            newRequestData.type === 'pet_care'
                              ? 'border-purple-500 bg-purple-50 text-purple-700 font-semibold'
                              : 'border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          🐾 Pet Care
                        </button>
                      </div>
                    </div>

                  {/* Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                    <input
                      type="date"
                      value={newRequestData.date}
                      onChange={(e) => setNewRequestData(prev => ({ ...prev, date: e.target.value }))}
                      min={new Date().toISOString().split('T')[0]}
                      max={`${new Date().getFullYear() + 5}-12-31`}
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

                          // Auto-calculate end_date if times cross midnight
                          if (newRequestData.date && newRequestData.start_time && newEndTime) {
                            const timeResult = calculateTimeDuration(newRequestData.start_time, newEndTime);
                            if (timeResult.isNextDay) {
                              // Calculate next day
                              const startDateObj = new Date(newRequestData.date + 'T00:00:00');
                              const endDateObj = new Date(startDateObj.getTime() + 24 * 60 * 60 * 1000);
                              const endDateStr = format(endDateObj, 'yyyy-MM-dd');

                              setNewRequestData(prev => ({
                                ...prev,
                                end_time: newEndTime,
                                end_date: endDateStr
                              }));
                            } else {
                              // Same day, clear end_date
                              setNewRequestData(prev => ({
                                ...prev,
                                end_time: newEndTime,
                                end_date: ''
                              }));
                            }
                          } else {
                            setNewRequestData(prev => ({ ...prev, end_time: newEndTime }));
                          }

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
                      onChange={(e) => {
                        const groupId = e.target.value;
                        setNewRequestData(prev => ({
                          ...prev,
                          group_id: groupId,
                          child_id: '',
                          pet_id: '',
                          hosting_child_ids: [],
                          invited_child_ids: []
                        }));
                        if (groupId) {
                          // Fetch children or pets based on request type
                          if (newRequestData.type === 'pet_care') {
                            fetchPetsForGroup(groupId);
                          } else {
                            fetchChildrenForGroup(groupId);
                            if (newRequestData.type !== 'care') {
                              fetchAllGroupChildren(groupId);
                            }
                          }
                        }
                      }}
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

                  {/* Child Selection (Care Request & Hangout) */}
                  {(newRequestData.type === 'care' || newRequestData.type === 'hangout') && newRequestData.group_id && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Child
                      </label>
                      <select
                        value={newRequestData.child_id}
                        onChange={(e) => setNewRequestData(prev => ({ ...prev, child_id: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="">Select a child</option>
                        {children.map(child => (
                          <option key={child.id} value={child.id}>
                            {child.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Pet Selection (Pet Care only) */}
                  {newRequestData.type === 'pet_care' && newRequestData.group_id && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Pet
                      </label>
                      <select
                        value={newRequestData.pet_id}
                        onChange={(e) => setNewRequestData(prev => ({ ...prev, pet_id: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                        required
                      >
                        <option value="">Select a pet</option>
                        {pets.map(pet => (
                          <option key={pet.id} value={pet.id}>
                            {pet.name} {pet.species ? `(${pet.species})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* End Date - Only shown for pet care */}
                  {newRequestData.type === 'pet_care' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        End Date
                        <span className="ml-2 text-xs text-purple-600">(Optional - for multi-day pet care)</span>
                      </label>
                      <input
                        type="date"
                        value={newRequestData.end_date}
                        onChange={(e) => setNewRequestData(prev => ({ ...prev, end_date: e.target.value }))}
                        min={newRequestData.date || undefined}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Leave empty for same-day care, or set an end date for vacations/trips
                      </p>
                    </div>
                  )}

                  {/* Hosting Children (Hangout/Sleepover only) */}
                  {(newRequestData.type === 'hangout' || newRequestData.type === 'sleepover') && newRequestData.group_id && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Hosting Children * (Your children who will host)
                      </label>
                      <div className="border border-gray-300 rounded-md p-3 max-h-40 overflow-y-auto">
                        {children.length === 0 ? (
                          <p className="text-sm text-gray-500">No children available</p>
                        ) : (
                          <div className="space-y-2">
                            {children.map(child => (
                              <label key={child.id} className="flex items-center space-x-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={newRequestData.hosting_child_ids.includes(child.id)}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setNewRequestData(prev => ({
                                      ...prev,
                                      hosting_child_ids: checked
                                        ? [...prev.hosting_child_ids, child.id]
                                        : prev.hosting_child_ids.filter(id => id !== child.id)
                                    }));
                                  }}
                                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-sm">{child.name}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Invited Children (Hangout/Sleepover only) */}
                  {(newRequestData.type === 'hangout' || newRequestData.type === 'sleepover') && newRequestData.group_id && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Invited Children * (Children from the group to invite)
                      </label>
                      <div className="border border-gray-300 rounded-md p-3 max-h-40 overflow-y-auto">
                        {groupChildren.length === 0 ? (
                          <p className="text-sm text-gray-500">No children available in this group</p>
                        ) : (
                          <div className="space-y-2">
                            {groupChildren
                              .filter(child => !children.some(myChild => myChild.id === child.id))
                              .map(child => (
                                <label key={child.id} className="flex items-center space-x-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={newRequestData.invited_child_ids.includes(child.id)}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setNewRequestData(prev => ({
                                        ...prev,
                                        invited_child_ids: checked
                                          ? [...prev.invited_child_ids, child.id]
                                          : prev.invited_child_ids.filter(id => id !== child.id)
                                      }));
                                    }}
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                  />
                                  <span className="text-sm">{child.name}</span>
                                </label>
                              ))}
                          </div>
                        )}
                      </div>
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
                      Create {newRequestData.type === 'care' ? 'Request' : newRequestData.type.charAt(0).toUpperCase() + newRequestData.type.slice(1)}
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
                Care block on {formatDateOnly(selectedCare.care_date)} at {formatTime(selectedCare.start_time)} - {formatTime(getActualEndTime(selectedCare.notes || '', selectedCare.end_time))}
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
                          Offer {index + 1}
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
                          min={new Date().toISOString().split('T')[0]}
                          max={`${new Date().getFullYear() + 5}-12-31`}
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
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200">
                <button
                  onClick={handleCreateOpenBlock}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  disabled={openBlockData.invitedParents.length === 0}
                >
                  Create Open Block Invitations
                </button>
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
            related_request_id: selectedCare.related_request_id || '',
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

export default function CalendarPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-center items-center h-64">
            <div className="text-gray-500">Loading calendar...</div>
          </div>
        </div>
      </div>
    }>
      <CalendarPageContent />
    </Suspense>
  );
}