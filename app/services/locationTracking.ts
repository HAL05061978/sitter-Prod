/**
 * Native Location Tracking Service
 *
 * Provides location tracking capabilities using Capacitor's native geolocation.
 * Supports background tracking for monitoring care providers.
 */

import { Geolocation, Position, PositionOptions } from '@capacitor/geolocation';
import { BackgroundRunner } from '@capacitor/background-runner';
import { supabase } from '../lib/supabase';

export interface LocationUpdate {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  altitude: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

export interface TrackingSession {
  sessionId: string;
  scheduledCareId: string;
  providerId: string;
  receiverId: string;
  status: 'pending_dropoff' | 'active' | 'pending_pickup' | 'completed' | 'cancelled';
}

class LocationTrackingService {
  private watchId: string | null = null;
  private currentSession: TrackingSession | null = null;
  private updateInterval: number = 10000; // Update every 10 seconds
  private isTracking: boolean = false;

  /**
   * Request location permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const permission = await Geolocation.requestPermissions();
      return permission.location === 'granted';
    } catch (error) {
      console.error('Error requesting location permissions:', error);
      return false;
    }
  }

  /**
   * Check if location permissions are granted
   */
  async checkPermissions(): Promise<boolean> {
    try {
      const permission = await Geolocation.checkPermissions();
      return permission.location === 'granted';
    } catch (error) {
      console.error('Error checking location permissions:', error);
      return false;
    }
  }

  /**
   * Get current location (one-time)
   */
  async getCurrentLocation(): Promise<LocationUpdate | null> {
    try {
      const hasPermission = await this.checkPermissions();
      if (!hasPermission) {
        const granted = await this.requestPermissions();
        if (!granted) {
          throw new Error('Location permission not granted');
        }
      }

      const options: PositionOptions = {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      };

      const position = await Geolocation.getCurrentPosition(options);
      return this.formatPosition(position);
    } catch (error) {
      console.error('Error getting current location:', error);
      return null;
    }
  }

  /**
   * Start tracking location (continuous updates)
   */
  async startTracking(session: TrackingSession): Promise<boolean> {
    try {
      // Check permissions
      const hasPermission = await this.checkPermissions();
      if (!hasPermission) {
        const granted = await this.requestPermissions();
        if (!granted) {
          throw new Error('Location permission not granted');
        }
      }

      // Stop any existing tracking
      if (this.isTracking) {
        await this.stopTracking();
      }

      this.currentSession = session;
      this.isTracking = true;

      // Set up watch position with high accuracy
      const options: PositionOptions = {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      };

      this.watchId = await Geolocation.watchPosition(options, (position, error) => {
        if (error) {
          console.error('Location tracking error:', error);
          return;
        }

        if (position && this.isTracking && this.currentSession) {
          this.handleLocationUpdate(position);
        }
      });

      console.log('Location tracking started for session:', session.sessionId);
      return true;
    } catch (error) {
      console.error('Error starting location tracking:', error);
      return false;
    }
  }

  /**
   * Stop tracking location
   */
  async stopTracking(): Promise<void> {
    try {
      if (this.watchId) {
        await Geolocation.clearWatch({ id: this.watchId });
        this.watchId = null;
      }

      this.isTracking = false;
      this.currentSession = null;
      console.log('Location tracking stopped');
    } catch (error) {
      console.error('Error stopping location tracking:', error);
    }
  }

  /**
   * Handle location update from watch position
   */
  private async handleLocationUpdate(position: Position): Promise<void> {
    if (!this.currentSession) return;

    const location = this.formatPosition(position);

    try {
      // Send location update to backend
      const { data, error } = await supabase.rpc('update_location', {
        p_session_id: this.currentSession.sessionId,
        p_latitude: location.latitude,
        p_longitude: location.longitude,
        p_accuracy: location.accuracy,
        p_altitude: location.altitude,
        p_heading: location.heading,
        p_speed: location.speed
      });

      if (error) {
        console.error('Error updating location:', error);
      } else {
        console.log('Location updated successfully');
      }
    } catch (error) {
      console.error('Error sending location update:', error);
    }
  }

