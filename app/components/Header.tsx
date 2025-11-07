"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import LogoutButton from "./LogoutButton";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface HeaderProps {
  currentPage?: string;
}

export default function Header({ currentPage = "dashboard" }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>('parent');
  const [pendingInvitations, setPendingInvitations] = useState<number>(0);

  const [unreadChatMessages, setUnreadChatMessages] = useState<number>(0);
  const [schedulerMessagesCount, setSchedulerMessagesCount] = useState<number>(0);
  const [newCalendarBlocksCount, setNewCalendarBlocksCount] = useState<number>(0);

  // Function to fetch pending invitations count
  const fetchPendingInvitations = async (userId: string) => {
    try {
      // First, get the user's email to match against group_invites.email
      const { data: profileData } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", userId)
        .single();
      
      if (!profileData?.email) {
        setPendingInvitations(0);
        return;
      }

      // Query group_invites table using email (case-insensitive)
      const { data, error } = await supabase
        .from('group_invites')
        .select('id')
        .eq('email', profileData.email.toLowerCase())
        .eq('status', 'pending');
      
      if (error) {
        // Error fetching pending invitations
        return;
      }
      
      const count = data?.length || 0;
      setPendingInvitations(count);
    } catch (error) {
      // Error fetching pending invitations
    }
  };



  // Function to fetch unread chat messages
  const fetchUnreadChatMessages = async (userId: string) => {
    try {
      const { data: userGroups } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("profile_id", userId)
        .eq("status", "active");

      if (!userGroups || userGroups.length === 0) {
        setUnreadChatMessages(0);
        return;
      }

      const groupIds = userGroups.map(g => g.group_id);

      // Get all messages in user's groups that weren't sent by the user
      const { data: allMessages } = await supabase
        .from("chat_messages")
        .select("id")
        .in("group_id", groupIds)
        .neq("sender_id", userId);

      if (!allMessages || allMessages.length === 0) {
        setUnreadChatMessages(0);
        return;
      }

      const messageIds = allMessages.map(m => m.id);

      // Get messages that the user has viewed
      const { data: viewedMessages } = await supabase
        .from("message_views")
        .select("message_id")
        .eq("user_id", userId)
        .in("message_id", messageIds);

      const viewedMessageIds = (viewedMessages || []).map(v => v.message_id);
      
      // Count total unviewed messages across all groups
      const unviewedChatCount = messageIds.filter(id => !viewedMessageIds.includes(id)).length;
      setUnreadChatMessages(unviewedChatCount);
    } catch (error) {
      // Error fetching unread chat messages
    }
  };

  // Function to fetch and calculate scheduler messages count (Messages/Scheduler button)
  const fetchSchedulerMessagesCount = async (userId: string) => {
    try {
      // Fetch all the data needed to calculate the counter
      const { data: invitations } = await supabase.rpc('get_open_block_invitations', {
        p_parent_id: userId
      });

      // Fetch CHILD care requests
      const { data: childRequests } = await supabase.rpc('get_reciprocal_care_requests', {
        parent_id: userId
      });

      // Fetch PET care requests (only if the function exists in production)
      let petRequests: any[] = [];
      try {
        const { data, error } = await supabase.rpc('get_reciprocal_pet_care_requests', {
          p_parent_id: userId
        });
        if (!error) {
          petRequests = data || [];
        }
      } catch (err) {
        // Pet care functions not deployed yet, skip
      }

      // Combine child and pet care requests
      const careRequests = [...(childRequests || []), ...petRequests];

      // Fetch CHILD care responses
      const { data: childResponses } = await supabase.rpc('get_reciprocal_care_responses', {
        parent_id: userId
      });

      // Fetch PET care responses (only if the function exists in production)
      let petResponses: any[] = [];
      try {
        const { data, error } = await supabase.rpc('get_reciprocal_pet_care_responses', {
          p_parent_id: userId
        });
        if (!error) {
          petResponses = data || [];
        }
      } catch (err) {
        // Pet care functions not deployed yet, skip
      }

      // Combine child and pet care responses
      const careResponses = [...(childResponses || []), ...petResponses];

      // Get responses to MY requests (when I'm the requester)
      const { data: responsesToMyRequests } = await supabase.rpc('get_responses_for_requester', {
        p_requester_id: userId
      });

      const { data: rescheduleRequests } = await supabase.rpc('get_reschedule_requests', {
        p_parent_id: userId
      });

      const { data: rescheduleNotifications } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .in('type', ['reschedule_request', 'reschedule_accepted', 'reschedule_declined', 'reschedule_counter_sent', 'reschedule_counter_accepted', 'reschedule_counter_declined']);

      // Fetch care_declined notifications (when your response was not accepted)
      const { data: careDeclinedNotifications } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'care_declined')
        .eq('is_read', false); // Only unread notifications

      // Calculate the count
      let schedulerCount = 0;

      // Load previously read messages from localStorage
      const savedReadMessages = localStorage.getItem('readSchedulerMessages');
      const readMessages = savedReadMessages ? new Set(JSON.parse(savedReadMessages)) : new Set<string>();

      console.log('🔍 Header Counter Debug - Data Fetched:', {
        invitationsCount: (invitations || []).length,
        childRequestsCount: (childRequests || []).length,
        petRequestsCount: (petRequests || []).length,
        totalRequestsCount: careRequests.length,
        childResponsesCount: (childResponses || []).length,
        petResponsesCount: (petResponses || []).length,
        totalResponsesCount: careResponses.length,
        responsesToMyRequestsCount: (responsesToMyRequests || []).length,
        rescheduleRequestsCount: (rescheduleRequests || []).length,
        rescheduleNotificationsCount: (rescheduleNotifications || []).length,
        careDeclinedNotificationsCount: (careDeclinedNotifications || []).length,
        readMessagesCount: readMessages.size
      });

      // 1. Pending care requests (reciprocal care requests needing response)
      const pendingCareResponses = (careResponses || []).filter((r: any) =>
        r.status === 'pending' && !readMessages.has(`pending-${r.care_response_id}`)
      );
      console.log('📊 Header - Pending care responses:', {
        total: (careResponses || []).filter((r: any) => r.status === 'pending').length,
        unread: pendingCareResponses.length,
        sample: pendingCareResponses[0],
        allStatuses: (careResponses || []).map((r: any) => ({ id: r.care_response_id, status: r.status }))
      });
      schedulerCount += pendingCareResponses.length;

      // 2. Responses to my requests (when I'm the requester)
      // Only count responses with status 'submitted' (not 'accepted' or 'declined')
      const submittedResponses = (responsesToMyRequests || []).filter((response: any) =>
        response.status === 'submitted'
      );

      // Count unique requests that have submitted responses (not individual responses)
      const requestsWithSubmittedResponses = new Set<string>();
      submittedResponses.forEach((response: any) => {
        requestsWithSubmittedResponses.add(response.care_request_id);
      });

      console.log('📊 Header - Responses to my requests:', {
        totalResponses: (responsesToMyRequests || []).length,
        submittedResponses: submittedResponses.length,
        uniqueRequestsWithSubmitted: requestsWithSubmittedResponses.size,
        sample: (responsesToMyRequests || [])[0],
        allResponses: (responsesToMyRequests || []).map((r: any) => ({
          request_id: r.care_request_id,
          response_id: r.care_response_id,
          status: r.status,
          responder: r.responder_name
        }))
      });
      schedulerCount += requestsWithSubmittedResponses.size;

      // 3. Pending open block invitations
      (invitations || []).filter((inv: any) => inv.status === 'pending').forEach((inv: any) => {
        const key = `${inv.open_block_parent_id || inv.open_block_parent_name}-${inv.care_response_id}`;
        if (!readMessages.has(`invitation-group-${key}`)) {
          schedulerCount++;
        }
      });

      // 4. Accepted open block invitations (for audit trail)
      (invitations || []).filter((inv: any) => inv.status === 'accepted').forEach((inv: any, index: number) => {
        const messageId = `open-block-accepted-${inv.invitation_id || index}`;
        if (!readMessages.has(messageId)) {
          schedulerCount++;
        }
      });

      // 5. Pending reschedule requests
      (rescheduleRequests || []).forEach((req: any) => {
        const requestId = req.reschedule_group_id || req.request_id;
        if (!readMessages.has(`reschedule-${requestId}`)) {
          schedulerCount++;
        }
      });

      // 5b. Reschedule request notifications (real-time notification-based)
      const rescheduleRequestNotifications = (rescheduleNotifications || []).filter((n: any) =>
        n.type === 'reschedule_request' && n.is_read === false
      );
      rescheduleRequestNotifications.forEach((n: any) => {
        if (!readMessages.has(`reschedule-notification-${n.id}`)) {
          schedulerCount++;
        }
      });

      // 6. Pending reschedule counter proposals
      const pendingCounters = (rescheduleNotifications || []).filter((n: any) =>
        n.type === 'reschedule_counter_sent' &&
        !(rescheduleNotifications || []).some((rn: any) =>
          (rn.type === 'reschedule_counter_accepted' || rn.type === 'reschedule_counter_declined') &&
          rn.data?.counter_request_id === n.data?.counter_request_id
        )
      );
      pendingCounters.forEach((n: any) => {
        if (!readMessages.has(`reschedule-notification-${n.id}`)) {
          schedulerCount++;
        }
      });

      // 7. Acceptance/decline notifications (informational)
      const acceptDeclineNotifications = (rescheduleNotifications || []).filter((n: any) =>
        n.type === 'reschedule_accepted' ||
        n.type === 'reschedule_declined' ||
        n.type === 'reschedule_counter_accepted' ||
        n.type === 'reschedule_counter_declined'
      );
      acceptDeclineNotifications.forEach((n: any) => {
        if (!readMessages.has(`reschedule-notification-${n.id}`)) {
          schedulerCount++;
        }
      });

      // 8. Care declined notifications (when your response was not accepted)
      (careDeclinedNotifications || []).forEach((n: any) => {
        if (!readMessages.has(`care-declined-${n.id}`)) {
          schedulerCount++;
        }
      });

      console.log('📊 Header - FINAL Counter:', schedulerCount);

      // Update the state
      setSchedulerMessagesCount(schedulerCount);

      // Also update localStorage for persistence
      localStorage.setItem('schedulerMessagesCount', schedulerCount.toString());
    } catch (error) {
      console.error('Error fetching scheduler messages count:', error);
    }
  };

  // Function to fetch new calendar blocks count (Calendar button)
  const fetchNewCalendarBlocksCount = async (userId: string) => {
    try {
      // Fetch care_accepted notifications (when your response was accepted)
      const { data: careAcceptedNotifications, error: careAcceptedError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'care_accepted')
        .eq('is_read', false);

      if (careAcceptedError) {
        console.error('Error fetching care_accepted notifications:', careAcceptedError);
      }

      // Load calendar count from localStorage (for blocks YOU created by accepting responses)
      const savedCount = localStorage.getItem('newCalendarBlocksCount');
      let count = savedCount ? parseInt(savedCount, 10) : 0;

      // Calculate total blocks from notifications
      // Each notification has a blocks_created field (2 for reciprocal care, 1-2 for open blocks)
      const notificationBlocks = (careAcceptedNotifications || []).reduce((total, notification) => {
        const blocksCreated = notification.data?.blocks_created || 2; // Default to 2 for old notifications
        return total + blocksCreated;
      }, 0);

      console.log('📅 Calendar Counter Debug:', {
        careAcceptedNotifications: (careAcceptedNotifications || []).length,
        notificationBlocks: notificationBlocks,
        localStorageCount: count,
        totalCount: count + notificationBlocks,
        notifications: careAcceptedNotifications
      });

      // Add blocks from notifications
      count += notificationBlocks;

      setNewCalendarBlocksCount(count);
    } catch (error) {
      console.error('Error fetching calendar blocks count:', error);
    }
  };

  // Manual refresh function for debugging (can be called from console)
  const manualRefresh = async () => {
    if (user) {
      await Promise.all([
        fetchPendingInvitations(user.id),
        fetchUnreadChatMessages(user.id),
        fetchSchedulerMessagesCount(user.id),
        fetchNewCalendarBlocksCount(user.id)
      ]);
    }
  };

  // Initialize user and fetch all counts
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        setUser(data.user);
        
        // Fetch user role
        const { data: profileData } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .single();
        
        if (profileData?.role) {
          setUserRole(profileData.role);
        }
        
        await Promise.all([
          fetchPendingInvitations(data.user.id),
          fetchUnreadChatMessages(data.user.id),
          fetchSchedulerMessagesCount(data.user.id),
          fetchNewCalendarBlocksCount(data.user.id)
        ]);
      }
    });
  }, []);

  // Listen for invitation acceptance events
  useEffect(() => {
    const handleMessagesViewed = async () => {
      if (user) {
        // Add a small delay to ensure database consistency
        setTimeout(async () => {
          await fetchUnreadChatMessages(user.id);
        }, 200);
      }
    };

    const handleCareRequestUpdated = () => {
      if (user) {
        // Removed fetchPendingScheduleItems - no longer needed
      }
    };

    const handleResponseStatusUpdated = () => {
      if (user) {
        fetchUnreadChatMessages(user.id);
      }
    };

    const handleSchedulerCountUpdated = () => {
      if (user) {
        fetchSchedulerMessagesCount(user.id);
      }
    };

    const handleCalendarCountUpdated = () => {
      if (user) {
        fetchNewCalendarBlocksCount(user.id);
      }
    };

    window.addEventListener('messagesViewed', handleMessagesViewed);
    window.addEventListener('careRequestUpdated', handleCareRequestUpdated);
    window.addEventListener('responseStatusUpdated', handleResponseStatusUpdated);
    window.addEventListener('newMessageSent', handleMessagesViewed); // Refresh when new messages are sent
    window.addEventListener('schedulerCountUpdated', handleSchedulerCountUpdated);
    window.addEventListener('calendarCountUpdated', handleCalendarCountUpdated);

    return () => {
      window.removeEventListener('messagesViewed', handleMessagesViewed);
      window.removeEventListener('careRequestUpdated', handleCareRequestUpdated);
      window.removeEventListener('responseStatusUpdated', handleResponseStatusUpdated);
      window.removeEventListener('newMessageSent', handleMessagesViewed);
      window.removeEventListener('schedulerCountUpdated', handleSchedulerCountUpdated);
      window.removeEventListener('calendarCountUpdated', handleCalendarCountUpdated);
    };
  }, [user]);

  // Set up real-time subscription for invitation updates
  useEffect(() => {
    if (!user) return;
    
    // Get the user's email from profile for the filter
    const getUserEmail = async () => {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", user.id)
        .single();
      
      if (profileData?.email) {
        const userEmail = profileData.email.toLowerCase();
        
        const channel = supabase
          .channel('header_invitation_updates')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'group_invites',
              filter: `email=eq.${userEmail}`
            },
            (payload) => {
              // Refresh the count when invitations change
              fetchPendingInvitations(user.id);
            }
          )
          .subscribe();

        return () => {
          supabase.removeChannel(channel);
        };
      }
    };

    getUserEmail();
  }, [user]);



  // Set up real-time subscription for care responses updates
  useEffect(() => {
    if (!user) return;
    
    const channel = supabase
      .channel('header_care_responses_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'care_responses',
          filter: `responder_id=eq.${user.id}`
        },
        (payload) => {
          // Refresh the count when care responses change
          // Removed fetchPendingScheduleItems - no longer needed
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Set up real-time subscription for care requests updates
  useEffect(() => {
    if (!user) return;
    
    // Get groups the user is a member of for filtering
    const setupCareRequestsSubscription = async () => {
      const { data: userGroups } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("profile_id", user.id)
        .eq("status", "active");

      if (!userGroups || userGroups.length === 0) {
        return;
      }

      const groupIds = userGroups.map(g => g.group_id);
      
      const channel = supabase
        .channel('header_care_requests_updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'care_requests',
            filter: `group_id=in.(${groupIds.join(',')})`
          },
          (payload) => {
            // Refresh the count when care requests change
            // Removed fetchPendingScheduleItems - no longer needed
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    setupCareRequestsSubscription();
  }, [user]);

  // Set up real-time subscription for notifications updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('header_notifications_updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('📬 New notification received:', payload.new);
          // Refresh counters when new notification is inserted
          fetchSchedulerMessagesCount(user.id);
          fetchNewCalendarBlocksCount(user.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Make manualRefresh available globally for debugging
  useEffect(() => {
    (window as any).manualRefresh = manualRefresh;
    return () => {
      delete (window as any).manualRefresh;
    };
  }, [user]);

  // Load scheduler and calendar counts on mount and when user changes
  useEffect(() => {
    if (user) {
      fetchSchedulerMessagesCount(user.id);
      fetchNewCalendarBlocksCount(user.id);
    }
  }, [user]);


  useEffect(() => {
    if (user) {
      fetchPendingInvitations(user.id);
      fetchUnreadChatMessages(user.id);
    }
  }, [user]);

  const getButtonClass = (page: string, isSecondary = false) => {
    const baseClass = isSecondary
      ? "px-2 py-1.5 sm:px-3 md:px-4 sm:py-2 rounded-lg transition font-medium shadow-soft text-[10px] sm:text-xs md:text-sm whitespace-nowrap"
      : "px-2 py-1.5 sm:px-3 md:px-4 lg:px-6 sm:py-2 md:py-2.5 lg:py-3 rounded-lg transition font-medium shadow-soft text-[10px] sm:text-xs md:text-sm lg:text-base whitespace-nowrap";
    const isActive = currentPage === page;

    if (isActive) {
      return `${baseClass} bg-emerald-600 text-white cursor-default shadow-medium`;
    }

    // All inactive buttons use the same lighter shade
    return `${baseClass} bg-emerald-500 text-white hover:bg-emerald-600 hover:shadow-medium`;
  };

  return (
    <>
      {/* Top Header - Profile, Logo, Logout */}
      <div className="bg-white shadow-soft border-b border-gray-200">
        <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">
          <div className="flex justify-between items-center">
            {/* Profile Button - Left */}
            <button
              onClick={() => router.push(userRole === 'tutor' ? '/tutor-dashboard' : '/dashboard')}
              className="p-2 sm:p-2.5 md:p-3 rounded-lg transition shadow-soft bg-emerald-500 text-white hover:bg-emerald-600 hover:shadow-medium"
              title="Profile"
            >
              {/* User Icon */}
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </button>

            {/* Logo - Center */}
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">Care-N-Care</h1>

            {/* Logout Button - Right */}
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                router.replace("/auth");
              }}
              className="p-2 sm:p-2.5 md:p-3 rounded-lg transition shadow-soft bg-red-500 text-white hover:bg-red-600 hover:shadow-medium"
              title="Log Out"
            >
              {/* Logout Icon */}
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Navigation - Fixed */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-3">
          <div className="flex justify-between items-center w-full gap-3 sm:gap-4 md:gap-6">
            {/* Messages Button - Left */}
            <button
              onClick={() => router.push('/scheduler')}
              className={`${getButtonClass('scheduler')} relative flex-1 flex items-center justify-center`}
            >
              {/* Envelope Icon */}
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              {schedulerMessagesCount > 0 && (
                <span className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 bg-red-500 text-white text-[10px] sm:text-xs rounded-full h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 flex items-center justify-center font-bold shadow-medium">
                  {schedulerMessagesCount}
                </span>
              )}
            </button>

            {/* Calendar Button - Center */}
            <button
              onClick={() => router.push('/calendar')}
              className={`${getButtonClass('calendar', true)} relative flex-1 flex items-center justify-center`}
            >
              {/* Calendar Icon */}
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {newCalendarBlocksCount > 0 && (
                <span className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 bg-red-500 text-white text-[10px] sm:text-xs rounded-full h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 flex items-center justify-center font-bold shadow-medium">
                  {newCalendarBlocksCount}
                </span>
              )}
            </button>

            {/* Chats Button - Right */}
            <button
              onClick={() => router.push('/chats')}
              className={`${getButtonClass('chats')} relative flex-1 flex items-center justify-center`}
            >
              {/* Chat Bubble Icon */}
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {unreadChatMessages > 0 && (
                <span className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 bg-red-500 text-white text-[10px] sm:text-xs rounded-full h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 flex items-center justify-center font-bold shadow-medium">
                  {unreadChatMessages}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
} 