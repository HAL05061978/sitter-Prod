/**
 * LocationTrackingPanel Component (SIMPLIFIED)
 *
 * Main UI for drop-off/pick-up workflow and location tracking
 * Uses logged-in user for all operations - no more guessing roles!
 */

'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import dynamic from 'next/dynamic';
import { useLocationTracking, useLocationUpdates } from '../../hooks/useLocationTracking';
import { supabase } from '../../app/lib/supabase';

// Dynamically import LocationMap to avoid SSR issues with Leaflet
const LocationMap = dynamic(() => import('./LocationMap'), {
  ssr: false,
  loading: () => (
    <div className="bg-gray-100 rounded-lg flex items-center justify-center" style={{ height: '300px' }}>
      <p className="text-gray-500">Loading map...</p>
    </div>
  )
});

interface LocationTrackingPanelProps {
  scheduledCareId: string;
  currentUserId: string;
  isProvider: boolean; // true if providing care, false if receiving care
  careDate: string;
  startTime: string;
  endTime: string;
}

export default function LocationTrackingPanel({
  scheduledCareId,
  currentUserId,
  isProvider,
  careDate,
  startTime,
  endTime
}: LocationTrackingPanelProps) {
  const { t } = useTranslation();
  const [activeSession, setActiveSession] = useState<any>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'dropoff' | 'pickup' | null>(null);
  const [otherPartyName, setOtherPartyName] = useState<string>('');

  const {
    isTracking,
    activeSessions,
    hasPermission,
    loading,
    error,
    requestDropoff,
    confirmDropoff,
    requestPickup,
    confirmPickup,
    refreshActiveSessions,
    requestPermissions
  } = useLocationTracking(currentUserId);

  const { location } = useLocationUpdates(activeSession?.session_id);

  useEffect(() => {
    loadActiveSession();
  }, [activeSessions, scheduledCareId]);

  useEffect(() => {
    // Auto-refresh to see updates from other party
    const interval = setInterval(() => {
      refreshActiveSessions();
    }, 10000);

    return () => clearInterval(interval);
  }, [refreshActiveSessions]);

  const loadActiveSession = async () => {
    const session = activeSessions.find(
      (s: any) => s.scheduled_care_id === scheduledCareId
    );
    setActiveSession(session);

    // Load the other party's name
    if (session) {
      const otherUserId = session.provider_id === currentUserId
        ? session.receiver_id
        : session.provider_id;

      if (otherUserId && otherUserId !== currentUserId) {
        const { data } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', otherUserId)
          .single();

        if (data) {
          setOtherPartyName(data.full_name);
        }
      }
    }
  };

  const handleDropoffRequest = async () => {
    console.log('=== Drop-off Request (SIMPLIFIED) ===');
    console.log('scheduledCareId:', scheduledCareId);
    console.log('currentUserId (receiver):', currentUserId);

    try {
      await requestDropoff(scheduledCareId, currentUserId);
      setShowConfirmModal(false);
      await refreshActiveSessions();
    } catch (err) {
      console.error('Error requesting drop-off:', err);
    }
  };

  const handleDropoffConfirm = async () => {
    if (!activeSession) return;

    // Request permissions first if not granted
    if (!hasPermission) {
      await requestPermissions();
      if (!hasPermission) {
        alert('Location permission is required to start tracking');
        return;
      }
    }

    console.log('=== Confirm Drop-off (SIMPLIFIED) ===');
    console.log('session_id:', activeSession.session_id);
    console.log('currentUserId (provider):', currentUserId);
    console.log('scheduledCareId (provider):', scheduledCareId);

    try {
      await confirmDropoff(activeSession.session_id, currentUserId, scheduledCareId);
      setShowConfirmModal(false);
      await refreshActiveSessions();
    } catch (err) {
      console.error('Error confirming drop-off:', err);
    }
  };

  const handlePickupRequest = async () => {
    if (!activeSession) return;

    console.log('=== Pick-up Request (SIMPLIFIED) ===');
    console.log('session_id:', activeSession.session_id);
    console.log('currentUserId (receiver):', currentUserId);

    try {
      await requestPickup(activeSession.session_id, currentUserId);
      setShowConfirmModal(false);
      await refreshActiveSessions();
    } catch (err) {
      console.error('Error requesting pick-up:', err);
    }
  };

  const handlePickupConfirm = async () => {
    if (!activeSession) return;

    console.log('=== Confirm Pick-up (SIMPLIFIED) ===');
    console.log('session_id:', activeSession.session_id);
    console.log('currentUserId (provider):', currentUserId);

    try {
      await confirmPickup(activeSession.session_id, currentUserId);
      setShowConfirmModal(false);
      await refreshActiveSessions();
    } catch (err) {
      console.error('Error confirming pick-up:', err);
    }
  };

  const openConfirmModal = (action: 'dropoff' | 'pickup') => {
    setConfirmAction(action);
    setShowConfirmModal(true);
  };

  const getButtonConfig = () => {
    if (!activeSession) {
      // No active session
      if (isProvider) {
        // Provider can't initiate - must wait for receiver
        return null;
      } else {
        // Receiver can initiate drop-off
        return {
          text: t('dropOff'),
          icon: '📍',
          color: 'bg-blue-500 hover:bg-blue-600',
          action: () => openConfirmModal('dropoff'),
          disabled: false,
          description: t('notifyProviderDropOff')
        };
      }
    }

    const status = activeSession.status;

    if (status === 'pending_dropoff') {
      // Waiting for provider to confirm drop-off
      if (isProvider) {
        // Provider sees confirm button
        return {
          text: t('confirmDropOff'),
          icon: '✓',
          color: 'bg-green-500 hover:bg-green-600',
          action: handleDropoffConfirm,
          disabled: false,
          description: otherPartyName ? t('hasIndicatedDropOff', { name: otherPartyName }) : t('confirmDropOffStart')
        };
      } else {
        // Receiver sees waiting message
        return {
          text: t('waitingForConfirmation'),
          icon: '⏳',
          color: 'bg-gray-400',
          action: () => {},
          disabled: true,
          description: t('waitingForProvider')
        };
      }
    }

    if (status === 'active') {
      // Tracking active
      if (isProvider) {
        // Provider just sees status
        return {
          text: t('trackingActive'),
          icon: '📡',
          color: 'bg-green-500',
          action: () => {},
          disabled: true,
          description: t('locationSharingActive')
        };
      } else {
        // Receiver can request pick-up
        return {
          text: t('pickUp'),
          icon: '🏠',
          color: 'bg-orange-500 hover:bg-orange-600',
          action: () => openConfirmModal('pickup'),
          disabled: false,
          description: t('notifyProviderPickUp')
        };
      }
    }

    if (status === 'pending_pickup') {
      // Waiting for provider to confirm pick-up
      if (isProvider) {
        // Provider sees confirm button
        return {
          text: t('confirmPickUp'),
          icon: '✓',
          color: 'bg-green-500 hover:bg-green-600',
          action: handlePickupConfirm,
          disabled: false,
          description: otherPartyName ? t('hasIndicatedPickUp', { name: otherPartyName }) : t('confirmPickUpStop')
        };
      } else {
        // Receiver sees waiting message
        return {
          text: t('waitingForConfirmation'),
          icon: '⏳',
          color: 'bg-gray-400',
          action: () => {},
          disabled: true,
          description: t('waitingForProvider')
        };
      }
    }

    return null;
  };

  const buttonConfig = getButtonConfig();

  // Debug logging
  console.log('=== LocationTrackingPanel Render (SIMPLIFIED) ===');
  console.log('currentUserId:', currentUserId);
  console.log('isProvider (from care_type):', isProvider);
  console.log('scheduledCareId:', scheduledCareId);
  console.log('activeSession:', activeSession);
  console.log('buttonConfig:', buttonConfig);

  return (
    <div className="bg-white rounded-lg shadow-md p-4 space-y-4">
      {/* Header */}
      <div className="border-b pb-3">
        <h3 className="text-lg font-semibold text-gray-900">{t('locationTracking')}</h3>
        <p className="text-sm text-gray-600">
          {careDate} • {startTime} - {endTime}
        </p>
      </div>

      {/* Status indicator */}
      {activeSession && (
        <div className="flex items-center space-x-2 bg-gray-50 rounded-lg p-3">
          <div className={`w-3 h-3 rounded-full ${
            activeSession.status === 'active' ? 'bg-green-500 animate-pulse' :
            activeSession.status === 'pending_dropoff' || activeSession.status === 'pending_pickup' ? 'bg-yellow-500' :
            'bg-gray-400'
          }`}></div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">
              {activeSession.status === 'active' && 'Tracking Active'}
              {activeSession.status === 'pending_dropoff' && 'Awaiting Drop-Off Confirmation'}
              {activeSession.status === 'pending_pickup' && 'Awaiting Pick-Up Confirmation'}
            </p>
            {activeSession.dropoff_confirmed_at && (
              <p className="text-xs text-gray-500">
                Started: {new Date(activeSession.dropoff_confirmed_at).toLocaleTimeString()}
              </p>
            )}
            {otherPartyName && (
              <p className="text-xs text-gray-500">
                With: {otherPartyName}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Map - only show when tracking is active */}
      {activeSession && activeSession.status === 'active' && (
        <div className="space-y-2">
          <LocationMap
            location={location}
            providerName={activeSession.provider_id === currentUserId ? 'You' : otherPartyName}
            height="300px"
            showAccuracy={true}
          />
          {location && (
            <p className="text-xs text-gray-500 text-center">
              Last updated: {new Date(location.timestamp).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {/* Action button */}
      {buttonConfig && (
        <div className="space-y-2">
          {buttonConfig.description && (
            <p className="text-sm text-gray-600 text-center">
              {buttonConfig.description}
            </p>
          )}
          <button
            onClick={buttonConfig.action}
            disabled={buttonConfig.disabled || loading}
            className={`w-full ${buttonConfig.color} text-white font-semibold py-3 px-4 rounded-lg
              transition duration-200 flex items-center justify-center space-x-2
              disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <span className="text-xl">{buttonConfig.icon}</span>
            <span>{loading ? 'Processing...' : buttonConfig.text}</span>
          </button>
        </div>
      )}

      {/* Permission warning */}
      {!hasPermission && activeSession && activeSession.status === 'pending_dropoff' && activeSession.provider_id === currentUserId && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-sm text-yellow-800">
            ⚠️ Location permission is required to start tracking
          </p>
          <button
            onClick={requestPermissions}
            className="mt-2 text-sm text-yellow-900 underline"
          >
            Grant Permission
          </button>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && confirmAction && (
        <div className="fixed left-0 right-0 bg-black bg-opacity-50 flex items-center justify-center p-4" style={{ top: '145px', bottom: '90px', zIndex: 9999 }}>
          <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {confirmAction === 'dropoff' ? 'Confirm Drop-Off' : 'Confirm Pick-Up'}
            </h3>
            <p className="text-gray-600">
              {confirmAction === 'dropoff' ? (
                <>
                  Are you dropping off your child?
                  The provider will be notified to confirm and start location sharing.
                </>
              ) : (
                <>
                  Are you picking up your child?
                  The provider will be notified to confirm and stop location sharing.
                </>
              )}
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmAction === 'dropoff' ? handleDropoffRequest : handlePickupRequest}
                className={`flex-1 ${
                  confirmAction === 'dropoff' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-orange-500 hover:bg-orange-600'
                } text-white font-semibold py-2 px-4 rounded-lg transition`}
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
