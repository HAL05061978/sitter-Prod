"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import Header from "../components/Header";
import LogoutButton from "../components/LogoutButton";
import type { User } from "@supabase/supabase-js";

export default function ActivitiesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace("/auth");
      } else {
        setUser(data.user);
        setLoading(false);
      }
    });
  }, [router]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  return (
    <div>
      <Header currentPage="activities" />
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Activities</h2>
        <p className="text-gray-600">Activities functionality coming soon...</p>
        </div>
      </div>
    </div>
  );
} 