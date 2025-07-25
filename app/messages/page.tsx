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
  const [messages, setMessages] = useState<any[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({});
  const [groupsMap, setGroupsMap] = useState<Record<string, string>>({});

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

  async function handleAcceptInvite(msg: any) {
    // Update group_invites to accepted
    await supabase
      .from('group_invites')
      .update({ status: 'accepted' })
      .eq('group_id', msg.group_id)
      .eq('email', profile?.email);
    // Debug: Log all group_members rows for this group before update
    const { data: allMembers } = await supabase
      .from('group_members')
      .select('*')
      .eq('group_id', msg.group_id);
    console.log('All group_members for this group:', allMembers);
    // Debug: Log the IDs used for update
    console.log('Attempting to update group_members:', { group_id: msg.group_id, profile_id: profile?.id });
    // Update group_members status to 'active' (if row exists)
    const { data: updatedRows, error: updateError } = await supabase
      .from('group_members')
      .update({ status: 'active' })
      .eq('group_id', msg.group_id)
      .eq('profile_id', profile?.id)
      .select();
    console.log('Update result:', { updatedRows, updateError });
    if (updateError) {
      alert('Error updating group_members status: ' + updateError.message);
      return;
    }
    if (!updatedRows || updatedRows.length === 0) {
      alert('No group_members row was updated. Please check that the group_id and profile_id match the pending entry.');
      return;
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
    const notifySubject = `Invitation Accepted: ${profile?.full_name || profile?.email} joined ${groupsMap[msg.group_id] || 'the group'}`;
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
      await supabase.from('messages').insert(notifyMessages);
    }
    // Delete the invite message after accepting
    const { error: deleteError } = await supabase
      .from('messages')
      .delete()
      .eq('id', msg.id);
    console.log('Delete error:', deleteError);
    await new Promise(res => setTimeout(res, 300));
    // Navigate to groups page to show the new group
    router.push('/groups');
  }

  async function handleRejectInvite(msg: any) {
    // Update group_invites to rejected
    await supabase
      .from('group_invites')
      .update({ status: 'rejected' })
      .eq('group_id', msg.group_id)
      .eq('email', profile?.email);
    // Notify all group members (excluding the invited parent)
    const { data: groupMembers } = await supabase
      .from('group_members')
      .select('profile_id')
      .eq('group_id', msg.group_id);
    let memberIds = (groupMembers || []).map((m: any) => m.profile_id).filter(Boolean);
    memberIds = memberIds.filter((id: string) => id !== profile?.id);
    const notifySubject = `Invitation Rejected: ${profile?.full_name || profile?.email} declined ${groupsMap[msg.group_id] || 'the group'}`;
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
      await supabase.from('messages').insert(notifyMessages);
    }
    // Delete the invite message after rejecting
    const { error: deleteErrorReject } = await supabase
      .from('messages')
      .delete()
      .eq('id', msg.id);
    console.log('Delete error (reject):', deleteErrorReject);
    await new Promise(res => setTimeout(res, 300));
    window.location.reload();
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
            {messages.map((msg) => (
              <div key={msg.id} className="border rounded p-4 bg-gray-50">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-lg">{msg.subject || "(No Subject)"}</span>
                  <span className="text-xs text-gray-400">{new Date(msg.created_at).toLocaleString()}</span>
                </div>
                <div className="mb-2 text-gray-700">{msg.content}</div>
                <div className="flex gap-4 text-xs text-gray-500">
                  <span>From: {profilesMap[msg.sender_id] || "Unknown"}</span>
                  {msg.group_id && <span>Group: {groupsMap[msg.group_id] || "Unknown"}</span>}
                </div>
                {/* Accept/Reject buttons for invite messages */}
                {msg.role === 'invite' && msg.recipient_id === profile?.id && (
                  <div className="mt-3 flex gap-2">
                    <button
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
                      onClick={() => handleAcceptInvite(msg)}
                    >
                      Accept
                    </button>
                    <button
                      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
                      onClick={() => handleRejectInvite(msg)}
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 