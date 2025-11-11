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
  school_name?: string | null;
  grade?: string | null;
  town?: string | null;
  zip_code?: string | null;
  parent_id: string;
  created_at: string;
}

interface Pet {
  id: string;
  name: string;
  species: string | null;
  breed: string | null;
  age: number | null;
  birthdate: string | null;
  special_needs: string | null;
  notes: string | null;
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
  const [activeTab, setActiveTab] = useState<'children' | 'pets'>('children');
  const [children, setChildren] = useState<Child[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteNote, setInviteNote] = useState("");
  const [inviteError, setInviteError] = useState("");

  // Pet form state
  const [showAddPet, setShowAddPet] = useState(false);
  const [petName, setPetName] = useState("");
  const [petSpecies, setPetSpecies] = useState("");
  const [petBreed, setPetBreed] = useState("");
  const [petAge, setPetAge] = useState("");
  const [petBirthdate, setPetBirthdate] = useState("");
  const [petSpecialNeeds, setPetSpecialNeeds] = useState("");
  const [petNotes, setPetNotes] = useState("");
  const [addingPet, setAddingPet] = useState(false);
  const [petError, setPetError] = useState("");

  // Profile edit state
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editFullName, setEditFullName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");

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
        // Fetch pets
        const { data: petsData } = await supabase
          .from("pets")
          .select("*")
          .eq("parent_id", data.user.id)
          .order("created_at", { ascending: false });
        setPets(petsData || []);
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

  async function handleAddPet(e: React.FormEvent) {
    e.preventDefault();
    setPetError("");

    if (!petName.trim()) {
      setPetError("Pet name is required");
      return;
    }

    setAddingPet(true);

    try {
      const { data, error } = await supabase
        .from("pets")
        .insert([
          {
            parent_id: user?.id,
            name: petName.trim(),
            species: petSpecies.trim() || null,
            breed: petBreed.trim() || null,
            age: petAge ? parseInt(petAge) : null,
            birthdate: petBirthdate || null,
            special_needs: petSpecialNeeds.trim() || null,
            notes: petNotes.trim() || null,
          },
        ])
        .select();

      if (error) throw error;

      if (data) {
        setPets([...pets, data[0]]);
        // Reset form
        setPetName("");
        setPetSpecies("");
        setPetBreed("");
        setPetAge("");
        setPetBirthdate("");
        setPetSpecialNeeds("");
        setPetNotes("");
        setShowAddPet(false);
      }
    } catch (error: any) {
      setPetError(error.message || "Failed to add pet");
    } finally {
      setAddingPet(false);
    }
  }

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileError("");

    if (!editFullName.trim()) {
      setProfileError("Name is required");
      return;
    }

