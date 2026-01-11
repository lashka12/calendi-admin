"use client";

import { useState } from "react";
import { Search, Plus, Mail, Phone, Star } from "lucide-react";
import { motion } from "framer-motion";

export default function ClientsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState("all");

  const clients = [
    {
      id: 1,
      name: "Sarah Johnson",
      email: "sarah.j@email.com",
      phone: "+1 (555) 123-4567",
      totalBookings: 24,
      totalSpent: "$1,080",
      lastVisit: "2 days ago",
      avatar: "https://i.pravatar.cc/150?img=44",
      rating: 5,
      status: "active",
    },
    {
      id: 2,
      name: "Michael Chen",
      email: "m.chen@email.com",
      phone: "+1 (555) 234-5678",
      totalBookings: 18,
      totalSpent: "$810",
      lastVisit: "5 days ago",
      avatar: "https://i.pravatar.cc/150?img=13",
      rating: 5,
      status: "active",
    },
    {
      id: 3,
      name: "Emma Williams",
      email: "emma.w@email.com",
      phone: "+1 (555) 345-6789",
      totalBookings: 32,
      totalSpent: "$1,440",
      lastVisit: "1 week ago",
      avatar: "https://i.pravatar.cc/150?img=45",
      rating: 4,
      status: "vip",
    },
    {
      id: 4,
      name: "James Rodriguez",
      email: "james.r@email.com",
      phone: "+1 (555) 456-7890",
      totalBookings: 15,
      totalSpent: "$675",
      lastVisit: "Today",
      avatar: "https://i.pravatar.cc/150?img=14",
      rating: 5,
      status: "active",
    },
    {
      id: 5,
      name: "Lisa Anderson",
      email: "lisa.a@email.com",
      phone: "+1 (555) 567-8901",
      totalBookings: 28,
      totalSpent: "$1,260",
      lastVisit: "3 days ago",
      avatar: "https://i.pravatar.cc/150?img=48",
      rating: 5,
      status: "vip",
    },
    {
      id: 6,
      name: "David Kim",
      email: "david.k@email.com",
      phone: "+1 (555) 678-9012",
      totalBookings: 12,
      totalSpent: "$540",
      lastVisit: "1 week ago",
      avatar: "https://i.pravatar.cc/150?img=15",
      rating: 4,
      status: "active",
    },
  ];

  const tabs = [
    { id: "all", name: "All", count: 89 },
    { id: "active", name: "Active", count: 67 },
    { id: "vip", name: "VIP", count: 12 },
  ];

  return (
    <div className="space-y-6">
      {/* Header - hidden on mobile */}
      <div className="hidden lg:flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Clients</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your client database</p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition-colors shadow-sm">
          <Plus className="w-4 h-4" />
          Add Client
        </button>
      </div>

      {/* Search and filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterTab(tab.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  filterTab === tab.id
                    ? "bg-gray-800 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {tab.name}
                <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${
                  filterTab === tab.id
                    ? "bg-white/20"
                    : "bg-gray-200"
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Clients grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clients.map((client, index) => (
          <motion.div
            key={client.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <img
                  src={client.avatar}
                  alt={client.name}
                  className="w-12 h-12 rounded-full"
                />
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{client.name}</h3>
                  <div className="flex items-center gap-0.5 mt-1">
                    {Array.from({ length: client.rating }).map((_, i) => (
                      <Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                </div>
              </div>
              {client.status === "vip" && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200">
                  VIP
                </span>
              )}
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Mail className="w-3.5 h-3.5" />
                <span className="truncate">{client.email}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Phone className="w-3.5 h-3.5" />
                <span>{client.phone}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 py-4 border-t border-b border-gray-200 mb-4">
              <div>
                <p className="text-xl font-semibold text-gray-900">{client.totalBookings}</p>
                <p className="text-xs text-gray-500">Bookings</p>
              </div>
              <div>
                <p className="text-xl font-semibold text-gray-900">{client.totalSpent}</p>
                <p className="text-xs text-gray-500">Total Spent</p>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Last visit</span>
              <span className="font-medium text-gray-900">{client.lastVisit}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
