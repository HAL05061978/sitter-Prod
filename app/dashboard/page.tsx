"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import LogoutButton from "../components/LogoutButton";
import type { User } from "@supabase/supabase-js";
import { v4 as uuidv4 } from 'uuid';

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
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [editChildName, setEditChildName] = useState("");
  const [editChildBirthdate, setEditChildBirthdate] = useState("");
  const [childEditError, setChildEditError] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [invitingGroupId, setInvitingGroupId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteNote, setInviteNote] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [editGroupName, setEditGroupName] = useState("");
  const [editGroupDescription, setEditGroupDescription] = useState("");
  const [groupEditError, setGroupEditError] = useState("");
  const [showAddChild, setShowAddChild] = useState(false);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [childName, setChildName] = useState("");
  const [childBirthdate, setChildBirthdate] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [addingChild, setAddingChild] = useState(false);
  const [addingGroup, setAddingGroup] = useState(false);
  const [childError, setChildError] = useState("");
  const [groupError, setGroupError] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.replace("/auth");
      } else {
        setUser(data.user);
        // Fetch profile from 'profiles' table
        const { data: profileData } = await supabase
          .from("profiles")
          .select("full_name, email, phone")
          .eq("id", data.user.id)
          .single();
        setProfile(profileData as Profile | null);
        
        // Fetch children for this parent
        const { data: childrenData } = await supabase
          .from("children")
          .select("*")
          .eq("parent_id", data.user.id)
          .order("created_at", { ascending: false });
        setChildren(childrenData || []);
        
        // Fetch groups created by this parent
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

  // Helper to format phone number as (XXX) XXX XXXX
  function formatPhone(phone?: string | null) {
    if (!phone) return null;
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
    }
    return phone;
  }

  // Helper to calculate age from birthdate
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

  // Helper to format birthdate for display
  function formatBirthdate(birthdate: string | null): string {
    if (!birthdate) return "Not set";
    // Add T00:00:00 to ensure local time and avoid timezone shift
    return new Date(birthdate + 'T00:00:00').toLocaleDateString();
  }

  const handleAddChild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !childName.trim() || !childBirthdate.trim()) {
      setChildError("Please fill in all fields");
      return;
    }

    // Validate birthdate (not in the future)
    const todayStr = new Date().toISOString().split('T')[0];
    if (childBirthdate > todayStr) {
      setChildError("Birthdate cannot be in the future");
      return;
    }

    // Validate age (reasonable range: 0-18 years)
    const age = calculateAge(childBirthdate);
    if (age !== null && (age < 0 || age > 18)) {
      setChildError("Child must be between 0 and 18 years old");
      return;
    }

    setAddingChild(true);
    setChildError("");

    const { error } = await supabase.from("children").insert([
      {
        full_name: childName.trim(),
        birthdate: childBirthdate,
        parent_id: user.id,
      },
    ]);

    setAddingChild(false);
    if (error) {
      setChildError(error.message);
    } else {
      // Refresh children list
      const { data: childrenData } = await supabase
        .from("children")
        .select("*")
        .eq("parent_id", user.id)
        .order("created_at", { ascending: false });
      setChildren(childrenData || []);
      
      // Reset form
      setChildName("");
      setChildBirthdate("");
      setShowAddChild(false);
    }
  };

  const handleAddGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !groupName.trim()) {
      setGroupError("Please enter a group name");
      return;
    }

    setAddingGroup(true);
    setGroupError("");

    // Insert group and get the new group's id
    console.log('Creating group with created_by:', user.id, {
      name: groupName.trim(),
      description: groupDescription.trim() || null,
      created_by: user.id,
    });
    const { data: groupInsertData, error: groupInsertError } = await supabase
      .from("groups")
      .insert([
        {
          name: groupName.trim(),
          description: groupDescription.trim() || null,
          created_by: user.id,
        },
      ])
      .select();
    if (groupInsertError) {
      setAddingGroup(false);
      setGroupError(groupInsertError.message);
      return;
    }
    const newGroup = groupInsertData && groupInsertData[0];
    if (!newGroup) {
      setAddingGroup(false);
      setGroupError("Failed to create group.");
      return;
    }
    // Insert creator into group_members
    const { error: memberInsertError } = await supabase
      .from("group_members")
      .insert([
        {
          group_id: newGroup.id,
          profile_id: user.id,
          role: 'parent',
          joined_at: new Date().toISOString(),
        },
      ]);
    setAddingGroup(false);
    if (memberInsertError) {
      setGroupError("Group created, but failed to add you as a member: " + memberInsertError.message);
      return;
    }
    // Refresh groups list
    const { data: groupsData } = await supabase
      .from("groups")
      .select("*")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false });
    setGroups(groupsData || []);
    // Reset form
    setGroupName("");
    setGroupDescription("");
    setShowAddGroup(false);
  };

  // Inline group edit handlers
  function handleEditGroup(group: Group) {
    setEditingGroupId(group.id);
    setEditGroupName(group.name);
    setEditGroupDescription(group.description || "");
    setGroupEditError("");
  }

  async function handleSaveGroupEdit(group: Group) {
    setGroupEditError("");
    if (!editGroupName.trim()) {
      setGroupEditError("Group name is required");
      return;
    }
    const { error } = await supabase
      .from("groups")
      .update({ name: editGroupName.trim(), description: editGroupDescription.trim() })
      .eq("id", group.id)
      .eq("created_by", user?.id)
      .select();
    if (error) {
      setGroupEditError(error.message);
      return;
    }
    // Update local state
    setGroups((prev) =>
      prev.map((g) =>
        g.id === group.id
          ? { ...g, name: editGroupName.trim(), description: editGroupDescription.trim() }
          : g
      )
    );
    setEditingGroupId(null);
  }

  function handleCancelGroupEdit() {
    setEditingGroupId(null);
    setGroupEditError("");
  }

  function handleInviteGroup(group: Group) {
    setInvitingGroupId(group.id);
    setInviteEmail("");
    setInviteNote("");
    setInviteError("");
  }

  function handleCancelInvite() {
    setInvitingGroupId(null);
    setInviteError("");
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
    // Fetch all group members (profile ids)
    const { data: groupMembers, error: membersError } = await supabase
      .from("group_members")
      .select("profile_id")
      .eq("group_id", group.id);
    if (membersError) {
      setInviteError(membersError.message);
      return;
    }
    const memberIds = (groupMembers || []).map((m: any) => m.profile_id).filter(Boolean);
    // Add the creator if not already in the list
    if (user?.id && !memberIds.includes(user.id)) {
      memberIds.push(user.id);
    }
    // Compose notification message for all group members (moved to after acceptance/rejection)
    // Only send invite message to the invited parent if they exist
    if (existingProfile) {
      // Internal message to invited parent only
      const messageInsert = {
        group_id: group.id,
        sender_id: user?.id,
        recipient_id: existingProfile.id,
        subject,
        content,
        role: 'invite',
      };
      console.log('Inserting message:', messageInsert);
      const { error: msgError } = await supabase
        .from("messages")
        .insert([messageInsert]);
      console.log('Supabase message insert error:', msgError);
      if (msgError) {
        setInviteError(msgError.message);
        return;
      }
      // Insert or update group_members as pending
      console.log('Attempting to insert group_members:', { group_id: group.id, profile_id: existingProfile.id });
      const { data: insertData, error: memberInsertError } = await supabase
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
      console.log('Insert response:', { insertData, memberInsertError });
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
      // Debug: Log all group_members rows for this group and profile after insert/update
      const { data: afterInsert } = await supabase
        .from("group_members")
        .select("*")
        .eq("group_id", group.id)
        .eq("profile_id", existingProfile.id);
      console.log("group_members after invite insert/update:", afterInsert);
      setInviteError("");
      setInvitingGroupId(null);
      alert("Invite sent as internal message!");
    } else {
      // External email (stub)
      // Here you would call your backend/email service
      setInviteError("");
      setInvitingGroupId(null);
      alert("Invite sent via email (stub). Implement real email sending in production.");
    }
  }

  // Inline child edit handlers
  function handleEditChild(child: Child) {
    setEditingChildId(child.id);
    setEditChildName(child.full_name);
    setEditChildBirthdate(child.birthdate || "");
    setChildEditError("");
  }

  async function handleSaveChildEdit(child: Child) {
    setChildEditError("");
    if (!editChildName.trim()) {
      setChildEditError("Child name is required");
      return;
    }
    if (!editChildBirthdate.trim()) {
      setChildEditError("Birthdate is required");
      return;
    }
    const todayStr = new Date().toISOString().split('T')[0];
    if (editChildBirthdate > todayStr) {
      setChildEditError("Birthdate cannot be in the future");
      return;
    }
    const { data, error } = await supabase
      .from("children")
      .update({ full_name: editChildName.trim(), birthdate: editChildBirthdate })
      .eq("id", child.id)
      .eq("parent_id", user?.id)
      .select();
    console.log('Supabase update children:', { data, error });
    if (error) {
      setChildEditError(error.message);
      return;
    }
    // Re-fetch children from Supabase
    const { data: childrenData, error: fetchError } = await supabase
      .from("children")
      .select("*")
      .eq("parent_id", user?.id)
      .order("full_name", { ascending: true });
    if (fetchError) {
      setChildEditError(fetchError.message);
      return;
    }
    setChildren(childrenData || []);
    setEditingChildId(null);
  }

  function handleCancelChildEdit() {
    setEditingChildId(null);
    setChildEditError("");
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-end mb-6">
        <LogoutButton />
      </div>
      
      {/* Navigation Buttons */}
      <div className="flex flex-wrap gap-4 mb-8">
        <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium">
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
        <button 
          onClick={() => router.push('/groups')}
          className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition font-medium"
        >
          Groups
        </button>
        <button 
          onClick={() => router.push('/activities')}
          className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium"
        >
          Activities
        </button>
      </div>
      
      {/* Profile Info (without header) */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="space-y-2">
          <div><strong>Name:</strong> {profile?.full_name || <span className="text-gray-400">(not set)</span>}</div>
          <div><strong>Email:</strong> {profile?.email || user?.email || <span className="text-gray-400">(not set)</span>}</div>
          <div><strong>Phone:</strong> {formatPhone(profile?.phone) || <span className="text-gray-400">(not set)</span>}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Children Section */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Children</h2>
            <button
              onClick={() => setShowAddChild(!showAddChild)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
            >
              {showAddChild ? "Cancel" : "Add Child"}
            </button>
          </div>

          {showAddChild && (
            <form onSubmit={handleAddChild} className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-medium mb-4">Add New Child</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Child's Name</label>
                  <input
                    type="text"
                    value={childName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setChildName(e.target.value)}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter child's name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Birthdate</label>
                  <input
                    type="date"
                    value={childBirthdate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setChildBirthdate(e.target.value)}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    max={new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>
              </div>
              {childError && <div className="text-red-600 mb-4">{childError}</div>}
              <button
                type="submit"
                disabled={addingChild}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition disabled:opacity-50"
              >
                {addingChild ? "Adding..." : "Add Child"}
              </button>
            </form>
          )}

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
                    {editingChildId === child.id ? (
                      <>
                        <input
                          type="text"
                          value={editChildName}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditChildName(e.target.value)}
                          className="px-3 py-2 border rounded mb-2"
                          placeholder="Child's name"
                          required
                        />
                        <input
                          type="date"
                          value={editChildBirthdate}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditChildBirthdate(e.target.value)}
                          className="px-3 py-2 border rounded mb-2"
                          max={new Date().toISOString().split('T')[0]}
                          required
                        />
                        {childEditError && <div className="text-red-600 mb-2">{childEditError}</div>}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleSaveChildEdit(child)}
                            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
                          >
                            Save
                          </button>
                          <button
                            onClick={handleCancelChildEdit}
                            className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500 transition"
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-lg">{child.full_name}</span>
                          <button
                            onClick={() => handleEditChild(child)}
                            className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                          >
                            Edit
                          </button>
                        </div>
                        <p className="text-gray-600">
                          Age: {age !== null ? `${age} years old` : "Unknown"}
                        </p>
                        <p className="text-gray-600">
                          Birthday: {formatBirthdate(child.birthdate)}
                        </p>
                        <p className="text-xs text-gray-400 mt-2">
                          Added: {new Date(child.created_at).toLocaleDateString()}
                        </p>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Groups Section */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Groups</h2>
            <button
              onClick={() => setShowAddGroup(!showAddGroup)}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition"
            >
              {showAddGroup ? "Cancel" : "Create Group"}
            </button>
          </div>

          {showAddGroup && (
            <form onSubmit={handleAddGroup} className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-medium mb-4">Create New Group</h3>
              <div className="space-y-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Group Name</label>
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGroupName(e.target.value)}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Enter group name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description (Optional)</label>
                  <textarea
                    value={groupDescription}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setGroupDescription(e.target.value)}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Enter group description"
                    rows={3}
                  />
                </div>
              </div>
              {groupError && <div className="text-red-600 mb-4">{groupError}</div>}
              <button
                type="submit"
                disabled={addingGroup}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition disabled:opacity-50"
              >
                {addingGroup ? "Creating..." : "Create Group"}
              </button>
            </form>
          )}

          {/* Editable Groups List (moved from profile card) */}
          {groups.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No groups created yet.</p>
              <p className="text-sm">Click "Create Group" to get started.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {groups.map((group) => (
                <div key={group.id} className="border rounded p-4 flex flex-col gap-2 bg-gray-50">
                  {editingGroupId === group.id ? (
                    <>
                      <input
                        type="text"
                        value={editGroupName}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditGroupName(e.target.value)}
                        className="px-3 py-2 border rounded mb-2"
                        placeholder="Group name"
                        required
                      />
                      <textarea
                        value={editGroupDescription}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditGroupDescription(e.target.value)}
                        className="px-3 py-2 border rounded mb-2"
                        placeholder="Group description"
                        rows={2}
                      />
                      {groupEditError && <div className="text-red-600 mb-2">{groupEditError}</div>}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveGroupEdit(group)}
                          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancelGroupEdit}
                          className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500 transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-lg">{group.name}</span>
                        <button
                          onClick={() => handleEditGroup(group)}
                          className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleInviteGroup(group)}
                          className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition"
                        >
                          Invite
                        </button>
                      </div>
                      {group.description && <div className="text-gray-600">{group.description}</div>}
                      <p className="text-xs text-gray-400 mt-2">
                        Created: {new Date(group.created_at).toLocaleDateString()}
                      </p>
                      {invitingGroupId === group.id && (
                        <form onSubmit={(e) => handleSubmitInvite(e, group)} className="mt-2 p-3 bg-gray-100 rounded">
                          <div className="mb-2">
                            <label className="block text-sm font-medium mb-1">Parent Email</label>
                            <input
                              type="email"
                              value={inviteEmail}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInviteEmail(e.target.value)}
                              className="w-full px-3 py-2 border rounded"
                              placeholder="parent@email.com"
                              required
                            />
                          </div>
                          <div className="mb-2">
                            <label className="block text-sm font-medium mb-1">Custom Note</label>
                            <textarea
                              value={inviteNote}
                              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInviteNote(e.target.value)}
                              className="w-full px-3 py-2 border rounded"
                              placeholder="Add a note (optional)"
                              rows={2}
                            />
                          </div>
                          {inviteError && <div className="text-red-600 mb-2">{inviteError}</div>}
                          <div className="flex gap-2">
                            <button
                              type="submit"
                              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
                            >
                              Send Invite
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelInvite}
                              className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500 transition"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 