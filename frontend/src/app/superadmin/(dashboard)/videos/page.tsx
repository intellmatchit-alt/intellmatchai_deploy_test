'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getSAVideos,
  createSAVideo,
  updateSAVideo,
  deleteSAVideo,
  getSAVideoCategories,
  getSAVideoTags,
  type SAVideo,
  type SAVideoCategory,
  type SAVideoTag,
} from '@/lib/api/superadmin';

interface VideoForm {
  id?: string;
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  videoUrl: string;
  categoryId: string;
  tagIds: string[];
  duration: string;
  sortOrder: number;
  isActive: boolean;
  isFeatured: boolean;
}

const emptyForm: VideoForm = {
  title: '',
  titleAr: '',
  description: '',
  descriptionAr: '',
  videoUrl: '',
  categoryId: '',
  tagIds: [],
  duration: '',
  sortOrder: 0,
  isActive: true,
  isFeatured: false,
};

function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function getYouTubeThumbnail(url: string): string | null {
  const id = extractYouTubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null;
}

function detectVideoType(url: string): 'YOUTUBE' | 'VIMEO' | null {
  if (/youtube\.com|youtu\.be/.test(url)) return 'YOUTUBE';
  if (/vimeo\.com/.test(url)) return 'VIMEO';
  return null;
}

