'use client';

import { motion } from 'framer-motion';
import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import Navbar from '@/components/layout/Navbar';
import Panel from '@/components/ui/Panel';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { FiPlus, FiEdit, FiTrash2, FiCheck, FiX, FiPackage, FiGrid, FiSearch } from 'react-icons/fi';
import { api } from '@/lib/api';

type Tab = 'packs' | 'categories';

export default function AdminPacksAndCategoriesPage() {
  const [activeTab, setActiveTab] = useState<Tab>('packs');
  const [packs, setPacks] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Pagination state
  const [packsPage, setPacksPage] = useState(1);
  const [categoriesPage, setCategoriesPage] = useState(1);
  const [packsPagination, setPacksPagination] = useState({ total: 0, totalPages: 0 });
  const [categoriesPagination, setCategoriesPagination] = useState({ total: 0, totalPages: 0 });
  const [loadingMore, setLoadingMore] = useState(false);
  const ITEMS_PER_PAGE = 50;
  
  // Search state
  const [packSearch, setPackSearch] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  
  // Pack form state
  const [showPackModal, setShowPackModal] = useState(false);
  const [editingPackId, setEditingPackId] = useState<string | null>(null);
  const [packFormData, setPackFormData] = useState({
    name: '',
    description: '',
    priceMonthly: 0,
    isFree: false,
  });
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedIncludedPacks, setSelectedIncludedPacks] = useState<string[]>([]);

  // Category form state
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryFormData, setCategoryFormData] = useState({
    name: '',
    nameEl: '',
    description: '',
    descriptionEl: '',
    standardBet: '',
    telegramNotifications: true,
  });

  // Translations
  const t = useTranslations('admin.packs');
  const tCommon = useTranslations('common');

  const fetchData = async () => {
    try {
      const [packsResult, categoriesResult] = await Promise.all([
        api.getPacksPaginated(true, 1, ITEMS_PER_PAGE),
        api.getCategoriesPaginated(true, 1, ITEMS_PER_PAGE),
      ]);
      setPacks(packsResult.data);
      setPacksPagination(packsResult.pagination);
      setPacksPage(1);
      setCategories(categoriesResult.data);
      setCategoriesPagination(categoriesResult.pagination);
      setCategoriesPage(1);
      setError('');
    } catch (err: any) {
      console.error('Failed to fetch data:', err);
      setError(err.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadMorePacks = async () => {
    if (loadingMore || packsPage >= packsPagination.totalPages) return;
    setLoadingMore(true);
    try {
      const result = await api.getPacksPaginated(true, packsPage + 1, ITEMS_PER_PAGE);
      setPacks(prev => [...prev, ...result.data]);
      setPacksPage(prev => prev + 1);
    } catch (err: any) {
      console.error('Failed to load more packs:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const loadMoreCategories = async () => {
    if (loadingMore || categoriesPage >= categoriesPagination.totalPages) return;
    setLoadingMore(true);
    try {
      const result = await api.getCategoriesPaginated(true, categoriesPage + 1, ITEMS_PER_PAGE);
      setCategories(prev => [...prev, ...result.data]);
      setCategoriesPage(prev => prev + 1);
    } catch (err: any) {
      console.error('Failed to load more categories:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Get all packs that are inherited through selected packs (recursively)
  const getInheritedPackIds = useMemo(() => {
    const inheritedPackIds = new Set<string>();
    
    const collectInheritedPacks = (packId: string) => {
      const pack = packs.find(p => p.id === packId);
      if (pack?.includedPacks) {
        pack.includedPacks.forEach((includedPack: any) => {
          const includedPackId = includedPack.id || includedPack;
          if (!inheritedPackIds.has(includedPackId)) {
            inheritedPackIds.add(includedPackId);
            collectInheritedPacks(includedPackId);
          }
        });
      }
    };
    
    selectedIncludedPacks.forEach(packId => collectInheritedPacks(packId));
    
    return inheritedPackIds;
  }, [selectedIncludedPacks, packs]);

  // Get categories that are already in included packs (should be greyed out)
  const getInheritedCategoryIds = useMemo(() => {
    const inheritedIds = new Set<string>();
    const allIncludedPacks = [...selectedIncludedPacks, ...Array.from(getInheritedPackIds)];
    
    allIncludedPacks.forEach(packId => {
      const pack = packs.find(p => p.id === packId);
      if (pack?.categories) {
        pack.categories.forEach((cat: any) => inheritedIds.add(cat.id));
      }
    });
    
    return inheritedIds;
  }, [selectedIncludedPacks, getInheritedPackIds, packs]);

  // Filtered lists
  const filteredPacks = useMemo(() => {
    if (!packSearch) return packs;
    const search = packSearch.toLowerCase();
    return packs.filter(p => 
      p.name.toLowerCase().includes(search) ||
      p.description?.toLowerCase().includes(search)
    );
  }, [packs, packSearch]);

  const filteredCategories = useMemo(() => {
    if (!categorySearch) return categories;
    const search = categorySearch.toLowerCase();
    return categories.filter(c => 
      c.name.toLowerCase().includes(search) ||
      c.description?.toLowerCase().includes(search)
    );
  }, [categories, categorySearch]);

  // ==================== PACK HANDLERS ====================
  const handlePackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Filter out inherited categories from selection
      const directCategories = selectedCategories.filter(id => !getInheritedCategoryIds.has(id));
      
      // Include ALL packs: directly selected + auto-inherited ones
      const inheritedArray = Array.from(getInheritedPackIds);
      const allIncludedPacks = Array.from(new Set([...selectedIncludedPacks, ...inheritedArray]));
      
      const data = {
        ...packFormData,
        currency: 'EUR', // Always EUR
        categoryIds: directCategories,
        includedPackIds: allIncludedPacks,
      };

      if (editingPackId) {
        await api.updatePack(editingPackId, { ...packFormData, currency: 'EUR' });
        await api.linkCategoriesToPack(editingPackId, directCategories);
        await api.setPackHierarchy(editingPackId, allIncludedPacks);
      } else {
        await api.createPack(data);
      }
      
      handleCancelPack();
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save pack');
    }
  };

  const handleEditPack = (pack: any) => {
    setEditingPackId(pack.id);
    setPackFormData({
      name: pack.name,
      description: pack.description || '',
      priceMonthly: pack.priceMonthly,
      isFree: pack.isFree,
    });
    setSelectedCategories(pack.categories?.map((c: any) => c.id) || []);
    setSelectedIncludedPacks(pack.includedPacks?.map((p: any) => p.id) || []);
    setShowPackModal(true);
  };

  const handleDeletePack = async (id: string) => {
    if (!confirm('Are you sure you want to delete this pack?')) return;
    
    try {
      await api.deletePack(id);
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete pack');
    }
  };

  const handleCancelPack = () => {
    setShowPackModal(false);
    setEditingPackId(null);
    setPackFormData({
      name: '',
      description: '',
      priceMonthly: 0,
      isFree: false,
    });
    setSelectedCategories([]);
    setSelectedIncludedPacks([]);
  };

  const toggleCategory = (categoryId: string) => {
    // Don't allow toggling inherited categories
    if (getInheritedCategoryIds.has(categoryId)) return;
    
    setSelectedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const toggleIncludedPack = (packId: string) => {
    setSelectedIncludedPacks(prev =>
      prev.includes(packId)
        ? prev.filter(id => id !== packId)
        : [...prev, packId]
    );
  };

  // ==================== CATEGORY HANDLERS ====================
  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const submitData = {
        name: categoryFormData.name,
        nameEl: categoryFormData.nameEl,
        description: categoryFormData.description,
        descriptionEl: categoryFormData.descriptionEl,
        standardBet: parseFloat(categoryFormData.standardBet) || 0,
        telegramNotifications: categoryFormData.telegramNotifications,
      };
      
      if (editingCategoryId) {
        await api.updateCategory(editingCategoryId, submitData);
      } else {
        await api.createCategory(submitData);
      }
      
      handleCancelCategory();
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save category');
    }
  };

  const handleEditCategory = (category: any) => {
    setEditingCategoryId(category.id);
    setCategoryFormData({
      name: category.name,
      nameEl: category.nameEl || '',
      description: category.description || '',
      descriptionEl: category.descriptionEl || '',
      standardBet: category.standardBet?.toString() || '',
      telegramNotifications: category.telegramNotifications !== false,
    });
    setShowCategoryModal(true);
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;
    
    try {
      await api.deleteCategory(id);
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete category');
    }
  };

  const handleCancelCategory = () => {
    setShowCategoryModal(false);
    setEditingCategoryId(null);
    setCategoryFormData({ name: '', nameEl: '', description: '', descriptionEl: '', standardBet: '', telegramNotifications: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 sm:pt-32 pb-20">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-neon-cyan"></div>
            <p className="mt-4 text-gray-400">{tCommon('loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />

      <div className="container mx-auto px-4 pt-24 sm:pt-32 pb-20">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 sm:mb-8"
        >
          <h1 className="font-orbitron text-3xl sm:text-4xl md:text-5xl font-bold text-neon-cyan mb-2 text-shadow-glow">
            {t('title')}
          </h1>
          <p className="text-gray-300 text-sm sm:text-base">
            {t('subtitle')}
          </p>

          {error && (
            <div className="bg-red-500/10 border border-red-500 rounded-lg p-4 mt-4">
              <p className="text-red-400">{error}</p>
            </div>
          )}
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6 sm:mb-8"
        >
          <div className="flex gap-2 p-1 bg-dark-200 rounded-xl border border-gray-700 w-fit">
            <button
              onClick={() => setActiveTab('packs')}
              className={`flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-orbitron font-bold text-sm sm:text-base transition-all ${
                activeTab === 'packs'
                  ? 'bg-gradient-neon text-cyber-dark'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <FiPackage />
              {t('tabs.packs')} ({packs.length})
            </button>
            <button
              onClick={() => setActiveTab('categories')}
              className={`flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-orbitron font-bold text-sm sm:text-base transition-all ${
                activeTab === 'categories'
                  ? 'bg-gradient-neon text-cyber-dark'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <FiGrid />
              {t('tabs.categories')} ({categories.length})
            </button>
          </div>
        </motion.div>

        {/* ==================== PACKS TAB ==================== */}
        {activeTab === 'packs' && (
          <motion.div
            key="packs"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            {/* Packs Header with Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between mb-6 gap-4">
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={packSearch}
                    onChange={(e) => setPackSearch(e.target.value)}
                    placeholder={t('searchPacks')}
                    className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:border-neon-cyan focus:outline-none text-sm sm:text-base"
                  />
                </div>
              </div>
              <Button
                variant="primary"
                icon={<FiPlus />}
                onClick={() => setShowPackModal(true)}
              >
                {t('createPack')}
              </Button>
            </div>

            {/* Pack Modal */}
            {showPackModal && (
              <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-2 sm:p-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-dark-100 border border-gray-700 rounded-xl sm:rounded-2xl p-4 sm:p-6 max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto"
                >
                  <h3 className="font-orbitron text-lg sm:text-xl md:text-2xl font-bold text-neon-cyan mb-4 sm:mb-6">
                    {editingPackId ? t('editPack') : t('createPack')}
                  </h3>

                  <form onSubmit={handlePackSubmit} className="space-y-3 sm:space-y-4 md:space-y-6">
                    {/* Basic Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-gray-300 mb-2">
                          {t('form.name')} *
                        </label>
                        <input
                          type="text"
                          value={packFormData.name}
                          onChange={(e) => setPackFormData({ ...packFormData, name: e.target.value })}
                          required
                          className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:border-neon-cyan focus:outline-none text-sm sm:text-base"
                          placeholder="e.g., VIP Silver"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-gray-300 mb-2">
                          {t('form.price')}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={packFormData.priceMonthly}
                          onChange={(e) => setPackFormData({ ...packFormData, priceMonthly: parseFloat(e.target.value) || 0 })}
                          className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:border-neon-cyan focus:outline-none text-sm sm:text-base"
                          disabled={packFormData.isFree}
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-300 mb-2">
                        {t('form.description')}
                      </label>
                      <textarea
                        value={packFormData.description}
                        onChange={(e) => setPackFormData({ ...packFormData, description: e.target.value })}
                        rows={2}
                        className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:border-neon-cyan focus:outline-none"
                        placeholder="Brief description of this pack"
                      />
                    </div>

                    <div>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={packFormData.isFree}
                          onChange={(e) => setPackFormData({ 
                            ...packFormData, 
                            isFree: e.target.checked, 
                            priceMonthly: e.target.checked ? 0 : packFormData.priceMonthly 
                          })}
                          className="form-checkbox text-neon-cyan w-5 h-5"
                        />
                        <span className="text-white font-bold">Free Pack (no payment required)</span>
                      </label>
                    </div>

                    {/* Included Packs (Hierarchy) */}
                    <div>
                      <label className="block text-sm font-bold text-gray-300 mb-2">
                        Includes Lower Packs (Inheritance)
                      </label>
                      <p className="text-xs text-gray-500 mb-2">
                        Grey packs are auto-inherited from selected packs
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 sm:p-4 bg-dark-200 border border-gray-700 rounded-lg max-h-40 overflow-y-auto">
                        {packs.filter(p => p.id !== editingPackId).map((pack) => {
                          const isAutoInherited = getInheritedPackIds.has(pack.id);
                          const isSelected = selectedIncludedPacks.includes(pack.id) || isAutoInherited;
                          
                          return (
                            <label 
                              key={pack.id} 
                              className={`flex items-center gap-2 ${
                                isAutoInherited 
                                  ? 'opacity-50 cursor-not-allowed' 
                                  : 'cursor-pointer hover:text-neon-cyan'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => !isAutoInherited && toggleIncludedPack(pack.id)}
                                disabled={isAutoInherited}
                                className="form-checkbox text-neon-cyan disabled:opacity-50"
                              />
                              <span className={`text-sm ${isAutoInherited ? 'text-gray-500' : ''}`}>
                                {pack.name}
                              </span>
                              {isAutoInherited && (
                                <span className="text-xs text-gray-600">(auto)</span>
                              )}
                            </label>
                          );
                        })}
                        {packs.filter(p => p.id !== editingPackId).length === 0 && (
                          <span className="text-sm text-gray-500 col-span-2">No other packs available</span>
                        )}
                      </div>
                    </div>

                    {/* Categories Selection */}
                    <div>
                      <label className="block text-sm font-bold text-gray-300 mb-2">
                        Direct Categories
                      </label>
                      <p className="text-xs text-gray-500 mb-2">
                        Grey categories are inherited from included packs
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 p-3 sm:p-4 bg-dark-200 border border-gray-700 rounded-lg max-h-40 sm:max-h-48 overflow-y-auto">
                        {categories.map((category) => {
                          const isInherited = getInheritedCategoryIds.has(category.id);
                          const isSelected = selectedCategories.includes(category.id) || isInherited;
                          
                          return (
                            <label 
                              key={category.id} 
                              className={`flex items-center gap-2 ${
                                isInherited 
                                  ? 'opacity-50 cursor-not-allowed' 
                                  : 'cursor-pointer hover:text-neon-cyan'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleCategory(category.id)}
                                disabled={isInherited}
                                className="form-checkbox text-neon-cyan disabled:opacity-50"
                              />
                              <span className={`text-sm ${isInherited ? 'text-gray-500 line-through' : ''}`}>
                                {category.name}
                              </span>
                              {isInherited && (
                                <span className="text-xs text-gray-600">(inherited)</span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-3 sm:pt-4 border-t border-gray-700">
                      <Button type="submit" variant="primary" icon={<FiCheck />}>
                        {editingPackId ? 'Save Changes' : 'Create Pack'}
                      </Button>
                      <Button type="button" variant="secondary" icon={<FiX />} onClick={handleCancelPack}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}

            {/* Packs List */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredPacks.map((pack, index) => (
                <motion.div
                  key={pack.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Panel>
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-orbitron text-2xl font-bold text-white">
                              {pack.name}
                            </h3>
                            {Boolean(pack.isFree) && (
                              <Badge variant="blue" size="sm">
                                FREE
                              </Badge>
                            )}
                          </div>
                          
                          <p className="font-orbitron text-xl text-neon-orange mb-2">
                            {Boolean(pack.isFree) ? 'FREE' : `€${pack.priceMonthly}/month`}
                          </p>

                          {pack.description && (
                            <p className="text-gray-400 mb-3">{pack.description}</p>
                          )}
                        </div>
                      </div>

                      {/* Categories */}
                      <div className="mb-3">
                        <p className="text-xs font-bold text-neon-cyan uppercase mb-2">
                          Direct Categories ({pack.categories?.length || 0}):
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {pack.categories && pack.categories.length > 0 ? (
                            pack.categories.map((cat: any) => (
                              <Badge key={cat.id} variant="blue" size="sm">
                                {cat.name}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-sm text-gray-500">None</span>
                          )}
                        </div>
                      </div>

                      {/* Included Packs */}
                      {pack.includedPacks && pack.includedPacks.length > 0 && (
                        <div className="mb-3 pt-3 border-t border-gray-700">
                          <p className="text-xs font-bold text-neon-cyan uppercase mb-2">
                            + Includes (Hierarchy):
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {pack.includedPacks.map((p: any) => (
                              <Badge key={p.id || p} variant="green" size="sm">
                                {p.name || p}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2 pt-4 border-t border-gray-700">
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<FiEdit />}
                          onClick={() => handleEditPack(pack)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          icon={<FiTrash2 />}
                          onClick={() => handleDeletePack(pack.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </Panel>
                </motion.div>
              ))}

              {filteredPacks.length === 0 && (
                <div className="lg:col-span-2">
                  <Panel>
                    <div className="text-center py-12">
                      <p className="text-2xl text-gray-400 mb-4">
                        {packSearch ? 'No packs match your search' : 'No packs yet'}
                      </p>
                      {!packSearch && (
                        <Button icon={<FiPlus />} onClick={() => setShowPackModal(true)}>
                          Create First Pack
                        </Button>
                      )}
                    </div>
                  </Panel>
                </div>
              )}
            </div>

            {/* Load More Packs Button */}
            {packsPage < packsPagination.totalPages && !packSearch && (
              <div className="flex justify-center mt-6">
                <Button
                  onClick={loadMorePacks}
                  disabled={loadingMore}
                  variant="secondary"
                >
                  {loadingMore ? 'Loading...' : `Load More (${packs.length} of ${packsPagination.total})`}
                </Button>
              </div>
            )}
          </motion.div>
        )}

        {/* ==================== CATEGORIES TAB ==================== */}
        {activeTab === 'categories' && (
          <motion.div
            key="categories"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            {/* Categories Header with Search */}
            <div className="flex items-center justify-between mb-6 gap-4">
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    placeholder="Search categories..."
                    className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:border-neon-cyan focus:outline-none"
                  />
                </div>
              </div>
              <Button
                variant="primary"
                icon={<FiPlus />}
                onClick={() => setShowCategoryModal(true)}
              >
                New Category
              </Button>
            </div>

            {/* Category Modal */}
            {showCategoryModal && (
              <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-2 sm:p-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-dark-100 border border-gray-700 rounded-xl sm:rounded-2xl p-4 sm:p-6 max-w-lg w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto"
                >
                  <h3 className="font-orbitron text-lg sm:text-2xl font-bold text-neon-cyan mb-4 sm:mb-6">
                    {editingCategoryId ? 'Edit Category' : 'Create New Category'}
                  </h3>

                  <form onSubmit={handleCategorySubmit} className="space-y-4 sm:space-y-6">
                    {/* English Name */}
                    <div>
                      <label className="block text-sm font-bold text-gray-300 mb-2">
                        Name (English) *
                      </label>
                      <input
                        type="text"
                        value={categoryFormData.name}
                        onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                        required
                        className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:border-neon-cyan focus:outline-none"
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
                        value={categoryFormData.nameEl}
                        onChange={(e) => setCategoryFormData({ ...categoryFormData, nameEl: e.target.value })}
                        required
                        className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:border-neon-cyan focus:outline-none"
                        placeholder="π.χ. Funbet, Δύσκολα Στοιχήματα"
                      />
                    </div>

                    {/* English Description */}
                    <div>
                      <label className="block text-sm font-bold text-gray-300 mb-2">
                        Description (English) *
                      </label>
                      <textarea
                        value={categoryFormData.description}
                        onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                        required
                        rows={2}
                        className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:border-neon-cyan focus:outline-none"
                        placeholder="Brief description of this category"
                      />
                    </div>

                    {/* Greek Description */}
                    <div>
                      <label className="block text-sm font-bold text-gray-300 mb-2">
                        Description (Greek) * <span className="text-neon-cyan text-xs">Ελληνικά</span>
                      </label>
                      <textarea
                        value={categoryFormData.descriptionEl}
                        onChange={(e) => setCategoryFormData({ ...categoryFormData, descriptionEl: e.target.value })}
                        required
                        rows={2}
                        className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:border-neon-cyan focus:outline-none"
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
                        value={categoryFormData.standardBet}
                        onChange={(e) => setCategoryFormData({ ...categoryFormData, standardBet: e.target.value })}
                        required
                        className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:border-neon-cyan focus:outline-none"
                        placeholder="e.g., 10.00"
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="telegramNotificationsPack"
                        checked={categoryFormData.telegramNotifications}
                        onChange={(e) => setCategoryFormData({ ...categoryFormData, telegramNotifications: e.target.checked })}
                        className="w-5 h-5 rounded border-gray-700 bg-dark-200 text-neon-cyan focus:ring-neon-cyan"
                      />
                      <label htmlFor="telegramNotificationsPack" className="text-sm font-bold text-gray-300">
                        Send Telegram Bot Notifications
                      </label>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-3 sm:pt-4 border-t border-gray-700">
                      <Button type="submit" variant="primary" icon={<FiCheck />}>
                        {editingCategoryId ? 'Save Changes' : 'Create Category'}
                      </Button>
                      <Button type="button" variant="secondary" icon={<FiX />} onClick={handleCancelCategory}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}

            {/* Categories List */}
            <div className="space-y-4">
              {filteredCategories.map((category, index) => (
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
                            <Badge variant="orange" size="sm">
                              €{category.standardBet?.toFixed(2) || '0.00'}
                            </Badge>
                          </div>
                          
                          {category.description && (
                            <div className="text-gray-400 mb-3">
                              <p className="text-sm">EN: {category.description}</p>
                              {category.descriptionEl && (
                                <p className="text-sm text-gray-500">EL: {category.descriptionEl}</p>
                              )}
                            </div>
                          )}

                          {/* Show which packs use this category */}
                          <div className="mt-3">
                            <p className="text-xs text-gray-500 mb-1">Used by packs:</p>
                            <div className="flex flex-wrap gap-1">
                              {packs
                                .filter(p => p.categories?.some((c: any) => c.id === category.id))
                                .map(p => (
                                  <Badge key={p.id} variant="orange" size="sm">
                                    {p.name}
                                  </Badge>
                                ))
                              }
                              {!packs.some(p => p.categories?.some((c: any) => c.id === category.id)) && (
                                <span className="text-xs text-gray-600">None</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={<FiEdit />}
                            onClick={() => handleEditCategory(category)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            icon={<FiTrash2 />}
                            onClick={() => handleDeleteCategory(category.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Panel>
                </motion.div>
              ))}

              {filteredCategories.length === 0 && (
                <Panel>
                  <div className="text-center py-12">
                    <p className="text-2xl text-gray-400 mb-4">
                      {categorySearch ? 'No categories match your search' : 'No categories yet'}
                    </p>
                    {!categorySearch && (
                      <Button icon={<FiPlus />} onClick={() => setShowCategoryModal(true)}>
                        Create First Category
                      </Button>
                    )}
                  </div>
                </Panel>
              )}
            </div>

            {/* Load More Categories Button */}
            {categoriesPage < categoriesPagination.totalPages && !categorySearch && (
              <div className="flex justify-center mt-6">
                <Button
                  onClick={loadMoreCategories}
                  disabled={loadingMore}
                  variant="secondary"
                >
                  {loadingMore ? 'Loading...' : `Load More (${categories.length} of ${categoriesPagination.total})`}
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
