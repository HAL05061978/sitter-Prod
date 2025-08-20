"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import Header from "../components/Header";
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
  group_type: 'care' | 'event';
}

interface ChildGroupMember {
  id: string;
  child_id: string;
  group_id: string;
  added_by: string;
  added_at: string;
  active: boolean;
}



type TabType = 'profile' | 'children' | 'groups';

export default function ClientDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [memberships, setMemberships] = useState<ChildGroupMember[]>([]);
  const [allChildrenInGroups, setAllChildrenInGroups] = useState<Record<string, Child[]>>({});
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  
  // Profile state
  const [editingProfile, setEditingProfile] = useState(false);
  const [editFullName, setEditFullName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [profileEditError, setProfileEditError] = useState("");

  // Children state
  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [editChildName, setEditChildName] = useState("");
  const [editChildBirthdate, setEditChildBirthdate] = useState("");
  const [childEditError, setChildEditError] = useState("");
  const [showAddChild, setShowAddChild] = useState(false);
  const [childName, setChildName] = useState("");
  const [childBirthdate, setChildBirthdate] = useState("");
  const [addingChild, setAddingChild] = useState(false);
  const [childError, setChildError] = useState("");

  // Groups state
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [invitingGroupId, setInvitingGroupId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteNote, setInviteNote] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [editGroupName, setEditGroupName] = useState("");
  const [editGroupDescription, setEditGroupDescription] = useState("");
  const [editGroupType, setEditGroupType] = useState<'care' | 'event'>('care');
  const [groupEditError, setGroupEditError] = useState("");
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [groupType, setGroupType] = useState<'care' | 'event'>('care');
  const [addingGroup, setAddingGroup] = useState(false);
  const [groupError, setGroupError] = useState("");
  const [groupManagementError, setGroupManagementError] = useState("");

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

        // Fetch all groups (created and joined)
        await loadGroups(data.user.id, childrenData || []);
        
        setLoading(false);
      }
    });
  }, [router]);

  // Reload groups when children change
  useEffect(() => {
    if (user && children.length > 0) {
      loadGroups(user.id, children);
    }
  }, [children, user]);

  const loadGroups = async (userId: string, childrenData: Child[]) => {
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

    // 4. Fetch all child-group memberships for parent's children
    if (childrenData.length > 0) {
      const childIds = childrenData.map(child => child.id);
      console.log('Loading memberships for child IDs:', childIds);
      const { data: membershipsData, error: membershipsError } = await supabase
        .from("child_group_members")
        .select("*")
        .in("child_id", childIds)
        .eq("active", true); // Only fetch active memberships
      
      if (membershipsError) {
        console.error('Error loading memberships:', membershipsError);
      } else {
        console.log('Loaded memberships:', membershipsData);
        setMemberships(membershipsData || []);
      }
    }

    // 5. Fetch all children for each group (including other parents' children)
    if (uniqueGroups && uniqueGroups.length > 0) {
      const groupIds = uniqueGroups.map(group => group.id);
      const { data: allMemberships } = await supabase
        .from("child_group_members")
        .select("*")
        .in("group_id", groupIds)
        .eq("active", true); // Only fetch active memberships
      
      if (allMemberships && allMemberships.length > 0) {
        const allChildIds = Array.from(new Set(allMemberships.map(m => m.child_id)));
        const { data: allChildrenData } = await supabase
          .from("children")
          .select("*")
          .in("id", allChildIds);
        
        if (allChildrenData) {
          const childrenMap: Record<string, Child[]> = {};
          uniqueGroups.forEach(group => {
            const groupMemberships = allMemberships.filter(m => m.group_id === group.id);
            childrenMap[group.id] = groupMemberships
              .map(membership => allChildrenData.find(child => child.id === membership.child_id))
              .filter(Boolean) as Child[];
          });
          setAllChildrenInGroups(childrenMap);
        }
      }
    }
  };

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
    return new Date(birthdate + 'T00:00:00').toLocaleDateString();
  }

  // Helper to check if a child is a member of a group
  function isChildInGroup(childId: string, groupId: string) {
    const membership = memberships.find(
      (m) => m.child_id === childId && m.group_id === groupId && m.active !== false
    );
    console.log(`Checking membership for child ${childId} in group ${groupId}:`, membership);
    return membership;
  }

  // Check if user is the creator of a group
  function isGroupCreator(group: Group) {
    return group.created_by === user?.id;
  }

  // Children handlers
  const handleAddChild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !childName.trim() || !childBirthdate.trim()) {
      setChildError("Please fill in all fields");
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    if (childBirthdate > todayStr) {
      setChildError("Birthdate cannot be in the future");
      return;
    }

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
      const { data: childrenData } = await supabase
        .from("children")
        .select("*")
        .eq("parent_id", user.id)
        .order("created_at", { ascending: false });
      setChildren(childrenData || []);
      
      setChildName("");
      setChildBirthdate("");
      setShowAddChild(false);
    }
  };

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
    if (error) {
      setChildEditError(error.message);
      return;
    }
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

  // Groups handlers
  const handleAddGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !groupName.trim()) {
      setGroupError("Please enter a group name");
      return;
    }

    setAddingGroup(true);
    setGroupError("");

    const { data: groupInsertData, error: groupInsertError } = await supabase
      .from("groups")
      .insert([
        {
          name: groupName.trim(),
          description: groupDescription.trim() || null,
          created_by: user.id,
          group_type: groupType,
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
    await loadGroups(user.id, children);
    setGroupName("");
    setGroupDescription("");
    setGroupType('care');
    setShowAddGroup(false);
  };

  function handleEditGroup(group: Group) {
    setEditingGroupId(group.id);
    setEditGroupName(group.name);
    setEditGroupDescription(group.description || "");
    setEditGroupType(group.group_type);
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
      .update({ 
        name: editGroupName.trim(), 
        description: editGroupDescription.trim(),
        group_type: editGroupType
      })
      .eq("id", group.id)
      .eq("created_by", user?.id)
      .select();
    if (error) {
      setGroupEditError(error.message);
      return;
    }
    setGroups((prev) =>
      prev.map((g) =>
        g.id === group.id
          ? { ...g, name: editGroupName.trim(), description: editGroupDescription.trim(), group_type: editGroupType }
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

    // Check if the user is trying to invite themselves
    if (profile?.email && inviteEmail.trim().toLowerCase() === profile.email.toLowerCase()) {
      setInviteError("You cannot invite yourself to your own group");
      return;
    }

    const { data: existingProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("email", inviteEmail.trim().toLowerCase())
      .single();
    if (profileError && profileError.code !== "PGRST116") {
      setInviteError(profileError.message);
      return;
    }
    const senderName = profile?.full_name || user?.email || "A parent";
    const groupName = group.name;
    const note = inviteNote.trim() ? `\n\nNote from ${senderName}: ${inviteNote.trim()}` : "";
    const subject = `Group Invitation: ${groupName}`;
    const content = `You have been invited to join the group '${groupName}' by ${senderName}.${note}`;
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
    const { data: groupMembers, error: membersError } = await supabase
      .from("group_members")
      .select("profile_id")
      .eq("group_id", group.id);
    if (membersError) {
      setInviteError(membersError.message);
      return;
    }
    const memberIds = (groupMembers || []).map((m: any) => m.profile_id).filter(Boolean);
    if (user?.id && !memberIds.includes(user.id)) {
      memberIds.push(user.id);
    }
    if (existingProfile) {
      const messageInsert = {
        group_id: group.id,
        sender_id: user?.id,
        recipient_id: existingProfile.id,
        subject,
        content,
        role: 'invite',
      };
      const { error: msgError } = await supabase
        .from("messages")
        .insert([messageInsert]);
      if (msgError) {
        setInviteError(msgError.message);
        return;
      }
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
      if (memberInsertError) {
        if (memberInsertError.code === '23505' || memberInsertError.message.includes('duplicate key')) {
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
          setInviteError(memberInsertError.message);
          return;
        }
      }
      setInviteError("");
      setInvitingGroupId(null);
      alert("Invite sent as internal message!");
    } else {
      setInviteError("");
      setInvitingGroupId(null);
      alert("Invite sent via email (stub). Implement real email sending in production.");
    }
  }

  // Toggle child membership in group
  async function handleToggle(child: Child, group: Group) {
    setGroupManagementError("");
    const membership = memberships.find(
      (m) => m.child_id === child.id && m.group_id === group.id
    );

    if (!membership) {
      // Activate child in group
      try {
        const { data, error } = await supabase.rpc('activate_child_in_group', {
          p_child_id: child.id,
          p_group_id: group.id,
          p_added_by: user!.id
        });
        
        if (error) {
          console.error('Error activating child in group:', error);
          setGroupManagementError('Failed to add child to group');
          return;
        }
        
        // Refresh memberships to get the updated data
        await loadGroups(user!.id, children);
        
      } catch (err) {
        console.error('Error adding child to group:', err);
        setGroupManagementError('Failed to add child to group');
      }
    } else {
      // Deactivate child in group
      try {
        const { data, error } = await supabase.rpc('deactivate_child_in_group', {
          p_child_id: child.id,
          p_group_id: group.id
        });
        
        if (error) {
          console.error('Error deactivating child in group:', error);
          setGroupManagementError('Failed to remove child from group');
          return;
        }
        
        // Refresh memberships to get the updated data
        await loadGroups(user!.id, children);
        
      } catch (err) {
        console.error('Error removing child from group:', err);
        setGroupManagementError('Failed to remove child from group');
      }
    }
  }



  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  return (
    <div>
      <Header currentPage="dashboard" />
      
      <div className="p-6 max-w-7xl mx-auto bg-white min-h-screen">
        {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-6 py-3 font-medium transition-colors ${
            activeTab === 'profile'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Profile
        </button>
        <button
          onClick={() => setActiveTab('children')}
          className={`px-6 py-3 font-medium transition-colors ${
            activeTab === 'children'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Children
        </button>
        <button
          onClick={() => setActiveTab('groups')}
          className={`px-6 py-3 font-medium transition-colors ${
            activeTab === 'groups'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Groups
        </button>

      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Profile Information</h2>
          <div className="space-y-2">
            <div><strong>Name:</strong> {profile?.full_name || <span className="text-gray-400">(not set)</span>}</div>
            <div><strong>Email:</strong> {profile?.email || user?.email || <span className="text-gray-400">(not set)</span>}</div>
            <div><strong>Phone:</strong> {formatPhone(profile?.phone) || <span className="text-gray-400">(not set)</span>}</div>
          </div>
        </div>
      )}

      {/* Children Tab */}
      {activeTab === 'children' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Children</h2>
            <button
              onClick={() => setShowAddChild(!showAddChild)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-soft hover:shadow-medium"
            >
              {showAddChild ? "Cancel" : "Add Child"}
            </button>
          </div>

          {showAddChild && (
            <form onSubmit={handleAddChild} className="mb-6 p-4 bg-white rounded-lg border border-cyan-200">
              <h3 className="text-lg font-medium mb-4">Add New Child</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Child's Name</label>
                  <input
                    type="text"
                    value={childName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setChildName(e.target.value)}
                    className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter child's name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Birthdate</label>
                  <input
                    type="date"
                    value={childBirthdate}
                    onChange={(e) => setChildBirthdate(e.target.value)}
                    className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    max={new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>
              </div>
              {childError && <div className="text-red-600 mb-4">{childError}</div>}
              <button
                type="submit"
                disabled={addingChild}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 shadow-soft hover:shadow-medium"
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
                  <div key={child.id} className="border border-cyan-200 rounded-lg p-4 flex flex-col gap-2 bg-white">
                    {editingChildId === child.id ? (
                      <>
                        <input
                          type="text"
                          value={editChildName}
                          onChange={(e) => setEditChildName(e.target.value)}
                          className="px-3 py-2 border rounded mb-2"
                          placeholder="Child's name"
                          required
                        />
                        <input
                          type="date"
                          value={editChildBirthdate}
                          onChange={(e) => setEditChildBirthdate(e.target.value)}
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
      )}

      {/* Groups Tab */}
      {activeTab === 'groups' && (
        <div className="space-y-6">
          {/* Group Creation Section */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Create Groups</h2>
              <button
                onClick={() => setShowAddGroup(!showAddGroup)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
              >
                {showAddGroup ? "Cancel" : "Create Group"}
              </button>
            </div>

            {showAddGroup && (
              <form onSubmit={handleAddGroup} className="mb-6 p-4 bg-white rounded-lg border border-cyan-200">
                <h3 className="text-lg font-medium mb-4">Create New Group</h3>
                <div className="space-y-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Group Type</label>
                    <select
                      value={groupType}
                      onChange={(e) => setGroupType(e.target.value as 'care' | 'event')}
                      className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="care">Care Group (Network members only)</option>
                      <option value="event">Event Group (Can include external attendees)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Group Name</label>
                    <input
                      type="text"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Enter group name"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Description (Optional)</label>
                    <textarea
                      value={groupDescription}
                      onChange={(e) => setGroupDescription(e.target.value)}
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
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {addingGroup ? "Creating..." : "Create Group"}
                </button>
              </form>
            )}

            {/* Groups List */}
            {groups.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No groups created yet.</p>
                <p className="text-sm">Click "Create Group" to get started.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {groups.map((group) => (
                  <div key={group.id} className="border border-cyan-200 rounded p-4 flex flex-col gap-2 bg-white">
                    {editingGroupId === group.id ? (
                      <>
                        <select
                          value={editGroupType}
                          onChange={(e) => setEditGroupType(e.target.value as 'care' | 'event')}
                          className="px-3 py-2 border rounded mb-2"
                        >
                          <option value="care">Care Group (Network members only)</option>
                          <option value="event">Event Group (Can include external attendees)</option>
                        </select>
                        <input
                          type="text"
                          value={editGroupName}
                          onChange={(e) => setEditGroupName(e.target.value)}
                          className="px-3 py-2 border rounded mb-2"
                          placeholder="Group name"
                          required
                        />
                        <textarea
                          value={editGroupDescription}
                          onChange={(e) => setEditGroupDescription(e.target.value)}
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
                          <span className={`px-2 py-1 text-xs rounded ${
                            group.group_type === 'care' 
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-purple-100 text-purple-800'
                          }`}>
                            {group.group_type === 'care' ? 'Care Group' : 'Event Group'}
                          </span>
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
                          <form onSubmit={(e) => handleSubmitInvite(e, group)} className="mt-2 p-3 bg-white rounded border border-cyan-200">
                            <div className="mb-2">
                              <label className="block text-sm font-medium mb-1">Parent Email</label>
                              <input
                                type="email"
                                value={inviteEmail}
                                onChange={(e) => setInviteEmail(e.target.value)}
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

          {/* Group Management Section */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Manage Group Memberships</h2>
            {groupManagementError && <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">{groupManagementError}</div>}
            
            {groups.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No groups available.</p>
                <p className="text-sm">Create a group first to manage memberships.</p>
              </div>
            ) : (
              <div className="space-y-8">
                {groups.map((group) => {
                  const allChildrenInGroup = allChildrenInGroups[group.id] || [];
                  const myChildren = allChildrenInGroup.filter(child => child.parent_id === user?.id);
                  const otherChildren = allChildrenInGroup.filter(child => child.parent_id !== user?.id);
                  const isCreator = isGroupCreator(group);
                  
                  return (
                    <div key={group.id} className="border border-cyan-200 rounded p-6 bg-white">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold">{group.name}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          isCreator 
                            ? 'bg-purple-100 text-purple-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {isCreator ? 'Creator' : 'Member'}
                        </span>
                      </div>
                      {group.description && <p className="text-gray-600 mb-4">{group.description}</p>}
                      
                      {/* All Children in Group */}
                      <div className="mb-6">
                        <h4 className="font-medium mb-3">All Children in this Group:</h4>
                        {allChildrenInGroup.length === 0 ? (
                          <div className="text-gray-500">No children are currently in this group.</div>
                        ) : (
                          <div className="space-y-2">
                            {allChildrenInGroup.map((child) => {
                              const isMyChild = child.parent_id === user?.id;
                              return (
                                <div key={child.id} className={`flex items-center justify-between p-2 rounded-lg ${
                                  isMyChild ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 border border-gray-200'
                                }`}>
                                  <div className="flex items-center">
                                    <span className="font-medium">{child.full_name}</span>
                                    {child.birthdate && (
                                      <span className="text-sm text-gray-500 ml-2">
                                        (Age: {calculateAge(child.birthdate)})
                                      </span>
                                    )}
                                    {isMyChild && (
                                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded ml-2">My Child</span>
                                    )}
                                  </div>
                                  <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                                    Member
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Manage My Children Section */}
                      {children.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-4">Manage My Children:</h4>
                          <div className="space-y-3">
                            {children.map((child) => {
                              const isMember = isChildInGroup(child.id, group.id);
                              return (
                                <div key={child.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                                  <div>
                                    <span className="font-medium">{child.full_name}</span>
                                    {child.birthdate && (
                                      <span className="text-sm text-gray-500 ml-2">
                                        (Age: {calculateAge(child.birthdate)})
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => handleToggle(child, group)}
                                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                      isMember 
                                        ? 'bg-red-600 text-white hover:bg-red-700' 
                                        : 'bg-green-600 text-white hover:bg-green-700'
                                    }`}
                                  >
                                    {isMember ? 'Remove' : 'Add'}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {children.length === 0 && (
                        <div className="text-gray-500">
                          No children added yet. Add children from the Children tab first.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  );
} 