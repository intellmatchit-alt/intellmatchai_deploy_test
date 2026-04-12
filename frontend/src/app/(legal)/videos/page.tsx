'use client';

/**
 * Public Video Gallery Page
 *
 * Displays external videos (YouTube/Vimeo) organized by categories and tags.
 * Landing-page style dark theme, bilingual (EN/AR).
 */

import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft24Regular,
  Translate24Regular,
  Search24Regular,
  Dismiss24Regular,
  PlayCircle24Filled,
  Star24Filled,
  Eye24Regular,
  Heart24Regular,
  Heart24Filled,
  Share24Regular,
} from '@fluentui/react-icons';
import { I18nProvider, useI18n, languages, type LanguageCode } from '@/lib/i18n';

// ============================================================
// Types
// ============================================================
interface VideoCategory {
  id: string;
  name: string;
  nameAr?: string;
  slug: string;
  _count?: { videos: number };
}
interface VideoTag {
  id: string;
  name: string;
  nameAr?: string;
}
interface Video {
  id: string;
  title: string;
  titleAr?: string;
  description?: string;
  descriptionAr?: string;
  videoUrl: string;
  videoType: 'YOUTUBE' | 'VIMEO';
  videoId: string;
  thumbnailUrl?: string;
  duration?: string;
  category?: VideoCategory;
  tags?: Array<{ tag: VideoTag }>;
  isFeatured: boolean;
  viewCount: number;
  likeCount: number;
  shareCount: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://intellmatch.com/api/v1';

// ============================================================
// Language Switcher
// ============================================================
const LanguageSwitcher = () => {
  const { lang, setLang } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const current = languages[lang];

  return (
    <div className="relative z-[100]">
      <button type="button" onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition-colors cursor-pointer">
        <Translate24Regular className="w-5 h-5" />
        <span className="hidden sm:inline">{current.flag} {current.name}</span>
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-[150]" onClick={() => setIsOpen(false)} />
          <div className="absolute end-0 top-full mt-2 w-44 bg-[#0c1222] border border-white/20 rounded-lg shadow-2xl z-[200] overflow-hidden">
            {Object.values(languages).map((language) => (
              <button
                key={language.code}
                onClick={() => { setLang(language.code as LanguageCode); setIsOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors ${lang === language.code ? 'bg-[#00d084]/10 text-[#00d084]' : 'text-white/70 hover:bg-white/5 hover:text-white'}`}
              >
                <span className="text-lg">{language.flag}</span>
                <span>{language.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// ============================================================
// Video Gallery Content
// ============================================================
function VideoGalleryContent() {
  const { t, lang, dir } = useI18n();
  const vt = (t as any).videoGallery || {};

  const [categories, setCategories] = useState<VideoCategory[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [likedVideos, setLikedVideos] = useState<Set<string>>(new Set());

  // Load liked videos from localStorage
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('liked_videos') || '[]');
      setLikedVideos(new Set(stored));
    } catch {}
  }, []);

  const handleLike = (videoId: string) => {
    if (likedVideos.has(videoId)) return;
    setLikedVideos(prev => {
      const next = new Set(prev);
      next.add(videoId);
      localStorage.setItem('liked_videos', JSON.stringify([...next]));
      return next;
    });
    setVideos(prev => prev.map(v => v.id === videoId ? { ...v, likeCount: (v.likeCount || 0) + 1 } : v));
    if (selectedVideo?.id === videoId) setSelectedVideo(prev => prev ? { ...prev, likeCount: (prev.likeCount || 0) + 1 } : prev);
    fetch(`${API_URL}/videos/${videoId}/like`, { method: 'POST' }).catch(() => {});
  };

  const handleShare = async (video: Video) => {
    const url = `${window.location.origin}/videos?v=${video.videoId}`;
    const title = biTitle(video);
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        fetch(`${API_URL}/videos/${video.id}/share`, { method: 'POST' }).catch(() => {});
        setVideos(prev => prev.map(v => v.id === video.id ? { ...v, shareCount: (v.shareCount || 0) + 1 } : v));
      } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      fetch(`${API_URL}/videos/${video.id}/share`, { method: 'POST' }).catch(() => {});
      setVideos(prev => prev.map(v => v.id === video.id ? { ...v, shareCount: (v.shareCount || 0) + 1 } : v));
      alert(vt.linkCopied || 'Link copied to clipboard!');
    }
  };

  // Fetch categories on mount
  useEffect(() => {
    fetch(`${API_URL}/videos/categories`)
      .then(r => r.json())
      .then(d => { if (d.success) setCategories(d.data); })
      .catch(() => {});
  }, []);

  // Fetch videos
  const loadVideos = useCallback(async (p: number, append = false) => {
    setLoading(!append);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '12' });
      if (activeCategoryId) params.set('categoryId', activeCategoryId);
      if (search.trim()) params.set('search', search.trim());
      const res = await fetch(`${API_URL}/videos?${params}`);
      const data = await res.json();
      if (data.success) {
        const newVideos = data.data.videos || [];
        setVideos(prev => append ? [...prev, ...newVideos] : newVideos);
        setTotalPages(data.data.pagination?.totalPages || 1);
        setPage(p);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [activeCategoryId, search]);

  useEffect(() => { loadVideos(1); }, [loadVideos]);

  // Track view
  const trackView = (id: string) => {
    fetch(`${API_URL}/videos/${id}/view`, { method: 'POST' }).catch(() => {});
  };

  const openVideo = (video: Video) => {
    setSelectedVideo(video);
    trackView(video.id);
  };

  const biTitle = (v: Video) => (lang === 'ar' && v.titleAr) ? v.titleAr : v.title;
  const biDesc = (v: Video) => (lang === 'ar' && v.descriptionAr) ? v.descriptionAr : v.description;
  const biCatName = (c?: VideoCategory) => c ? ((lang === 'ar' && c.nameAr) ? c.nameAr : c.name) : '';

  return (
    <div className="min-h-screen bg-[#060b18] text-white" dir={dir}>
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#060b18]/90 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2 text-white/70 hover:text-[#00d084] transition-colors">
              <ArrowLeft24Regular className="w-5 h-5 rtl:rotate-180" />
              <img src="/intelllogo.png" alt="IntellMatch" className="h-8 w-auto" />
            </Link>
            <LanguageSwitcher />
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-12 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] rounded-full" style={{ background: 'radial-gradient(ellipse, rgba(0,208,132,0.12) 0%, transparent 70%)' }} />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 bg-[#00d084]/10 border border-[#00d084]/20 rounded-full px-4 py-2 mb-6">
            <PlayCircle24Filled className="w-4 h-4 text-[#00d084]" />
            <span className="text-[#00d084] text-sm font-medium">{vt.badge || 'Video Gallery'}</span>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4">
            <span className="text-white">{vt.title || 'Video'} </span>
            <span style={{ background: 'linear-gradient(135deg, #00d084, #00e896)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{vt.titleHighlight || 'Gallery'}</span>
          </h1>
          <p className="text-lg text-white/70 max-w-2xl mx-auto">{vt.subtitle || 'Watch tutorials, demos, and insights about IntellMatch'}</p>
        </div>
      </section>

      {/* Filters */}
      <section className="max-w-7xl mx-auto px-6 lg:px-8 mb-10">
        {/* Search - always centered */}
        <div className="relative max-w-lg mx-auto mb-6">
          <Search24Regular className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={vt.searchPlaceholder || 'Search videos...'}
            className="w-full ps-12 pe-12 py-3.5 bg-white/[0.06] border border-[#00d084]/30 rounded-2xl text-white placeholder-white/40 focus:outline-none focus:border-[#00d084]/60 focus:bg-white/[0.08] focus:shadow-[0_0_24px_rgba(0,208,132,0.15)] transition-all text-sm shadow-[0_0_12px_rgba(0,208,132,0.06)]"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute end-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white">
              <Dismiss24Regular className="w-5 h-5" />
            </button>
          )}
        </div>
        {/* Categories - centered */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button onClick={() => { setActiveCategoryId(null); setPage(1); }} className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 ${!activeCategoryId ? 'bg-[#00d084] text-[#060b18] shadow-[0_0_16px_rgba(0,208,132,0.3)]' : 'bg-white/[0.06] text-white/80 border border-white/15 hover:bg-white/10 hover:text-white hover:border-white/25 hover:scale-105'}`}>{vt.allCategories || 'All'}</button>
          {categories.map((cat) => (
            <button key={cat.id} onClick={() => { setActiveCategoryId(cat.id); setPage(1); }} className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 ${activeCategoryId === cat.id ? 'bg-[#00d084] text-[#060b18] shadow-[0_0_16px_rgba(0,208,132,0.3)]' : 'bg-white/[0.06] text-white/80 border border-white/15 hover:bg-white/10 hover:text-white hover:border-white/25 hover:scale-105'}`}>
              {biCatName(cat)} {cat._count?.videos ? <span className="text-white/40 ms-0.5">({cat._count.videos})</span> : ''}
            </button>
          ))}
        </div>
      </section>

      {/* Video Grid */}
      <section className="max-w-7xl mx-auto px-6 lg:px-8 pb-20">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-2 border-[#00d084] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-20">
            <PlayCircle24Filled className="w-16 h-16 text-white/20 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white/50 mb-2">{vt.noVideos || 'No videos found'}</h3>
            <p className="text-white/30 text-sm">{vt.noVideosDesc || 'Check back later for new content'}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {videos.map((video) => (
                <div key={video.id} onClick={() => openVideo(video)} className="group cursor-pointer bg-[rgba(12,18,34,0.8)] border border-white/[0.08] rounded-2xl overflow-hidden backdrop-blur-[12px] hover:border-[rgba(0,208,132,0.25)] hover:shadow-[0_0_40px_rgba(0,208,132,0.1)] hover:-translate-y-1.5 transition-all duration-300">
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-[#0c1222]">
                    {video.thumbnailUrl ? (
                      <img src={video.thumbnailUrl} alt={biTitle(video)} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#0c1222] to-[#060b18]">
                        <PlayCircle24Filled className="w-14 h-14 text-white/10" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#060b18]/60 via-transparent to-transparent" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="w-16 h-16 rounded-full bg-[#00d084]/90 flex items-center justify-center shadow-xl shadow-[#00d084]/40 scale-90 group-hover:scale-100 transition-transform duration-300">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-[#060b18] ms-1" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                      </div>
                    </div>
                    {video.duration && (
                      <span className="absolute bottom-2 end-2 px-2 py-0.5 bg-black/80 text-white text-xs rounded-md font-mono font-medium">{video.duration}</span>
                    )}
                    {video.isFeatured && (
                      <span className="absolute top-2.5 start-2.5 inline-flex items-center gap-1 px-2.5 py-1 bg-[#00d084] text-[#060b18] text-[10px] font-bold rounded-lg shadow-lg shadow-[#00d084]/30">
                        <Star24Filled className="w-3 h-3" />{vt.featured || 'Featured'}
                      </span>
                    )}
                    <span className={`absolute top-2.5 end-2.5 px-2 py-0.5 text-[10px] font-bold rounded-md ${video.videoType === 'YOUTUBE' ? 'bg-red-600 text-white' : 'bg-blue-500 text-white'}`}>{video.videoType === 'YOUTUBE' ? 'YT' : 'VM'}</span>
                  </div>
                  {/* Content */}
                  <div className="p-5">
                    <h3 className="text-white font-bold text-base mb-1.5 line-clamp-2 leading-snug group-hover:text-[#00d084] transition-colors duration-300">{biTitle(video)}</h3>
                    {biDesc(video) && <p className="text-white font-semibold text-sm line-clamp-2 mb-3 leading-relaxed">{biDesc(video)}</p>}
                    {/* Category label */}
                    {biCatName(video.category) && (
                      <span className="inline-block text-[11px] text-[#00d084] font-semibold bg-[#00d084]/10 px-2.5 py-1 rounded-full mb-3">{biCatName(video.category)}</span>
                    )}
                    {/* Stats row */}
                    <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
                      <div className="flex items-center gap-3.5">
                        <span className="text-xs text-white font-bold flex items-center gap-1.5"><Eye24Regular className="w-4 h-4 text-white/80" />{video.viewCount}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleLike(video.id); }}
                          className={`text-xs font-bold flex items-center gap-1.5 transition-all duration-200 ${likedVideos.has(video.id) ? 'text-red-400' : 'text-white hover:text-red-400'}`}
                        >
                          {likedVideos.has(video.id) ? <Heart24Filled className="w-4 h-4" /> : <Heart24Regular className="w-4 h-4 text-white/80" />}
                          {(video.likeCount || 0) > 0 && (video.likeCount || 0)}
                        </button>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleShare(video); }}
                        className="text-xs text-white font-bold hover:text-[#00d084] flex items-center gap-1.5 transition-all duration-200"
                      >
                        <Share24Regular className="w-4 h-4 text-white/80" />
                      </button>
                    </div>
                    {/* Tags */}
                    {video.tags && video.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {video.tags.map(({ tag }) => (
                          <span key={tag.id} className="px-2.5 py-1 text-[11px] font-semibold bg-white/[0.10] text-white rounded-lg border border-white/[0.15] hover:bg-white/15 hover:text-white transition-colors">
                            {(lang === 'ar' && tag.nameAr) ? tag.nameAr : tag.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Load More */}
            {page < totalPages && (
              <div className="text-center mt-10">
                <button onClick={() => loadVideos(page + 1, true)} className="px-8 py-3 bg-[#00d084] text-[#060b18] font-semibold rounded-xl hover:bg-[#00e896] hover:shadow-[0_0_24px_rgba(0,208,132,0.3)] transition-all">
                  {vt.loadMore || 'Load More'}
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* Video Modal */}
      {selectedVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedVideo(null)} />
          <div className="relative w-full max-w-4xl z-10">
            <button onClick={() => setSelectedVideo(null)} className="absolute -top-12 end-0 flex items-center gap-2 text-white/70 hover:text-white transition-colors text-sm">
              <Dismiss24Regular className="w-5 h-5" />{vt.closeVideo || 'Close'}
            </button>
            <div className="relative w-full rounded-2xl overflow-hidden shadow-2xl" style={{ paddingBottom: '56.25%' }}>
              <iframe
                className="absolute inset-0 w-full h-full"
                src={selectedVideo.videoType === 'YOUTUBE'
                  ? `https://www.youtube.com/embed/${selectedVideo.videoId}?autoplay=1&rel=0`
                  : `https://player.vimeo.com/video/${selectedVideo.videoId}?autoplay=1`}
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
              />
            </div>
            <div className="flex items-center justify-between mt-4">
              <h3 className="text-white font-semibold text-lg flex-1">{biTitle(selectedVideo)}</h3>
              <div className="flex items-center gap-4 flex-shrink-0">
                <button
                  onClick={() => handleLike(selectedVideo.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${likedVideos.has(selectedVideo.id) ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white/70 hover:bg-red-500/20 hover:text-red-400'}`}
                >
                  {likedVideos.has(selectedVideo.id) ? <Heart24Filled className="w-4 h-4" /> : <Heart24Regular className="w-4 h-4" />}
                  {(selectedVideo.likeCount || 0) > 0 && (selectedVideo.likeCount || 0)}
                </button>
                <button
                  onClick={() => handleShare(selectedVideo)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-white/10 text-white/70 hover:bg-[#00d084]/20 hover:text-[#00d084] transition-all"
                >
                  <Share24Regular className="w-4 h-4" />
                  {vt.share || 'Share'}
                </button>
              </div>
            </div>
            {biDesc(selectedVideo) && <p className="text-white/60 text-sm mt-1 leading-relaxed">{biDesc(selectedVideo)}</p>}
          </div>
        </div>
      )}

      {/* Simple Footer */}
      <footer className="border-t border-white/5 bg-[#050a15]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="text-white/50 hover:text-[#00d084] transition-colors text-sm">{vt.backToHome || 'Back to Home'}</Link>
          <div className="flex items-center gap-4 text-white/30 text-xs">
            <Link href="/privacy" className="hover:text-white/50 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-white/50 transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ============================================================
// Page Export (wrapped with I18nProvider)
// ============================================================
export default function VideoGalleryPage() {
  return (
    <I18nProvider>
      <VideoGalleryContent />
    </I18nProvider>
  );
}
