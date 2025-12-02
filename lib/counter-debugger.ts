/**
 * Counter Debugging Utility
 *
 * This utility provides comprehensive logging for debugging counter button issues,
 * particularly focusing on requester flows (accepting reciprocal responses and open blocks).
 *
 * Usage:
 * 1. Import this utility in Header.tsx and scheduler/page.tsx
 * 2. Call CounterDebugger.init() when the app loads
 * 3. Use CounterDebugger methods to log counter-related events
 */

export class CounterDebugger {
  private static enabled = true;
  private static sessionStart = Date.now();
  private static events: any[] = [];

  // Enable/disable debugging from console
  static setEnabled(enabled: boolean) {
    this.enabled = enabled;
    console.log(`🔧 Counter Debugger ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }

  // Initialize the debugger
  static init() {
    console.log('🔧 Counter Debugger Initialized');
    console.log('📝 Available Commands:');
    console.log('  - CounterDebugger.showHistory() - Show all logged events');
    console.log('  - CounterDebugger.showCounterFlow() - Show counter update flow');
    console.log('  - CounterDebugger.showEventDispatches() - Show all window events');
    console.log('  - CounterDebugger.clear() - Clear event history');
    console.log('  - CounterDebugger.setEnabled(false) - Disable debugging');

    // Make it globally accessible
    (window as any).CounterDebugger = this;
  }

  // Log counter fetch operation
  static logCounterFetch(counterType: 'scheduler' | 'calendar', userId: string, triggerReason: string) {
    if (!this.enabled) return;

    const event = {
      timestamp: this.getTimestamp(),
      type: 'COUNTER_FETCH',
      counterType,
      userId,
      triggerReason
    };

    this.events.push(event);
    console.log(`🔄 [${event.timestamp}] FETCHING ${counterType.toUpperCase()} Counter`, {
      reason: triggerReason,
      userId
    });
  }

  // Log counter calculation result
  static logCounterCalculation(
    counterType: 'scheduler' | 'calendar',
    breakdown: any,
    finalCount: number
  ) {
    if (!this.enabled) return;

    const event = {
      timestamp: this.getTimestamp(),
      type: 'COUNTER_CALCULATION',
      counterType,
      breakdown,
      finalCount
    };

    this.events.push(event);
    console.log(`📊 [${event.timestamp}] ${counterType.toUpperCase()} Counter Calculated`, {
      finalCount,
      breakdown
    });
  }

  // Log window event dispatch
  static logEventDispatch(eventName: string, source: string, additionalData?: any) {
    if (!this.enabled) return;

    const event = {
      timestamp: this.getTimestamp(),
      type: 'EVENT_DISPATCH',
      eventName,
      source,
      additionalData
    };

    this.events.push(event);
    console.log(`📡 [${event.timestamp}] EVENT DISPATCHED: "${eventName}"`, {
      source,
      ...additionalData
    });
  }

  // Log window event listener trigger
  static logEventReceived(eventName: string, handler: string) {
    if (!this.enabled) return;

    const event = {
      timestamp: this.getTimestamp(),
      type: 'EVENT_RECEIVED',
      eventName,
      handler
    };

    this.events.push(event);
    console.log(`📥 [${event.timestamp}] EVENT RECEIVED: "${eventName}"`, {
      handler
    });
  }

  // Log reciprocal response acceptance
  static logReciprocalAcceptance(
    responseId: string,
    careType: 'child' | 'pet',
    requesterId: string,
    responderId: string
  ) {
    if (!this.enabled) return;

    const event = {
      timestamp: this.getTimestamp(),
      type: 'RECIPROCAL_ACCEPTANCE',
      responseId,
      careType,
      requesterId,
      responderId
    };

    this.events.push(event);
    console.log(`✅ [${event.timestamp}] RECIPROCAL RESPONSE ACCEPTED`, {
      responseId,
      careType,
      requesterId,
      responderId,
      note: '⚠️ Calendar counter should increment for BOTH requester and responder'
    });
  }

  // Log open block acceptance
  static logOpenBlockAcceptance(
    invitationId: string,
    acceptorId: string,
    offererParentId: string
  ) {
    if (!this.enabled) return;

    const event = {
      timestamp: this.getTimestamp(),
      type: 'OPEN_BLOCK_ACCEPTANCE',
      invitationId,
      acceptorId,
      offererParentId
    };

    this.events.push(event);
    console.log(`✅ [${event.timestamp}] OPEN BLOCK ACCEPTED`, {
      invitationId,
      acceptorId,
      offererParentId,
      note: '⚠️ Calendar counter should increment for BOTH acceptor and offerer'
    });
  }

  // Log notification creation
  static logNotificationCreated(
    notificationType: string,
    recipientUserId: string,
    data: any
  ) {
    if (!this.enabled) return;

    const event = {
      timestamp: this.getTimestamp(),
      type: 'NOTIFICATION_CREATED',
      notificationType,
      recipientUserId,
      data
    };

    this.events.push(event);
    console.log(`🔔 [${event.timestamp}] NOTIFICATION CREATED`, {
      type: notificationType,
      recipient: recipientUserId,
      data
    });
  }

  // Log database error
  static logDatabaseError(
    operation: string,
    functionName: string,
    error: any
  ) {
    if (!this.enabled) return;

    const event = {
      timestamp: this.getTimestamp(),
      type: 'DATABASE_ERROR',
      operation,
      functionName,
      error
    };

    this.events.push(event);
    console.error(`❌ [${event.timestamp}] DATABASE ERROR`, {
      operation,
      functionName,
      error
    });
  }

  // Show history of all events
  static showHistory() {
    console.log('📚 Counter Debugger Event History:');
    console.table(this.events);
    return this.events;
  }

  // Show counter update flow
  static showCounterFlow() {
    const counterEvents = this.events.filter(e =>
      e.type === 'COUNTER_FETCH' ||
      e.type === 'COUNTER_CALCULATION' ||
      e.type === 'EVENT_DISPATCH' ||
      e.type === 'EVENT_RECEIVED'
    );
    console.log('🔄 Counter Update Flow:');
    console.table(counterEvents);
    return counterEvents;
  }

  // Show all event dispatches
  static showEventDispatches() {
    const eventDispatches = this.events.filter(e =>
      e.type === 'EVENT_DISPATCH' || e.type === 'EVENT_RECEIVED'
    );
    console.log('📡 Event Dispatch Flow:');
    console.table(eventDispatches);
    return eventDispatches;
  }

  // Show requester-specific events
  static showRequesterFlow(userId: string) {
    const requesterEvents = this.events.filter(e =>
      e.userId === userId ||
      e.requesterId === userId ||
      e.offererParentId === userId
    );
    console.log(`👤 Requester Flow for User: ${userId}`);
    console.table(requesterEvents);
    return requesterEvents;
  }

  // Clear event history
  static clear() {
    this.events = [];
    console.log('🗑️ Counter Debugger history cleared');
  }

  // Get timestamp relative to session start
  private static getTimestamp(): string {
    const elapsed = Date.now() - this.sessionStart;
    const seconds = (elapsed / 1000).toFixed(2);
    return `+${seconds}s`;
  }
}

// Auto-initialize
if (typeof window !== 'undefined') {
  CounterDebugger.init();
}
