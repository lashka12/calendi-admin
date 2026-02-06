"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, Search, X, Phone, UserX, Bell, ChevronRight } from "lucide-react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { 
  subscribeToBlacklist,
  addToBlacklist,
  removeFromBlacklist,
  type BlacklistedClient as FirebaseBlacklistedClient
} from "../lib/firebase/blacklist";
import { useToast } from "../lib/hooks/useToast";
import ConfirmationModal from "../components/ConfirmationModal";
import { useTranslation } from "@/app/i18n";
import { useScrollLock } from "@/app/lib/hooks/useScrollLock";

interface BlacklistedClient {
  id: string;
  name: string;
  phone: string;
  reason: string;
  dateAdded: string;
}

const transformBlacklistEntry = (entry: FirebaseBlacklistedClient): BlacklistedClient => {
  const dateAdded = (entry.dateAdded && typeof entry.dateAdded === 'object' && 'toDate' in entry.dateAdded)
    ? (entry.dateAdded as any).toDate().toISOString().split('T')[0]
    : (entry.dateAdded instanceof Date 
        ? entry.dateAdded.toISOString().split('T')[0] 
        : new Date().toISOString().split('T')[0]);
  
  return {
    id: entry.id,
    name: entry.clientName || "Unknown",
    phone: entry.phone || "",
    reason: entry.reason || "",
    dateAdded,
  };
};