  /**
   * Format Capacitor position to LocationUpdate
   */
  private formatPosition(position: Position): LocationUpdate {
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      altitude: position.coords.altitude,
      heading: position.coords.heading,
      speed: position.coords.speed,
      timestamp: position.timestamp
    };
  }

  /**
   * Request drop-off (receiving parent)
   */
  async requestDropoff(scheduledCareId: string, receiverId: string): Promise<any> {
    try {
      const { data, error } = await supabase.rpc('request_dropoff', {
        p_scheduled_care_id: scheduledCareId,
        p_receiver_id: receiverId
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error requesting drop-off:', error);
      throw error;
    }
  }

  /**
   * Confirm drop-off (providing parent)
   */
  async confirmDropoff(sessionId: string, providerId: string, providerScheduledCareId: string): Promise<any> {
    try {
      const { data, error } = await supabase.rpc('confirm_dropoff', {
        p_session_id: sessionId,
        p_provider_id: providerId,
        p_provider_scheduled_care_id: providerScheduledCareId
      });

      if (error) throw error;

      // Start tracking if confirmation successful
      if (data.success) {
        await this.startTracking({
          sessionId,
          scheduledCareId: providerScheduledCareId,
          providerId,
          receiverId: '', // Will be populated from session
          status: 'active'
        });
      }

      return data;
    } catch (error) {
      console.error('Error confirming drop-off:', error);
      throw error;
    }
  }

  /**
   * Request pick-up (receiving parent)
   */
  async requestPickup(sessionId: string, receiverId: string): Promise<any> {
    try {
      const { data, error } = await supabase.rpc('request_pickup', {
        p_session_id: sessionId,
        p_receiver_id: receiverId
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error requesting pick-up:', error);
      throw error;
    }
  }

  /**
   * Confirm pick-up (providing parent)
   */
  async confirmPickup(sessionId: string, providerId: string): Promise<any> {
    try {
      const { data, error } = await supabase.rpc('confirm_pickup', {
        p_session_id: sessionId,
        p_provider_id: providerId
      });

      if (error) throw error;

      // Stop tracking if confirmation successful
      if (data.success) {
        await this.stopTracking();
      }

      return data;
    } catch (error) {
      console.error('Error confirming pick-up:', error);
      throw error;
    }
  }

  /**
   * Get active tracking sessions for current user
   */
  async getActiveTrackingSessions(userId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase.rpc('get_active_tracking_sessions', {
        p_user_id: userId
      });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting active tracking sessions:', error);
      return [];
    }
  }

  /**
   * Get latest location for a session
   */
  async getLatestLocation(sessionId: string): Promise<LocationUpdate | null> {
    try {
      const { data, error } = await supabase.rpc('get_latest_location', {
        p_session_id: sessionId
      });

      if (error) throw error;

      if (data.success && data.location) {
        return {
          latitude: data.location.latitude,
          longitude: data.location.longitude,
          accuracy: data.location.accuracy,
          altitude: data.location.altitude,
          heading: data.location.heading,
          speed: data.location.speed,
          timestamp: new Date(data.location.recorded_at).getTime()
        };
      }

      return null;
    } catch (error) {
      console.error('Error getting latest location:', error);
      return null;
    }
  }

  /**
   * Subscribe to location updates for a session (real-time)
   */
  subscribeToLocationUpdates(sessionId: string, callback: (location: LocationUpdate) => void) {
    const channel = supabase
      .channel(`location_updates:${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'location_updates',
          filter: `session_id=eq.${sessionId}`
        },
        (payload: any) => {
          const location: LocationUpdate = {
            latitude: payload.new.latitude,
            longitude: payload.new.longitude,
            accuracy: payload.new.accuracy,
            altitude: payload.new.altitude,
            heading: payload.new.heading,
            speed: payload.new.speed,
            timestamp: new Date(payload.new.recorded_at).getTime()
          };
          callback(location);
        }
      )
      .subscribe();

    // Return unsubscribe function
    return () => {
      supabase.removeChannel(channel);
    };
  }

  /**
   * Check if currently tracking
   */
  isCurrentlyTracking(): boolean {
    return this.isTracking;
  }

  /**
   * Get current tracking session
   */
  getCurrentSession(): TrackingSession | null {
    return this.currentSession;
  }
}

// Export singleton instance
export const locationTrackingService = new LocationTrackingService();
