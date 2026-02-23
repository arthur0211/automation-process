// ─── Action Types ───────────────────────────────────────────────────────────

export type ActionType = 'click' | 'input' | 'scroll' | 'navigate' | 'submit';

// ─── Element Metadata ───────────────────────────────────────────────────────

export interface ElementSelector {
  css: string;
  xpath: string;
  confidence?: number;
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

// ─── Validation ─────────────────────────────────────────────────────────────

export type ValidationStatus = 'pending' | 'running' | 'done' | 'error';

export interface ValidationIssue {
  step: number;
  type: 'missing_step' | 'unclear' | 'inaccurate' | 'missing_decision';
  description: string;
}

export interface ValidationSuggestion {
  step: number;
  suggestion: string;
}

export interface ValidationMissingStep {
  afterStep: number;
  description: string;
}

export interface ValidationResult {
  overallScore: number;
  issues: ValidationIssue[];
  suggestions: ValidationSuggestion[];
  missingSteps: ValidationMissingStep[];
  summary: string;
}

// ─── Visual Analysis ───────────────────────────────────────────────────────

export interface VisualAnalysis {
  elements?: { type: string; text: string; position: string }[];
  interactedElement?: { type: string; text: string; description: string };
  pageContext?: { app?: string; section?: string; workflow?: string };
  statusIndicators?: string[];
  layout?: string;
  confidence?: number;
  reasoning?: string;
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
  llmVisualAnalysis?: VisualAnalysis;
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
  validationResult?: ValidationResult;
  validationStatus?: ValidationStatus;
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
    validation?: ValidationResult;
  };
  steps: ProcessStep[];
}

// ─── Capture Settings ──────────────────────────────────────────────────────

export interface CaptureSettings {
  screenshotQuality: number;
  scrollThrottleMs: number;
  inputDebounceMs: number;
}

export const DEFAULT_CAPTURE_SETTINGS: CaptureSettings = {
  screenshotQuality: 80,
  scrollThrottleMs: 1000,
  inputDebounceMs: 500,
};

// ─── Messages (between extension components) ────────────────────────────────

export type MessageType =
  | 'START_RECORDING'
  | 'PAUSE_RECORDING'
  | 'RESUME_RECORDING'
  | 'STOP_RECORDING'
  | 'RESET_RECORDING'
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
