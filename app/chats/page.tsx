"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
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
      console.error("Error loading chat messages:", error);
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
      console.error("Error sending message:", error);
      alert("Failed to send message. Please try again.");
    } else {
      setNewMessage("");
      // Reload messages
      await loadChatMessages(selectedGroup.id);
    }
    
    setSendingMessage(false);
  };

  const selectGroup = async (group: Group) => {
    setSelectedGroup(group);
    await loadChatMessages(group.id);
    
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
          console.log('New message received:', payload);
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

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Group Chats</h1>
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
        <button 
          onClick={() => router.push('/schedule')}
          className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium"
        >
          Schedule
        </button>

        <button className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium">
          Chats
        </button>
        <button 
          onClick={() => router.push('/activities')}
          className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium"
        >
          Activities
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Group Selection */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Your Groups</h2>
            {groups.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No groups available.</p>
                <p className="text-sm">Join or create a group to start chatting.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {groups.map((group) => (
                  <button
                    key={group.id}
                    onClick={() => selectGroup(group)}
                    className={`w-full p-4 rounded-lg border-2 transition-colors text-left ${
                      selectedGroup?.id === group.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                    }`}
                  >
                    <h3 className="font-semibold text-lg mb-2">{group.name}</h3>
                    {group.description && (
                      <p className="text-gray-600 text-sm mb-2">{group.description}</p>
                    )}
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{isGroupCreator(group) ? 'Creator' : 'Member'}</span>
                      <span>{new Date(group.created_at).toLocaleDateString()}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Chat Interface */}
        <div className="lg:col-span-2">
          {selectedGroup ? (
            <div className="bg-white rounded-lg shadow-md p-6 h-[600px] flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Chat: {selectedGroup.name}</h3>
                <button
                  onClick={() => setSelectedGroup(null)}
                  className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition"
                >
                  Back to Groups
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto border rounded-lg p-4 mb-4 bg-gray-50">
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
                  onChange={(e) => setNewMessage(e.target.value)}
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
          ) : (
            <div className="bg-white rounded-lg shadow-md p-6 h-[600px] flex items-center justify-center">
              <div className="text-center text-gray-500">
                <p className="text-lg font-medium mb-2">Select a Group</p>
                <p className="text-sm">Choose a group from the sidebar to start chatting</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 