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

export default function ClientDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

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
        setLoading(false);
      }
    });
  }, [router]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  return (
    <div>
      <div className="flex justify-end p-4"><LogoutButton /></div>
      <h1>Welcome to your Dashboard!</h1>
      <div className="mb-4">
        <strong>Name:</strong> {profile?.full_name || <span className="text-gray-400">(not set)</span>}<br />
        <strong>Email:</strong> {profile?.email || user?.email || <span className="text-gray-400">(not set)</span>}<br />
        <strong>Phone:</strong> {profile?.phone || <span className="text-gray-400">(not set)</span>}
      </div>
      <div style={{ color: 'red', fontWeight: 'bold' }}>TEST ELEMENT</div>
      {/* Add wallet, calendar, requests, etc. */}
    </div>
  );
} 