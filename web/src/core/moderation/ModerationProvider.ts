export interface ModerationProvider {
  moderate(text: string): Promise<boolean>;
}

/**
 * EXPERIMENTAL PLACEHOLDER
 * NOT READY FOR PRODUCTION
 * 
 * This merely simulates local moderation passes/fails.
 */
export class DummyModerationProvider implements ModerationProvider {
  async moderate(text: string): Promise<boolean> {
    // Basic placeholder check
    if (text.toLowerCase().includes("toxic")) {
      return false;
    }
    return true;
  }
}
