/**
 * Find Contact Page
 *
 * Unified search interface for finding contacts using:
 * - Name, phone, email, or URL
 * - Image upload (business card, screenshot, photo)
 * - Intent-based opening message generation
 *
 * Features:
 * - Multi-input type detection
 * - Real-time search with confidence scoring
 * - Confirm/reject feedback for result improvement
 * - AI-generated opening sentences
 */

'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { toast } from '@/components/ui/Toast';
import { getAccessToken } from '@/lib/api/client';
import {
  Search24Regular,
  Person24Regular,
  Mail24Regular,
  Phone24Regular,
  Link24Regular,
  Camera24Regular,
  Send24Regular,
  Checkmark24Regular,
  Dismiss24Regular,
  ArrowLeft24Regular,
  Building24Regular,
  Location24Regular,
  ChevronDown24Regular,
  Sparkle24Regular,
  Copy24Regular,
  ThumbLike24Regular,
  ThumbDislike24Regular,
  ArrowRight24Regular,
  Image24Regular,
  Info24Regular,
} from '@fluentui/react-icons';

// Types
interface Channel {
  type: 'email' | 'phone' | 'linkedin' | 'twitter' | 'website';
  value: string;
}

interface Snapshot {
  name: string;
  title: string | null;
  company: string | null;
  location: string | null;
  avatarUrl: string | null;
  channels: Channel[];
}

interface SearchResult {
  candidateType: 'USER' | 'CONTACT';
  candidateId: string;
  score: number;
  confidence: number;
  reasons: string[];
  snapshot: Snapshot;
}

interface SearchResponse {
  requestId: string;
  inputType: string;
  status: 'HIGH_CONFIDENCE' | 'LIKELY' | 'UNCERTAIN' | 'NO_MATCH' | 'PENDING_OCR';
  results: SearchResult[];
  suggestedActions: string[];
  openingSentences: string[];
  warnings?: string[];
}

type Intent = 'MEETING' | 'COLLABORATION' | 'FOLLOW_UP' | 'SALES' | 'SUPPORT' | 'OTHER';

const INTENTS: { value: Intent; label: string; labelAr: string }[] = [
  { value: 'MEETING', label: 'Schedule a Meeting', labelAr: 'جدولة اجتماع' },
  { value: 'COLLABORATION', label: 'Explore Collaboration', labelAr: 'استكشاف التعاون' },
  { value: 'FOLLOW_UP', label: 'Follow Up', labelAr: 'متابعة' },
  { value: 'SALES', label: 'Business Opportunity', labelAr: 'فرصة عمل' },
  { value: 'SUPPORT', label: 'Offer Help', labelAr: 'تقديم المساعدة' },
  { value: 'OTHER', label: 'Other', labelAr: 'أخرى' },
];

