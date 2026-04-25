/**
 * New Pitch Page
 *
 * Slim wrapper around PitchForm for creating a new pitch.
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import {
  ArrowLeft24Regular,
  Checkmark24Regular,
  Add24Regular,
} from "@fluentui/react-icons";
import { createPitch, CreatePitchInput } from "@/lib/api/pitch";
import { toast } from "@/components/ui/Toast";
import PitchForm from "@/components/pitch/PitchForm";

export default function NewPitchPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdPitchId, setCreatedPitchId] = useState<string | null>(null);

  const handleSubmit = async (data: CreatePitchInput) => {
    setIsLoading(true);
    try {
      const pitch = await createPitch(data);
      setCreatedPitchId(pitch.id);
      setShowSuccess(true);
    } catch (error: any) {
      toast({
        title: t.common?.error || "Error",
        description: error.message,
        variant: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewPitch = () => {
    if (createdPitchId) router.push(`/pitch/${createdPitchId}`);
  };

  const handleAddAnother = () => {
    setShowSuccess(false);
    setCreatedPitchId(null);
    // Force a full remount of the form by navigating to the same page
    router.replace("/pitch/new");
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-th-surface-h text-th-text-t hover:text-th-text transition-colors"
        >
          <ArrowLeft24Regular className="w-5 h-5 rtl:rotate-180" />
        </button>
        <h1 className="text-2xl font-bold text-th-text">
          {t.pitch?.newPitch || "New Pitch"}
        </h1>
      </div>

      <PitchForm
        onSubmit={handleSubmit as any}
        onCancel={() => router.back()}
        isSubmitting={isLoading}
      />

      {/* Success Dialog */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-th-bg-s border border-th-border rounded-2xl p-8 max-w-md mx-4 shadow-2xl">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Checkmark24Regular className="w-8 h-8 text-green-400" />
              </div>
              <h2 className="text-xl font-semibold text-th-text mb-2">
                Pitch Created!
              </h2>
              <p className="text-th-text-t mb-6">
                Your pitch is live and ready for AI matching.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleViewPitch}
                  className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all"
                >
                  View Pitch & Find Matches
                </button>
                <button
                  onClick={handleAddAnother}
                  className="w-full py-3 bg-th-surface-h border border-white/20 text-th-text font-medium rounded-xl hover:bg-th-surface-h transition-all flex items-center justify-center gap-2"
                >
                  <Add24Regular className="w-5 h-5" />
                  Create Another Pitch
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
