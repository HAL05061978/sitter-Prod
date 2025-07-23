"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import LogoutButton from "../components/LogoutButton";
import type { User } from "@supabase/supabase-js";

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
  const [groups, setGroups] = useState<Group[]>([]);
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

    const { error } = await supabase.from("groups").insert([
      {
        name: groupName.trim(),
        description: groupDescription.trim() || null,
        created_by: user.id,
      },
    ]);

    setAddingGroup(false);
    if (error) {
      setGroupError(error.message);
    } else {
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
    }
  };

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
            <h2 className="text-xl font-semibold">Your Children</h2>
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
                    onChange={(e) => setChildName((e as React.ChangeEvent<HTMLInputElement>).target.value)}
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
                    onChange={(e) => setChildBirthdate((e as React.ChangeEvent<HTMLInputElement>).target.value)}
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
            <div className="space-y-3">
              {children.map((child) => {
                const age = calculateAge(child.birthdate);
                return (
                  <div key={child.id} className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-medium text-lg">{child.full_name}</h3>
                    <p className="text-gray-600">
                      Age: {age !== null ? `${age} years old` : "Unknown"}
                    </p>
                    <p className="text-gray-600">
                      Birthday: {formatBirthdate(child.birthdate)}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                      Added: {new Date(child.created_at).toLocaleDateString()}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Groups Section */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Your Groups</h2>
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
                    onChange={(e) => setGroupName((e as React.ChangeEvent<HTMLInputElement>).target.value)}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Enter group name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description (Optional)</label>
                  <textarea
                    value={groupDescription}
                    onChange={(e) => setGroupDescription((e as React.ChangeEvent<HTMLTextAreaElement>).target.value)}
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

          {groups.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No groups created yet.</p>
              <p className="text-sm">Click "Create Group" to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {groups.map((group) => (
                <div key={group.id} className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium text-lg">{group.name}</h3>
                  {group.description && (
                    <p className="text-gray-600 mt-1">{group.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-2">
                    Created: {new Date(group.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 