import { DomainError } from './errors.js';
import { planTemplateDay, templateById, type TrainingAdaptationOverlay } from './programs.js';
import type { CoachingRecommendation } from './recommendation.js';
import { assertRecommendationMayApply, payloadKind } from './recommendation.js';
import type { PlannedExercise } from './training.js';

/** Bounded training change kinds that may mutate a real program version. */
export const TRAINING_ADAPTATION_KINDS = [
  'recovery_preference',
  'volume_deload',
  'session_intensity_ease',
  'progressive_overload_hint',
] as const;

export type TrainingAdaptationKind = (typeof TRAINING_ADAPTATION_KINDS)[number];

export type { TrainingAdaptationOverlay };

export type ProgramVersionDocument = {
  templateId: string;
  days: readonly { name_ar: string; name_en: string; exerciseIds: readonly string[] }[];
  adaptation?: TrainingAdaptationOverlay | null;
  sourceRecommendationId?: string | null;
};

export type ProgramAdaptationDiff = {
  kind: TrainingAdaptationKind;
  summary: string;
  before: {
    programVersion: number;
    volumeScaleBps: number;
    restSecondsDelta: number;
    loadIncrementPctMax: number;
    sampleDayExercises: readonly { exerciseId: string; sets: number; restSeconds: number }[];
  };
  after: {
    programVersion: number;
    volumeScaleBps: number;
    restSecondsDelta: number;
    loadIncrementPctMax: number;
    sampleDayExercises: readonly { exerciseId: string; sets: number; restSeconds: number }[];
  };
  changes: readonly string[];
};

export type ProgramAdaptationPlan = {
  nextDocument: ProgramVersionDocument;
  overlay: TrainingAdaptationOverlay;
  diff: ProgramAdaptationDiff;
};

const KIND_SET = new Set<string>(TRAINING_ADAPTATION_KINDS);

export function isTrainingAdaptationKind(value: string): value is TrainingAdaptationKind {
  return KIND_SET.has(value);
}

function clampVolumeBps(value: number): number {
  if (!Number.isFinite(value)) return 10_000;
  return Math.min(10_000, Math.max(5_000, Math.round(value)));
}

function clampRestDelta(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(120, Math.max(0, Math.round(value)));
}

function clampLoadPct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(5, Math.max(0, Math.round(value)));
}

/** Map recommendation payload → bounded overlay. Rejects nutrition / unknown kinds. */
export function overlayFromRecommendation(
  rec: CoachingRecommendation,
  at: string,
  options: { requireApproved?: boolean } = {},
): TrainingAdaptationOverlay {
  if (rec.category !== 'training') {
    throw new DomainError('NOT_TRAINING_ADAPTATION', 'Only training recommendations mutate programs');
  }
  const kind = payloadKind(rec);
  if (!isTrainingAdaptationKind(kind)) {
    throw new DomainError('TRAINING_APPLY_NOT_PERMITTED', 'Payload kind is not a permitted training adaptation');
  }
  if (options.requireApproved !== false) {
    assertRecommendationMayApply(rec);
  } else if (rec.status !== 'APPROVED' && rec.status !== 'MEMBER_CONFIRMATION_REQUIRED') {
    throw new DomainError('NOT_APPROVED', 'Preview requires confirmation-ready or approved status');
  }

  if (kind === 'recovery_preference' || kind === 'session_intensity_ease') {
    return {
      kind,
      volumeScaleBps: clampVolumeBps(7_000),
      restSecondsDelta: clampRestDelta(30),
      loadIncrementPctMax: 0,
      recommendationId: rec.id,
      appliedAt: at,
    };
  }
  if (kind === 'volume_deload') {
    const raw = typeof rec.payload.volumeScaleBps === 'number' ? rec.payload.volumeScaleBps : 7_000;
    return {
      kind,
      volumeScaleBps: clampVolumeBps(raw),
      restSecondsDelta: clampRestDelta(15),
      loadIncrementPctMax: 0,
      recommendationId: rec.id,
      appliedAt: at,
    };
  }
  // progressive_overload_hint — volume unchanged; soft load hint only
  const load =
    typeof rec.payload.loadIncrementPctMax === 'number' ? rec.payload.loadIncrementPctMax : 5;
  return {
    kind,
    volumeScaleBps: 10_000,
    restSecondsDelta: 0,
    loadIncrementPctMax: clampLoadPct(load),
    recommendationId: rec.id,
    appliedAt: at,
  };
}

export function parseProgramVersionDocument(raw: unknown): ProgramVersionDocument {
  if (typeof raw !== 'object' || raw === null) {
    throw new DomainError('INVALID_PROGRAM_VERSION', 'Program version template is invalid');
  }
  const doc = raw as Record<string, unknown>;
  if (typeof doc.templateId !== 'string' || doc.templateId.length < 1) {
    throw new DomainError('INVALID_PROGRAM_VERSION', 'templateId is required on program version');
  }
  if (!Array.isArray(doc.days)) {
    throw new DomainError('INVALID_PROGRAM_VERSION', 'days are required on program version');
  }
  const adaptation =
    doc.adaptation === undefined || doc.adaptation === null
      ? null
      : (doc.adaptation as TrainingAdaptationOverlay);
  return {
    templateId: doc.templateId,
    days: doc.days as ProgramVersionDocument['days'],
    adaptation,
    sourceRecommendationId:
      typeof doc.sourceRecommendationId === 'string' ? doc.sourceRecommendationId : null,
  };
}

