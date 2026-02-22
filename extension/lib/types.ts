// ─── Action Types ───────────────────────────────────────────────────────────

export type ActionType = 'click' | 'input' | 'scroll' | 'navigate' | 'submit';

// ─── Element Metadata ───────────────────────────────────────────────────────

export interface ElementSelector {
  css: string;
  xpath: string;
  role?: string;
  testId?: string;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ClickCoordinates {
  x: number;
  y: number;
  pageX: number;
  pageY: number;
}

export interface ElementMetadata {
  tag: string;
  id: string;
  classes: string[];
  text: string;
  role: string;
  ariaLabel: string;
  name: string;
  type: string;
  href: string;
  placeholder: string;
  boundingBox: BoundingBox;
  selectors: ElementSelector;
}

// ─── Decision Points ────────────────────────────────────────────────────────

export interface DecisionBranch {
  condition: string;
  description: string;
}

export interface DecisionPoint {
  isDecisionPoint: boolean;
  reason: string;
  branches: DecisionBranch[];
}

// ─── Captured Action ────────────────────────────────────────────────────────

export interface CapturedAction {
  id: string;
  sessionId: string;
  timestamp: number;
  sequenceNumber: number;
  actionType: ActionType;
  url: string;
  pageTitle: string;
  element: ElementMetadata;
  clickCoordinates?: ClickCoordinates;
  inputValue?: string;
  scrollPosition?: { x: number; y: number };
  screenshotDataUrl?: string;
  description: string;
  note: string;
  decisionPoint: DecisionPoint;
  llmDescription?: string;
  llmVisualAnalysis?: Record<string, unknown>;
}

// ─── Recording Session ──────────────────────────────────────────────────────

export type RecordingStatus = 'idle' | 'recording' | 'paused' | 'stopped';

export interface RecordingSession {
  id: string;
  name: string;
  startedAt: number;
  stoppedAt?: number;
  status: RecordingStatus;
  url: string;
  actionCount: number;
}

// ─── Process Export ─────────────────────────────────────────────────────────

export interface ProcessStep {
  stepNumber: number;
  actionType: ActionType;
  url: string;
  pageTitle: string;
  element: ElementMetadata;
  description: string;
  note: string;
  screenshotDataUrl?: string;
  decisionPoint: DecisionPoint;
  timestamp: number;
}

export interface ProcessExport {
  version: '1.0.0';
  metadata: {
    name: string;
    createdAt: string;
    totalSteps: number;
    startUrl: string;
    duration: number;
  };
  steps: ProcessStep[];
}

// ─── Messages (between extension components) ────────────────────────────────

export type MessageType =
  | 'START_RECORDING'
  | 'PAUSE_RECORDING'
  | 'RESUME_RECORDING'
  | 'STOP_RECORDING'
  | 'ACTION_CAPTURED'
  | 'SCREENSHOT_TAKEN'
  | 'GET_STATUS'
  | 'STATUS_UPDATE'
  | 'START_TAB_CAPTURE'
  | 'STOP_TAB_CAPTURE';

export interface ExtensionMessage {
  type: MessageType;
  payload?: unknown;
}

export interface ActionCapturedPayload {
  action: Omit<CapturedAction, 'screenshotDataUrl'>;
}

export interface ScreenshotPayload {
  actionId: string;
  dataUrl: string;
}

export interface StatusPayload {
  status: RecordingStatus;
  sessionId?: string;
  actionCount: number;
}

export interface TabCapturePayload {
  streamId: string;
}
