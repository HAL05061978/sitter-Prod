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

interface Child {
  id: string;
  full_name: string;
  birthdate: string | null;
  parent_id: string;
}

interface ChildGroupMember {
  id: string;
  child_id: string;
  group_id: string;
  active: boolean;
}

export default function GroupsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [parentChildren, setParentChildren] = useState<Child[]>([]);
  const [memberships, setMemberships] = useState<ChildGroupMember[]>([]);
  const [allActiveChildren, setAllActiveChildren] = useState<Record<string, Child[]>>({}); // groupId -> all active children
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.replace("/auth");
      } else {
        setUser(data.user);
        
        // 1. Fetch groups created by this parent
        const { data: createdGroups } = await supabase
          .from("groups")
          .select("*")
          .eq("created_by", data.user.id)
          .order("created_at", { ascending: false });

        // 2. Fetch groups where this parent is a member (through invites)
        const { data: memberGroups } = await supabase
          .from("group_members")
          .select("group_id, status")
          .eq("profile_id", data.user.id)
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

        // 4. Fetch parent's children
        const { data: childrenData } = await supabase
          .from("children")
          .select("*")
          .eq("parent_id", data.user.id)
          .order("created_at", { ascending: false });
        setParentChildren(childrenData || []);

        // 5. Fetch all child-group memberships for parent's children
        if (childrenData && childrenData.length > 0) {
          const childIds = childrenData.map(child => child.id);
          const { data: membershipsData } = await supabase
            .from("child_group_members")
            .select("*")
            .in("child_id", childIds);
          setMemberships(membershipsData || []);
        }

        // 6. Fetch all active children for each group (including other parents' children)
        if (uniqueGroups && uniqueGroups.length > 0) {
          const groupIds = uniqueGroups.map(group => group.id);
          const { data: allActiveMemberships } = await supabase
            .from("child_group_members")
            .select("*")
            .in("group_id", groupIds)
            .eq("active", true);
          
          if (allActiveMemberships && allActiveMemberships.length > 0) {
            const allChildIds = Array.from(new Set(allActiveMemberships.map(m => m.child_id)));
            const { data: allChildrenData } = await supabase
              .from("children")
              .select("*")
              .in("id", allChildIds);
            
            if (allChildrenData) {
              const activeChildrenMap: Record<string, Child[]> = {};
              uniqueGroups.forEach(group => {
                const groupMemberships = allActiveMemberships.filter(m => m.group_id === group.id);
                activeChildrenMap[group.id] = groupMemberships
                  .map(membership => allChildrenData.find(child => child.id === membership.child_id))
                  .filter(Boolean) as Child[];
              });
              setAllActiveChildren(activeChildrenMap);
            }
          }
        }

        setLoading(false);
      }
    });
  }, [router]);

  // Helper to check if a child is active in a group
  function isChildActiveInGroup(childId: string, groupId: string) {
    return memberships.find(
      (m) => m.child_id === childId && m.group_id === groupId && m.active
    );
  }

  // Check if user is the creator of a group
  function isGroupCreator(group: Group) {
    return group.created_by === user?.id;
  }

  // Toggle child membership in group (only for parent's own children)
  async function handleToggle(child: Child, group: Group) {
    setError("");
    const membership = memberships.find(
      (m) => m.child_id === child.id && m.group_id === group.id
    );

    if (!membership) {
      // Add new membership (activate)
      const { data, error } = await supabase
        .from("child_group_members")
        .insert([
          { child_id: child.id, group_id: group.id, active: true },
        ])
        .select();
      
      if (error) {
        setError(error.message);
        return;
      }
      
      if (data && data.length > 0) {
        setMemberships([...memberships, data[0]]);
        // Update the allActiveChildren state
        setAllActiveChildren(prev => ({
          ...prev,
          [group.id]: [...(prev[group.id] || []), child]
        }));
      }
    } else {
      // Toggle active flag
      const { data, error } = await supabase
        .from("child_group_members")
        .update({ active: !membership.active })
        .eq("id", membership.id)
        .select();
      
      if (error) {
        setError(error.message);
        return;
      }
      
      if (data && data.length > 0) {
        setMemberships(memberships.map((m) =>
          m.id === membership.id ? { ...m, active: !membership.active } : m
        ));
        
        // Update the allActiveChildren state
        setAllActiveChildren(prev => {
          const currentActive = prev[group.id] || [];
          if (!membership.active) {
            // Activating - add to active list
            return {
              ...prev,
              [group.id]: [...currentActive, child]
            };
          } else {
            // Deactivating - remove from active list
            return {
              ...prev,
              [group.id]: currentActive.filter(c => c.id !== child.id)
            };
          }
        });
      }
    }
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">My Groups</h1>
        <LogoutButton />
      </div>
      
      {/* Navigation Buttons */}
      <div className="flex flex-wrap gap-4 mb-8">
        <button onClick={() => router.push('/dashboard')} className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium">Profile</button>
        <button onClick={() => router.push('/messages')} className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium">Messages</button>
        <button onClick={() => router.push('/schedule')} className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium">Schedule</button>
        <button className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition font-medium">Groups</button>
        <button onClick={() => router.push('/activities')} className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium">Activities</button>
      </div>

      {error && <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">{error}</div>}

      <div className="space-y-8">
        {groups.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No groups available.</p>
            <p className="text-sm">Create a group from your dashboard or wait for an invite.</p>
          </div>
        ) : (
          groups.map((group) => {
            const allActiveInGroup = allActiveChildren[group.id] || [];
            const myActiveChildren = allActiveInGroup.filter(child => child.parent_id === user?.id);
            const otherActiveChildren = allActiveInGroup.filter(child => child.parent_id !== user?.id);
            const isCreator = isGroupCreator(group);
            
            return (
              <div key={group.id} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xl font-semibold">{group.name}</h2>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    isCreator 
                      ? 'bg-purple-100 text-purple-800' 
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {isCreator ? 'Creator' : 'Member'}
                  </span>
                </div>
                {group.description && <p className="text-gray-600 mb-4">{group.description}</p>}
                
                {/* All Active Children in Group */}
                <div className="mb-6">
                  <h3 className="font-medium mb-3 text-lg">All Active Children in this Group:</h3>
                  {allActiveInGroup.length === 0 ? (
                    <div className="text-gray-500">No children are currently active in this group.</div>
                  ) : (
                    <div className="space-y-2">
                      {allActiveInGroup.map((child) => {
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
                              Active
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Manage My Children Section */}
                {parentChildren.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-4 text-lg">Manage My Children:</h3>
                    <div className="space-y-3">
                      {parentChildren.map((child) => {
                        const active = isChildActiveInGroup(child.id, group.id);
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
                                active 
                                  ? 'bg-green-600 text-white hover:bg-green-700' 
                                  : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                              }`}
                            >
                              {active ? 'Active' : 'Inactive'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {parentChildren.length === 0 && (
                  <div className="text-gray-500">
                    No children added yet. Add children from your dashboard first.
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// Helper function to calculate age
function calculateAge(birthdate: string): number {
  const today = new Date();
  const birth = new Date(birthdate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age;
} 