    setUpdatingProfile(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: editFullName.trim(),
          phone: editPhone.trim() || null,
        })
        .eq("id", user?.id);

      if (error) throw error;

      // Update local profile state
      setProfile({
        ...profile,
        full_name: editFullName.trim(),
        phone: editPhone.trim() || null,
      } as Profile);

      setShowEditProfile(false);
      setProfileError("");
    } catch (error: any) {
      setProfileError(error.message || "Failed to update profile");
    } finally {
      setUpdatingProfile(false);
    }
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
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Profile Information</h2>
          <button
            onClick={() => {
              setEditFullName(profile?.full_name || "");
              setEditPhone(profile?.phone || "");
              setShowEditProfile(!showEditProfile);
              setProfileError("");
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            {showEditProfile ? "Cancel" : "Edit Profile"}
          </button>
        </div>

        {showEditProfile ? (
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Full Name *</label>
              <input
                type="text"
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your full name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                value={profile?.email || user?.email || ""}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                title="Email cannot be changed"
              />
              <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <input
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="(555) 555-5555"
              />
            </div>
            {profileError && (
              <p className="text-red-600 text-sm">{profileError}</p>
            )}
            <button
              type="submit"
              disabled={updatingProfile}
              className={`w-full px-4 py-2 rounded-lg transition ${
                updatingProfile
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-green-600 hover:bg-green-700 text-white"
              }`}
            >
              {updatingProfile ? "Updating..." : "Save Changes"}
            </button>
          </form>
        ) : (
          <div className="space-y-2">
            <div><strong>Name:</strong> {profile?.full_name || <span className="text-gray-400">(not set)</span>}</div>
            <div><strong>Email:</strong> {profile?.email || user?.email || <span className="text-gray-400">(not set)</span>}</div>
            <div><strong>Phone:</strong> {formatPhone(profile?.phone) || <span className="text-gray-400">(not set)</span>}</div>
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          {/* Tab Headers */}
          <div className="flex border-b border-gray-200 mb-4">
            <button
              onClick={() => setActiveTab('children')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'children'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Children
            </button>
            <button
              onClick={() => setActiveTab('pets')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'pets'
                  ? 'border-b-2 border-purple-500 text-purple-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Pets
            </button>
          </div>

          {/* Children Tab Content */}
          {activeTab === 'children' && (
            <>
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
                        {child.school_name && <p className="text-gray-600">School: {child.school_name}</p>}
                        {child.grade && <p className="text-gray-600">Grade: {child.grade}</p>}
                        {child.town && <p className="text-gray-600">Town: {child.town}</p>}
                        {child.zip_code && <p className="text-gray-600">Zip Code: {child.zip_code}</p>}
                        <p className="text-xs text-gray-400 mt-2">Added: {new Date(child.created_at).toLocaleDateString()}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* Pets Tab Content */}
          {activeTab === 'pets' && (
            <>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Pets</h2>
                <button
                  onClick={() => setShowAddPet(!showAddPet)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                >
                  {showAddPet ? "Cancel" : "Add Pet"}
                </button>
              </div>

              {showAddPet && (
                <form onSubmit={handleAddPet} className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <h3 className="text-lg font-medium mb-4">Add New Pet</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Pet Name *</label>
                      <input
                        type="text"
                        value={petName}
                        onChange={(e) => setPetName(e.target.value)}
                        className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="Enter pet's name"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Species</label>
                      <input
                        type="text"
                        value={petSpecies}
                        onChange={(e) => setPetSpecies(e.target.value)}
                        className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="Dog, Cat, Bird, etc."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Breed</label>
                      <input
                        type="text"
                        value={petBreed}
                        onChange={(e) => setPetBreed(e.target.value)}
                        className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="Enter breed"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Age (years)</label>
                      <input
                        type="number"
                        value={petAge}
                        onChange={(e) => setPetAge(e.target.value)}
                        className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="Age in years"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Birthdate</label>
                      <input
                        type="date"
                        value={petBirthdate}
                        onChange={(e) => setPetBirthdate(e.target.value)}
                        className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        max={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Special Needs</label>
                      <input
                        type="text"
                        value={petSpecialNeeds}
                        onChange={(e) => setPetSpecialNeeds(e.target.value)}
                        className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="Medications, allergies, etc."
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-1">Notes</label>
                      <textarea
                        value={petNotes}
                        onChange={(e) => setPetNotes(e.target.value)}
                        className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="Additional notes about your pet"
                        rows={3}
                      />
                    </div>
                  </div>
                  {petError && <div className="text-red-600 mb-4">{petError}</div>}
                  <button
                    type="submit"
                    disabled={addingPet}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
                  >
                    {addingPet ? "Adding..." : "Add Pet"}
                  </button>
                </form>
              )}

              {pets.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No pets added yet.</p>
                  <p className="text-sm">Click "Add Pet" to get started.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pets.map((pet) => {
                    const age = pet.age || (pet.birthdate ? calculateAge(pet.birthdate) : null);
                    return (
                      <div key={pet.id} className="border rounded p-4 flex flex-col gap-2 bg-purple-50">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-lg">{pet.name}</span>
                          {pet.species && (
                            <span className="text-xs bg-purple-200 text-purple-800 px-2 py-1 rounded">
                              {pet.species}
                            </span>
                          )}
                        </div>
                        {age && <p className="text-gray-600">Age: {age} years old</p>}
                        {pet.breed && <p className="text-gray-600">Breed: {pet.breed}</p>}
                        {pet.birthdate && <p className="text-gray-600">Birthday: {formatBirthdate(pet.birthdate)}</p>}
                        {pet.special_needs && <p className="text-gray-600">Special Needs: {pet.special_needs}</p>}
                        {pet.notes && <p className="text-gray-600 text-sm">Notes: {pet.notes}</p>}
                        <p className="text-xs text-gray-400 mt-2">Added: {new Date(pet.created_at).toLocaleDateString()}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
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