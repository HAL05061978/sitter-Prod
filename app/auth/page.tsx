"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../lib/supabase";
import { rememberedUsersService, RememberedUser } from "../../lib/remembered-users";

export default function AuthPage() {
  const router = useRouter();
  const [rememberedUsers, setRememberedUsers] = useState<RememberedUser[]>([]);
  const [showRememberedUsers, setShowRememberedUsers] = useState(true);
  const [selectedUser, setSelectedUser] = useState<RememberedUser | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Load remembered users on mount
  useEffect(() => {
    const users = rememberedUsersService.getUsers();
    setRememberedUsers(users);
  }, []);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session) {
        try {
          // Check if this is a new user with pending signup data
          const userMetadata = session.user.user_metadata;
          const pendingProfile = userMetadata?.pending_profile;
          const pendingChildren = userMetadata?.pending_children;
          const pendingPets = userMetadata?.pending_pets;

          // First, check if profile exists
          const { data: existingProfile, error: profileCheckError } = await supabase
            .from("profiles")
            .select("id, role, full_name, profile_photo_url, email")
            .eq("id", session.user.id)
            .single();

          // If profile doesn't exist and we have pending data, create it
          if (profileCheckError?.code === 'PGRST116' && pendingProfile) {
            console.log("Creating profile from pending signup data...");

            // Create the profile
            const { error: createProfileError } = await supabase
              .from("profiles")
              .insert({
                id: session.user.id,
                ...pendingProfile
              });

            if (createProfileError) {
              console.error("Error creating profile:", createProfileError);
            } else {
              console.log("Profile created successfully");
            }

            // Create children if any
            if (pendingChildren && pendingChildren.length > 0) {
              for (const child of pendingChildren) {
                const { error: childError } = await supabase
                  .from("children")
                  .insert({
                    full_name: child.name,
                    birthdate: child.birthdate || null,
                    school_name: child.schoolName || null,
                    grade: child.grade || null,
                    town: child.town || null,
                    zip_code: child.zipCode || null,
                    parent_id: session.user.id
                  });

                if (childError) {
                  console.error("Error creating child:", childError);
                }
              }
              console.log(`Created ${pendingChildren.length} children`);
            }

            // Create pets if any
            if (pendingPets && pendingPets.length > 0) {
              for (const pet of pendingPets) {
                const { error: petError } = await supabase
                  .from("pets")
                  .insert({
                    name: pet.name,
                    species: pet.species || null,
                    breed: pet.breed || null,
                    birthdate: pet.birthdate || null,
                    special_needs: pet.specialNeeds || null,
                    notes: pet.notes || null,
                    parent_id: session.user.id
                  });

                if (petError) {
                  console.error("Error creating pet:", petError);
                }
              }
              console.log(`Created ${pendingPets.length} pets`);
            }

            // Clear the pending data from user metadata
            await supabase.auth.updateUser({
              data: {
                pending_profile: null,
                pending_children: null,
                pending_pets: null
              }
            });

            // Save to remembered users with the new data
            rememberedUsersService.addUser({
              id: session.user.id,
              email: session.user.email || pendingProfile.email || "",
              fullName: pendingProfile.full_name || "User",
              profilePhotoUrl: undefined,
              lastLoginAt: new Date().toISOString()
            });

            // Redirect to dashboard
            router.replace("/dashboard");
            return;
          }

          // Existing user - normal flow
          if (existingProfile) {
            // Save to remembered users
            rememberedUsersService.addUser({
              id: session.user.id,
              email: session.user.email || existingProfile.email || "",
              fullName: existingProfile.full_name || "User",
              profilePhotoUrl: existingProfile.profile_photo_url || undefined,
              lastLoginAt: new Date().toISOString()
            });

            // Redirect based on role
            if (existingProfile.role === "tutor") {
              router.replace("/tutor-dashboard");
            } else {
              router.replace("/dashboard");
            }
          } else {
            // No profile found and no pending data - redirect to dashboard anyway
            router.replace("/dashboard");
          }
        } catch (error) {
          console.error("Error during sign in:", error);
          router.replace("/dashboard");
        }
      }
    });
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, [router]);

  // Handle selecting a remembered user
  const handleSelectUser = (user: RememberedUser) => {
    setSelectedUser(user);
    setEmail(user.email);
    setShowRememberedUsers(false);
    setError("");
  };

  // Handle signing in
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password
      });

      if (error) {
        setError(error.message);
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during sign in");
    } finally {
      setLoading(false);
    }
  };

  // Handle removing a remembered user
  const handleRemoveUser = (e: React.MouseEvent, userId: string) => {
    e.stopPropagation();
    rememberedUsersService.removeUser(userId);
    setRememberedUsers(rememberedUsersService.getUsers());
  };

  // Handle using a different account
  const handleUseDifferentAccount = () => {
    setSelectedUser(null);
    setEmail("");
    setPassword("");
    setShowRememberedUsers(false);
    setError("");
  };

  // Handle going back to remembered users list
  const handleBackToUsers = () => {
    setSelectedUser(null);
    setEmail("");
    setPassword("");
    setShowRememberedUsers(true);
    setError("");
  };

  // Get initials for avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-center text-gray-900 mb-6">
          Welcome Back
        </h1>

        {/* Remembered Users List */}
        {rememberedUsers.length > 0 && showRememberedUsers && !selectedUser && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-4">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Choose an account</h2>
            <div className="space-y-3">
              {rememberedUsers.map((user) => (
                <div
                  key={user.id}
                  onClick={() => handleSelectUser(user)}
                  className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition"
                >
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    {user.profilePhotoUrl ? (
                      <img
                        src={user.profilePhotoUrl}
                        alt={user.fullName}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-indigo-500 flex items-center justify-center text-white font-medium">
                        {getInitials(user.fullName)}
                      </div>
                    )}
                  </div>

                  {/* User Info */}
                  <div className="ml-3 flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {user.fullName}
                    </p>
                    <p className="text-sm text-gray-500 truncate">
                      {user.email}
                    </p>
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={(e) => handleRemoveUser(e, user.id)}
                    className="ml-2 p-1 text-gray-400 hover:text-red-500"
                    title="Remove from list"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={handleUseDifferentAccount}
              className="mt-4 w-full py-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Use a different account
            </button>
          </div>
        )}

        {/* Sign In Form */}
        {(!showRememberedUsers || rememberedUsers.length === 0 || selectedUser) && (
          <div className="bg-white rounded-lg shadow-md p-6">
            {/* Selected User Header */}
            {selectedUser && (
              <div className="flex items-center mb-6 pb-4 border-b">
                {selectedUser.profilePhotoUrl ? (
                  <img
                    src={selectedUser.profilePhotoUrl}
                    alt={selectedUser.fullName}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-medium text-sm">
                    {getInitials(selectedUser.fullName)}
                  </div>
                )}
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900">{selectedUser.fullName}</p>
                  <p className="text-xs text-gray-500">{selectedUser.email}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSignIn} className="space-y-4">
              {/* Email field - only show if no selected user */}
              {!selectedUser && (
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email Address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="username email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-base"
                  />
                </div>
              )}

              {/* Password field */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-base"
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="rounded-md bg-red-50 p-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Sign In Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-indigo-600 text-white font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>

            {/* Back to users / Different account */}
            {selectedUser && rememberedUsers.length > 1 && (
              <button
                onClick={handleBackToUsers}
                className="mt-4 w-full py-2 text-sm text-gray-600 hover:text-gray-700"
              >
                Switch account
              </button>
            )}

            {!selectedUser && rememberedUsers.length > 0 && (
              <button
                onClick={handleBackToUsers}
                className="mt-4 w-full py-2 text-sm text-gray-600 hover:text-gray-700"
              >
                Back to saved accounts
              </button>
            )}
          </div>
        )}

        {/* Sign Up Link */}
        <div className="mt-6 text-center text-sm text-gray-600">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-indigo-600 hover:text-indigo-500 font-medium">
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}
