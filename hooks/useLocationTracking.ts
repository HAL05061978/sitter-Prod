/**
 * useLocationTracking Hook
 *
 * React hook for managing location tracking in care blocks
 */

import { useState, useEffect, useCallback } from 'react';
import { locationTrackingService, LocationUpdate, TrackingSession } from '../app/services/locationTracking';
import { supabase } from '../app/lib/supabase';

export interface UseLocationTrackingReturn {
  // State
  isTracking: boolean;
  currentSession: TrackingSession | null;
  latestLocation: LocationUpdate | null;
  activeSessions: any[];
  hasPermission: boolean;
  loading: boolean;
  error: string | null;

  // Actions
  requestDropoff: (scheduledCareId: string, receiverId: string) => Promise<void>;
  confirmDropoff: (sessionId: string, providerId: string, providerScheduledCareId: string) => Promise<void>;
  requestPickup: (sessionId: string, receiverId: string) => Promise<void>;
  confirmPickup: (sessionId: string, providerId: string) => Promise<void>;
  startTracking: (session: TrackingSession) => Promise<void>;
  stopTracking: () => Promise<void>;
  refreshActiveSessions: () => Promise<void>;
  requestPermissions: () => Promise<void>;
}

export function useLocationTracking(userId?: string): UseLocationTrackingReturn {
  const [isTracking, setIsTracking] = useState(false);
  const [currentSession, setCurrentSession] = useState<TrackingSession | null>(null);
  const [latestLocation, setLatestLocation] = useState<LocationUpdate | null>(null);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [hasPermission, setHasPermission] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check permissions on mount
  useEffect(() => {
    checkPermissions();
  }, []);

  // Load active sessions on mount and when userId changes
  useEffect(() => {
    if (userId) {
      refreshActiveSessions();
    }
  }, [userId]);

  // Update tracking state
  useEffect(() => {
    const trackingState = locationTrackingService.isCurrentlyTracking();
    const session = locationTrackingService.getCurrentSession();

    setIsTracking(trackingState);
    setCurrentSession(session);
  }, []);

  const checkPermissions = async () => {
    try {
      const granted = await locationTrackingService.checkPermissions();
      setHasPermission(granted);
    } catch (err) {
      console.error('Error checking permissions:', err);
    }
  };

  const requestPermissions = async () => {
    try {
      setLoading(true);
      setError(null);
      const granted = await locationTrackingService.requestPermissions();
      setHasPermission(granted);

      if (!granted) {
        setError('Location permission denied');
      }
    } catch (err: any) {
      setError(err.message || 'Error requesting permissions');
    } finally {
      setLoading(false);
    }
  };

  const refreshActiveSessions = async () => {
    if (!userId) return;

    try {
      setLoading(true);
      setError(null);
      const sessions = await locationTrackingService.getActiveTrackingSessions(userId);
      setActiveSessions(sessions);
    } catch (err: any) {
      setError(err.message || 'Error loading active sessions');
    } finally {
      setLoading(false);
    }
  };

  const requestDropoff = async (scheduledCareId: string, receiverId: string) => {
    try {
      setLoading(true);
      setError(null);
      const result = await locationTrackingService.requestDropoff(scheduledCareId, receiverId);

      if (!result.success) {
        throw new Error(result.error || 'Failed to request drop-off');
      }

      await refreshActiveSessions();
    } catch (err: any) {
      setError(err.message || 'Error requesting drop-off');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const confirmDropoff = async (sessionId: string, providerId: string, providerScheduledCareId: string) => {
    try {
      setLoading(true);
      setError(null);
      const result = await locationTrackingService.confirmDropoff(sessionId, providerId, providerScheduledCareId);

      if (!result.success) {
        throw new Error(result.error || 'Failed to confirm drop-off');
      }

      setIsTracking(true);
      setCurrentSession(locationTrackingService.getCurrentSession());
      await refreshActiveSessions();
    } catch (err: any) {
      setError(err.message || 'Error confirming drop-off');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const requestPickup = async (sessionId: string, receiverId: string) => {
    try {
      setLoading(true);
      setError(null);
      const result = await locationTrackingService.requestPickup(sessionId, receiverId);

      if (!result.success) {
        throw new Error(result.error || 'Failed to request pick-up');
      }

      await refreshActiveSessions();
    } catch (err: any) {
      setError(err.message || 'Error requesting pick-up');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const confirmPickup = async (sessionId: string, providerId: string) => {
    try {
      setLoading(true);
      setError(null);
      const result = await locationTrackingService.confirmPickup(sessionId, providerId);

      if (!result.success) {
        throw new Error(result.error || 'Failed to confirm pick-up');
      }

      setIsTracking(false);
      setCurrentSession(null);
      setLatestLocation(null);
      await refreshActiveSessions();
    } catch (err: any) {
      setError(err.message || 'Error confirming pick-up');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const startTracking = async (session: TrackingSession) => {
    try {
      setLoading(true);
      setError(null);

      if (!hasPermission) {
        const granted = await locationTrackingService.requestPermissions();
        if (!granted) {
          throw new Error('Location permission not granted');
        }
        setHasPermission(true);
      }

      const started = await locationTrackingService.startTracking(session);
      if (!started) {
        throw new Error('Failed to start tracking');
      }

      setIsTracking(true);
      setCurrentSession(session);
    } catch (err: any) {
      setError(err.message || 'Error starting tracking');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const stopTracking = async () => {
    try {
      setLoading(true);
      setError(null);
      await locationTrackingService.stopTracking();

      setIsTracking(false);
      setCurrentSession(null);
      setLatestLocation(null);
    } catch (err: any) {
      setError(err.message || 'Error stopping tracking');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    // State
    isTracking,
    currentSession,
    latestLocation,
    activeSessions,
    hasPermission,
    loading,
    error,

    // Actions
    requestDropoff,
    confirmDropoff,
    requestPickup,
    confirmPickup,
    startTracking,
    stopTracking,
    refreshActiveSessions,
    requestPermissions
  };
}

/**
 * useLocationUpdates Hook
 *
 * Subscribe to real-time location updates for a session
 */
export function useLocationUpdates(sessionId: string | null) {
  const [location, setLocation] = useState<LocationUpdate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setLocation(null);
      return;
    }

    setLoading(true);

    // Get initial location
    locationTrackingService.getLatestLocation(sessionId)
      .then(loc => {
        setLocation(loc);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });

    // Subscribe to real-time updates
    const unsubscribe = locationTrackingService.subscribeToLocationUpdates(
      sessionId,
      (newLocation) => {
        setLocation(newLocation);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [sessionId]);

  return { location, loading, error };
}
