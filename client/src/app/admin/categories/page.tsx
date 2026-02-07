'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import Navbar from '@/components/layout/Navbar';
import Panel from '@/components/ui/Panel';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { FiPlus, FiEdit, FiTrash2, FiCheck, FiX } from 'react-icons/fi';
import { api } from '@/lib/api';

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    nameEl: '',
    description: '',
    descriptionEl: '',
    standardBet: '',
    displayOrder: 0,
    isActive: true,
    includeInStatistics: true,
    telegramNotifications: true,
  });
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });
  const [loadingMore, setLoadingMore] = useState(false);
  const ITEMS_PER_PAGE = 50;

  const fetchCategories = async () => {
    try {
      const result = await api.getCategoriesPaginated(true, 1, ITEMS_PER_PAGE);
      setCategories(result.data);
      setPagination(result.pagination);
      setPage(1);
      setError('');
    } catch (err: any) {
      console.error('Failed to fetch categories:', err);
      setError(err.response?.data?.message || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const loadMoreCategories = async () => {
    if (loadingMore || page >= pagination.totalPages) return;
    setLoadingMore(true);
    try {
      const result = await api.getCategoriesPaginated(true, page + 1, ITEMS_PER_PAGE);
      setCategories(prev => [...prev, ...result.data]);
      setPage(prev => prev + 1);
    } catch (err: any) {
      console.error('Failed to load more categories:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const submitData = {
        ...formData,
        standardBet: parseFloat(formData.standardBet) || 0,
      };
      
      if (editingId) {
        await api.updateCategory(editingId, submitData);
      } else {
        await api.createCategory(submitData);
      }
      
      setShowCreateForm(false);
      setEditingId(null);
      setFormData({ name: '', nameEl: '', description: '', descriptionEl: '', standardBet: '', displayOrder: 0, isActive: true, includeInStatistics: true, telegramNotifications: true });
      await fetchCategories();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save category');
    }
  };

  const handleEdit = (category: any) => {
    setEditingId(category.id);
    setFormData({
      name: category.name,
      nameEl: category.nameEl || '',
      description: category.description || '',
      descriptionEl: category.descriptionEl || '',
      standardBet: category.standardBet?.toString() || '',
      displayOrder: category.displayOrder,
      isActive: category.isActive,
      includeInStatistics: category.includeInStatistics !== false,
      telegramNotifications: category.telegramNotifications !== false,
    });
    setShowCreateForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;
    
    try {
      await api.deleteCategory(id);
      await fetchCategories();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete category');
    }
  };

  const handleCancel = () => {
    setShowCreateForm(false);
    setEditingId(null);
    setFormData({ name: '', nameEl: '', description: '', descriptionEl: '', standardBet: '', displayOrder: 0, isActive: true, includeInStatistics: true, telegramNotifications: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="container mx-auto px-4 pt-32 pb-20">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-neon-cyan"></div>
            <p className="mt-4 text-gray-400">Loading categories...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />

      <div className="container mx-auto px-4 pt-32 pb-20">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="font-orbitron text-4xl md:text-5xl font-bold text-neon-cyan mb-2 text-shadow-glow">
                MANAGE CATEGORIES
              </h1>
              <p className="text-gray-300">
                Create and manage betting categories
              </p>
            </div>
            <Button
              variant="primary"
              icon={<FiPlus />}
              onClick={() => setShowCreateForm(!showCreateForm)}
            >
              {showCreateForm ? 'Cancel' : 'New Category'}
            </Button>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500 rounded-lg p-4 mb-4">
              <p className="text-red-400">{error}</p>
            </div>
          )}
        </motion.div>

        {/* Create/Edit Form */}
        {showCreateForm && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <Panel>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <h3 className="font-orbitron text-xl font-bold text-neon-cyan mb-4">
                  {editingId ? 'Edit Category' : 'Create New Category'}
                </h3>

                {/* English Name */}
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">
                    Name (English) *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full px-4 py-2 bg-dark-200 border border-gray-700 rounded-lg text-white focus:border-neon-cyan focus:outline-none"
                    placeholder="e.g., Funbet, Hard Bets"
                  />
                </div>

                {/* Greek Name */}
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">
                    Name (Greek) * <span className="text-neon-cyan text-xs">Ελληνικά</span>
                  </label>
                  <input
                    type="text"
                    value={formData.nameEl}
                    onChange={(e) => setFormData({ ...formData, nameEl: e.target.value })}
                    required
                    className="w-full px-4 py-2 bg-dark-200 border border-gray-700 rounded-lg text-white focus:border-neon-cyan focus:outline-none"
                    placeholder="π.χ. Funbet, Δύσκολα Στοιχήματα"
                  />
                </div>

                {/* English Description */}
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">
                    Description (English) *
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                    rows={2}
                    className="w-full px-4 py-2 bg-dark-200 border border-gray-700 rounded-lg text-white focus:border-neon-cyan focus:outline-none"
                    placeholder="Brief description of this category"
                  />
                </div>

                {/* Greek Description */}
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">
                    Description (Greek) * <span className="text-neon-cyan text-xs">Ελληνικά</span>
                  </label>
                  <textarea
                    value={formData.descriptionEl}
                    onChange={(e) => setFormData({ ...formData, descriptionEl: e.target.value })}
                    required
                    rows={2}
                    className="w-full px-4 py-2 bg-dark-200 border border-gray-700 rounded-lg text-white focus:border-neon-cyan focus:outline-none"
                    placeholder="Σύντομη περιγραφή αυτής της κατηγορίας"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">
                    Standard Bet (€) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.standardBet}
                    onChange={(e) => setFormData({ ...formData, standardBet: e.target.value })}
                    required
                    className="w-full px-4 py-2 bg-dark-200 border border-gray-700 rounded-lg text-white focus:border-neon-cyan focus:outline-none"
                    placeholder="e.g., 10.00"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-300 mb-2">
                      Display Order
                    </label>
                    <input
                      type="number"
                      value={formData.displayOrder}
                      onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 bg-dark-200 border border-gray-700 rounded-lg text-white focus:border-neon-cyan focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-300 mb-2">
                      Status
                    </label>
                    <select
                      value={formData.isActive ? 'active' : 'inactive'}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'active' })}
                      className="w-full px-4 py-2 bg-dark-200 border border-gray-700 rounded-lg text-white focus:border-neon-cyan focus:outline-none"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="includeInStatistics"
                    checked={formData.includeInStatistics}
                    onChange={(e) => setFormData({ ...formData, includeInStatistics: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-700 bg-dark-200 text-neon-cyan focus:ring-neon-cyan"
                  />
                  <label htmlFor="includeInStatistics" className="text-sm font-bold text-gray-300">
                    Include in Public Statistics
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="telegramNotifications"
                    checked={formData.telegramNotifications}
                    onChange={(e) => setFormData({ ...formData, telegramNotifications: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-700 bg-dark-200 text-neon-cyan focus:ring-neon-cyan"
                  />
                  <label htmlFor="telegramNotifications" className="text-sm font-bold text-gray-300">
                    Send Telegram Bot Notifications
                  </label>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button type="submit" variant="primary" icon={<FiCheck />}>
                    {editingId ? 'Update' : 'Create'}
                  </Button>
                  <Button type="button" variant="secondary" icon={<FiX />} onClick={handleCancel}>
                    Cancel
                  </Button>
                </div>
              </form>
            </Panel>
          </motion.div>
        )}

        {/* Categories List */}
        <div className="space-y-4">
          {categories.map((category, index) => (
            <motion.div
              key={category.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Panel>
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h3 className="font-orbitron text-xl font-bold text-white">
                          {category.name}
                        </h3>
                        {category.nameEl && (
                          <span className="text-neon-cyan text-sm">({category.nameEl})</span>
                        )}
                        <Badge variant={category.isActive ? 'green' : 'red'} size="sm">
                          {category.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        <Badge variant="blue" size="sm">
                          Order: {category.displayOrder}
                        </Badge>
                        <Badge variant="orange" size="sm">
                          €{category.standardBet?.toFixed(2) || '0.00'}
                        </Badge>
                        {!category.includeInStatistics && (
                          <Badge variant="red" size="sm">
                            Excluded from Stats
                          </Badge>
                        )}
                      </div>
                      
                      {category.description && (
                        <div className="text-gray-400 mb-3">
                          <p className="text-sm">EN: {category.description}</p>
                          {category.descriptionEl && (
                            <p className="text-sm text-gray-500">EL: {category.descriptionEl}</p>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>ID: {category.id}</span>
                        <span>Created: {new Date(category.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<FiEdit />}
                        onClick={() => handleEdit(category)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        icon={<FiTrash2 />}
                        onClick={() => handleDelete(category.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              </Panel>
            </motion.div>
          ))}

          {categories.length === 0 && (
            <Panel>
              <div className="text-center py-12">
                <p className="text-2xl text-gray-400 mb-4">No categories yet</p>
                <Button icon={<FiPlus />} onClick={() => setShowCreateForm(true)}>
                  Create First Category
                </Button>
              </div>
            </Panel>
          )}

          {/* Load More Button */}
          {page < pagination.totalPages && (
            <div className="flex justify-center mt-6">
              <Button
                onClick={loadMoreCategories}
                disabled={loadingMore}
                variant="secondary"
              >
                {loadingMore ? 'Loading...' : `Load More (${categories.length} of ${pagination.total})`}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
