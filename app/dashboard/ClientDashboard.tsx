"use client";

import LogoutButton from '../components/LogoutButton';

export default function ClientDashboard() {
  return (
    <div>
      <div className="flex justify-end p-4"><LogoutButton /></div>
      <h1>Welcome to your Dashboard!</h1>
      <div style={{ color: 'red', fontWeight: 'bold' }}>TEST ELEMENT</div>
      {/* Add wallet, calendar, requests, etc. */}
    </div>
  );
} 