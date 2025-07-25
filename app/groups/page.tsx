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
  const [parentChildren, setParentChildren] = useState<Child[]>([]); // Only parent's children
  const [groupActiveChildren, setGroupActiveChildren] = useState<Record<string, Child[]>>({}); // groupId -> active children[] (all parents)
  const [memberships, setMemberships] = useState<ChildGroupMember[]>([]); // All memberships for parent's children
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.replace("/auth");
      } else {
        setUser(data.user);
        // 1. Get all groups the parent is a member of
        const { data: memberships } = await supabase
          .from('group_members')
          .select('group_id')
          .eq('profile_id', data.user.id)
          .eq('status', 'active');
        const groupIds = (memberships || []).map((m: any) => m.group_id);
        // 2. Fetch all groups where user is creator or member
        let groupsData: Group[] = [];
        if (groupIds.length > 0) {
          const { data: allGroups } = await supabase
            .from('groups')
            .select('*')
            .or(`created_by.eq.${data.user.id},id.in.(${groupIds.join(',')})`)
            .order('created_at', { ascending: false });
          groupsData = allGroups || [];
        } else {
          const { data: createdGroups } = await supabase
            .from('groups')
            .select('*')
            .eq('created_by', data.user.id)
            .order('created_at', { ascending: false });
          groupsData = createdGroups || [];
        }
        // Deduplicate
        const uniqueGroups = groupsData.filter((g, i, arr) => arr.findIndex(x => x.id === g.id) === i);
        setGroups(uniqueGroups);
        // 3. For all visible groups, fetch all active child-group memberships
        let groupActiveChildrenMap: Record<string, Child[]> = {};
        let allChildIds: string[] = [];
        let membershipsData: any[] = [];
        if (uniqueGroups.length > 0) {
          const { data: membershipsRaw, error: membershipsError } = await supabase
            .from("child_group_members")
            .select("*")
            .in("group_id", uniqueGroups.map(g => g.id))
            .eq("active", true);
          if (membershipsError) {
            setError(membershipsError.message);
            setLoading(false);
            return;
          }
          membershipsData = membershipsRaw || [];
          allChildIds = Array.from(new Set(membershipsData.map((m: any) => m.child_id)));
        }
        // 4. Fetch all children for those child_ids (to get parent_id)
        let allChildren: Child[] = [];
        if (allChildIds.length > 0) {
          const { data: allChildrenData, error: childrenError } = await supabase
            .from("children")
            .select("*")
            .in("id", allChildIds);
          if (childrenError) {
            setError(childrenError.message);
            setLoading(false);
            return;
          }
          allChildren = allChildrenData || [];
        }
        // 5. Map groupId -> children[]
        for (const group of uniqueGroups) {
          const groupMemberships = membershipsData.filter((m: any) => m.group_id === group.id);
          groupActiveChildrenMap[group.id] = groupMemberships
            .map((m: any) => allChildren.find((c) => c.id === m.child_id))
            .filter(Boolean) as Child[];
        }
        setGroupActiveChildren(groupActiveChildrenMap);
        // 6. Set parent's children for button logic
        const parentChildren = allChildren.filter((c) => c.parent_id === data.user.id);
        setParentChildren(parentChildren);
        // 7. Fetch all memberships for parent's children (for toggle logic)
        const parentChildIds = parentChildren.map((c: Child) => c.id);
        let parentMemberships: ChildGroupMember[] = [];
        if (parentChildIds.length > 0) {
          const { data: membershipsRaw } = await supabase
            .from("child_group_members")
            .select("*")
            .in("child_id", parentChildIds);
          parentMemberships = membershipsRaw || [];
        }
        setMemberships(parentMemberships);
        setLoading(false);
      }
    });
  }, [router]);

  // Helper to check if a parent's child is active in a group
  function isChildActiveInGroup(childId: string, groupId: string) {
    return memberships.find(
      (m) => m.child_id === childId && m.group_id === groupId && m.active
    );
  }

  // Toggle child membership in group (only for parent's children)
  async function handleToggle(child: Child, group: Group) {
    setError("");
    const membership = memberships.find(
      (m) => m.child_id === child.id && m.group_id === group.id
    );
    let newMemberships = [...memberships];
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
        newMemberships.push(data[0]);
        setMemberships(newMemberships);
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
        newMemberships = newMemberships.map((m) =>
          m.id === membership.id ? { ...m, active: !membership.active } : m
        );
        setMemberships(newMemberships);
      }
    }
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Groups</h1>
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
      {error && <div className="mb-4 text-red-600">{error}</div>}
      <div className="space-y-8">
        {groups.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No groups created yet.</p>
            <p className="text-sm">Create a group from your dashboard to get started.</p>
          </div>
        ) : (
          groups.map((group) => {
            // Deduplicate children by id for this group
            const uniqueChildren = Array.from(
              new Map(
                (groupActiveChildren[group.id] || []).map(child => [child.id, child])
              ).values()
            );
            // 1. Parent's children (all, regardless of active status)
            const parentChildIds = parentChildren.map((c) => c.id);
            // 2. Other active children (exclude parent's children)
            const otherActiveChildren = uniqueChildren.filter(
              (child) => !parentChildIds.includes(child.id)
            );
            return (
              <div key={group.id} className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-2">{group.name}</h2>
                {group.description && <p className="text-gray-600 mb-4">{group.description}</p>}
                <h3 className="font-medium mb-2">Children in this Group:</h3>
                <div className="space-y-2">
                  {/* Parent's children (with button) */}
                  {parentChildren.map((child) => {
                    const active = isChildActiveInGroup(child.id, group.id);
                    return (
                      <div key={child.id} className="flex items-center gap-3">
                        <span className="w-40">{child.full_name}</span>
                        <button
                          onClick={() => handleToggle(child, group)}
                          className={`px-3 py-1 rounded text-white font-medium transition ${active ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-400 hover:bg-gray-500'}`}
                        >
                          {active ? 'Active' : 'Inactive'}
                        </button>
                      </div>
                    );
                  })}
                  {/* Other parents' active children (read-only) */}
                  {otherActiveChildren.map((child) => (
                    <div key={child.id} className="flex items-center gap-3 opacity-70">
                      <span className="w-40">{child.full_name}</span>
                      <span className="px-3 py-1 rounded bg-green-100 text-green-800 font-medium">Active</span>
                    </div>
                  ))}
                  {/* If no children at all */}
                  {parentChildren.length === 0 && otherActiveChildren.length === 0 && (
                    <div className="text-gray-500">No children in this group.</div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
} 