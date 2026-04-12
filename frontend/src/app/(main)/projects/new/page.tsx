/**
 * New Project Page
 *
 * Create a new collaboration project using the shared ProjectForm.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import {
  ArrowLeft24Regular,
  Checkmark24Regular,
  Add24Regular,
} from '@fluentui/react-icons';
import { createProject, CreateProjectInput } from '@/lib/api/projects';
import ProjectForm from '@/components/projects/ProjectForm';
import { toast } from '@/components/ui/Toast';

export default function NewProjectPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  const handleSubmit = async (data: CreateProjectInput | import('@/lib/api/projects').UpdateProjectInput) => {
    setIsSubmitting(true);
    try {
      const project = await createProject(data as CreateProjectInput);
      setCreatedProjectId(project.id);
      setShowSuccess(true);
    } catch (error: any) {
      toast({ title: t.common?.error || 'Error', description: error.message, variant: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewProject = () => {
    if (createdProjectId) {
      router.push(`/projects/${createdProjectId}`);
    }
  };

  const handleAddAnother = () => {
    setShowSuccess(false);
    setCreatedProjectId(null);
    setFormKey(prev => prev + 1);
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
        <h1 className="text-2xl font-bold text-th-text">{t.projects?.newProject || 'New Project'}</h1>
      </div>

      <ProjectForm
        key={formKey}
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
        isSubmitting={isSubmitting}
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
                {t.projects?.createdSuccessTitle || 'Project Created Successfully!'}
              </h2>
              <p className="text-th-text-t mb-6">
                {t.projects?.createdSuccessDesc || 'Your project has been created and is ready for collaboration.'}
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleViewProject}
                  className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all"
                >
                  {t.projects?.viewProject || 'View Project'}
                </button>
                <button
                  onClick={handleAddAnother}
                  className="w-full py-3 bg-th-surface-h border border-white/20 text-th-text font-medium rounded-xl hover:bg-th-surface-h transition-all flex items-center justify-center gap-2"
                >
                  <Add24Regular className="w-5 h-5" />
                  {t.projects?.addAnother || 'Add Another Project'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
