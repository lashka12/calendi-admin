"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, Search, Trash2, X, AlertTriangle, User, Phone, Calendar } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  subscribeToBlacklist,
  addToBlacklist,
  removeFromBlacklist,
  type BlacklistedClient as FirebaseBlacklistedClient
} from "../lib/firebase/blacklist";
import { useToast } from "../lib/hooks/useToast";
import ConfirmationModal from "../components/ConfirmationModal";

interface BlacklistedClient {
  id: string;
  name: string;
  phone: string;
  reason: string;
  dateAdded: string;
  avatar?: string;
}

// Helper: Generate avatar URL from name
const generateAvatar = (name: string): string => {
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return `https://i.pravatar.cc/150?img=${(hash % 70) + 1}`;
};

// Transform Firebase blacklist entry to display format
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
    avatar: generateAvatar(entry.clientName || "Unknown"),
  };
};

export default function BlacklistPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    reason: "",
  });
  const [blacklistedClients, setBlacklistedClients] = useState<BlacklistedClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string | null; clientName: string }>({
    open: false,
    id: null,
    clientName: "",
  });
  const { showToast } = useToast();

  // Subscribe to real-time blacklist updates
  useEffect(() => {
    const unsubscribe = subscribeToBlacklist((firebaseClients) => {
      const transformed = firebaseClients.map(transformBlacklistEntry);
      setBlacklistedClients(transformed);
      setLoading(false);
      setError(null);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const filteredClients = useMemo(() => {
    return blacklistedClients.filter(
      (client) =>
        client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.phone.includes(searchTerm) ||
        client.reason.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [blacklistedClients, searchTerm]);

  const openAddModal = () => {
    setFormData({ name: "", phone: "", reason: "" });
    setError(null);
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.phone || !formData.reason) return;

    if (processing.has('new')) return;

    setProcessing(prev => new Set(prev).add('new'));
    setError(null);

    try {
      await addToBlacklist({
        clientName: formData.name,
        phone: formData.phone,
        reason: formData.reason,
      });
      
      showToast(`${formData.name} has been added to the blacklist`, "success");
      setModalOpen(false);
      setFormData({ name: "", phone: "", reason: "" });
    } catch (err: any) {
      console.error("Error saving blacklist entry:", err);
      const errorMessage = err.message || "Failed to save blacklist entry";
      setError(errorMessage);
      showToast(errorMessage, "error");
    } finally {
      setProcessing(prev => {
        const next = new Set(prev);
        next.delete('new');
        return next;
      });
    }
  };

  const openDeleteConfirm = (id: string, clientName: string) => {
    setDeleteConfirm({ open: true, id, clientName });
  };

  const closeDeleteConfirm = () => {
    setDeleteConfirm({ open: false, id: null, clientName: "" });
  };

  const handleDelete = async () => {
    if (!deleteConfirm.id) return;

    if (processing.has(deleteConfirm.id)) return;

    setProcessing(prev => new Set(prev).add(deleteConfirm.id!));
    const clientName = deleteConfirm.clientName;
    try {
      await removeFromBlacklist(deleteConfirm.id);
      closeDeleteConfirm();
      showToast(`${clientName} has been removed from the blacklist`, "success");
    } catch (err: any) {
      console.error("Error removing from blacklist:", err);
      setError(err.message || "Failed to remove from blacklist");
      showToast(err.message || "Failed to remove from blacklist", "error");
    } finally {
      setProcessing(prev => {
        const next = new Set(prev);
        next.delete(deleteConfirm.id!);
        return next;
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header - hidden on mobile */}
      <div className="hidden lg:flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Blacklist</h1>
          <p className="text-sm text-gray-500 mt-1">Manage blocked clients</p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add to Blacklist
        </button>
      </div>

      {/* Mobile Add Button */}
      <button
        onClick={openAddModal}
        className="lg:hidden fixed bottom-20 right-4 z-30 w-14 h-14 bg-gray-800 text-white rounded-full shadow-lg hover:bg-gray-700 transition-all hover:scale-105 flex items-center justify-center"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Search and Stats */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search blacklisted clients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <AlertTriangle className="w-4 h-4 text-red-600" />
          <span className="text-gray-600">
            <span className="font-semibold text-gray-900">{blacklistedClients.length}</span> clients
            blacklisted
          </span>
        </div>
      </div>

      {/* Blacklist */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mb-4"></div>
            <p className="text-sm text-gray-500">Loading blacklist...</p>
          </div>
        ) : error && !modalOpen ? (
          <div className="p-12 text-center">
            <AlertTriangle className="w-12 h-12 text-red-300 mx-auto mb-4" />
            <p className="text-sm text-red-600">Error: {error}</p>
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="p-12 text-center">
            <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {searchTerm ? "No results found" : "No blacklisted clients"}
            </h3>
            <p className="text-sm text-gray-500">
              {searchTerm
                ? "Try adjusting your search"
                : "Clients you blacklist will appear here"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 lg:divide-y-0 lg:space-y-4">
            {filteredClients.map((client, index) => (
              <motion.div
                key={client.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-4 lg:p-6 lg:bg-white lg:rounded-xl lg:border lg:border-gray-200 hover:bg-gray-50 transition-colors"
              >
                {/* Mobile: Compact Card Style */}
                <div className="flex items-start gap-3">
                  {/* Avatar with indicator */}
                  <div className="relative flex-shrink-0">
                    <img
                      src={client.avatar}
                      alt={client.name}
                      className="w-14 h-14 rounded-full"
                    />
                    <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
                      <AlertTriangle className="w-3 h-3 text-white" />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold text-gray-900 truncate mb-0.5">
                          {client.name}
                        </h3>
                        <div className="flex items-center gap-1.5 text-sm text-gray-600">
                          <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate">{client.phone}</span>
                        </div>
                      </div>

                      {/* Desktop: Action buttons */}
                      <div className="hidden lg:flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => openDeleteConfirm(client.id, client.name)}
                          disabled={processing.has(client.id)}
                          className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Reason - Clean design */}
                    <div className="bg-red-50 rounded-lg px-3 py-2 mb-2.5">
                      <p className="text-sm text-red-900 leading-relaxed">
                        {client.reason}
                      </p>
                    </div>

                    {/* Footer with date and mobile actions */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>
                          {new Date(client.dateAdded).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </div>

                      {/* Mobile: Action buttons */}
                      <div className="flex lg:hidden items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => openDeleteConfirm(client.id, client.name)}
                          disabled={processing.has(client.id)}
                          className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg active:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {processing.has(client.id) ? "Removing..." : "Remove"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
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

            {/* Modal */}
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="fixed bottom-0 left-0 right-0 lg:inset-auto lg:left-1/2 lg:top-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:w-full lg:max-w-lg z-50 bg-white rounded-t-3xl lg:rounded-2xl shadow-2xl flex flex-col max-h-[90vh] lg:max-h-[85vh]"
            >
              {/* Handle bar for mobile */}
              <div className="lg:hidden flex justify-center p-3">
                <div className="w-16 h-1.5 bg-gray-300 rounded-full" />
              </div>

              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      Add to Blacklist
                    </h2>
                    <p className="text-sm text-gray-500">
                      Block a client from booking
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

              {/* Form */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Client Name *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Enter client name"
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Phone Number *
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+1 (555) 123-4567"
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Reason for Blacklisting *
                  </label>
                  <textarea
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    placeholder="Describe the reason for blacklisting this client..."
                    rows={4}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent resize-none"
                  />
                  <p className="text-xs text-gray-500 mt-1.5">
                    Be specific about incidents or patterns of behavior
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 flex-shrink-0">
                <button
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!formData.name || !formData.phone || !formData.reason || processing.has('new')}
                  className="px-4 py-2.5 bg-gray-800 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing.has('new') ? "Adding..." : "Add to Blacklist"}
                </button>
              </div>

              {/* Safe area padding for iPhone */}
              <div className="h-8 lg:hidden flex-shrink-0"></div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteConfirm.open}
        onClose={closeDeleteConfirm}
        onConfirm={handleDelete}
        title="Remove from Blacklist?"
        message={`Are you sure you want to remove ${deleteConfirm.clientName} from the blacklist? This action cannot be undone.`}
        confirmText="Remove from Blacklist"
        isLoading={processing.has(deleteConfirm.id || '')}
        variant="danger"
      />
    </div>
  );
}
