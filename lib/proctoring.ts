export interface ProctoringEvent {
  type: string;
  timestamp: number;
  details: string;
  severity: 'low' | 'medium' | 'high';
}

export class ProctoringMonitor {
  private events: ProctoringEvent[] = [];
  private onFlag: (event: ProctoringEvent) => void;
  private avatarSpeaking: boolean = false;

  constructor(onFlag: (event: ProctoringEvent) => void) {
    this.onFlag = onFlag;
  }

  setAvatarSpeaking(speaking: boolean) {
    this.avatarSpeaking = speaking;
  }

  start() {
    // 1. Tab visibility change
    document.addEventListener('visibilitychange', this.handleVisibility);
    
    // 2. Window focus/blur
    window.addEventListener('blur', this.handleBlur);
    window.addEventListener('focus', this.handleFocus);
    
    // 3. Paste detection
    document.addEventListener('paste', this.handlePaste);
    
    // 4. Keyboard during avatar speech
    document.addEventListener('keydown', this.handleKeydown);
    
    // 5. Right click (trying to inspect/use tools)
    document.addEventListener('contextmenu', this.handleContextMenu);

    console.log('Proctoring monitor active');
  }

  stop() {
    document.removeEventListener('visibilitychange', this.handleVisibility);
    window.removeEventListener('blur', this.handleBlur);
    window.removeEventListener('focus', this.handleFocus);
    document.removeEventListener('paste', this.handlePaste);
    document.removeEventListener('keydown', this.handleKeydown);
    document.removeEventListener('contextmenu', this.handleContextMenu);
  }

  private handleVisibility = () => {
    if (document.hidden) {
      this.flag({
        type: 'TAB_SWITCH',
        timestamp: Date.now(),
        details: 'Candidate switched away from interview tab',
        severity: 'high'
      });
    }
  };

  private handleBlur = () => {
    this.flag({
      type: 'WINDOW_BLUR',
      timestamp: Date.now(),
      details: 'Browser window lost focus — possible switch to external AI tool',
      severity: 'high'
    });
  };

  private handleFocus = () => {
    // Log return to window — useful for timing how long they were away
    this.events.push({
      type: 'WINDOW_FOCUS_RETURN',
      timestamp: Date.now(),
      details: 'Candidate returned to interview window',
      severity: 'low'
    });
  };

  private handlePaste = (e: ClipboardEvent) => {
    const pastedText = e.clipboardData?.getData('text') || '';
    this.flag({
      type: 'PASTE_DETECTED',
      timestamp: Date.now(),
      details: `Candidate pasted ${pastedText.length} characters — possible AI-generated answer`,
      severity: 'high'
    });
  };

  private handleKeydown = (e: KeyboardEvent) => {
    // Typing while avatar is speaking = reading answers from AI tool
    if (this.avatarSpeaking && e.key.length === 1) {
      this.flag({
        type: 'TYPING_DURING_QUESTION',
        timestamp: Date.now(),
        details: 'Candidate typed while interviewer was speaking — possible real-time AI assistance',
        severity: 'medium'
      });
    }
  };

  private handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    this.flag({
      type: 'RIGHT_CLICK',
      timestamp: Date.now(),
      details: 'Right-click attempted during interview',
      severity: 'low'
    });
  };

  private flag(event: ProctoringEvent) {
    this.events.push(event);
    this.onFlag(event);
    console.warn('🚨 PROCTORING FLAG:', event);
  }

  getReport() {
    const highCount = this.events.filter(e => e.severity === 'high').length;
    const mediumCount = this.events.filter(e => e.severity === 'medium').length;
    const lowCount = this.events.filter(e => e.severity === 'low').length;
    
    const suspicionScore = Math.min(
      (highCount * 0.4 + mediumCount * 0.2 + lowCount * 0.05),
      1.0
    );

    return {
      total_flags: this.events.length,
      high_severity: highCount,
      medium_severity: mediumCount,
      low_severity: lowCount,
      suspicion_score: round(suspicionScore, 3),
      events: this.events,
      verdict: highCount >= 2 ? 'LIKELY_CHEATING' : 
               highCount >= 1 ? 'SUSPICIOUS' : 'CLEAN'
    };
  }

  getSuspicionScore() {
    return this.getReport().suspicion_score;
  }
}

function round(n: number, decimals: number) {
  return Math.round(n * 10 ** decimals) / 10 ** decimals;
}