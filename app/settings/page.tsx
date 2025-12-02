"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import Header from "../components/Header";
import NotificationSettingsPanel from "../../components/NotificationSettings";
import { rememberedUsersService } from "../../lib/remembered-users";

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

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

  const handleClearRememberedUsers = () => {
    if (confirm("This will remove all saved accounts from the login screen. Continue?")) {
      rememberedUsersService.clearAll();
      alert("Saved accounts cleared successfully.");
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Header currentPage="settings">
      <div className="p-4 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

        {/* Notification Settings */}
        <div className="mb-6">
          <NotificationSettingsPanel />
        </div>

        {/* Account Settings */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Account</h2>

          <div className="space-y-4">
            {/* Clear Remembered Users */}
            <div className="flex items-center justify-between py-3 border-b">
              <div>
                <p className="font-medium text-gray-900">Clear saved accounts</p>
                <p className="text-sm text-gray-500">Remove all remembered accounts from login</p>
              </div>
              <button
                onClick={handleClearRememberedUsers}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Clear
              </button>
            </div>

            {/* Sign Out */}
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-gray-900">Sign out</p>
                <p className="text-sm text-gray-500">Sign out of your account</p>
              </div>
              <button
                onClick={handleSignOut}
                className="px-4 py-2 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>

        {/* App Info */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">About</h2>

          <div className="space-y-2 text-sm text-gray-600">
            <p><strong>App:</strong> SitterApp</p>
            <p><strong>Version:</strong> 1.0.0</p>
          </div>
        </div>
      </div>
    </Header>
  );
}