export default function SAVideosPage() {
  const [videos, setVideos] = useState<SAVideo[]>([]);
  const [categories, setCategories] = useState<SAVideoCategory[]>([]);
  const [tags, setTags] = useState<SAVideoTag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editing, setEditing] = useState<VideoForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [videosRes, catsRes, tagsRes] = await Promise.all([
        getSAVideos(page) as Promise<any>,
        getSAVideoCategories(),
        getSAVideoTags(),
      ]);
      setVideos(videosRes.videos || []);
      setTotalPages(videosRes.pagination?.totalPages || 1);
      setCategories(catsRes);
      setTags(tagsRes);
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const openEdit = (video: SAVideo) => {
    setEditing({
      id: video.id,
      title: video.title,
      titleAr: video.titleAr || '',
      description: video.description || '',
      descriptionAr: video.descriptionAr || '',
      videoUrl: video.videoUrl,
      categoryId: video.categoryId,
      tagIds: video.tags?.map((t) => t.tag.id) || [],
      duration: video.duration || '',
      sortOrder: video.sortOrder,
      isActive: video.isActive,
      isFeatured: video.isFeatured,
    });
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.title || !editing.videoUrl || !editing.categoryId) {
      alert('Title, Video URL, and Category are required.');
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: editing.title,
        titleAr: editing.titleAr || undefined,
        description: editing.description || undefined,
        descriptionAr: editing.descriptionAr || undefined,
        videoUrl: editing.videoUrl,
        categoryId: editing.categoryId,
        tagIds: editing.tagIds,
        duration: editing.duration || undefined,
        sortOrder: editing.sortOrder,
        isActive: editing.isActive,
        isFeatured: editing.isFeatured,
      };
      if (editing.id) {
        await updateSAVideo(editing.id, payload);
      } else {
        await createSAVideo(payload);
      }
      setEditing(null);
      load();
    } catch (err: any) {
      alert(err?.message || 'Error saving');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this video?')) return;
    try {
      await deleteSAVideo(id);
      load();
    } catch (err: any) {
      alert(err?.message || 'Error deleting');
    }
  };

  const toggleTagId = (tagId: string) => {
    if (!editing) return;
    const current = editing.tagIds;
    setEditing({
      ...editing,
      tagIds: current.includes(tagId)
        ? current.filter((id) => id !== tagId)
        : [...current, tagId],
    });
  };

  const thumbnailUrl = useMemo(() => {
    if (!editing?.videoUrl) return null;
    return getYouTubeThumbnail(editing.videoUrl);
  }, [editing?.videoUrl]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-[#00d084] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white font-bold">Videos</h2>
          <p className="text-sm text-white font-bold mt-1">Manage video gallery content</p>
        </div>
        <button
          onClick={() => setEditing({ ...emptyForm })}
          className="flex items-center gap-2 px-4 py-2 bg-[#00d084] hover:bg-[#00b872] text-black font-bold rounded-lg text-sm font-medium transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Video
        </button>
      </div>

      {/* Table */}
      <div className="bg-[#111118] border border-[#2a2a35] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2a2a35]">
              <th className="text-left px-4 py-3 text-white font-bold font-medium">Thumbnail</th>
              <th className="text-left px-4 py-3 text-white font-bold font-medium">Title</th>
              <th className="text-left px-4 py-3 text-white font-bold font-medium">Category</th>
              <th className="text-center px-4 py-3 text-white font-bold font-medium">Type</th>
              <th className="text-center px-4 py-3 text-white font-bold font-medium">Featured</th>
              <th className="text-center px-4 py-3 text-white font-bold font-medium">Active</th>
              <th className="text-center px-4 py-3 text-white font-bold font-medium">Views</th>
              <th className="text-right px-4 py-3 text-white font-bold font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {videos.map((video) => {
              const ytThumb = getYouTubeThumbnail(video.videoUrl);
              return (
                <tr key={video.id} className="border-b border-[#2a2a35] last:border-b-0 hover:bg-[#16161e] transition-colors">
                  <td className="px-4 py-2">
                    {ytThumb || video.thumbnailUrl ? (
                      <img
                        src={ytThumb || video.thumbnailUrl}
                        alt={video.title}
                        className="w-[80px] h-[45px] object-cover rounded"
                      />
                    ) : (
                      <div className="w-[80px] h-[45px] bg-[#1a1a24] rounded flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white font-bold" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-white font-bold font-medium">{video.title}</div>
                    {video.duration && <div className="text-xs text-white font-bold mt-0.5">{video.duration}</div>}
                  </td>
                  <td className="px-4 py-3 text-white font-bold">{video.category?.name || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-medium px-2 py-1 rounded ${
                      video.videoType === 'YOUTUBE'
                        ? 'bg-red-400 text-black border border-red-400'
                        : 'bg-blue-400 text-black border border-blue-400'
                    }`}>
                      {video.videoType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {video.isFeatured ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-yellow-400 mx-auto" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                    ) : (
                      <span className="text-white font-bold">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block w-2.5 h-2.5 rounded-full ${video.isActive ? 'bg-green-400' : 'bg-gray-500'}`} />
                  </td>
                  <td className="px-4 py-3 text-center text-white font-bold">{video.viewCount ?? 0}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(video)}
                        className="px-3 py-1.5 text-xs text-white font-bold hover:text-white font-bold hover:bg-[#1a1a24] rounded-lg transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(video.id)}
                        className="px-3 py-1.5 text-xs text-red-400/70 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {videos.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-12 text-white font-bold">
                  No videos yet. Add one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 text-sm text-white font-bold hover:text-white font-bold hover:bg-[#16161e] rounded-lg disabled:opacity-30 transition-colors border border-[#2a2a35]"
          >
            Previous
          </button>
          <span className="text-sm text-white font-bold">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 text-sm text-white font-bold hover:text-white font-bold hover:bg-[#16161e] rounded-lg disabled:opacity-30 transition-colors border border-[#2a2a35]"
          >
            Next
          </button>
        </div>
      )}

      {/* Edit/Create Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEditing(null)}>
          <div className="bg-[#16161e] rounded-2xl p-6 border border-[#2a2a35] w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white font-bold">{editing.id ? 'Edit Video' : 'Add Video'}</h3>
              <button onClick={() => setEditing(null)} className="p-1 hover:bg-[#2a2a35] rounded-lg text-white font-bold hover:text-white font-bold">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm text-white font-bold mb-1">Title *</label>
              <input
                type="text"
                placeholder="e.g. How to Network Effectively"
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#2a2a35] rounded-lg text-white font-bold text-sm focus:border-[#00d084] focus:outline-none transition-colors"
              />
            </div>

            {/* Title Arabic */}
            <div>
              <label className="block text-sm text-white font-bold mb-1">Title (Arabic)</label>
              <input
                type="text"
                placeholder="e.g. كيف تبني شبكة علاقات"
                value={editing.titleAr}
                onChange={(e) => setEditing({ ...editing, titleAr: e.target.value })}
                className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#2a2a35] rounded-lg text-white font-bold text-sm focus:border-[#00d084] focus:outline-none transition-colors"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm text-white font-bold mb-1">Description</label>
              <textarea
                rows={3}
                placeholder="Brief description of the video..."
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#2a2a35] rounded-lg text-white font-bold text-sm focus:border-[#00d084] focus:outline-none transition-colors resize-none"
              />
            </div>

            {/* Description Arabic */}
            <div>
              <label className="block text-sm text-white font-bold mb-1">Description (Arabic)</label>
              <textarea
                rows={3}
                dir="rtl"
                placeholder="وصف مختصر للفيديو..."
                value={editing.descriptionAr}
                onChange={(e) => setEditing({ ...editing, descriptionAr: e.target.value })}
                className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#2a2a35] rounded-lg text-white font-bold text-sm focus:border-[#00d084] focus:outline-none transition-colors resize-none"
              />
            </div>

            {/* Video URL */}
            <div>
              <label className="block text-sm text-white font-bold mb-1">Video URL * (YouTube or Vimeo)</label>
              <input
                type="text"
                placeholder="https://www.youtube.com/watch?v=..."
                value={editing.videoUrl}
                onChange={(e) => setEditing({ ...editing, videoUrl: e.target.value })}
                className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#2a2a35] rounded-lg text-white font-bold text-sm focus:border-[#00d084] focus:outline-none transition-colors"
              />
              {editing.videoUrl && detectVideoType(editing.videoUrl) && (
                <span className={`inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded ${
                  detectVideoType(editing.videoUrl) === 'YOUTUBE'
                    ? 'bg-red-400 text-black'
                    : 'bg-blue-400 text-black'
                }`}>
                  {detectVideoType(editing.videoUrl)}
                </span>
              )}
            </div>

            {/* Thumbnail Preview */}
            {thumbnailUrl && (
              <div>
                <label className="block text-sm text-white font-bold mb-1">Thumbnail Preview</label>
                <img src={thumbnailUrl} alt="Thumbnail preview" className="w-full max-w-[320px] rounded-lg border border-[#2a2a35]" />
              </div>
            )}

            {/* Category */}
            <div>
              <label className="block text-sm text-white font-bold mb-1">Category *</label>
              <select
                value={editing.categoryId}
                onChange={(e) => setEditing({ ...editing, categoryId: e.target.value })}
                className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#2a2a35] rounded-lg text-white font-bold text-sm focus:border-[#00d084] focus:outline-none transition-colors"
              >
                <option value="">Select a category</option>
                {categories.filter((c) => c.isActive).map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            {/* Tags (multi-select checkboxes) */}
            <div>
              <label className="block text-sm text-white font-bold mb-2">Tags</label>
              <div className="flex flex-wrap gap-2">
                {tags.filter((t) => t.isActive).map((tag) => (
                  <label
                    key={tag.id}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer border transition-colors ${
                      editing.tagIds.includes(tag.id)
                        ? 'bg-emerald-400 text-black border-emerald-400 font-bold'
                        : 'bg-[#0a0a0f] text-white font-bold border-[#2a2a35] hover:border-[#3a3a45]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={editing.tagIds.includes(tag.id)}
                      onChange={() => toggleTagId(tag.id)}
                      className="sr-only"
                    />
                    {tag.name}
                  </label>
                ))}
                {tags.filter((t) => t.isActive).length === 0 && (
                  <span className="text-xs text-white font-bold">No tags available. Create tags first.</span>
                )}
              </div>
            </div>

            {/* Duration + Sort Order */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-white font-bold mb-1">Duration</label>
                <input
                  type="text"
                  placeholder="e.g. 5:30"
                  value={editing.duration}
                  onChange={(e) => setEditing({ ...editing, duration: e.target.value })}
                  className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#2a2a35] rounded-lg text-white font-bold text-sm focus:border-[#00d084] focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm text-white font-bold mb-1">Sort Order</label>
                <input
                  type="number"
                  placeholder="0"
                  value={editing.sortOrder}
                  onChange={(e) => setEditing({ ...editing, sortOrder: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#2a2a35] rounded-lg text-white font-bold text-sm focus:border-[#00d084] focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Toggles */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editing.isActive}
                  onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })}
                  className="rounded border-[#2a2a35] bg-[#0a0a0f]"
                />
                <label className="text-sm text-white font-bold">Active</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editing.isFeatured}
                  onChange={(e) => setEditing({ ...editing, isFeatured: e.target.checked })}
                  className="rounded border-[#2a2a35] bg-[#0a0a0f]"
                />
                <label className="text-sm text-white font-bold">Featured</label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-white font-bold hover:text-white font-bold transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-[#00d084] hover:bg-[#00b872] disabled:opacity-50 text-black font-bold rounded-lg text-sm font-medium transition-colors"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