export default function BlacklistPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", phone: "", reason: "" });
  const [blacklistedClients, setBlacklistedClients] = useState<BlacklistedClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<Set<string>>(new Set());
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string | null; clientName: string }>({
    open: false, id: null, clientName: "",
  });
  const { showToast } = useToast();
  const { t, isRTL } = useTranslation();
  useScrollLock(modalOpen);

  useEffect(() => {
    const unsubscribe = subscribeToBlacklist((firebaseClients) => {
      const transformed = firebaseClients.map(transformBlacklistEntry);
      setBlacklistedClients(transformed);
      setLoading(false);
      setError(null);
    });
    return () => unsubscribe();
  }, []);

  const filteredClients = useMemo(() => {
    return blacklistedClients.filter(
      (client) =>
        client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.phone.includes(searchTerm)
    );
  }, [blacklistedClients, searchTerm]);

  const openAddModal = () => {
    setFormData({ name: "", phone: "", reason: "" });
    setError(null);
    setModalOpen(true);
  };

  // Phone validation
  const validatePhone = (phone: string): string | null => {
    const cleaned = phone.replace(/\D/g, '');
    if (!cleaned) return t('blacklist.phoneRequired');
    if (cleaned.length !== 10) return t('blacklist.phoneDigits');
    if (!cleaned.startsWith('05')) return t('blacklist.phoneStart');
    return null;
  };

  const isPhoneValid = !validatePhone(formData.phone);

  const handleSubmit = async () => {
    if (!formData.name) {
      setError(t('blacklist.nameRequired'));
      return;
    }
    
    const phoneError = validatePhone(formData.phone);
    if (phoneError) {
      setError(phoneError);
      return;
    }

    if (processing.has('new')) return;

    setProcessing(prev => new Set(prev).add('new'));
    setError(null);

    try {
      await addToBlacklist({
        clientName: formData.name,
        phone: formData.phone.replace(/\D/g, ''),
        reason: formData.reason || t('blacklist.noReason'),
      });
      showToast(t('blacklist.addedSuccess').replace('{name}', formData.name), "success");
      setModalOpen(false);
      setFormData({ name: "", phone: "", reason: "" });
    } catch (err: any) {
      const errorMessage = err.message || "Failed to add to blacklist";
      setError(errorMessage);
      showToast(errorMessage, "error");
    } finally {
      setProcessing(prev => { const next = new Set(prev); next.delete('new'); return next; });
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm.id || processing.has(deleteConfirm.id)) return;

    setProcessing(prev => new Set(prev).add(deleteConfirm.id!));
    const clientName = deleteConfirm.clientName;
    
    try {
      await removeFromBlacklist(deleteConfirm.id);
      setDeleteConfirm({ open: false, id: null, clientName: "" });
      showToast(t('blacklist.removedSuccess').replace('{name}', clientName), "success");
    } catch (err: any) {
      showToast(err.message || "Failed to remove", "error");
    } finally {
      setProcessing(prev => { const next = new Set(prev); next.delete(deleteConfirm.id!); return next; });
    }
  };

  const handleSwipe = (id: string) => {
    setSwipedId(swipedId === id ? null : id);
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return t('blacklist.today');
    if (diffDays === 1) return t('blacklist.yesterday');
    if (diffDays < 7) return t('blacklist.daysAgo').replace('{days}', String(diffDays));
    return date.toLocaleDateString(isRTL ? "he-IL" : "en-US", { month: "short", day: "numeric" });
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="pt-2 pb-16 lg:pt-0 lg:pb-6">
        <div className="h-11 theme-bg-secondary border theme-border rounded-xl mb-4" />
        <div className="theme-bg-secondary rounded-2xl border theme-border overflow-hidden">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`p-4 ${i > 0 ? 'border-t border-gray-100' : ''}`}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 theme-bg-tertiary rounded-full overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100 animate-shimmer" />
                </div>
                <div className="flex-1">
                  <div className="h-4 w-28 theme-bg-tertiary rounded mb-2 overflow-hidden relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100 animate-shimmer" />
                  </div>
                  <div className="h-3 w-20 bg-gray-50 rounded overflow-hidden relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-gray-50 via-white to-gray-50 animate-shimmer" />
                  </div>
                </div>
                <div className="h-4 w-12 bg-gray-50 rounded overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-gray-50 via-white to-gray-50 animate-shimmer" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="pt-2 pb-16 lg:pt-0 lg:pb-6">
      {/* Desktop Header */}
      <div className="hidden lg:flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold theme-text-primary">{t('blacklist.title')}</h1>
          <p className="text-sm theme-text-secondary">{t('blacklist.subtitle').replace('{count}', String(blacklistedClients.length))}</p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('blacklist.addButton')}
        </button>
      </div>

      {/* Mobile FAB */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        whileTap={{ scale: 0.92 }}
        onClick={openAddModal}
        className="lg:hidden fixed right-5 z-30 w-14 h-14 theme-bg-secondary theme-text-primary rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.12)] border theme-border flex items-center justify-center"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)' }}
      >
        <Plus className="w-6 h-6 stroke-[2.5]" />
      </motion.button>

      {/* Info Header */}
      <div className="mb-4 theme-bg-secondary rounded-2xl border theme-border p-4" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="flex gap-3">
          <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center flex-shrink-0">
            <Bell className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[15px] font-semibold theme-text-primary mb-1">{t('blacklist.infoTitle')}</h3>
            <p className="text-[13px] theme-text-secondary leading-relaxed">
              {t('blacklist.infoDesc')}
            </p>
          </div>
        </div>
        
        {/* Stats */}
        {blacklistedClients.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-gray-400 rounded-full" />
              <span className="text-[13px] theme-text-secondary">
                <span className="font-semibold theme-text-primary">{blacklistedClients.length}</span> {t('blacklist.flagged')}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Search */}
      {(blacklistedClients.length > 0 || searchTerm) && (
        <div className="relative mb-4" dir={isRTL ? 'rtl' : 'ltr'}>
          <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 theme-text-tertiary ${isRTL ? 'right-4' : 'left-4'}`} />
          <input
            type="text"
            placeholder={t('blacklist.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full h-11 theme-bg-secondary border theme-border rounded-xl text-[15px] theme-text-primary placeholder-gray-400 outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all ${isRTL ? 'pr-11 pl-4' : 'pl-11 pr-4'}`}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className={`absolute top-1/2 -translate-y-1/2 w-6 h-6 theme-bg-tertiary rounded-full flex items-center justify-center ${isRTL ? 'left-3' : 'right-3'}`}
            >
              <X className="w-3.5 h-3.5 theme-text-secondary" />
            </button>
          )}
        </div>
      )}

      {/* Empty State */}
      {filteredClients.length === 0 && !searchTerm ? (
        <div className="flex flex-col items-center justify-center py-16 px-6">
          <div className="w-20 h-20 theme-bg-tertiary rounded-full flex items-center justify-center mb-5">
            <UserX className="w-10 h-10 text-gray-300" />
          </div>
          <h3 className="text-[18px] font-semibold theme-text-primary mb-2">{t('blacklist.emptyTitle')}</h3>
          <p className="text-[14px] theme-text-secondary text-center mb-6 max-w-[260px]">
            {t('blacklist.emptyDesc')}
          </p>
          <button
            onClick={openAddModal}
            className="h-11 px-6 bg-gray-900 text-white text-[15px] font-semibold rounded-xl active:scale-[0.98] transition-transform"
          >
            {t('blacklist.addButton')}
          </button>
        </div>
      ) : filteredClients.length === 0 && searchTerm ? (
        <div className="flex flex-col items-center justify-center py-16 px-6">
          <div className="w-16 h-16 theme-bg-tertiary rounded-full flex items-center justify-center mb-4">
            <Search className="w-7 h-7 text-gray-300" />
          </div>
          <h3 className="text-[17px] font-semibold theme-text-primary mb-1">{t('blacklist.noResults')}</h3>
          <p className="text-[14px] theme-text-secondary">{t('blacklist.noResultsDesc')}</p>
        </div>
      ) : (
        /* List */
        <div className="theme-bg-secondary rounded-2xl border theme-border overflow-hidden">
          {filteredClients.map((client, index) => (
            <div
              key={client.id}
              className={`relative overflow-hidden ${index > 0 ? 'border-t border-gray-100' : ''}`}
            >
              {/* Delete action (revealed on swipe) */}
              <div className="absolute inset-y-0 right-0 w-20 bg-red-500 flex items-center justify-center">
                <button
                  onClick={() => setDeleteConfirm({ open: true, id: client.id, clientName: client.name })}
                  className="w-full h-full flex items-center justify-center text-white"
                >
                  <UserX className="w-5 h-5" />
                </button>
              </div>

              {/* Card content */}
              <motion.div
                drag="x"
                dragConstraints={{ left: -80, right: 0 }}
                dragElastic={0.1}
                onDragEnd={(_, info: PanInfo) => {
                  if (info.offset.x < -40) {
                    handleSwipe(client.id);
                  } else {
                    handleSwipe('');
                  }
                }}
                animate={{ x: swipedId === client.id ? -80 : 0 }}
                transition={{ type: "tween", duration: 0.2 }}
                className="relative theme-bg-secondary p-4 cursor-grab active:cursor-grabbing"
                onClick={() => swipedId === client.id && handleSwipe('')}
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="w-12 h-12 bg-gray-900 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-[14px] font-semibold text-white">
                      {getInitials(client.name)}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="text-[16px] font-semibold theme-text-primary truncate">
                        {client.name}
                      </h3>
                    </div>
                    <p className="text-[14px] theme-text-secondary truncate">
                      {client.phone}
                    </p>
                  </div>

                  {/* Date & Arrow */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className="text-[13px] theme-text-tertiary">
                      {formatDate(client.dateAdded)}
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </div>
                </div>

                {/* Reason (if exists and not empty) */}
                {client.reason && client.reason !== "No reason provided" && (
                  <div className="mt-2.5 pl-[60px]">
                    <p className="text-[13px] theme-text-tertiary line-clamp-1">
                      "{client.reason}"
                    </p>
                  </div>
                )}
              </motion.div>
            </div>
          ))}
          
          {/* Swipe hint */}
          {filteredClients.length > 0 && (
            <div className="lg:hidden px-4 py-3 bg-gray-50 border-t border-gray-100">
              <p className="text-[12px] theme-text-tertiary text-center">
                {t('blacklist.swipeHint')}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Add Modal */}
      <AnimatePresence>
        {modalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setModalOpen(false)}
              className="fixed inset-0 bg-black/40 z-[9999] touch-none"
            />

            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "tween", duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
              className="fixed bottom-0 left-0 right-0 z-[10000] touch-none"
            >
              <div className="bg-[#fafafa] rounded-t-[28px] max-h-[85vh] flex flex-col touch-auto">
                {/* Handle */}
                <div className="flex justify-center pt-3 pb-1">
                  <div className="w-10 h-1 modal-handle rounded-full" />
                </div>

                {/* Header */}
                <div className="px-5 py-3 flex items-center justify-between" dir={isRTL ? 'rtl' : 'ltr'}>
                  <div>
                    <h2 className="text-[17px] font-bold theme-text-primary">{t('blacklist.addModalTitle')}</h2>
                    <p className="text-[13px] theme-text-secondary">{t('blacklist.addModalDesc')}</p>
                  </div>
                  <button 
                    onClick={() => setModalOpen(false)}
                    className="w-8 h-8 flex items-center justify-center theme-text-tertiary"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Form */}
                <div className="flex-1 overflow-y-auto px-5 overscroll-contain touch-auto">
                  {error && (
                    <p className="text-[13px] text-red-500 bg-red-50 px-3 py-2 rounded-xl mb-4">{error}</p>
                  )}

                  <div className="theme-bg-secondary rounded-2xl border theme-border overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
                    {/* Name */}
                    <div className="p-4 border-b border-gray-100">
                      <label className="block text-[11px] font-medium theme-text-tertiary uppercase tracking-wide mb-2">
                        {t('blacklist.nameLabel')} <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder={t('blacklist.namePlaceholder')}
                        className="w-full text-[17px] font-medium theme-text-primary placeholder-gray-300 outline-none bg-transparent"
                      />
                    </div>

                    {/* Phone */}
                    <div className="p-4 border-b border-gray-100">
                      <label className="block text-[11px] font-medium theme-text-tertiary uppercase tracking-wide mb-2">
                        {t('blacklist.phoneLabel')} <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder={t('blacklist.phonePlaceholder')}
                        className="w-full text-[17px] font-medium theme-text-primary placeholder-gray-300 outline-none bg-transparent"
                        dir="ltr"
                      />
                      {formData.phone && !isPhoneValid && (
                        <p className="text-[12px] text-red-500 mt-1.5">{validatePhone(formData.phone)}</p>
                      )}
                    </div>

                    {/* Reason */}
                    <div className="p-4">
                      <label className="block text-[11px] font-medium theme-text-tertiary uppercase tracking-wide mb-2">
                        {t('blacklist.reasonLabel')} <span className="text-gray-300">({t('blacklist.optional')})</span>
                      </label>
                      <textarea
                        value={formData.reason}
                        onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                        placeholder={t('blacklist.reasonPlaceholder')}
                        rows={2}
                        className="w-full text-[15px] text-gray-700 placeholder-gray-300 outline-none bg-transparent resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div 
                  className="px-5 pt-5 flex gap-3"
                  style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
                  dir={isRTL ? 'rtl' : 'ltr'}
                >
                  <button
                    onClick={() => setModalOpen(false)}
                    className="flex-1 h-12 theme-bg-secondary border theme-border text-gray-700 font-semibold text-[15px] rounded-2xl active:bg-gray-50 transition-colors"
                  >
                    {t('blacklist.cancel')}
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!formData.name || !isPhoneValid || processing.has('new')}
                    className="flex-1 h-12 bg-gray-900 text-white font-semibold text-[15px] rounded-2xl disabled:bg-gray-300 disabled:theme-text-secondary active:scale-[0.98] transition-all"
                  >
                    {processing.has('new') ? t('blacklist.adding') : t('blacklist.add')}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <ConfirmationModal
        isOpen={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, id: null, clientName: "" })}
        onConfirm={handleDelete}
        title={t('blacklist.removeTitle')}
        message={t('blacklist.removeMessage').replace('{name}', deleteConfirm.clientName)}
        confirmText={t('blacklist.remove')}
        isLoading={processing.has(deleteConfirm.id || '')}
        variant="danger"
      />
    </div>
  );
}
