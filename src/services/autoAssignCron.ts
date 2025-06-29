import { supabase } from '../lib/supabase';

class AutoAssignCron {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastRun = 0;
  private readonly INTERVAL_MS = 60000; // Run every minute

  async start() {
    if (this.isRunning) {
      console.log('AutoAssignCron: Already running');
      return;
    }

    console.log('AutoAssignCron: Starting auto-assignment processor');
    this.isRunning = true;

    // Run immediately on start
    await this.processAutoAssignments();

    // Then set up the interval
    this.intervalId = setInterval(async () => {
      await this.processAutoAssignments();
    }, this.INTERVAL_MS);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('AutoAssignCron: Stopped');
  }

  private async processAutoAssignments() {
    const now = Date.now();
    
    // Prevent running too frequently (minimum 30 seconds between runs)
    if (now - this.lastRun < 30000) {
      return;
    }

    this.lastRun = now;

    try {
      console.log('AutoAssignCron: Processing auto-assignments...');
      
      const { data, error } = await supabase.rpc('process_auto_assignment_timers');
      
      if (error) {
        console.error('AutoAssignCron: Error processing auto-assignments:', error);
        return;
      }

      if (data && data > 0) {
        console.log(`AutoAssignCron: Successfully processed ${data} auto-assignments`);
      } else {
        console.log('AutoAssignCron: No auto-assignments to process');
      }
    } catch (error) {
      console.error('AutoAssignCron: Unexpected error:', error);
    }
  }

  // Manual trigger for testing
  async triggerNow() {
    console.log('AutoAssignCron: Manual trigger');
    await this.processAutoAssignments();
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      lastRun: this.lastRun,
      intervalMs: this.INTERVAL_MS
    };
  }
}

// Create singleton instance
export const autoAssignCron = new AutoAssignCron();

// Export for manual testing
export const triggerAutoAssign = () => autoAssignCron.triggerNow();
export const getCronStatus = () => autoAssignCron.getStatus(); 