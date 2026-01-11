"use client";

import { useState, useEffect } from "react";
import { Plus, Clock, DollarSign, Edit, Trash2, X, Briefcase, Tag, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  subscribeToServices,
  addService,
  updateService,
  deleteService,
  getServiceName,
  getServiceDescription,
  type Service as FirebaseService
} from "../lib/firebase/services";
import ConfirmationModal from "../components/ConfirmationModal";
import { useToast } from "../lib/hooks/useToast";

interface ServiceDisplay {
  id: string;
  name: string;
  description: string;
  duration: number;
  price: number;
  category?: string;
}

export default function ServicesPage() {
  const [services, setServices] = useState<ServiceDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceDisplay | null>(null);
  const [processing, setProcessing] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string | null; serviceName: string }>({
    open: false,
    id: null,
    serviceName: "",
  });
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    duration: "",
    price: "",
    category: "",
  });
  const { showToast } = useToast();

  const categories = ["Hair Services", "Grooming", "Packages", "Specialized", "Treatments"];

  // Subscribe to real-time services updates
  useEffect(() => {
    const unsubscribe = subscribeToServices((firebaseServices) => {
      // Transform Firebase services to display format
      const transformed = firebaseServices
        .filter(service => service.active !== false) // Only show active services
        .map(service => ({
          id: service.id,
          name: getServiceName(service),
          description: getServiceDescription(service),
          duration: service.duration || 0,
          price: service.price || 0,
          category: service.category,
        }));
      
      setServices(transformed);
      setLoading(false);
      setError(null);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const openAddModal = () => {
    setEditingService(null);
    setFormData({ name: "", description: "", duration: "", price: "", category: "" });
    setModalOpen(true);
  };

  const openEditModal = (service: ServiceDisplay) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      description: service.description,
      duration: service.duration.toString(),
      price: service.price.toString(),
      category: service.category || "",
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.duration || !formData.price) return;

    const serviceData = {
      names: {
        en: formData.name,
        he: "", // Will be filled in later
        ar: "", // Will be filled in later
      },
      descriptions: {
        en: formData.description || "",
        he: "", // Will be filled in later
        ar: "", // Will be filled in later
      },
      duration: parseInt(formData.duration),
      price: parseFloat(formData.price),
      category: formData.category || undefined,
      active: true,
    };

    try {
      if (editingService) {
        // Update existing
        setProcessing(prev => new Set(prev).add(editingService.id));
        await updateService(editingService.id, serviceData);
      } else {
        // Add new
        await addService(serviceData);
        showToast(`${formData.name} has been added`, "success");
      }
      
      if (editingService) {
        showToast(`${formData.name} has been updated`, "success");
      }
      
      setModalOpen(false);
      setFormData({ name: "", description: "", duration: "", price: "", category: "" });
      setEditingService(null);
    } catch (err: any) {
      console.error("Error saving service:", err);
      const errorMessage = err.message || "Failed to save service";
      setError(errorMessage);
      showToast(errorMessage, "error");
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

  const openDeleteConfirm = (id: string, serviceName: string) => {
    setDeleteConfirm({ open: true, id, serviceName });
  };

  const closeDeleteConfirm = () => {
    setDeleteConfirm({ open: false, id: null, serviceName: "" });
  };

  const handleDelete = async () => {
    if (!deleteConfirm.id) return;

    if (processing.has(deleteConfirm.id)) return;

    const serviceName = deleteConfirm.serviceName;
    setProcessing(prev => new Set(prev).add(deleteConfirm.id!));
    try {
      await deleteService(deleteConfirm.id);
      closeDeleteConfirm();
      showToast(`${serviceName} has been deleted`, "success");
    } catch (err: any) {
      console.error("Error deleting service:", err);
      const errorMessage = err.message || "Failed to delete service";
      setError(errorMessage);
      showToast(errorMessage, "error");
    } finally {
      setProcessing(prev => {
        const next = new Set(prev);
        next.delete(deleteConfirm.id!);
        return next;
      });
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="hidden lg:block">
          <h1 className="text-2xl font-semibold text-gray-900">Services</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your service offerings</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <Loader2 className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-500">Loading services...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header - hidden on mobile */}
      <div className="hidden lg:flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Services</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your service offerings</p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Service
        </button>
      </div>

      {/* Mobile Add Button */}
      <button
        onClick={openAddModal}
        className="lg:hidden fixed bottom-20 right-4 z-30 w-14 h-14 bg-gray-800 text-white rounded-full shadow-lg hover:bg-gray-700 transition-all hover:scale-105 flex items-center justify-center"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Services list */}
      <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-200">
        {services.length === 0 ? (
          <div className="p-12 text-center">
            <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No services yet</h3>
            <p className="text-sm text-gray-500 mb-4">Get started by adding your first service</p>
            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Service
            </button>
          </div>
        ) : (
          services.map((service, index) => (
            <motion.div
              key={service.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.2, ease: "easeOut" }}
              className="p-4 lg:p-6 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Briefcase className="w-6 h-6 text-gray-600" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-gray-900 mb-1 truncate">
                        {service.name}
                      </h3>
                      <p className="text-sm text-gray-500 line-clamp-2">{service.description}</p>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => openEditModal(service)}
                        disabled={processing.has(service.id)}
                        className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {processing.has(service.id) ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Edit className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => openDeleteConfirm(service.id, service.name)}
                        disabled={processing.has(service.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {processing.has(service.id) ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl">
                      <Clock className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-900">{formatDuration(service.duration)}</span>
                    </div>

                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl">
                      <DollarSign className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-900">${service.price}</span>
                    </div>

                    {service.category && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl">
                        <Tag className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-900">{service.category}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {modalOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              onClick={() => setModalOpen(false)}
              className="fixed inset-0 bg-gray-900/50 z-50"
            />

            {/* Modal Sheet - Mobile bottom sheet, Desktop centered */}
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
              className="fixed bottom-0 left-0 right-0 lg:inset-auto lg:left-1/2 lg:top-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:w-full lg:max-w-2xl z-50 bg-white rounded-t-3xl lg:rounded-2xl shadow-2xl max-h-[90vh] lg:max-h-[85vh] overflow-hidden"
            >
              {/* Handle bar - Mobile only */}
              <div className="flex justify-center pt-3 pb-2 lg:hidden">
                <div className="w-10 h-1 bg-gray-300 rounded-full"></div>
              </div>

              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                      <Briefcase className="w-5 h-5 text-gray-700" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">
                        {editingService ? "Edit Service" : "Add New Service"}
                      </h2>
                      <p className="text-sm text-gray-500">
                        {editingService ? "Update service details" : "Create a new service offering"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setModalOpen(false)}
                    className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>

              {/* Form */}
              <div className="p-6 space-y-5 max-h-[calc(100vh-250px)] overflow-y-auto">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Service Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Haircut & Styling"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe what's included in this service..."
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Duration (minutes) *
                    </label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="number"
                        value={formData.duration}
                        onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                        placeholder="60"
                        min="1"
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1.5">How long does this service take?</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Price ($) *
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="number"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        placeholder="45"
                        min="0"
                        step="0.01"
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1.5">How much do you charge?</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Category
                  </label>
                  <div className="relative">
                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent appearance-none bg-white"
                    >
                      <option value="">No category (optional)</option>
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!formData.name || !formData.duration || !formData.price || processing.size > 0}
                  className="px-4 py-2.5 bg-gray-800 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {processing.size > 0 && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingService ? "Update Service" : "Add Service"}
                </button>
              </div>

              {/* Safe area padding for iPhone */}
              <div className="h-8 lg:hidden"></div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteConfirm.open}
        onClose={closeDeleteConfirm}
        onConfirm={handleDelete}
        title="Delete Service?"
        message={`Are you sure you want to delete "${deleteConfirm.serviceName}"? This action cannot be undone.`}
        confirmText="Delete Service"
        isLoading={processing.has(deleteConfirm.id || '')}
        variant="danger"
      />
    </div>
  );
}
