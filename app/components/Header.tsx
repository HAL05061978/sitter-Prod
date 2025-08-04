"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import LogoutButton from "./LogoutButton";

interface HeaderProps {
  currentPage?: string;
}

export default function Header({ currentPage = "dashboard" }: HeaderProps) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [pendingInvitations, setPendingInvitations] = useState<number>(0);
  const [pendingScheduleItems, setPendingScheduleItems] = useState<number>(0);
  const [unreadChatMessages, setUnreadChatMessages] = useState<number>(0);
  const [unreadMessages, setUnreadMessages] = useState<number>(0);

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
        console.error('Error fetching pending invitations:', error);
        return;
      }
      
      const count = data?.length || 0;
      setPendingInvitations(count);
    } catch (error) {
      console.error('Error fetching pending invitations:', error);
    }
  };

  // Function to fetch pending schedule items (care requests and events)
  const fetchPendingScheduleItems = async (userId: string) => {
    try {
      // Get groups the user is a member of
      const { data: userGroups } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("profile_id", userId)
        .eq("status", "active");

      if (!userGroups || userGroups.length === 0) {
        setPendingScheduleItems(0);
        return;
      }

      const groupIds = userGroups.map(g => g.group_id);

      let totalPendingItems = 0;

      // 1. Count care requests that need responses (not responded to by current user)
      const { data: careRequests } = await supabase
        .from("care_requests")
        .select("id")
        .in("group_id", groupIds)
        .neq("requester_id", userId) // Exclude requests created by current user
        .neq("status", "cancelled"); // Exclude cancelled requests

      if (careRequests && careRequests.length > 0) {
        const requestIds = careRequests.map(r => r.id);
        
        // Check which requests the current user hasn't responded to
        const { data: userResponses } = await supabase
          .from("care_responses")
          .select("request_id")
          .in("request_id", requestIds)
          .eq("responder_id", userId);

        const respondedRequestIds = (userResponses || []).map(r => r.request_id);
        const pendingRequests = careRequests.filter(r => !respondedRequestIds.includes(r.id));
        
        totalPendingItems += pendingRequests.length;
      }

      // 2. Count pending responses that need approval (responses to user's requests)
      // First get the user's request IDs
      const { data: userRequests } = await supabase
        .from("care_requests")
        .select("id")
        .eq("requester_id", userId)
        .neq("status", "cancelled");

      if (userRequests && userRequests.length > 0) {
        const requestIds = userRequests.map(r => r.id);
        
        // Then count pending responses for those requests
        const { data: pendingResponses } = await supabase
          .from("care_responses")
          .select("id")
          .eq("status", "pending")
          .in("request_id", requestIds);

        if (pendingResponses) {
          totalPendingItems += pendingResponses.length;
        }
      }

      setPendingScheduleItems(totalPendingItems);
    } catch (error) {
      console.error('Error fetching pending schedule items:', error);
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
      console.error('Error fetching unread chat messages:', error);
    }
  };

  const fetchUnreadMessages = async (userId: string) => {
    try {
      // Get all regular messages for the user
      const { data: regularMessages, error: messagesError } = await supabase
        .from("messages")
        .select("id")
        .eq("recipient_id", userId);

      if (messagesError) {
        console.error('Error fetching messages for count:', messagesError);
        setUnreadMessages(0);
        return;
      }

      if (!regularMessages || regularMessages.length === 0) {
        setUnreadMessages(0);
        return;
      }

      const messageIds = regularMessages.map(m => m.id);

      // Get messages that the user has viewed
      const { data: viewedMessages } = await supabase
        .from("message_views")
        .select("message_id")
        .eq("user_id", userId)
        .in("message_id", messageIds);

      const viewedMessageIds = (viewedMessages || []).map(v => v.message_id);
      
      // Count unviewed messages
      const unviewedCount = messageIds.filter(id => !viewedMessageIds.includes(id)).length;
      setUnreadMessages(unviewedCount);
    } catch (error) {
      console.error('Error fetching unread messages:', error);
      setUnreadMessages(0);
    }
  };

  // Manual refresh function for debugging (can be called from console)
  const manualRefresh = async () => {
    if (user) {
      console.log('Manual refresh triggered');
      await Promise.all([
        fetchPendingInvitations(user.id),
        fetchPendingScheduleItems(user.id),
        fetchUnreadChatMessages(user.id),
        fetchUnreadMessages(user.id)
      ]);
      console.log('Manual refresh completed');
    }
  };

  // Initialize user and fetch all counts
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        setUser(data.user);
        await Promise.all([
          fetchPendingInvitations(data.user.id),
          fetchPendingScheduleItems(data.user.id),
          fetchUnreadChatMessages(data.user.id),
          fetchUnreadMessages(data.user.id)
        ]);
      }
    });
  }, []);

  // Listen for invitation acceptance events
  useEffect(() => {
    const handleInvitationAccepted = () => {
      if (user) {
        fetchPendingInvitations(user.id);
      }
    };

    const handleMessagesViewed = () => {
      if (user) {
        fetchUnreadChatMessages(user.id);
        fetchUnreadMessages(user.id);
      }
    };

    const handleCareRequestUpdated = () => {
      if (user) {
        fetchPendingScheduleItems(user.id);
      }
    };

    const handleResponseStatusUpdated = () => {
      if (user) {
        fetchPendingScheduleItems(user.id);
        fetchUnreadChatMessages(user.id);
        fetchUnreadMessages(user.id); // Refresh regular messages count
      }
    };

    window.addEventListener('invitationAccepted', handleInvitationAccepted);
    window.addEventListener('messagesViewed', handleMessagesViewed);
    window.addEventListener('careRequestUpdated', handleCareRequestUpdated);
    window.addEventListener('responseStatusUpdated', handleResponseStatusUpdated);
    window.addEventListener('newMessageSent', handleMessagesViewed); // Refresh when new messages are sent

    return () => {
      window.removeEventListener('invitationAccepted', handleInvitationAccepted);
      window.removeEventListener('messagesViewed', handleMessagesViewed);
      window.removeEventListener('careRequestUpdated', handleCareRequestUpdated);
      window.removeEventListener('responseStatusUpdated', handleResponseStatusUpdated);
      window.removeEventListener('newMessageSent', handleMessagesViewed);
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
          fetchPendingScheduleItems(user.id);
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
            fetchPendingScheduleItems(user.id);
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
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">SitterApp</h1>
          <LogoutButton />
        </div>
        
        {/* Navigation Buttons */}
        <div className="flex flex-wrap gap-4">
          <button 
            onClick={() => router.push('/dashboard')}
            className={getButtonClass('dashboard')}
          >
            Profile
          </button>
          <button 
            onClick={() => router.push('/messages')}
            className={`${getButtonClass('messages')} relative`}
          >
            Messages
            {unreadMessages > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center font-bold shadow-medium">
                {unreadMessages}
              </span>
            )}
          </button>
          <button 
            onClick={() => router.push('/schedule')}
            className={`${getButtonClass('schedule')} relative`}
          >
            Schedule
                         {pendingScheduleItems > 0 && (
               <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center font-bold shadow-medium">
                 {pendingScheduleItems}
               </span>
             )}
          </button>
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
          <button 
            onClick={() => router.push('/activities')}
            className={getButtonClass('activities')}
          >
            Activities
          </button>
        </div>
      </div>
    </div>
  );
} 