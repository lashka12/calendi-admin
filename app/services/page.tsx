"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, Clock, Trash2, X, Loader2, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  subscribeToServices,
  addService,
  updateService,
  deleteService,
  getServiceName,
  getServiceDescription,
  type Service as FirebaseService,
} from "../lib/firebase/services";
import { subscribeToBusinessSettings, type BusinessSettings, DEFAULT_SETTINGS } from "../lib/firebase/settings";
import ConfirmationModal from "../components/ConfirmationModal";
import { useToast } from "../lib/hooks/useToast";
import { useTranslation } from "@/app/i18n";

interface ServiceDisplay {
  id: string;
  name: string;
  description: string;
  duration: number;
  price: number;
}

type Language = 'en' | 'he' | 'ar';

const LANGUAGES: { code: Language; label: string; dir: 'ltr' | 'rtl' }[] = [
  { code: 'en', label: 'EN', dir: 'ltr' },
  { code: 'he', label: 'עב', dir: 'rtl' },
  { code: 'ar', label: 'ع', dir: 'rtl' },
];

export default function ServicesPage() {
  const [services, setServices] = useState<ServiceDisplay[]>([]);
  const [rawServices, setRawServices] = useState<FirebaseService[]>([]); // Store raw data for editing
  const [settings, setSettings] = useState<BusinessSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceDisplay | null>(null);
  const [processing, setProcessing] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string | null; name: string }>({
    open: false,
    id: null,
    name: "",
  });
  const [activeLang, setActiveLang] = useState<Language>('en');
  const [formData, setFormData] = useState({
    names: { en: '', he: '', ar: '' },
    descriptions: { en: '', he: '', ar: '' },
    duration: 30,
    price: "",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const { showToast } = useToast();
  const { t, language } = useTranslation();

  // Subscribe to settings
  useEffect(() => {
    const unsubscribe = subscribeToBusinessSettings(setSettings);
    return () => unsubscribe();
  }, []);

  // Subscribe to services
  useEffect(() => {
    const unsubscribe = subscribeToServices((firebaseServices) => {
      // Store raw services for editing
      setRawServices(firebaseServices.filter(s => s.active !== false));
      
      const transformed = firebaseServices
        .filter(s => s.active !== false)
        .map(s => ({
          id: s.id,
          name: getServiceName(s, language),
          description: getServiceDescription(s, language),
          duration: s.duration || 0,
          price: s.price || 0,
        }));
      setServices(transformed);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [language]);

  // Duration options based on slot duration
  const durationOptions = useMemo(() => {
    const slot = settings.slotDuration || 15;
    const options: number[] = [];
    for (let i = slot; i <= 180; i += slot) options.push(i);
    return options;
  }, [settings.slotDuration]);

  const formatDuration = (mins: number) => {
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const currencySymbol = settings.currency === 'ILS' ? '₪' : settings.currency === 'USD' ? '$' : settings.currency;

  const openAddModal = () => {
    setEditingService(null);
    setActiveLang('en');
    setFormData({ 
      names: { en: '', he: '', ar: '' },
      descriptions: { en: '', he: '', ar: '' },
      duration: settings.slotDuration * 2 || 30, 
      price: "" 
    });
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (service: ServiceDisplay) => {
    setEditingService(service);
    setActiveLang('en');
    
    // Get raw service data to populate all languages
    const rawService = rawServices.find(s => s.id === service.id);
    
    setFormData({
      names: {
        en: rawService?.names?.en || rawService?.name || service.name,
        he: rawService?.names?.he || '',
        ar: rawService?.names?.ar || '',
      },
      descriptions: {
        en: rawService?.descriptions?.en || rawService?.description || service.description,
        he: rawService?.descriptions?.he || '',
        ar: rawService?.descriptions?.ar || '',
      },
      duration: service.duration,
      price: service.price.toString(),
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    // At least English name is required
    if (!formData.names.en.trim()) {
      setFormError("Please enter a service name (English)");
      setActiveLang('en');
      return;
    }
    if (formData.duration % settings.slotDuration !== 0) {
      setFormError(`Duration must be in ${settings.slotDuration}-minute increments`);
      return;
    }
    const priceNum = Number(formData.price);
    if (!formData.price || isNaN(priceNum) || priceNum < 0 || !/^\d+(\.\d+)?$/.test(formData.price.trim())) {
      setFormError("Please enter a valid price");
      return;
    }

    const data = {
      names: formData.names,
      descriptions: formData.descriptions,
      duration: formData.duration,
      price: parseFloat(formData.price),
      active: true,
    };

    try {
      if (editingService) {
        setProcessing(prev => new Set(prev).add(editingService.id));
        await updateService(editingService.id, data);
        showToast("Service updated", "success");
      } else {
        await addService(data);
        showToast("Service added", "success");
      }
      setModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || "Failed to save");
      showToast(err.message || "Failed to save", "error");
    } finally {
      if (editingService) {
        setProcessing(prev => {
          const next = new Set(prev);
          next.delete(editingService.id);
          return next;
        });
      }
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm.id) return;
    setProcessing(prev => new Set(prev).add(deleteConfirm.id!));
    try {
      await deleteService(deleteConfirm.id);
      setDeleteConfirm({ open: false, id: null, name: "" });
      showToast("Service deleted", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to delete", "error");
    } finally {
      setProcessing(prev => {
        const next = new Set(prev);
        next.delete(deleteConfirm.id!);
        return next;
      });
    }
  };

  if (loading) {
    return (
      <div className="pt-2 pb-16 lg:pt-0 lg:pb-6 space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div 
            key={i} 
            className="bg-white rounded-2xl border border-gray-200 p-4"
          >
            {/* Top row: Name + Price */}
            <div className="flex items-center justify-between gap-4 mb-3">
              <div className="h-5 w-32 bg-gray-200 rounded-lg overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-shimmer" />
              </div>
              <div className="h-5 w-14 bg-gray-200 rounded-lg overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-shimmer" />
              </div>
            </div>
            {/* Description */}
            <div className="h-3.5 w-3/4 bg-gray-100 rounded mb-3 overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100 animate-shimmer" />
            </div>
            {/* Bottom row: Duration */}
            <div className="flex items-center justify-between">
              <div className="h-7 w-20 bg-gray-200 rounded-full overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-shimmer" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="pt-2 pb-16 lg:pt-0 lg:pb-6">
      {/* Desktop Header */}
      <div className="hidden lg:flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('services.title')}</h1>
          <p className="text-sm text-gray-500">{services.length} {t('services.activeServices')}</p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('services.addService')}
        </button>
      </div>

      {/* Mobile FAB */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 400, damping: 25 }}
        whileTap={{ scale: 0.92 }}
        onClick={openAddModal}
        className="lg:hidden fixed right-5 z-30 w-14 h-14 bg-white text-gray-900 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.12)] border border-gray-200 flex items-center justify-center"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)' }}
      >
        <Plus className="w-6 h-6 stroke-[2.5]" />
      </motion.button>

      {/* Services List */}
      {services.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-gray-200 p-10 text-center"
        >
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Clock className="w-7 h-7 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">{t('services.noServices')}</h3>
          <p className="text-sm text-gray-500 mb-5">{t('services.addFirst')}</p>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-xl"
          >
            <Plus className="w-4 h-4" />
            {t('services.addService')}
          </button>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {services.map((service) => (
            <div
              key={service.id}
              onClick={() => openEditModal(service)}
              className="bg-white rounded-2xl border border-gray-200 p-4 cursor-pointer lg:hover:shadow-md lg:hover:border-gray-300 active:scale-[0.98] transition-all duration-200"
            >
              {/* Top row: Name + Price */}
              <div className="flex items-center justify-between gap-4 mb-3">
                <h3 className="text-[17px] font-semibold text-gray-900 leading-tight">
                  {service.name}
                </h3>
                <span className="text-[16px] font-bold text-gray-900 tabular-nums flex-shrink-0">
                  {currencySymbol}{service.price}
                </span>
              </div>

              {/* Description */}
              {service.description && (
                <p className="text-[14px] text-gray-500 leading-relaxed mb-3 line-clamp-2">
                  {service.description}
                </p>
              )}

              {/* Bottom row: Duration badge */}
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-full">
                  <Clock className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-[13px] font-medium text-gray-600">
                    {formatDuration(service.duration)}
                  </span>
                </div>
                <span className="text-[12px] text-gray-400">
                  {t('services.tapToEdit')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {modalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setModalOpen(false)}
              className="fixed inset-0 bg-black/40 z-[9999]"
            />

            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "tween", duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
              className="fixed bottom-0 left-0 right-0 z-[10000]"
            >
              <div className="bg-[#fafafa] rounded-t-[28px] max-h-[90vh] flex flex-col">
                {/* Handle */}
                <div className="flex justify-center pt-3 pb-1">
                  <div className="w-10 h-1 bg-gray-300 rounded-full" />
                </div>

                {/* Header with Language Selector */}
                <div className="px-5 py-3 flex items-center justify-between">
                  <h2 className="text-[17px] font-bold text-gray-900">
                    {editingService ? t('services.editService') : t('services.newService')}
                  </h2>
                  <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                    {LANGUAGES.map((lang) => (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => setActiveLang(lang.code)}
                        className={`h-7 px-3 rounded-md text-[12px] font-semibold transition-all ${
                          activeLang === lang.code
                            ? 'bg-white text-gray-900 shadow-sm'
                            : formData.names[lang.code] 
                              ? 'text-gray-600' 
                              : 'text-gray-400'
                        }`}
                      >
                        {lang.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Form */}
                <div className="flex-1 overflow-y-auto px-5 overscroll-contain">
                  {formError && (
                    <p className="text-[13px] text-red-500 bg-red-50 px-3 py-2 rounded-xl mb-4">{formError}</p>
                  )}

                  {/* Main Content Card */}
                  <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    {/* Name Field */}
                    <div className="p-4 border-b border-gray-100">
                      <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-2">
                        {t('services.serviceName')} {activeLang === 'en' && <span className="text-red-400">*</span>}
                      </label>
                      <input
                        type="text"
                        dir={LANGUAGES.find(l => l.code === activeLang)?.dir}
                        value={formData.names[activeLang]}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          names: { ...formData.names, [activeLang]: e.target.value }
                        })}
                        placeholder={t('services.serviceNamePlaceholder')}
                        className="w-full text-[17px] font-medium text-gray-900 placeholder-gray-300 outline-none bg-transparent"
                      />
                    </div>

                    {/* Description Field */}
                    <div className="p-4 border-b border-gray-100">
                      <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-2">
                        {t('services.description')}
                      </label>
                      <textarea
                        dir={LANGUAGES.find(l => l.code === activeLang)?.dir}
                        value={formData.descriptions[activeLang]}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          descriptions: { ...formData.descriptions, [activeLang]: e.target.value }
                        })}
                        placeholder={t('services.descriptionPlaceholder')}
                        rows={2}
                        className="w-full text-[15px] text-gray-700 placeholder-gray-300 outline-none bg-transparent resize-none"
                      />
                    </div>

                    {/* Duration */}
                    <div className="p-4 border-b border-gray-100">
                      <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-3">
                        {t('services.duration')}
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {durationOptions.slice(0, 8).map((dur) => (
                          <button
                            key={dur}
                            type="button"
                            onClick={() => setFormData({ ...formData, duration: dur })}
                            className={`h-9 rounded-xl text-[13px] font-semibold transition-all ${
                              formData.duration === dur
                                ? 'bg-gray-900 text-white'
                                : 'bg-gray-50 text-gray-600 active:bg-gray-100'
                            }`}
                          >
                            {formatDuration(dur)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Price */}
                    <div className="p-4">
                      <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-2">
                        {t('services.price')}
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-[18px] text-gray-400">{currencySymbol}</span>
                        <input
                          type="text"
                          value={formData.price}
                          onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                          placeholder="0"
                          className="flex-1 text-[28px] font-bold text-gray-900 placeholder-gray-300 outline-none bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div 
                  className="px-5 pt-5 flex gap-3"
                  style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
                >
                  {editingService && (
                    <button
                      onClick={() => {
                        setModalOpen(false);
                        setTimeout(() => setDeleteConfirm({ open: true, id: editingService.id, name: editingService.name }), 200);
                      }}
                      className="w-12 h-12 bg-white border border-gray-200 text-gray-400 rounded-2xl flex items-center justify-center active:bg-gray-50 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                  <button
                    onClick={handleSubmit}
                    disabled={!formData.names.en || !formData.price || !/^\d+(\.\d+)?$/.test(formData.price.trim()) || processing.size > 0}
                    className="flex-1 h-12 bg-gray-900 text-white font-semibold text-[15px] rounded-2xl disabled:bg-gray-300 disabled:text-gray-500 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                  >
                    {processing.size > 0 ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      editingService ? t('services.saveChanges') : t('services.addService')
                    )}
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
        onClose={() => setDeleteConfirm({ open: false, id: null, name: "" })}
        onConfirm={handleDelete}
        title={t('services.deleteService')}
        message={`"${deleteConfirm.name}" ${t('services.deleteMessage')}`}
        confirmText={t('common.delete')}
        isLoading={processing.has(deleteConfirm.id || '')}
        variant="danger"
      />
    </div>
  );
}
