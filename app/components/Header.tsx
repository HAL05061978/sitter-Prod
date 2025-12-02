"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import LogoutButton from "./LogoutButton";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CounterDebugger } from "../../lib/counter-debugger";
import { useTranslation } from "react-i18next";
import { pushNotificationService } from "../../lib/push-notifications";
import { Capacitor } from "@capacitor/core";

interface HeaderProps {
  currentPage?: string;
  children?: React.ReactNode;
}

export default function Header({ currentPage = "dashboard", children }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { t, i18n } = useTranslation();
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>('parent');
  const [pendingInvitations, setPendingInvitations] = useState<number>(0);

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'es' : 'en';
    i18n.changeLanguage(newLang);
  };

  // Initialize counters from localStorage to prevent flickering during fetch
  const [unreadChatMessages, setUnreadChatMessages] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('unreadChatMessages');
      return saved ? parseInt(saved, 10) : 0;
    }
    return 0;
  });
  const [schedulerMessagesCount, setSchedulerMessagesCount] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('schedulerMessagesCount');
      return saved ? parseInt(saved, 10) : 0;
    }
    return 0;
  });
  const [newCalendarBlocksCount, setNewCalendarBlocksCount] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('newCalendarBlocksCount');
      return saved ? parseInt(saved, 10) : 0;
    }
    return 0;
  });

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
        localStorage.setItem('unreadChatMessages', '0');
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
        localStorage.setItem('unreadChatMessages', '0');
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
      localStorage.setItem('unreadChatMessages', unviewedChatCount.toString());
    } catch (error) {
      // Error fetching unread chat messages
    }
  };

  // Function to fetch and calculate scheduler messages count (Messages/Scheduler button)
  const fetchSchedulerMessagesCount = async (userId: string) => {
    CounterDebugger.logCounterFetch('scheduler', userId, 'Header.fetchSchedulerMessagesCount');
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

      // Fetch HANGOUT/SLEEPOVER invitations
      let hangoutResponses: any[] = [];
      try {
        const { data, error } = await supabase.rpc('get_hangout_sleepover_responses', {
          p_parent_id: userId
        });
        if (!error) {
          hangoutResponses = data || [];
        }
      } catch (err) {
        // Hangout/sleepover function not deployed yet, skip
      }

      // Combine child, pet, and hangout/sleepover care responses
      const careResponses = [...(childResponses || []), ...petResponses, ...hangoutResponses];

      // Get responses to MY requests (when I'm the requester)
      const { data: responsesToMyRequests } = await supabase.rpc('get_responses_for_requester', {
        p_requester_id: userId
      });

      // Get PET care responses to MY requests (when I'm the requester)
      let petResponsesToMyRequests: any[] = [];
      try {
        const { data, error } = await supabase.rpc('get_pet_care_responses_for_requester', {
          p_requester_id: userId
        });
        if (!error) {
          petResponsesToMyRequests = data || [];
        } else {
          CounterDebugger.logDatabaseError(
            'get_pet_care_responses_for_requester',
            'get_pet_care_responses_for_requester',
            error
          );
        }
      } catch (err) {
        // Pet care responses function not deployed yet, skip
        CounterDebugger.logDatabaseError(
          'get_pet_care_responses_for_requester',
          'get_pet_care_responses_for_requester',
          { message: 'Function not deployed or catch error', error: err }
        );
      }

      // Combine child and pet care responses
      const allResponsesToMyRequests = [...(responsesToMyRequests || []), ...petResponsesToMyRequests];

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

      // Fetch hangout_accepted notifications (when someone accepts your hangout invitation)
      const { data: hangoutAcceptedNotifications } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'hangout_accepted')
        .eq('is_read', false); // Only unread notifications

      // Calculate the count
      let schedulerCount = 0;

      // Load previously read messages from localStorage
      const savedReadMessages = localStorage.getItem('readSchedulerMessages');
      const readMessages = savedReadMessages ? new Set(JSON.parse(savedReadMessages)) : new Set<string>();


      // 1. Pending care requests (reciprocal care requests needing response)
      const pendingCareResponses = (careResponses || []).filter((r: any) =>
        r.status === 'pending' && !readMessages.has(`pending-${r.care_response_id}`)
      );
      schedulerCount += pendingCareResponses.length;

      // 2. Responses to my requests (when I'm the requester)
      // Only count responses with status 'submitted' (not 'accepted' or 'declined')
      const submittedResponses = (allResponsesToMyRequests || []).filter((response: any) =>
        response.status === 'submitted'
      );

      // Count unique requests that have submitted responses (not individual responses)
      const requestsWithSubmittedResponses = new Set<string>();
      submittedResponses.forEach((response: any) => {
        requestsWithSubmittedResponses.add(response.care_request_id);
      });

      schedulerCount += requestsWithSubmittedResponses.size;

      // 3. Pending open block invitations (grouped by parent to count as 1 message)
      const invitationGroups = new Map();
      (invitations || []).filter((inv: any) => inv.status === 'pending').forEach((inv: any) => {
        const key = inv.open_block_parent_id || inv.open_block_parent_name;
        if (!invitationGroups.has(key)) {
          invitationGroups.set(key, []);
        }
        invitationGroups.get(key).push(inv);
      });

      // Count each group as 1 message (regardless of how many blocks in the offer)
      invitationGroups.forEach((invs, key) => {
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
      const careDeclinedCount = (careDeclinedNotifications || []).filter((n: any) =>
        !readMessages.has(`care-declined-${n.id}`)
      ).length;
      schedulerCount += careDeclinedCount;

      // 9. Hangout accepted notifications (when someone accepts your hangout invitation)
      const hangoutAcceptedCount = (hangoutAcceptedNotifications || []).filter((n: any) =>
        !readMessages.has(`hangout-accepted-${n.id}`)
      ).length;
      schedulerCount += hangoutAcceptedCount;

      // Log the final calculation
      CounterDebugger.logCounterCalculation('scheduler', {
        pendingCareResponses: pendingCareResponses.length,
        requestsWithSubmittedResponses: requestsWithSubmittedResponses.size,
        openBlockInvitationGroups: invitationGroups.size,
        acceptedOpenBlockInvitations: (invitations || []).filter((inv: any) => inv.status === 'accepted').length,
        rescheduleRequests: (rescheduleRequests || []).length,
        rescheduleRequestNotifications: (rescheduleNotifications || []).filter((n: any) => n.type === 'reschedule_request' && n.is_read === false).length,
        rescheduleCounters: (rescheduleNotifications || []).filter((n: any) => n.type === 'reschedule_counter_sent' && !(rescheduleNotifications || []).some((rn: any) => (rn.type === 'reschedule_counter_accepted' || rn.type === 'reschedule_counter_declined') && rn.data?.counter_request_id === n.data?.counter_request_id)).length,
        acceptDeclineNotifications: (rescheduleNotifications || []).filter((n: any) => n.type === 'reschedule_accepted' || n.type === 'reschedule_declined' || n.type === 'reschedule_counter_accepted' || n.type === 'reschedule_counter_declined').length,
        careDeclinedNotifications: careDeclinedCount,
        hangoutAcceptedNotifications: hangoutAcceptedCount,
        readMessagesInLocalStorage: readMessages.size
      }, schedulerCount);

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
    CounterDebugger.logCounterFetch('calendar', userId, 'Header.fetchNewCalendarBlocksCount');
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

      // Calculate total blocks from notifications ONLY
      // Each notification has a blocks_created field (2 for reciprocal care, 1-2 for open blocks)
      // Note: We no longer use localStorage because notifications have the accurate count
      const notificationBlocks = (careAcceptedNotifications || []).reduce((total, notification) => {
        const blocksCreated = notification.data?.blocks_created || 2; // Default to 2 for old notifications
        return total + blocksCreated;
      }, 0);

      // Fetch unseen calendar updates (photo/notes changes by provider)
      let unseenUpdatesCount = 0;
      try {
        const { data: unseenCount, error: unseenError } = await supabase.rpc(
          'get_unseen_calendar_updates_count',
          { p_user_id: userId }
        );
        if (!unseenError && unseenCount !== null) {
          unseenUpdatesCount = unseenCount;
        }
      } catch (err) {
        // Function may not exist yet - ignore error
        console.log('get_unseen_calendar_updates_count not available yet');
      }

      const totalCount = notificationBlocks + unseenUpdatesCount;

      // Log the calculation
      CounterDebugger.logCounterCalculation('calendar', {
        totalNotifications: (careAcceptedNotifications || []).length,
        notificationDetails: (careAcceptedNotifications || []).map((n: any) => ({
          id: n.id,
          blocks_created: n.data?.blocks_created || 2,
          care_type: n.data?.care_type,
          created_at: n.created_at
        })),
        unseenUpdatesCount
      }, totalCount);

      setNewCalendarBlocksCount(totalCount);
      localStorage.setItem('newCalendarBlocksCount', totalCount.toString());
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

  // Listen for counter refresh events (triggered when accepting invitations, etc.)
  useEffect(() => {
    const handleRefreshCounters = () => {
      if (user) {
        // Add a small delay to ensure database consistency
        setTimeout(async () => {
          await Promise.all([
            fetchSchedulerMessagesCount(user.id),
            fetchNewCalendarBlocksCount(user.id)
          ]);
        }, 300);
      }
    };

    window.addEventListener('refreshCounters', handleRefreshCounters);
    return () => window.removeEventListener('refreshCounters', handleRefreshCounters);
  }, [user]);

  // Listen for calendar block viewed events (to refresh counter when unseen block is opened)
  useEffect(() => {
    const handleCalendarBlockViewed = () => {
      if (user) {
        // Add a small delay to ensure database consistency
        setTimeout(async () => {
          await fetchNewCalendarBlocksCount(user.id);
        }, 200);
      }
    };

    window.addEventListener('calendarBlockViewed', handleCalendarBlockViewed);
    return () => window.removeEventListener('calendarBlockViewed', handleCalendarBlockViewed);
  }, [user]);

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
      CounterDebugger.logEventReceived('schedulerCountUpdated', 'Header.handleSchedulerCountUpdated');
      if (user) {
        fetchSchedulerMessagesCount(user.id);
      }
    };

    const handleCalendarCountUpdated = () => {
      CounterDebugger.logEventReceived('calendarCountUpdated', 'Header.handleCalendarCountUpdated');
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

  // Update app badge when counters change
  useEffect(() => {
    const totalUnread = schedulerMessagesCount + newCalendarBlocksCount + unreadChatMessages;
    if (Capacitor.isNativePlatform()) {
      pushNotificationService.setBadge(totalUnread);
    }
  }, [schedulerMessagesCount, newCalendarBlocksCount, unreadChatMessages]);


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
    <div className="app-container">
      {/* Top Header */}
      <div className="app-header">
        <div className="p-3 max-w-7xl mx-auto">
          {/* App Name - Top Center */}
          <h1 className="text-xl font-bold text-gray-900 text-center mb-2">{t('appName')}</h1>

          <div className="flex justify-between items-center">
            {/* Left side - Profile, Settings & Logout */}
            <div className="flex items-center gap-2">
              {/* Profile Button */}
              <button
                onClick={() => router.push(userRole === 'tutor' ? '/tutor-dashboard' : '/dashboard')}
                className="p-2 rounded-lg transition shadow-soft bg-emerald-500 text-white hover:bg-emerald-600 hover:shadow-medium"
                title="Profile"
              >
                {/* User Icon */}
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </button>

              {/* Settings Button */}
              <button
                onClick={() => router.push('/settings')}
                className="p-2 rounded-lg transition shadow-soft bg-gray-500 text-white hover:bg-gray-600 hover:shadow-medium"
                title="Settings"
              >
                {/* Settings/Gear Icon */}
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>

              {/* Logout Button */}
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  router.replace("/auth");
                }}
                className="p-2 rounded-lg transition shadow-soft bg-red-500 text-white hover:bg-red-600 hover:shadow-medium"
                title="Log Out"
              >
                {/* Logout Icon */}
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>

            {/* Right side - Language Toggle */}
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg transition shadow-soft bg-white border-2 border-gray-200 hover:border-gray-300 hover:shadow-medium"
              title={i18n.language === 'en' ? 'Switch to Spanish' : 'Cambiar a Inglés'}
            >
              {/* UK Flag */}
              <span className={`text-lg transition-opacity ${i18n.language === 'en' ? 'opacity-100' : 'opacity-40'}`}>
                🇬🇧
              </span>
              {/* Toggle indicator */}
              <div className="w-10 h-5 bg-gray-200 rounded-full relative mx-1">
                <div
                  className={`absolute top-0.5 w-4 h-4 bg-emerald-500 rounded-full transition-all duration-200 ${
                    i18n.language === 'en' ? 'left-0.5' : 'left-5'
                  }`}
                />
              </div>
              {/* Spain Flag */}
              <span className={`text-lg transition-opacity ${i18n.language === 'es' ? 'opacity-100' : 'opacity-40'}`}>
                🇪🇸
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="app-content bg-gray-50">
        {children}
      </div>

      {/* Bottom Navigation */}
      <div className="app-footer">
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
    </div>
  );
} 