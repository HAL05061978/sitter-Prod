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
  const [unreadSchedulerMessages, setUnreadSchedulerMessages] = useState<number>(0);

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

  // Function to fetch unread scheduler messages count
  const fetchUnreadSchedulerMessages = async (userId: string) => {
    try {
      // Get open block invitations
      const { data: invitations } = await supabase.rpc('get_open_block_invitations', {
        p_parent_id: userId
      });

      // Get care requests that I need to respond to
      const { data: careRequests, error: careRequestsError } = await supabase.rpc('get_reciprocal_care_requests', {
        parent_id: userId
      });

      if (careRequestsError) {
        // Error fetching care requests
      }

      // Get care responses that I need to respond to (for invited parents)
      const { data: careResponses, error: careResponsesError } = await supabase.rpc('get_reciprocal_care_responses', {
        parent_id: userId
      });

      if (careResponsesError) {
        // Error fetching care responses
      }

      // Get responses to my requests
      const { data: responsesToMyRequests, error: responsesToMyRequestsError } = await supabase.rpc('get_responses_for_requester', {
        p_requester_id: userId
      });

      if (responsesToMyRequestsError) {
        // Error fetching responses to my requests
      }

      // Get pending group invitations
      const { data: groupInvitations, error: groupInvitationsError } = await supabase.rpc('get_pending_group_invitations', {
        p_user_id: userId
      });

      if (groupInvitationsError) {
        // Error fetching group invitations
      }

      // Get pending event invitations
      const { data: eventInvitations, error: eventInvitationsError } = await supabase.rpc('get_pending_event_invitations', {
        p_user_id: userId
      });

      if (eventInvitationsError) {
        // Error fetching event invitations
      }

      // Get pending reschedule requests
      const { data: rescheduleRequests, error: rescheduleRequestsError } = await supabase.rpc('get_reschedule_requests', {
        p_parent_id: userId
      });

      if (rescheduleRequestsError) {
        // Error fetching reschedule requests
      }

      let unreadCount = 0;

      // Count pending open block invitations (grouped by parent)
      if (invitations) {
        const pendingInvitations = invitations.filter((inv: any) => inv.status === 'pending');
        const invitationGroups = new Map();
        
        // Group invitations by parent
        pendingInvitations.forEach((invitation: any) => {
          const key = invitation.open_block_parent_id || invitation.open_block_parent_name;
          if (!invitationGroups.has(key)) {
            invitationGroups.set(key, []);
          }
          invitationGroups.get(key).push(invitation);
        });
        
        // Count one per parent group
        unreadCount += invitationGroups.size;
      }

      // Count pending care requests that I need to respond to
      if (careRequests) {
        const pendingCareRequests = careRequests.filter((req: any) => req.status === 'pending' || req.status === 'submitted');
        unreadCount += pendingCareRequests.length;
      }

      // CRITICAL FIX: Count care responses that are pending (for invited parents)
      // This is what was missing - we need to count responses that the user needs to act on
      if (careResponses) {
        const pendingCareResponses = careResponses.filter((resp: any) => resp.status === 'pending');
        unreadCount += pendingCareResponses.length;
      }



      // Count requests that have responses in 'submitted' status (for the Messages counter)
      if (responsesToMyRequests) {
        const requestsWithSubmittedResponses = responsesToMyRequests.filter((resp: any) => resp.status === 'submitted');
        // REMOVED: Don't count responses to your requests in the Messages button count
        // These are responses that others made to your requests - they don't require action from you
        // The Messages button should only count things YOU need to act on
      }

      // CRITICAL FIX: Count reciprocal requests that are still pending response
      // This ensures invited parents see the count for requests they haven't responded to yet
      if (careRequests) {
        const unrespondedReciprocalRequests = careRequests.filter((req: any) => {
          // Count requests that are still waiting for a response from the invited parent
          return req.status === 'pending' && req.response_type === 'pending';
        });
        // Note: We don't add to unreadCount here because these are already counted above
        // This is just for debugging to ensure we're seeing the right requests
      }

      // Count pending group invitations
      if (groupInvitations) {
        const pendingGroupInvitations = groupInvitations.filter((inv: any) => inv.status === 'pending');
        unreadCount += pendingGroupInvitations.length;
      }

      // Count pending event invitations
      if (eventInvitations) {
        unreadCount += eventInvitations.length;
      }

      // Count pending reschedule requests
      if (rescheduleRequests) {
        const pendingRescheduleRequests = rescheduleRequests.filter((req: any) => req.status === 'pending');
        unreadCount += pendingRescheduleRequests.length;
      }

      setUnreadSchedulerMessages(unreadCount);
    } catch (error) {
      // Error fetching unread scheduler messages
    }
  };



  // Manual refresh function for debugging (can be called from console)
  const manualRefresh = async () => {
    if (user) {
      await Promise.all([
        fetchPendingInvitations(user.id),
        fetchUnreadChatMessages(user.id),
        fetchUnreadSchedulerMessages(user.id)
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
          fetchUnreadSchedulerMessages(data.user.id)
        ]);
      }
    });
  }, []);

  // Listen for invitation acceptance events
  useEffect(() => {
    const handleMessagesViewed = () => {
      if (user) {
        fetchUnreadChatMessages(user.id);
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

    const handleSchedulerUpdated = () => {
      if (user) {
        fetchUnreadSchedulerMessages(user.id);
      }
    };

    const handleInvitationAccepted = () => {
      if (user) {
        fetchUnreadSchedulerMessages(user.id);
      }
    };

    const handleInvitationDeclined = () => {
      if (user) {
        fetchUnreadSchedulerMessages(user.id);
      }
    };

    const handleCareRequestResponded = () => {
      if (user) {
        fetchUnreadSchedulerMessages(user.id);
      }
    };

    window.addEventListener('invitationAccepted', handleInvitationAccepted);
    window.addEventListener('invitationDeclined', handleInvitationDeclined);
    window.addEventListener('careRequestResponded', handleCareRequestResponded);
    window.addEventListener('groupInvitationUpdated', handleCareRequestResponded); // Use same handler for group invitations
    window.addEventListener('messagesViewed', handleMessagesViewed);
    window.addEventListener('careRequestUpdated', handleCareRequestUpdated);
    window.addEventListener('responseStatusUpdated', handleResponseStatusUpdated);
    window.addEventListener('newMessageSent', handleMessagesViewed); // Refresh when new messages are sent
    window.addEventListener('schedulerUpdated', handleSchedulerUpdated); // Refresh when scheduler is updated

    return () => {
      window.removeEventListener('invitationAccepted', handleInvitationAccepted);
      window.removeEventListener('invitationDeclined', handleInvitationDeclined);
      window.removeEventListener('careRequestResponded', handleCareRequestResponded);
      window.removeEventListener('groupInvitationUpdated', handleCareRequestResponded);
      window.removeEventListener('messagesViewed', handleMessagesViewed);
      window.removeEventListener('careRequestUpdated', handleCareRequestUpdated);
      window.removeEventListener('responseStatusUpdated', handleResponseStatusUpdated);
      window.removeEventListener('newMessageSent', handleMessagesViewed);
      window.removeEventListener('schedulerUpdated', handleSchedulerUpdated);
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

  // Make manualRefresh available globally for debugging
  useEffect(() => {
    (window as any).manualRefresh = manualRefresh;
    return () => {
      delete (window as any).manualRefresh;
    };
  }, [user]);

  // Listen for localStorage changes to update scheduler unread count
  useEffect(() => {
    const handleStorageChange = (e: any) => {
      if (e.key === 'headerSchedulerUnreadCount' && e.newValue) {
        setUnreadSchedulerMessages(parseInt(e.newValue));
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  useEffect(() => {
    if (user) {
      fetchPendingInvitations(user.id);
      fetchUnreadChatMessages(user.id);
      fetchUnreadSchedulerMessages(user.id);
      
      // Load scheduler unread count from localStorage
      const savedSchedulerUnread = localStorage.getItem('headerSchedulerUnreadCount');
      if (savedSchedulerUnread) {
        setUnreadSchedulerMessages(parseInt(savedSchedulerUnread));
      }
    }
  }, [user]);

  const getButtonClass = (page: string) => {
    const baseClass = "px-6 py-3 rounded-lg transition font-medium shadow-soft";
    const isActive = currentPage === page;
    
    if (isActive) {
      return `${baseClass} bg-emerald-600 text-white cursor-default shadow-medium`;
    }
    
    // All inactive buttons use the same lighter shade
    return `${baseClass} bg-emerald-500 text-white hover:bg-emerald-600 hover:shadow-medium`;
  };

  return (
    <div className="bg-white shadow-soft border-b border-gray-200">
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">SitterApp</h1>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => router.push(userRole === 'tutor' ? '/tutor-dashboard' : '/dashboard')}
              className="px-4 py-2 rounded-lg transition font-medium shadow-soft bg-emerald-500 text-white hover:bg-emerald-600 hover:shadow-medium"
            >
              Profile
            </button>
            <LogoutButton />
          </div>
        </div>
        
        {/* Navigation Buttons */}
        <div className="flex flex-wrap gap-4">
          {/* Messages Button */}
          <button 
            onClick={() => router.push('/scheduler')}
            className={`${getButtonClass('scheduler')} relative`}
          >
            Messages
            {unreadSchedulerMessages > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center font-bold shadow-medium">
                {unreadSchedulerMessages}
              </span>
            )}
          </button>

          {/* Chats Button */}
          <button 
            onClick={() => router.push('/chats')}
            className={`${getButtonClass('chats')} relative`}
          >
            Chats
            {unreadChatMessages > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center font-bold shadow-medium">
                {unreadChatMessages}
              </span>
            )}
          </button>

          {/* Calendar Button */}
          <button 
            onClick={() => router.push('/calendar')}
            className={getButtonClass('calendar')}
          >
            Calendar
          </button>

          {/* Bites Button */}
          <button 
            onClick={() => router.push('/coaching')}
            className={getButtonClass('coaching')}
          >
            Bites
          </button>

          {/* Collective Button */}
          <button 
            onClick={() => router.push('/activities')}
            className={getButtonClass('activities')}
          >
            Collective
          </button>
        </div>
      </div>
    </div>
  );
} 