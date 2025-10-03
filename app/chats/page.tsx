"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import Header from "../components/Header";
import LogoutButton from "../components/LogoutButton";
import type { User } from "@supabase/supabase-js";

interface Group {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
}

interface ChatMessage {
  id: string;
  group_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

interface ChatProfile {
  id: string;
  full_name: string | null;
  email: string | null;
}

export default function ChatsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [chatProfiles, setChatProfiles] = useState<Record<string, ChatProfile>>({});
  const [sendingMessage, setSendingMessage] = useState(false);
  const [groupsWithUnread, setGroupsWithUnread] = useState<Set<string>>(new Set());
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.replace("/auth");
      } else {
        setUser(data.user);
        await loadGroups(data.user.id);
        setLoading(false);
      }
    });
  }, [router]);

  // Set up real-time subscription for new messages to update unread groups
  useEffect(() => {
    if (!user || groups.length === 0) return;

    const groupIds = groups.map(g => g.id);
    
    const subscription = supabase
      .channel('chat_unread_updates')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'chat_messages',
          filter: `group_id=in.(${groupIds.join(',')})`
        }, 
        (payload) => {
          const newMessage = payload.new as ChatMessage;
          
          // Only add to unread if the message is not from the current user
          if (newMessage.sender_id !== user?.id) {
            setGroupsWithUnread(prev => {
              const newSet = new Set(prev);
              newSet.add(newMessage.group_id);
              return newSet;
            });
            
            // Update the unread count for this group
            setUnreadCounts(prev => ({
              ...prev,
              [newMessage.group_id]: (prev[newMessage.group_id] || 0) + 1
            }));
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user, groups]);

  const loadGroups = async (userId: string) => {
    // 1. Fetch groups created by this parent
    const { data: createdGroups } = await supabase
      .from("groups")
      .select("*")
      .eq("created_by", userId)
      .order("created_at", { ascending: false });

    // 2. Fetch groups where this parent is a member (through invites)
    const { data: memberGroups } = await supabase
      .from("group_members")
      .select("group_id, status")
      .eq("profile_id", userId)
      .eq("status", "active");

    let memberGroupIds: string[] = [];
    if (memberGroups) {
      memberGroupIds = memberGroups.map(mg => mg.group_id);
    }

    const { data: joinedGroups } = await supabase
      .from("groups")
      .select("*")
      .in("id", memberGroupIds)
      .order("created_at", { ascending: false });

    // 3. Combine and deduplicate groups
    const allGroups = [...(createdGroups || []), ...(joinedGroups || [])];
    const uniqueGroups = allGroups.filter((group, index, self) => 
      index === self.findIndex(g => g.id === group.id)
    );
    setGroups(uniqueGroups);

    // 4. Check which groups have unread messages
    await checkGroupsWithUnread(userId, uniqueGroups);
  };

  // Function to check which groups have unread messages
  const checkGroupsWithUnread = async (userId: string, groupsList: Group[]) => {
    try {
      const groupIds = groupsList.map(g => g.id);
      
      // Get all messages in user's groups that weren't sent by the user
      const { data: allMessages } = await supabase
        .from("chat_messages")
        .select("id, group_id")
        .in("group_id", groupIds)
        .neq("sender_id", userId);

      if (!allMessages || allMessages.length === 0) {
        setGroupsWithUnread(new Set());
        return;
      }

      const messageIds = allMessages.map(m => m.id);

      // Get messages that the user has viewed
      const { data: viewedMessages } = await supabase
        .from("message_views")
        .select("message_id")
        .eq("user_id", userId)
        .in("message_id", messageIds);

      const viewedMessageIds = new Set((viewedMessages || []).map(v => v.message_id));
      
      // Count unviewed messages per group
      const unreadCounts: Record<string, number> = {};
      allMessages.forEach(message => {
        if (!viewedMessageIds.has(message.id)) {
          unreadCounts[message.group_id] = (unreadCounts[message.group_id] || 0) + 1;
        }
      });
      
      // Only add groups that have unread messages
      const groupsWithUnreadSet = new Set(Object.keys(unreadCounts).filter(groupId => unreadCounts[groupId] > 0));
      setGroupsWithUnread(groupsWithUnreadSet);
      
      // Store the unread counts for display
      setUnreadCounts(unreadCounts);
    } catch (error) {
      // Error checking groups with unread messages
    }
  };

  // Check if user is the creator of a group
  function isGroupCreator(group: Group) {
    return group.created_by === user?.id;
  }

  const loadChatMessages = async (groupId: string) => {
    const { data: messages, error } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("group_id", groupId)
      .order("created_at", { ascending: true });
    
    if (error) {
      // Error loading chat messages
      return;
    }
    
    setChatMessages(messages || []);
    
    // Load profiles for all senders
    const senderIds = Array.from(new Set((messages || []).map(m => m.sender_id)));
    if (senderIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", senderIds);
      
      const profilesMap: Record<string, ChatProfile> = {};
      (profiles || []).forEach((p: any) => {
        profilesMap[p.id] = p;
      });
      setChatProfiles(profilesMap);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup || !newMessage.trim() || !user) return;
    
    setSendingMessage(true);
    
    const { error } = await supabase
      .from("chat_messages")
      .insert([{
        group_id: selectedGroup.id,
        sender_id: user.id,
        content: newMessage.trim(),
      }]);
    
    if (error) {
      // Error sending message
      alert("Failed to send message. Please try again.");
    } else {
      setNewMessage("");
      // Reload messages
      await loadChatMessages(selectedGroup.id);
    }
    
    setSendingMessage(false);
  };

  const toggleGroup = async (group: Group) => {
    // If clicking the same group, toggle it off
    if (selectedGroup?.id === group.id) {
      setSelectedGroup(null);
      setChatMessages([]);
      return;
    }
    
    // If clicking a different group, select it
    setSelectedGroup(group);
    await loadChatMessages(group.id);
    
    // Mark all messages in this group as viewed by the current user
    if (user) {
      await markMessagesAsViewed(group.id, user.id);
    }
    
    // Remove this group from the unread set since it's now opened
    setGroupsWithUnread(prev => {
      const newSet = new Set(prev);
      newSet.delete(group.id);
      return newSet;
    });
    
    // Clear the unread count for this group
    setUnreadCounts(prev => {
      const newCounts = { ...prev };
      delete newCounts[group.id];
      return newCounts;
    });
    
    // Set up real-time subscription for new messages
    const subscription = supabase
      .channel(`chat:${group.id}`)
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'chat_messages',
          filter: `group_id=eq.${group.id}`
        }, 
        (payload) => {
          const newMessage = payload.new as ChatMessage;
          setChatMessages(prev => [...prev, newMessage]);
          
          // Load sender profile if not already loaded
          if (!chatProfiles[newMessage.sender_id]) {
            supabase
              .from("profiles")
              .select("id, full_name, email")
              .eq("id", newMessage.sender_id)
              .single()
              .then(({ data }) => {
                if (data) {
                  setChatProfiles(prev => ({
                    ...prev,
                    [data.id]: data
                  }));
                }
              });
          }
        }
      )
      .subscribe();
    
    // Cleanup subscription when component unmounts or group changes
    return () => {
      subscription.unsubscribe();
    };
  };

  // Function to mark messages as viewed
  const markMessagesAsViewed = async (groupId: string, userId: string) => {
    try {
      // Get all message IDs in this group that weren't sent by the current user
      const { data: messages } = await supabase
        .from("chat_messages")
        .select("id")
        .eq("group_id", groupId)
        .neq("sender_id", userId);

      if (!messages || messages.length === 0) return;

      const messageIds = messages.map(m => m.id);

      // Insert view records for all unviewed messages
      const viewRecords = messageIds.map(messageId => ({
        user_id: userId,
        message_id: messageId
      }));

      // Use upsert to avoid conflicts if already viewed
      const { error } = await supabase
        .from("message_views")
        .upsert(viewRecords, { 
          onConflict: 'user_id,message_id',
          ignoreDuplicates: true 
        });

      if (error) {
        // Error marking messages as viewed
      } else {
        // Trigger a refresh of the header notification count
        window.dispatchEvent(new CustomEvent('messagesViewed'));
      }
    } catch (error) {
      // Error marking messages as viewed
    }
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  return (
    <div>
      <Header currentPage="chats" />
      <div className="p-6 bg-white min-h-screen">
        {/* Groups Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Your Groups</h2>
          {groups.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No groups available.</p>
              <p className="text-sm">Join or create a group to start chatting.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {groups.map((group) => {
                const hasUnread = groupsWithUnread.has(group.id);
                const unreadCount = unreadCounts[group.id] || 0;
                const isSelected = selectedGroup?.id === group.id;
                
                return (
                  <div key={group.id}>
                    <button
                      onClick={() => toggleGroup(group)}
                      className={`w-full p-4 rounded-lg border-2 transition-colors text-left ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : hasUnread
                          ? 'border-orange-400 bg-orange-50 shadow-md'
                          : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-lg mb-2">{group.name}</h3>
                          {group.description && (
                            <p className="text-gray-600 text-sm mb-2">{group.description}</p>
                          )}
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>{isGroupCreator(group) ? 'Creator' : 'Member'}</span>
                            <span>{new Date(group.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {hasUnread && (
                            <span className="bg-orange-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center font-bold">
                              {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                          )}
                          <span className={`text-xs transition-transform ${isSelected ? 'rotate-180' : ''}`}>
                            ▼
                          </span>
                        </div>
                      </div>
                    </button>
                    
                    {/* Chat Area - appears underneath the selected group */}
                    {isSelected && (
                      <div className="mt-4 ml-4 bg-white rounded-lg border border-gray-200 p-4">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold">Chat: {group.name}</h3>
                        </div>

                        {/* Messages */}
                        <div className="h-80 overflow-y-auto border rounded-lg p-4 mb-4 bg-gray-50">
                          {chatMessages.length === 0 ? (
                            <div className="text-center text-gray-500 py-8">
                              <p>No messages yet.</p>
                              <p className="text-sm">Start the conversation!</p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {chatMessages.map((message) => {
                                const isMyMessage = message.sender_id === user?.id;
                                const senderProfile = chatProfiles[message.sender_id];
                                const senderName = senderProfile?.full_name || senderProfile?.email || "Unknown";
                                
                                return (
                                  <div
                                    key={message.id}
                                    className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'}`}
                                  >
                                    <div
                                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                                        isMyMessage
                                          ? 'bg-blue-500 text-white'
                                          : 'bg-white border border-gray-200'
                                      }`}
                                    >
                                      <div className="text-xs opacity-75 mb-1">
                                        {isMyMessage ? 'You' : senderName}
                                      </div>
                                      <div className="text-sm">{message.content}</div>
                                      <div className="text-xs opacity-75 mt-1">
                                        {new Date(message.created_at).toLocaleTimeString()}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Message Input */}
                        <form onSubmit={sendMessage} className="flex gap-2">
                          <input
                            type="text"
                            value={newMessage}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMessage(e.target.value)}
                            placeholder="Type your message..."
                            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            disabled={sendingMessage}
                          />
                          <button
                            type="submit"
                            disabled={sendingMessage || !newMessage.trim()}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {sendingMessage ? 'Sending...' : 'Send'}
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 