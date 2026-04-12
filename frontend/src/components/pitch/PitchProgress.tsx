'use client';

/**
 * PNME Component: Pitch Progress
 * Shows processing progress with step indicators
 */

import {
  CheckmarkCircleRegular,
  CircleRegular,
  ArrowSyncRegular,
  ErrorCircleRegular,
} from '@fluentui/react-icons';

interface PitchProgressStep {
  step: string;
  status: string;
  progress: number;
  error?: string;
}

interface PitchProgressProps {
  progress: {
    overall: number;
    currentStep: string | null;
    steps: PitchProgressStep[];
  };
}

const stepLabels: Record<string, string> = {
  UPLOAD: 'Upload',
  EXTRACT_TEXT: 'Extracting Text',
  CLASSIFY_SECTIONS: 'Classifying Sections',
  EXTRACT_NEEDS: 'Analyzing Needs',
  BUILD_PROFILES: 'Building Profiles',
  COMPUTE_MATCHES: 'Computing Matches',
  GENERATE_OUTREACH: 'Generating Outreach',
};

const stepDescriptions: Record<string, string> = {
  UPLOAD: 'Uploading your pitch deck',
  EXTRACT_TEXT: 'Extracting text from your document',
  CLASSIFY_SECTIONS: 'Identifying pitch sections (Problem, Solution, etc.)',
  EXTRACT_NEEDS: 'Analyzing what your startup needs',
  BUILD_PROFILES: 'Building profiles for your contacts',
  COMPUTE_MATCHES: 'Finding the best matches for each section',
  GENERATE_OUTREACH: 'Creating personalized outreach messages',
};

export function PitchProgress({ progress }: PitchProgressProps) {
  const { overall, currentStep, steps } = progress;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Overall Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-th-text font-medium">Processing your pitch deck...</span>
          <span className="text-primary-400 font-medium">{overall}%</span>
        </div>
        <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#00d084]/50 rounded-full transition-all duration-500"
            style={{ width: `${overall}%` }}
          />
        </div>
      </div>

      {/* Step List */}
      <div className="space-y-4">
        {steps.map((step, index) => {
          const isCompleted = step.status === 'COMPLETED';
          const isProcessing = step.status === 'PROCESSING';
          const isFailed = step.status === 'FAILED';
          const isPending = step.status === 'PENDING';

          return (
            <div
              key={step.step}
              className={`flex items-start gap-4 p-4 rounded-lg transition-colors ${
                isProcessing
                  ? 'bg-[#00d084]/50/10 border border-[#00d084]/40/30'
                  : isFailed
                  ? 'bg-red-500/10 border border-red-500/30'
                  : 'bg-dark-800'
              }`}
            >
              {/* Status Icon */}
              <div className="mt-0.5">
                {isCompleted && (
                  <CheckmarkCircleRegular className="w-6 h-6 text-green-400" />
                )}
                {isProcessing && (
                  <ArrowSyncRegular className="w-6 h-6 text-primary-400 animate-spin" />
                )}
                {isFailed && (
                  <ErrorCircleRegular className="w-6 h-6 text-red-400" />
                )}
                {isPending && (
                  <CircleRegular className="w-6 h-6 text-dark-500" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span
                    className={`font-medium ${
                      isProcessing
                        ? 'text-th-text'
                        : isCompleted
                        ? 'text-dark-300'
                        : isFailed
                        ? 'text-red-400'
                        : 'text-dark-500'
                    }`}
                  >
                    {stepLabels[step.step] || step.step}
                  </span>
                  {isProcessing && (
                    <span className="text-primary-400 text-sm">{step.progress}%</span>
                  )}
                </div>
                <p
                  className={`text-sm mt-0.5 ${
                    isProcessing ? 'text-dark-300' : 'text-dark-500'
                  }`}
                >
                  {stepDescriptions[step.step] || ''}
                </p>
                {isFailed && step.error && (
                  <p className="text-red-400/70 text-sm mt-1">{step.error}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
