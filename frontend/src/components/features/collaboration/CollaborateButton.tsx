/**
 * CollaborateButton Component
 *
 * Reusable button that opens contact selection modal
 * and sends collaboration requests (single or bulk).
 * Supports voice message recording.
 * For contacts without accounts, offers WhatsApp/Email invitation.
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  PeopleTeam24Regular,
  Send24Regular,
  Mail24Regular,
  Chat24Regular,
  Checkmark24Regular,
  Mic24Regular,
  Stop24Regular,
  Play24Regular,
  Delete24Regular,
  Dismiss24Regular,
} from '@fluentui/react-icons';
import { useI18n } from '@/lib/i18n';
import { toast } from '@/components/ui/Toast';
import {
  sendCollaborationRequest,
  bulkSendCollaborationRequests,
  uploadCollaborationVoice,
  CollaborationSourceType,
} from '@/lib/api/collaboration';
import ContactSelectionModal from './ContactSelectionModal';
import { useWalletStore } from '@/stores/walletStore';

interface Contact {
  id: string;
  fullName: string;
  company: string | null;
  jobTitle: string | null;
  avatarUrl: string | null;
  email: string | null;
  phone: string | null;
  hasAccount?: boolean;
}

interface CollaborateButtonProps {
  sourceType: CollaborationSourceType;
  sourceId: string;
  sourceTitle?: string;
  onSuccess?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function CollaborateButton({
  sourceType,
  sourceId,
  sourceTitle,
  onSuccess,
  variant = 'primary',
  size = 'md',
  className = '',
}: CollaborateButtonProps) {
  const { t } = useI18n();
  const { balance, costs, fetchBalance } = useWalletStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showCostConfirm, setShowCostConfirm] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<Contact[]>([]);
  const [message, setMessage] = useState('');
  const [mounted, setMounted] = useState(false);

  // Voice recording state
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [voiceDuration, setVoiceDuration] = useState(0);
  const [currentRecordingDuration, setCurrentRecordingDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchBalance();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const getSourceTypeLabel = () => {
    const labels: Record<CollaborationSourceType, string> = {
      PROJECT: 'project',
      OPPORTUNITY: 'opportunity',
      PITCH: 'pitch',
      DEAL: 'deal',
    };
    return labels[sourceType] || sourceType.toLowerCase();
  };

  // Multi-select handler from ContactSelectionModal
  const handleMultiSelect = (contacts: Contact[]) => {
    setSelectedContacts(contacts);
    setIsModalOpen(false);
    setShowMessageModal(true);
  };

  // Single select fallback (for single contact)
  const handleSingleSelect = (contact: Contact) => {
    setSelectedContacts([contact]);
    setIsModalOpen(false);
    setShowMessageModal(true);
  };

  // Voice recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setVoiceBlob(blob);
        setVoiceDuration(currentRecordingDuration);
        stream.getTracks().forEach(track => track.stop());
        setCurrentRecordingDuration(0);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setCurrentRecordingDuration(0);

      timerRef.current = setInterval(() => {
        setCurrentRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Could not access microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const playVoice = () => {
    if (!voiceBlob) return;

    if (isPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setIsPlaying(false);
    } else {
      const url = URL.createObjectURL(voiceBlob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setIsPlaying(false);
      audio.play();
      setIsPlaying(true);
    }
  };

  const removeVoice = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setVoiceBlob(null);
    setVoiceDuration(0);
    setIsPlaying(false);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Send collaboration requests
  const handleSend = async () => {
    if (selectedContacts.length === 0) return;

    // Pre-check wallet balance
    if (costs.collaboration > 0) {
      const totalCost = costs.collaboration * selectedContacts.length;
      if (balance < totalCost) {
        toast.error(`Insufficient points. Need ${totalCost} pts, you have ${balance}. Visit Wallet to buy more.`);
        return;
      }
    }

    setIsSending(true);
    try {
      // Upload voice if exists
      let voiceMessageUrl: string | undefined;
      if (voiceBlob) {
        try {
          voiceMessageUrl = await uploadCollaborationVoice(voiceBlob);
        } catch (err) {
          console.error('Voice upload failed:', err);
          toast.error('Failed to upload voice message');
          setIsSending(false);
          return;
        }
      }

      // Check if any contacts don't have accounts (non-member contacts)
      const membersOnly = selectedContacts.filter(c => c.hasAccount);
      const nonMembers = selectedContacts.filter(c => !c.hasAccount);

      if (selectedContacts.length === 1) {
        // Single request
        const contact = selectedContacts[0];
        await sendCollaborationRequest({
          sourceType,
          sourceId,
          toContactId: contact.id,
          message: message || undefined,
          voiceMessageUrl,
        });
        toast.success(`Collaboration request sent to ${contact.fullName}`);
      } else {
        // Bulk request
        const result = await bulkSendCollaborationRequests({
          sourceType,
          sourceId,
          contactIds: selectedContacts.map(c => c.id),
          message: message || undefined,
          voiceMessageUrl,
        });

        const { sent, failed, emailsSent } = result.summary;
        if (failed === 0) {
          const emailNote = emailsSent ? ` (${emailsSent} email invite${emailsSent > 1 ? 's' : ''} sent)` : '';
          toast.success(`Collaboration requests sent to ${sent} contacts${emailNote}`);
        } else if (sent === 0) {
          toast.error(`Failed to send all ${failed} requests`);
        } else {
          const emailNote = emailsSent ? ` (${emailsSent} email invite${emailsSent > 1 ? 's' : ''} sent)` : '';
          toast.success(`Sent ${sent} requests, ${failed} failed${emailNote}`);
        }
      }

      // Reset everything and refresh wallet
      closeAll();
      fetchBalance();
      onSuccess?.();
    } catch (error: any) {
      console.error('Failed to send collaboration request:', error);
      if (error?.status === 402 || error?.code === 'INSUFFICIENT_POINTS') {
        toast.error('Insufficient points. Visit Wallet to buy more.');
      } else {
        toast.error(error.message || 'Failed to send collaboration request');
      }
    } finally {
      setIsSending(false);
    }
  };

  // Generate invitation message
  const getInvitationMessage = () => {
    const appUrl = 'https://intellmatch.com';
    const projectInfo = sourceTitle ? `"${sourceTitle}"` : `this ${getSourceTypeLabel()}`;
    const firstName = selectedContacts[0]?.fullName?.split(' ')[0] || 'there';
    return `Hi ${firstName}! 👋

I'd like to collaborate with you on ${projectInfo} using IntellMatch - an AI-powered networking platform.

Join IntellMatch to connect and explore collaboration opportunities:
${appUrl}/register

Looking forward to working together!`;
  };

  // Send via WhatsApp
  const handleWhatsAppInvite = () => {
    const contact = selectedContacts[0];
    if (!contact?.phone) {
      toast.error('No phone number available for this contact');
      return;
    }
    const cleanPhone = contact.phone.replace(/[\s\-\(\)]/g, '');
    const msg = encodeURIComponent(getInvitationMessage());
    window.open(`https://wa.me/${cleanPhone}?text=${msg}`, '_blank');
    toast.success('Opening WhatsApp...');
    closeAll();
  };

  // Send via Email
  const handleEmailInvite = () => {
    const contact = selectedContacts[0];
    if (!contact?.email) {
      toast.error('No email address available for this contact');
      return;
    }
    const subject = encodeURIComponent(`Collaboration Invitation - ${sourceTitle || 'IntellMatch'}`);
    const body = encodeURIComponent(getInvitationMessage());
    window.location.href = `mailto:${contact.email}?subject=${subject}&body=${body}`;
    toast.success('Opening email client...');
    closeAll();
  };

  const getButtonClasses = () => {
    const base = 'inline-flex items-center gap-2 font-medium transition-colors rounded-lg';
    const sizeClasses = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
    };
    const variantClasses = {
      primary: 'bg-[#00d084]/50 hover:bg-[#00b870] text-th-text',
      secondary: 'bg-th-bg-t hover:bg-neutral-700 text-th-text border border-neutral-700',
      ghost: 'hover:bg-th-bg-t text-th-text-s hover:text-th-text',
    };
    return `${base} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`;
  };

  const closeAll = () => {
    setShowMessageModal(false);
    setIsModalOpen(false);
    setSelectedContacts([]);
    setMessage('');
    removeVoice();
  };

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);

  // Check if single contact without account (invitation flow)
  const isSingleNonMember = selectedContacts.length === 1 && !selectedContacts[0].hasAccount;

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className={getButtonClasses()}
      >
        <PeopleTeam24Regular className="w-5 h-5" />
        <span>Collaborate</span>
      </button>

      {/* Contact Selection Modal - Multi-select */}
      <ContactSelectionModal
        isOpen={isModalOpen && !showMessageModal}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedContacts([]);
        }}
        onSelect={handleSingleSelect}
        onMultiSelect={handleMultiSelect}
        multiSelect={true}
        title="Select Collaborators"
        description={`Choose contacts to collaborate on this ${getSourceTypeLabel()}`}
      />

      {/* Message + Voice Modal */}
      {mounted && showMessageModal && selectedContacts.length > 0 && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md mx-4 bg-th-bg-s rounded-xl shadow-xl border border-th-border max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-th-border">
              <div>
                <h3 className="text-lg font-semibold text-th-text">
                  {isSingleNonMember ? 'Invite to Collaborate' : 'Send Collaboration Request'}
                </h3>
                <p className="text-sm text-th-text-t mt-1">
                  {isSingleNonMember ? (
                    <>
                      <span className="text-th-text">{selectedContacts[0].fullName}</span> doesn't have an IntellMatch account yet
                    </>
                  ) : selectedContacts.length === 1 ? (
                    <>
                      Sending to <span className="text-th-text">{selectedContacts[0].fullName}</span>
                      {sourceTitle && (
                        <> for <span className="text-primary-400">{sourceTitle}</span></>
                      )}
                    </>
                  ) : (
                    <>
                      Sending to <span className="text-primary-400">{selectedContacts.length} contacts</span>
                      {sourceTitle && (
                        <> for <span className="text-th-text">{sourceTitle}</span></>
                      )}
                    </>
                  )}
                </p>
              </div>
              <button onClick={closeAll} className="p-2 hover:bg-th-bg-t rounded-lg transition-colors">
                <Dismiss24Regular className="w-5 h-5 text-th-text-t" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Selected contacts preview */}
              <div className="space-y-2">
                {selectedContacts.length <= 3 ? (
                  selectedContacts.map(contact => (
                    <div key={contact.id} className="flex items-center gap-3 p-2.5 bg-th-bg-t rounded-lg">
                      {contact.avatarUrl ? (
                        <img src={contact.avatarUrl} alt={contact.fullName} className="w-9 h-9 rounded-full object-cover" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-neutral-700 flex items-center justify-center text-xs font-medium text-th-text-s">
                          {getInitials(contact.fullName)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-th-text text-sm truncate">{contact.fullName}</span>
                          {contact.hasAccount ? (
                            <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-medium bg-green-500/20 text-green-400 rounded-full">Member</span>
                          ) : (
                            <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-medium bg-yellow-500/20 text-yellow-400 rounded-full">Not on IntellMatch</span>
                          )}
                        </div>
                        {contact.jobTitle && (
                          <div className="text-xs text-th-text-t truncate">
                            {contact.jobTitle}{contact.company && ` at ${contact.company}`}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center gap-3 p-3 bg-th-bg-t rounded-lg">
                    <div className="flex -space-x-2">
                      {selectedContacts.slice(0, 3).map(c => (
                        <div key={c.id} className="w-8 h-8 rounded-full bg-neutral-700 border-2 border-th-border flex items-center justify-center text-xs font-medium text-th-text-s">
                          {getInitials(c.fullName)}
                        </div>
                      ))}
                      {selectedContacts.length > 3 && (
                        <div className="w-8 h-8 rounded-full bg-[#00d084]/50/30 border-2 border-th-border flex items-center justify-center text-xs font-medium text-primary-300">
                          +{selectedContacts.length - 3}
                        </div>
                      )}
                    </div>
                    <span className="text-sm text-th-text-s">{selectedContacts.length} contacts selected</span>
                  </div>
                )}
              </div>

              {isSingleNonMember ? (
                /* Not a member - Show invitation options */
                <div className="space-y-3">
                  <p className="text-sm text-th-text-t">
                    Send them an invitation to join IntellMatch and collaborate with you:
                  </p>

                  <button
                    onClick={handleWhatsAppInvite}
                    disabled={!selectedContacts[0].phone}
                    className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-[#25D366] hover:bg-[#20BD5A] disabled:bg-neutral-700 disabled:cursor-not-allowed text-th-text font-medium rounded-lg transition-colors"
                  >
                    <Chat24Regular className="w-5 h-5" />
                    <span>Invite via WhatsApp</span>
                    {!selectedContacts[0].phone && <span className="text-xs opacity-70">(No phone)</span>}
                  </button>

                  <button
                    onClick={handleEmailInvite}
                    disabled={!selectedContacts[0].email}
                    className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                  >
                    <Mail24Regular className="w-5 h-5" />
                    <span>Invite via Email</span>
                    {!selectedContacts[0].email && <span className="text-xs opacity-70">(No email)</span>}
                  </button>

                  <div className="pt-2 border-t border-th-border">
                    <p className="text-xs text-th-text-m">
                      {selectedContacts[0].phone && <span className="block">Phone: {selectedContacts[0].phone}</span>}
                      {selectedContacts[0].email && <span className="block">Email: {selectedContacts[0].email}</span>}
                      {!selectedContacts[0].phone && !selectedContacts[0].email && (
                        <span className="text-cyan-400">No contact information available</span>
                      )}
                    </p>
                  </div>
                </div>
              ) : (
                /* Members / mixed - Show message + voice input */
                <>
                  {/* Text message */}
                  <div>
                    <label className="block text-sm font-medium text-th-text-t mb-2">
                      Message (optional)
                    </label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Add a personal message..."
                      rows={3}
                      className="w-full px-3 py-2 bg-th-bg-t border border-neutral-700 rounded-lg text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-[#00d084]/40 focus:border-transparent resize-none"
                    />
                  </div>

                  {/* Voice message */}
                  <div>
                    <label className="block text-sm font-medium text-th-text-t mb-2">
                      Voice Message (optional)
                    </label>

                    {!voiceBlob && !isRecording && (
                      <button
                        onClick={startRecording}
                        className="flex items-center gap-2 px-4 py-2.5 bg-th-bg-t hover:bg-neutral-700 border border-neutral-700 rounded-lg text-th-text-s hover:text-th-text transition-colors w-full justify-center"
                      >
                        <Mic24Regular className="w-5 h-5 text-red-400" />
                        <span className="text-sm">Record Voice Message</span>
                      </button>
                    )}

                    {isRecording && (
                      <div className="flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-sm text-red-400 font-medium flex-1">
                          Recording... {formatDuration(currentRecordingDuration)}
                        </span>
                        <button
                          onClick={stopRecording}
                          className="p-2 bg-red-500 hover:bg-red-600 rounded-full text-white transition-colors"
                        >
                          <Stop24Regular className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {voiceBlob && !isRecording && (
                      <div className="flex items-center gap-3 px-4 py-3 bg-th-bg-t border border-neutral-700 rounded-lg">
                        <button
                          onClick={playVoice}
                          className="p-2 bg-[#00d084]/50 hover:bg-[#00b870] rounded-full text-th-text transition-colors"
                        >
                          {isPlaying ? (
                            <Stop24Regular className="w-4 h-4" />
                          ) : (
                            <Play24Regular className="w-4 h-4" />
                          )}
                        </button>
                        <div className="flex-1">
                          <div className="text-sm text-th-text">Voice Message</div>
                          <div className="text-xs text-th-text-t">{formatDuration(voiceDuration)}</div>
                        </div>
                        <button
                          onClick={removeVoice}
                          className="p-2 hover:bg-neutral-700 rounded-lg text-th-text-t hover:text-red-400 transition-colors"
                        >
                          <Delete24Regular className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            {!isSingleNonMember && (
              <div className="p-4 border-t border-th-border flex items-center justify-between gap-3">
                {costs.collaboration > 0 && selectedContacts.length > 0 ? (
                  <span className="text-xs text-amber-400 font-medium">
                    Cost: {costs.collaboration * selectedContacts.length} pts
                  </span>
                ) : <span />}
                <div className="flex gap-3">
                <button
                  onClick={closeAll}
                  className="px-4 py-2 text-th-text-t hover:text-th-text transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (costs.collaboration > 0) {
                      setShowCostConfirm(true);
                    } else {
                      handleSend();
                    }
                  }}
                  disabled={isSending}
                  className="px-5 py-2 bg-[#00d084]/50 hover:bg-[#00b870] disabled:bg-neutral-700 disabled:text-th-text-m text-th-text font-medium rounded-lg transition-colors inline-flex items-center gap-2"
                >
                  {isSending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send24Regular className="w-4 h-4" />
                      {selectedContacts.length === 1
                        ? 'Send Request'
                        : `Send to ${selectedContacts.length} Contacts`}
                    </>
                  )}
                </button>
                </div>
              </div>
            )}

            {isSingleNonMember && (
              <div className="p-4 border-t border-th-border flex justify-end">
                <button
                  onClick={closeAll}
                  className="px-4 py-2 text-th-text-t hover:text-th-text transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
      {/* Cost Confirmation Popup */}
      {showCostConfirm && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowCostConfirm(false)} />
          <div className="relative bg-[#0d1528] border border-white/10 rounded-xl p-4 max-w-[280px] w-full shadow-2xl">
            <h3 className="text-sm font-semibold text-th-text mb-1">Confirm Points</h3>
            <p className="text-xs text-th-text-t mb-1">
              This will deduct <span className="text-amber-400 font-bold">{costs.collaboration * selectedContacts.length} pts</span> from your wallet.
            </p>
            <p className="text-[11px] text-th-text-m mb-3">
              Your balance: <span className="font-medium">{balance} pts</span>
            </p>
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => setShowCostConfirm(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-th-text-t hover:text-th-text hover:bg-th-surface-h transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowCostConfirm(false); handleSend(); }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 transition-colors"
              >
                Confirm & Send
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
