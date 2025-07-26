"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import LogoutButton from "../components/LogoutButton";
import type { User } from "@supabase/supabase-js";
import { v4 as uuidv4 } from 'uuid';

interface Message {
  id: string;
  subject: string | null;
  content: string;
  sender_id: string;
  group_id: string | null;
  created_at: string;
  role?: string;
  status?: string; // 'pending', 'accepted', 'rejected'
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface Group {
  id: string;
  name: string;
}

export default function MessagesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({});
  const [groupsMap, setGroupsMap] = useState<Record<string, string>>({});
  const [processingInvite, setProcessingInvite] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.replace("/auth");
      } else {
        setUser(data.user);
        // Get current user's profile
        const { data: myProfile } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .eq("id", data.user.id)
          .single();
        setProfile(myProfile);
        // Fetch all messages for this user
        const { data: messagesData } = await supabase
          .from("messages")
          .select("*, group_id, sender_id")
          .eq("recipient_id", data.user.id)
          .order("created_at", { ascending: false });
        setMessages(messagesData || []);
        // Fetch all involved profiles (senders)
        const senderIds = Array.from(new Set((messagesData || []).map((m: any) => m.sender_id)));
        let profilesMap: Record<string, string> = {};
        if (senderIds.length > 0) {
          const { data: senderProfiles } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", senderIds);
          (senderProfiles || []).forEach((p: any) => {
            profilesMap[p.id] = p.full_name || "Unknown";
          });
        }
        setProfilesMap(profilesMap);
        // Fetch all involved groups (fix: use all group_ids from messages)
        const groupIds = Array.from(new Set((messagesData || []).map((m: any) => m.group_id).filter(Boolean)));
        let groupsMap: Record<string, string> = {};
        if (groupIds.length > 0) {
          const { data: groupsData } = await supabase
            .from("groups")
            .select("id, name")
            .in("id", groupIds);
          (groupsData || []).forEach((g: any) => {
            groupsMap[g.id] = g.name;
          });
        }
        console.log("Message groupIds:", groupIds);
        console.log("groupsMap:", groupsMap);
        setGroupsMap(groupsMap);
        setLoading(false);
      }
    });
  }, [router]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  async function handleAcceptInvite(msg: Message) {
    if (processingInvite) return; // Prevent double-clicking
    setProcessingInvite(msg.id);

    try {
      console.log('Starting accept invite process for message:', msg.id);
      
      // Update group_invites to accepted
      const { error: inviteError } = await supabase
        .from('group_invites')
        .update({ status: 'accepted' })
        .eq('group_id', msg.group_id)
        .eq('email', profile?.email);
      
      if (inviteError) {
        console.error('Error updating group_invites:', inviteError);
        alert('Error updating group invite: ' + inviteError.message);
        return;
      }
      console.log('Successfully updated group_invites');

      // Update group_members status to 'active'
      const { data: updatedRows, error: updateError } = await supabase
        .from('group_members')
        .update({ status: 'active' })
        .eq('group_id', msg.group_id)
        .eq('profile_id', profile?.id)
        .select();

      if (updateError) {
        console.error('Error updating group_members:', updateError);
        alert('Error updating group_members status: ' + updateError.message);
        return;
      }
      if (!updatedRows || updatedRows.length === 0) {
        console.error('No group_members row was updated');
        alert('No group_members row was updated. Please check that the group_id and profile_id match the pending entry.');
        return;
      }
      console.log('Successfully updated group_members:', updatedRows);

      // Update the message status to 'accepted' instead of deleting
      const { error: messageUpdateError } = await supabase
        .from('messages')
        .update({ status: 'accepted' })
        .eq('id', msg.id);
      
      if (messageUpdateError) {
        console.error('Error updating message status:', messageUpdateError);
        // Don't fail the whole process if message update fails
        console.warn('Message status update failed, but continuing with other updates');
      } else {
        console.log('Successfully updated message status to accepted');
      }

      // Notify all group members (excluding the invited parent)
      const { data: groupMembers } = await supabase
        .from('group_members')
        .select('profile_id')
        .eq('group_id', msg.group_id)
        .eq('status', 'active');
      
      let memberIds = (groupMembers || []).map((m: any) => m.profile_id).filter(Boolean);
      // Remove the invited parent (current user) from notification recipients
      memberIds = memberIds.filter((id: string) => id !== profile?.id);
      
      const notifySubject = `Invitation Accepted: ${profile?.full_name || profile?.email} joined ${groupsMap[msg.group_id!] || 'the group'}`;
      const notifyContent = `${profile?.full_name || profile?.email} has accepted the invitation and joined the group.`;
      
      const notifyMessages = memberIds.map((recipientId: string) => ({
        group_id: msg.group_id,
        sender_id: user?.id,
        recipient_id: recipientId,
        subject: notifySubject,
        content: notifyContent,
        role: 'invite-accepted',
      }));

      if (notifyMessages.length > 0) {
        const { error: notifyError } = await supabase.from('messages').insert(notifyMessages);
        if (notifyError) {
          console.error('Error sending notifications:', notifyError);
        } else {
          console.log('Successfully sent notifications to', notifyMessages.length, 'members');
        }
      }

      // Update local state to reflect the change
      setMessages(prev => prev.map(m => 
        m.id === msg.id ? { ...m, status: 'accepted' } : m
      ));

      console.log('Accept invite process completed successfully');
      
      // Navigate to groups page to show the new group
      router.push('/groups');
    } catch (error) {
      console.error('Error accepting invite:', error);
      alert('Error accepting invitation. Please try again.');
    } finally {
      setProcessingInvite(null);
    }
  }

  async function handleRejectInvite(msg: Message) {
    if (processingInvite) return; // Prevent double-clicking
    setProcessingInvite(msg.id);

    try {
      console.log('Starting reject invite process for message:', msg.id);
      
      // Update group_invites to rejected
      const { error: inviteError } = await supabase
        .from('group_invites')
        .update({ status: 'rejected' })
        .eq('group_id', msg.group_id)
        .eq('email', profile?.email);
      
      if (inviteError) {
        console.error('Error updating group_invites:', inviteError);
        alert('Error updating group invite: ' + inviteError.message);
        return;
      }
      console.log('Successfully updated group_invites to rejected');

      // Update group_members status to 'rejected'
      const { error: memberError } = await supabase
        .from('group_members')
        .update({ status: 'rejected' })
        .eq('group_id', msg.group_id)
        .eq('profile_id', profile?.id);
      
      if (memberError) {
        console.error('Error updating group_members:', memberError);
        alert('Error updating group_members status: ' + memberError.message);
        return;
      }
      console.log('Successfully updated group_members to rejected');

      // Update the message status to 'rejected' instead of deleting
      const { error: messageUpdateError } = await supabase
        .from('messages')
        .update({ status: 'rejected' })
        .eq('id', msg.id);
      
      if (messageUpdateError) {
        console.error('Error updating message status:', messageUpdateError);
        // Don't fail the whole process if message update fails
        console.warn('Message status update failed, but continuing with other updates');
      } else {
        console.log('Successfully updated message status to rejected');
      }

      // Notify all group members (excluding the invited parent)
      const { data: groupMembers } = await supabase
        .from('group_members')
        .select('profile_id')
        .eq('group_id', msg.group_id);
      
      let memberIds = (groupMembers || []).map((m: any) => m.profile_id).filter(Boolean);
      memberIds = memberIds.filter((id: string) => id !== profile?.id);
      
      const notifySubject = `Invitation Rejected: ${profile?.full_name || profile?.email} declined ${groupsMap[msg.group_id!] || 'the group'}`;
      const notifyContent = `${profile?.full_name || profile?.email} has declined the invitation to join the group.`;
      
      const notifyMessages = memberIds.map((recipientId: string) => ({
        group_id: msg.group_id,
        sender_id: user?.id,
        recipient_id: recipientId,
        subject: notifySubject,
        content: notifyContent,
        role: 'invite-rejected',
      }));

      if (notifyMessages.length > 0) {
        const { error: notifyError } = await supabase.from('messages').insert(notifyMessages);
        if (notifyError) {
          console.error('Error sending notifications:', notifyError);
        } else {
          console.log('Successfully sent rejection notifications to', notifyMessages.length, 'members');
        }
      }

      // Update local state to reflect the change
      setMessages(prev => prev.map(m => 
        m.id === msg.id ? { ...m, status: 'rejected' } : m
      ));
      
      console.log('Reject invite process completed successfully');
    } catch (error) {
      console.error('Error rejecting invite:', error);
      alert('Error rejecting invitation. Please try again.');
    } finally {
      setProcessingInvite(null);
    }
  }

  // Helper function to get status display
  function getStatusDisplay(status: string | undefined) {
    switch (status) {
      case 'accepted':
        return { text: 'Accepted', color: 'bg-green-100 text-green-800' };
      case 'rejected':
        return { text: 'Rejected', color: 'bg-red-100 text-red-800' };
      default:
        return { text: 'Pending', color: 'bg-yellow-100 text-yellow-800' };
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Messages</h1>
        <LogoutButton />
      </div>
      {/* Navigation Buttons */}
      <div className="flex flex-wrap gap-4 mb-8">
        <button onClick={() => router.push('/dashboard')} className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium">Profile</button>
        <button className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium">Messages</button>
        <button onClick={() => router.push('/schedule')} className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium">Schedule</button>
        <button onClick={() => router.push('/groups')} className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition font-medium">Groups</button>
        <button onClick={() => router.push('/activities')} className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium">Activities</button>
      </div>
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Inbox</h2>
        {messages.length === 0 ? (
          <div className="text-gray-500">No messages yet.</div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => {
              const isInvite = msg.role === 'invite' && msg.recipient_id === profile?.id;
              const status = getStatusDisplay(msg.status);
              const isProcessing = processingInvite === msg.id;
              const hasActionTaken = msg.status === 'accepted' || msg.status === 'rejected';

              return (
                <div key={msg.id} className={`border rounded p-4 ${
                  hasActionTaken ? 'bg-gray-50 opacity-75' : 'bg-gray-50'
                }`}>
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-lg">{msg.subject || "(No Subject)"}</span>
                      {isInvite && (
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                          {status.text}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">{new Date(msg.created_at).toLocaleString()}</span>
                  </div>
                  <div className="mb-2 text-gray-700">{msg.content}</div>
                  <div className="flex gap-4 text-xs text-gray-500">
                    <span>From: {profilesMap[msg.sender_id] || "Unknown"}</span>
                    {msg.group_id && <span>Group: {groupsMap[msg.group_id] || "Unknown"}</span>}
                  </div>
                  
                  {/* Accept/Reject buttons for invite messages */}
                  {isInvite && !hasActionTaken && (
                    <div className="mt-3 flex gap-2">
                      <button
                        className={`px-4 py-2 rounded transition ${
                          isProcessing 
                            ? 'bg-gray-400 text-white cursor-not-allowed' 
                            : 'bg-green-600 text-white hover:bg-green-700'
                        }`}
                        onClick={() => handleAcceptInvite(msg)}
                        disabled={isProcessing}
                      >
                        {isProcessing ? 'Processing...' : 'Accept'}
                      </button>
                      <button
                        className={`px-4 py-2 rounded transition ${
                          isProcessing 
                            ? 'bg-gray-400 text-white cursor-not-allowed' 
                            : 'bg-red-600 text-white hover:bg-red-700'
                        }`}
                        onClick={() => handleRejectInvite(msg)}
                        disabled={isProcessing}
                      >
                        {isProcessing ? 'Processing...' : 'Reject'}
                      </button>
                    </div>
                  )}

                  {/* Show action taken for processed invites */}
                  {isInvite && hasActionTaken && (
                    <div className="mt-3">
                      <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${status.color}`}>
                        <span className="mr-2">✓</span>
                        {msg.status === 'accepted' ? 'Invitation Accepted' : 'Invitation Rejected'}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
} 