function sampleDaySnapshot(
  templateId: string,
  overlay: TrainingAdaptationOverlay | null,
): readonly { exerciseId: string; sets: number; restSeconds: number }[] {
  const planned = planTemplateDay(templateId, 0, overlay);
  return planned.exercises.slice(0, 4).map((exercise) => snapshotExercise(exercise));
}

function snapshotExercise(exercise: PlannedExercise): {
  exerciseId: string;
  sets: number;
  restSeconds: number;
} {
  if (exercise.prescription.kind === 'strength') {
    return {
      exerciseId: exercise.exerciseId,
      sets: exercise.prescription.sets,
      restSeconds: exercise.prescription.restSeconds,
    };
  }
  return { exerciseId: exercise.exerciseId, sets: 0, restSeconds: 0 };
}

export function buildProgramAdaptationPlan(input: {
  recommendation: CoachingRecommendation;
  currentDocument: ProgramVersionDocument;
  currentVersion: number;
  at: string;
  /** When true, skip APPROVED gate (member preview before confirm). */
  preview?: boolean;
}): ProgramAdaptationPlan {
  const { recommendation, currentDocument, currentVersion, at } = input;
  if (currentVersion < 1) {
    throw new DomainError('INVALID_PROGRAM_VERSION', 'Program version must be >= 1');
  }
  const expected = recommendation.payload.expectedProgramVersion;
  // Non-preview applies fail closed without a version stamp so adaptations cannot land on a newer plan silently.
  if (input.preview !== true && typeof expected !== 'number') {
    throw new DomainError(
      'MISSING_EXPECTED_PROGRAM_VERSION',
      'Training adaptations require expectedProgramVersion before apply',
    );
  }
  if (typeof expected === 'number' && expected !== currentVersion) {
    throw new DomainError(
      'STALE_PROGRAM_VERSION',
      `Recommendation expects program version ${expected} but current is ${currentVersion}`,
    );
  }
  if (currentDocument.sourceRecommendationId === recommendation.id) {
    throw new DomainError('ADAPTATION_ALREADY_APPLIED', 'This recommendation already produced a program version');
  }
  const catalog = templateById(currentDocument.templateId);
  if (catalog === null) {
    throw new DomainError('UNKNOWN_TEMPLATE', 'Active program template is unknown');
  }

  const overlay = overlayFromRecommendation(recommendation, at, {
    requireApproved: input.preview === true ? false : true,
  });
  const beforeOverlay = currentDocument.adaptation ?? null;
  const nextDocument: ProgramVersionDocument = {
    templateId: currentDocument.templateId,
    days: currentDocument.days.length > 0 ? currentDocument.days : catalog.days,
    adaptation: overlay,
    sourceRecommendationId: recommendation.id,
  };

  const changes: string[] = [];
  const beforeVol = beforeOverlay?.volumeScaleBps ?? 10_000;
  const beforeRest = beforeOverlay?.restSecondsDelta ?? 0;
  const beforeLoad = beforeOverlay?.loadIncrementPctMax ?? 0;
  if (overlay.volumeScaleBps !== beforeVol) {
    changes.push(`volume_scale_bps ${beforeVol} → ${overlay.volumeScaleBps}`);
  }
  if (overlay.restSecondsDelta !== beforeRest) {
    changes.push(`rest_seconds_delta ${beforeRest} → ${overlay.restSecondsDelta}`);
  }
  if (overlay.loadIncrementPctMax !== beforeLoad) {
    changes.push(`load_increment_pct_max ${beforeLoad} → ${overlay.loadIncrementPctMax}`);
  }
  if (changes.length === 0) {
    changes.push(`adaptation_kind=${overlay.kind}`);
  }

  const diff: ProgramAdaptationDiff = {
    kind: overlay.kind,
    summary: recommendation.summary,
    before: {
      programVersion: currentVersion,
      volumeScaleBps: beforeVol,
      restSecondsDelta: beforeRest,
      loadIncrementPctMax: beforeLoad,
      sampleDayExercises: sampleDaySnapshot(currentDocument.templateId, beforeOverlay),
    },
    after: {
      programVersion: currentVersion + 1,
      volumeScaleBps: overlay.volumeScaleBps,
      restSecondsDelta: overlay.restSecondsDelta,
      loadIncrementPctMax: overlay.loadIncrementPctMax,
      sampleDayExercises: sampleDaySnapshot(currentDocument.templateId, overlay),
    },
    changes,
  };

  return { nextDocument, overlay, diff };
}
