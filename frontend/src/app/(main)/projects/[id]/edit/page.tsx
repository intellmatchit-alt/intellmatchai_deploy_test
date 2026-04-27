/**
 * Edit Project Page
 *
 * Edit existing project information using the shared ProjectForm.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { ArrowLeft24Regular } from '@fluentui/react-icons';
import { getProject, updateProject, Project, UpdateProjectInput } from '@/lib/api/projects';
import ProjectForm from '@/components/projects/ProjectForm';
import { toast } from '@/components/ui/Toast';

export default function EditProjectPage() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        setIsFetching(true);
        const data = await getProject(projectId);
        setProject(data);
      } catch (error: any) {
        console.error('Error fetching project:', error);
        toast({
          title: t.common?.error || 'Error',
          description: 'Failed to load project',
          variant: 'error',
        });
        router.push('/projects');
      } finally {
        setIsFetching(false);
      }
    };

    if (projectId) {
      fetchProject();
    }
  }, [projectId, router, t]);

  const handleSubmit = async (data: UpdateProjectInput | import('@/lib/api/projects').CreateProjectInput) => {
    setIsSubmitting(true);
    try {
      await updateProject(projectId, data as UpdateProjectInput);
      toast({ title: t.projects?.updated || 'Project updated', variant: 'success' });
      router.push(`/projects/${projectId}?updated=${Date.now()}`);
      router.refresh();
    } catch (error: any) {
      toast({ title: t.common?.error || 'Error', description: error.message, variant: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isFetching) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin h-10 w-10 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!project) {
    return null;
  }

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
        <h1 className="text-2xl font-bold text-th-text">{t.projects?.editProject || 'Edit Project'}</h1>
      </div>

      <ProjectForm
        project={project}
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