export default function FindContactPage() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Search state
  const [query, setQuery] = useState('');
  const [intent, setIntent] = useState<Intent>('MEETING');
  const [intentNote, setIntentNote] = useState('');
  const [showIntentDropdown, setShowIntentDropdown] = useState(false);

  // Image upload state
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [consentFaceMatch, setConsentFaceMatch] = useState(false);

  // Results state
  const [isSearching, setIsSearching] = useState(false);
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [copiedSentence, setCopiedSentence] = useState<number | null>(null);

  // Feedback state
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<string | null>(null);

  // Detect input type from query
  const detectInputType = (q: string): string => {
    if (!q) return 'name';
    const trimmed = q.trim();

    // Email pattern
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return 'email';

    // Phone pattern (mostly digits)
    const digitsOnly = trimmed.replace(/[\s\-\(\)\+\.]/g, '');
    if (/^\d+$/.test(digitsOnly) && digitsOnly.length >= 7) return 'phone';

    // URL pattern
    if (/^(https?:\/\/|www\.|linkedin\.com|twitter\.com)/i.test(trimmed)) return 'url';

    return 'name';
  };

  const inputType = detectInputType(query);

  // Handle image selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: t.findContact?.invalidFileType || 'Invalid file type',
        description: t.findContact?.selectImageFile || 'Please select an image file',
        variant: 'error',
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: t.findContact?.fileTooLarge || 'File too large',
        description: t.findContact?.maxFileSize || 'Maximum file size is 10MB',
        variant: 'error',
      });
      return;
    }

    setSelectedImage(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  // Clear image
  const clearImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setConsentFaceMatch(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Perform search
  const handleSearch = async () => {
    if (!query.trim() && !selectedImage) {
      toast({
        title: t.findContact?.enterQuery || 'Enter a search query',
        description: t.findContact?.enterQueryDesc || 'Type a name, email, phone, or URL, or upload an image',
        variant: 'error',
      });
      return;
    }

    setIsSearching(true);
    setSearchResponse(null);
    setSelectedResult(null);
    setFeedbackSubmitted(null);

    try {
      const token = getAccessToken();
      const formData = new FormData();

      if (query.trim()) {
        formData.append('query', query.trim());
      }
      formData.append('intent', intent);
      if (intentNote.trim()) {
        formData.append('intentNote', intentNote.trim());
      }
      if (selectedImage) {
        formData.append('image', selectedImage);
        formData.append('consentFaceMatch', consentFaceMatch.toString());
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/find-contact/search`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || 'Search failed');
      }

      setSearchResponse(data.data);

      if (data.data.results.length === 0) {
        toast({
          title: t.findContact?.noResults || 'No matches found',
          description: t.findContact?.tryDifferentQuery || 'Try a different search query or add more details',
          variant: 'info',
        });
      }
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: t.findContact?.searchFailed || 'Search failed',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'error',
      });
    } finally {
      setIsSearching(false);
    }
  };

  // Submit feedback
  const submitFeedback = async (confirmedId?: string, confirmedType?: 'USER' | 'CONTACT', rejected?: string[]) => {
    if (!searchResponse?.requestId) return;

    try {
      const token = getAccessToken();
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/find-contact/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          requestId: searchResponse.requestId,
          confirmedCandidateId: confirmedId,
          confirmedType: confirmedType,
          rejectedCandidateIds: rejected,
        }),
      });

      setFeedbackSubmitted(confirmedId || 'rejected');
      toast({
        title: t.findContact?.feedbackSubmitted || 'Feedback submitted',
        description: t.findContact?.thankYou || 'Thank you for helping us improve',
        variant: 'success',
      });
    } catch (error) {
      console.error('Feedback error:', error);
    }
  };

  // Copy opening sentence
  const copyToClipboard = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSentence(index);
      setTimeout(() => setCopiedSentence(null), 2000);
      toast({
        title: t.findContact?.copied || 'Copied!',
        description: t.findContact?.sentenceCopied || 'Opening sentence copied to clipboard',
        variant: 'success',
      });
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'HIGH_CONFIDENCE':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'LIKELY':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'UNCERTAIN':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'NO_MATCH':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-white/[0.03]0/20 text-th-text-t border-neutral-500/30';
    }
  };

  // Get confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-emerald-400';
    if (confidence >= 0.7) return 'text-blue-400';
    if (confidence >= 0.5) return 'text-yellow-400';
    return 'text-th-text-t';
  };

  // Get channel icon
  const getChannelIcon = (type: string) => {
    switch (type) {
      case 'email':
        return <Mail24Regular className="w-4 h-4" />;
      case 'phone':
        return <Phone24Regular className="w-4 h-4" />;
      case 'linkedin':
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
          </svg>
        );
      case 'website':
        return <Link24Regular className="w-4 h-4" />;
      default:
        return <Link24Regular className="w-4 h-4" />;
    }
  };

  const inputClass = "w-full ps-12 pe-4 py-3 bg-th-surface border border-th-border rounded-xl text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all";

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-th-surface-h rounded-lg transition-colors"
          >
            <ArrowLeft24Regular className="w-5 h-5 text-th-text-t" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-th-text">
              {t.findContact?.title || 'Find Contact'}
            </h1>
            <p className="text-sm text-th-text-t mt-1">
              {t.findContact?.subtitle || 'Search by name, email, phone, URL, or image'}
            </p>
          </div>
        </div>

        {/* Search Section */}
        <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-2xl p-6 space-y-5">
          {/* Search Input */}
          <div>
            <label className="block text-sm font-medium text-th-text-s mb-2">
              {t.findContact?.searchQuery || 'Search Query'}
            </label>
            <div className="relative">
              {inputType === 'email' && <Mail24Regular className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-th-text-m" />}
              {inputType === 'phone' && <Phone24Regular className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-th-text-m" />}
              {inputType === 'url' && <Link24Regular className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-th-text-m" />}
              {inputType === 'name' && <Search24Regular className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-th-text-m" />}
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder={t.findContact?.searchPlaceholder || 'Enter name, email, phone, or LinkedIn URL...'}
                className={inputClass}
              />
              {query && (
                <span className="absolute end-4 top-1/2 -translate-y-1/2 text-xs text-th-text-m capitalize">
                  {inputType}
                </span>
              )}
            </div>
          </div>

          {/* Image Upload */}
          <div>
            <label className="block text-sm font-medium text-th-text-s mb-2">
              {t.findContact?.uploadImage || 'Or Upload Image (Optional)'}
            </label>
            {!imagePreview ? (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/20 rounded-xl cursor-pointer hover:bg-th-surface transition-colors">
                <Camera24Regular className="w-8 h-8 text-th-text-m mb-2" />
                <span className="text-sm text-th-text-t">
                  {t.findContact?.clickToUpload || 'Business card, screenshot, or photo'}
                </span>
                <span className="text-xs text-th-text-m mt-1">JPG, PNG, WebP up to 10MB</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </label>
            ) : (
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full h-32 object-cover rounded-xl"
                />
                <button
                  onClick={clearImage}
                  className="absolute top-2 end-2 p-2 bg-black/60 rounded-lg hover:bg-black/80 transition-colors"
                >
                  <Dismiss24Regular className="w-4 h-4 text-th-text" />
                </button>
                {/* Face match consent */}
                <label className="absolute bottom-2 start-2 flex items-center gap-2 bg-black/60 rounded-lg px-3 py-1.5">
                  <input
                    type="checkbox"
                    checked={consentFaceMatch}
                    onChange={(e) => setConsentFaceMatch(e.target.checked)}
                    className="w-4 h-4 rounded border-white/40 bg-th-surface-h text-emerald-500"
                  />
                  <span className="text-xs text-th-text">
                    {t.findContact?.consentFaceMatch || 'Enable face matching'}
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* Intent Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-th-text-s mb-2">
                {t.findContact?.selectIntent || 'Intent'}
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowIntentDropdown(!showIntentDropdown)}
                  className="w-full px-4 py-3 bg-th-surface border border-th-border rounded-xl text-th-text text-start flex items-center justify-between hover:bg-th-surface-h transition-colors"
                >
                  <span>
                    {INTENTS.find(i => i.value === intent)?.[lang === 'ar' ? 'labelAr' : 'label'] || intent}
                  </span>
                  <ChevronDown24Regular className={`w-5 h-5 text-th-text-t transition-transform ${showIntentDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showIntentDropdown && (
                  <div className="absolute z-10 w-full mt-2 bg-th-bg-t border border-th-border rounded-xl shadow-lg overflow-hidden">
                    {INTENTS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setIntent(opt.value);
                          setShowIntentDropdown(false);
                        }}
                        className={`w-full px-4 py-3 text-start hover:bg-th-surface-h transition-colors ${
                          intent === opt.value ? 'bg-emerald-500/20 text-emerald-400' : 'text-white'
                        }`}
                      >
                        {lang === 'ar' ? opt.labelAr : opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-th-text-s mb-2">
                {t.findContact?.intentNote || 'Additional Context (Optional)'}
              </label>
              <input
                type="text"
                value={intentNote}
                onChange={(e) => setIntentNote(e.target.value)}
                placeholder={t.findContact?.intentNotePlaceholder || 'e.g., Met at conference last week'}
                className="w-full px-4 py-3 bg-th-surface border border-th-border rounded-xl text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
          </div>

          {/* Search Button */}
          <button
            onClick={handleSearch}
            disabled={isSearching || (!query.trim() && !selectedImage)}
            className="w-full px-6 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-emerald-600 disabled:from-neutral-600 disabled:to-neutral-700 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
          >
            {isSearching ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {t.findContact?.searching || 'Searching...'}
              </>
            ) : (
              <>
                <Search24Regular className="w-5 h-5" />
                {t.findContact?.searchButton || 'Find Contact'}
              </>
            )}
          </button>
        </div>

        {/* Results Section */}
        {searchResponse && (
          <div className="space-y-4">
            {/* Status Badge */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 text-sm font-medium border rounded-full ${getStatusColor(searchResponse.status)}`}>
                  {searchResponse.status.replace(/_/g, ' ')}
                </span>
                <span className="text-sm text-th-text-t">
                  {searchResponse.results.length} {t.findContact?.resultsFound || 'results found'}
                </span>
              </div>
              <span className="text-xs text-th-text-m">
                {t.findContact?.requestId || 'Request ID'}: {searchResponse.requestId.slice(0, 8)}...
              </span>
            </div>

            {/* Warnings */}
            {searchResponse.warnings && searchResponse.warnings.length > 0 && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
                {searchResponse.warnings.map((warning, i) => (
                  <p key={i} className="text-sm text-yellow-400 flex items-center gap-2">
                    <Info24Regular className="w-4 h-4 flex-shrink-0" />
                    {warning}
                  </p>
                ))}
              </div>
            )}

            {/* Results List */}
            {searchResponse.results.length > 0 && (
              <div className="space-y-3">
                {searchResponse.results.map((result, index) => (
                  <div
                    key={`${result.candidateType}-${result.candidateId}`}
                    className={`bg-th-surface border rounded-2xl p-5 transition-all ${
                      selectedResult?.candidateId === result.candidateId
                        ? 'border-emerald-500/50 ring-2 ring-emerald-500/20'
                        : 'border-th-border hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Avatar */}
                      <div className="flex-shrink-0">
                        {result.snapshot.avatarUrl ? (
                          <img
                            src={result.snapshot.avatarUrl}
                            alt=""
                            className="w-14 h-14 rounded-xl object-cover"
                          />
                        ) : (
                          <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center">
                            <Person24Regular className="w-7 h-7 text-th-text" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="text-lg font-semibold text-th-text truncate">
                              {result.snapshot.name}
                            </h3>
                            {(result.snapshot.title || result.snapshot.company) && (
                              <p className="text-sm text-th-text-t mt-0.5">
                                {result.snapshot.title}
                                {result.snapshot.title && result.snapshot.company && ' at '}
                                {result.snapshot.company}
                              </p>
                            )}
                            {result.snapshot.location && (
                              <p className="text-xs text-th-text-m mt-0.5 flex items-center gap-1">
                                <Location24Regular className="w-3 h-3" />
                                {result.snapshot.location}
                              </p>
                            )}
                          </div>

                          {/* Score & Confidence */}
                          <div className="text-end flex-shrink-0">
                            <div className="text-2xl font-bold text-th-text">{result.score}</div>
                            <div className={`text-xs ${getConfidenceColor(result.confidence)}`}>
                              {Math.round(result.confidence * 100)}% confidence
                            </div>
                            <div className="text-xs text-th-text-m mt-1">
                              {result.candidateType}
                            </div>
                          </div>
                        </div>

                        {/* Reasons */}
                        {result.reasons.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-3">
                            {result.reasons.map((reason, i) => (
                              <span
                                key={i}
                                className="px-2 py-1 bg-th-surface-h text-th-text-s text-xs rounded-lg"
                              >
                                {reason}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Channels */}
                        {result.snapshot.channels.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-3">
                            {result.snapshot.channels.map((channel, i) => (
                              <a
                                key={i}
                                href={channel.type === 'email' ? `mailto:${channel.value}` : channel.type === 'phone' ? `tel:${channel.value}` : channel.value}
                                target={['email', 'phone'].includes(channel.type) ? undefined : '_blank'}
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-lg hover:bg-emerald-500/30 transition-colors"
                              >
                                {getChannelIcon(channel.type)}
                                {channel.type === 'linkedin' ? 'LinkedIn' : channel.value.length > 25 ? channel.value.slice(0, 25) + '...' : channel.value}
                              </a>
                            ))}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-2 mt-4">
                          <button
                            onClick={() => setSelectedResult(result)}
                            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                              selectedResult?.candidateId === result.candidateId
                                ? 'bg-emerald-500 text-white'
                                : 'bg-th-surface-h text-th-text hover:bg-th-surface-h'
                            }`}
                          >
                            <Checkmark24Regular className="w-4 h-4" />
                            {t.findContact?.select || 'Select'}
                          </button>
                          {feedbackSubmitted !== result.candidateId && (
                            <>
                              <button
                                onClick={() => submitFeedback(result.candidateId, result.candidateType)}
                                className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors"
                                title={t.findContact?.confirmMatch || 'This is the right person'}
                              >
                                <ThumbLike24Regular className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => submitFeedback(undefined, undefined, [result.candidateId])}
                                className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                                title={t.findContact?.rejectMatch || 'This is not the right person'}
                              >
                                <ThumbDislike24Regular className="w-5 h-5" />
                              </button>
                            </>
                          )}
                          {feedbackSubmitted === result.candidateId && (
                            <span className="text-xs text-emerald-400 flex items-center gap-1">
                              <Checkmark24Regular className="w-4 h-4" />
                              {t.findContact?.confirmed || 'Confirmed'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Opening Sentences */}
            {selectedResult && searchResponse.openingSentences.length > 0 && (
              <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkle24Regular className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-lg font-semibold text-th-text">
                    {t.findContact?.suggestedOpenings || 'Suggested Opening Lines'}
                  </h3>
                </div>
                <div className="space-y-3">
                  {searchResponse.openingSentences.map((sentence, index) => (
                    <div
                      key={index}
                      className="bg-th-surface rounded-xl p-4 flex items-start justify-between gap-4"
                    >
                      <p className="text-neutral-200 flex-1">{sentence}</p>
                      <button
                        onClick={() => copyToClipboard(sentence, index)}
                        className="p-2 bg-th-surface-h hover:bg-th-surface-h rounded-lg transition-colors flex-shrink-0"
                        title={t.findContact?.copyToClipboard || 'Copy to clipboard'}
                      >
                        {copiedSentence === index ? (
                          <Checkmark24Regular className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Copy24Regular className="w-4 h-4 text-th-text-t" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Suggested Actions */}
            {searchResponse.suggestedActions.length > 0 && (
              <div className="bg-th-surface border border-th-border rounded-2xl p-5">
                <h3 className="text-sm font-medium text-th-text-t mb-3">
                  {t.findContact?.suggestedActions || 'Suggested Next Steps'}
                </h3>
                <ul className="space-y-2">
                  {searchResponse.suggestedActions.map((action, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-th-text-s">
                      <ArrowRight24Regular className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* No Results */}
            {searchResponse.results.length === 0 && (
              <div className="bg-th-surface border border-th-border rounded-2xl p-8 text-center">
                <Person24Regular className="w-12 h-12 text-th-text-m mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-th-text mb-2">
                  {t.findContact?.noMatchesFound || 'No Matches Found'}
                </h3>
                <p className="text-th-text-t mb-4">
                  {t.findContact?.tryDifferentSearch || 'Try a different search query or add more details like company name or location.'}
                </p>
                <button
                  onClick={() => router.push('/contacts/new')}
                  className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-xl transition-colors"
                >
                  {t.findContact?.addNewContact || 'Add as New Contact'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
