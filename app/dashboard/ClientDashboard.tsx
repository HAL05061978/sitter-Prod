"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import LogoutButton from "../components/LogoutButton";
import { v4 as uuidv4 } from "uuid";

interface Profile {
  full_name: string | null;
  email: string | null;
  phone: string | null;
}

interface Child {
  id: string;
  full_name: string;
  birthdate: string | null;
  parent_id: string;
  created_at: string;
}

interface Group {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
}

export default function ClientDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteNote, setInviteNote] = useState("");
  const [inviteError, setInviteError] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.replace("/auth");
      } else {
        setUser(data.user);
        // Fetch profile
        const { data: profileData } = await supabase
          .from("profiles")
          .select("full_name, email, phone")
          .eq("id", data.user.id)
          .single();
        setProfile(profileData as Profile | null);
        // Fetch children
        const { data: childrenData } = await supabase
          .from("children")
          .select("*")
          .eq("parent_id", data.user.id)
          .order("created_at", { ascending: false });
        setChildren(childrenData || []);
        // Fetch groups where user is the creator ONLY
        const { data: groupsData } = await supabase
          .from("groups")
          .select("*")
          .eq("created_by", data.user.id)
          .order("created_at", { ascending: false });
        setGroups(groupsData || []);
        setLoading(false);
      }
    });
  }, [router]);

  function formatPhone(phone?: string | null) {
    if (!phone) return null;
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
    }
    return phone;
  }

  function calculateAge(birthdate: string | null): number | null {
    if (!birthdate) return null;
    const today = new Date();
    const birth = new Date(birthdate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  }

  function formatBirthdate(birthdate: string | null): string {
    if (!birthdate) return "Not set";
    return new Date(birthdate + 'T00:00:00').toLocaleDateString();
  }

  async function handleSubmitInvite(e: React.FormEvent, group: Group) {
    e.preventDefault();
    setInviteError("");
    if (!inviteEmail.trim()) {
      setInviteError("Email is required");
      return;
    }
    // Check if email exists in profiles
    const { data: existingProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("email", inviteEmail.trim().toLowerCase())
      .single();
    console.log('existingProfile:', existingProfile);
    if (profileError && profileError.code !== "PGRST116") {
      setInviteError(profileError.message);
      return;
    }
    // Compose message content
    const senderName = profile?.full_name || user?.email || "A parent";
    const groupName = group.name;
    const note = inviteNote.trim() ? `\n\nNote from ${senderName}: ${inviteNote.trim()}` : "";
    const subject = `Group Invitation: ${groupName}`;
    const content = `You have been invited to join the group '${groupName}' by ${senderName}.${note}`;
    // Add to group_invites
    const inviteId = uuidv4();
    const { error: inviteError } = await supabase
      .from("group_invites")
      .insert([
        {
          id: inviteId,
          group_id: group.id,
          email: inviteEmail.trim().toLowerCase(),
          invited_by: user?.id,
          status: "pending",
        },
      ]);
    if (inviteError) {
      setInviteError(inviteError.message);
      return;
    }
    // Add to group_members as pending if profile exists
    if (existingProfile) {
      console.log("Inserting pending group_member for:", existingProfile.id, group.id);
      const { error: memberInsertError } = await supabase
        .from("group_members")
        .insert([
          {
            group_id: group.id,
            profile_id: existingProfile.id,
            role: 'parent',
            status: 'pending',
            joined_at: new Date().toISOString(),
          },
        ]);
      if (memberInsertError) {
        // If unique constraint, update status to pending
        if (memberInsertError.code === '23505' || memberInsertError.message.includes('duplicate key')) {
          console.log("Row exists, updating status to pending");
          const { error: updateError } = await supabase
            .from("group_members")
            .update({ status: 'pending' })
            .eq("group_id", group.id)
            .eq("profile_id", existingProfile.id);
          if (updateError) {
            setInviteError(updateError.message);
            return;
          }
        } else {
          console.error("Error inserting group_member:", memberInsertError);
          setInviteError(memberInsertError.message);
          return;
        }
      } else {
        console.log("Successfully inserted pending group_member");
      }
    }
    // ...rest of your code (notify members, send messages, etc.)
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-end mb-6">
        <LogoutButton />
      </div>
      <div className="flex flex-wrap gap-4 mb-8">
        <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium">Profile</button>
        
        <button onClick={() => router.push('/schedule')} className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium">Schedule</button>
        <button onClick={() => router.push('/activities')} className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium">Activities</button>
      </div>
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="space-y-2">
          <div><strong>Name:</strong> {profile?.full_name || <span className="text-gray-400">(not set)</span>}</div>
          <div><strong>Email:</strong> {profile?.email || user?.email || <span className="text-gray-400">(not set)</span>}</div>
          <div><strong>Phone:</strong> {formatPhone(profile?.phone) || <span className="text-gray-400">(not set)</span>}</div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Children</h2>
          </div>
          {children.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No children added yet.</p>
              <p className="text-sm">Click "Add Child" to get started.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {children.map((child) => {
                const age = calculateAge(child.birthdate);
                return (
                  <div key={child.id} className="border rounded p-4 flex flex-col gap-2 bg-gray-50">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-lg">{child.full_name}</span>
                    </div>
                    <p className="text-gray-600">Age: {age !== null ? `${age} years old` : "Unknown"}</p>
                    <p className="text-gray-600">Birthday: {formatBirthdate(child.birthdate)}</p>
                    <p className="text-xs text-gray-400 mt-2">Added: {new Date(child.created_at).toLocaleDateString()}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Groups</h2>
          </div>
          {groups.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No groups found.</p>
              <p className="text-sm">You are not a member or creator of any groups.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {groups.map((group) => (
                <div key={group.id} className="border rounded p-4 flex flex-col gap-2 bg-gray-50">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-lg">{group.name}</span>
                  </div>
                  {group.description && <div className="text-gray-600">{group.description}</div>}
                  <p className="text-xs text-gray-400 mt-2">Created: {new Date(group.created_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 