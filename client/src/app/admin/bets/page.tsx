'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef, memo } from 'react';
import { useTranslations } from 'next-intl';
import Navbar from '@/components/layout/Navbar';
import Panel from '@/components/ui/Panel';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { 
  FiPlus, FiEdit, FiTrash2, FiSend, FiFilter, 
  FiChevronDown, FiX, FiUpload, FiImage 
} from 'react-icons/fi';
import { api, API_BASE_URL } from '@/lib/api';
import { useShouldReduceMotion, useIsMobile } from '@/hooks/useMediaQuery';

type ResultFilter = 'ALL' | 'IN_PROGRESS' | 'FINISHED' | 'WIN' | 'LOST' | 'CASH_OUT';

interface Category {
  id: string;
  name: string;
  description?: string;
}

interface Bet {
  id: string;
  imageUrl?: string;
  odds: string;
  standardBet: number;
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';
  result: 'IN_PROGRESS' | 'WIN' | 'LOST' | 'CASH_OUT';
  categoryId: string;
  categoryName: string;
  publishedAt?: string;
  createdAt: string;
}

// Memoized bet card component for admin
const AdminBetCard = memo(function AdminBetCard({
  bet,
  onEdit,
  onDelete,
  onPublish,
  onImageClick,
  shouldReduceMotion,
  isMobile,
}: {
  bet: Bet;
  onEdit: (bet: Bet) => void;
  onDelete: (id: string) => void;
  onPublish: (id: string) => void;
  onImageClick: (url: string) => void;
  shouldReduceMotion: boolean;
  isMobile: boolean;
}) {
  const [imageError, setImageError] = useState(false);

  const statusVariants = {
    DRAFT: 'blue' as const,
    SCHEDULED: 'orange' as const,
    PUBLISHED: 'green' as const,
    ARCHIVED: 'red' as const,
  };

  const resultVariants = {
    IN_PROGRESS: 'blue' as const,
    WIN: 'green' as const,
    LOST: 'red' as const,
    CASH_OUT: 'orange' as const,
  };

  return (
    <Card 
      variant="glass" 
      hover={!isMobile} 
      animated={!shouldReduceMotion}
      className="relative overflow-hidden h-full"
    >
      {/* Result indicator line at top */}
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${
        bet.result === 'WIN' ? 'from-green-500/20 to-emerald-500/20' :
        bet.result === 'LOST' ? 'from-red-500/20 to-rose-500/20' :
        bet.result === 'CASH_OUT' ? 'from-orange-500/20 to-amber-500/20' :
        'from-blue-500/20 to-cyan-500/20'
      }`} />
      
      <div className="space-y-4">
        {/* Image */}
        {bet.imageUrl && !imageError && (
          <div 
            className="relative w-full rounded-lg overflow-hidden bg-cyber-dark/50 cursor-pointer active:opacity-90 sm:hover:opacity-90 transition-opacity"
            onClick={() => onImageClick(`${API_BASE_URL}${bet.imageUrl}`)}
          >
            <img
              src={`${API_BASE_URL}${bet.imageUrl}`}
              alt="Bet image"
              className="w-full h-auto max-h-64 object-contain"
              onError={() => setImageError(true)}
              loading="lazy"
              decoding="async"
            />
          </div>
        )}

        {/* Fallback for no image or error */}
        {(!bet.imageUrl || imageError) && (
          <div className="relative w-full h-48 rounded-lg overflow-hidden bg-cyber-dark/50 flex items-center justify-center">
            <FiImage className="w-12 h-12 text-gray-600" />
          </div>
        )}
        
        {/* Header with Category and Result aligned on same row */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Badge variant="blue" size="sm">
              {bet.categoryName}
            </Badge>
            <Badge 
              variant={resultVariants[bet.result]} 
              size="sm" 
              className="flex items-center gap-1 shrink-0 ml-auto"
            >
              {bet.result.replace('_', ' ')}
            </Badge>
          </div>
        </div>
        
        {/* Odds and Standard Bet */}
        <div className="glass-panel-light p-4 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm uppercase font-medium">Odds</span>
            <span className="font-orbitron text-2xl font-bold text-neon-orange text-shadow-orange-light">
              {bet.odds}
            </span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <span className="text-gray-400 text-sm uppercase font-medium">Standard Bet</span>
            <span className="font-orbitron text-lg font-bold text-neon-cyan text-shadow-glow-light">
              €{bet.standardBet?.toFixed(2) || '0.00'}
            </span>
          </div>
        </div>
        
        {/* Meta Info */}
        <div className="flex items-center gap-2 text-xs text-gray-400 pt-2 border-t border-white/10">
          <span>{bet.createdAt}</span>
          <span className="text-gray-600">•</span>
          <Badge variant={statusVariants[bet.status]} size="sm">
            {bet.status}
          </Badge>
        </div>
        
        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t border-white/10">
          {bet.status === 'DRAFT' && (
            <button 
              className="flex-1 p-2 bg-neon-blue/20 active:bg-neon-blue/30 sm:hover:bg-neon-blue/30 rounded-lg transition-colors flex items-center justify-center gap-2"
              onClick={() => onPublish(bet.id)}
              title="Publish"
            >
              <FiSend className="text-neon-blue" />
              <span className="text-neon-blue text-sm">Publish</span>
            </button>
          )}
          <button 
            className="flex-1 p-2 bg-neon-cyan/20 active:bg-neon-cyan/30 sm:hover:bg-neon-cyan/30 rounded-lg transition-colors flex items-center justify-center gap-2"
            onClick={() => onEdit(bet)}
            title="Edit"
          >
            <FiEdit className="text-neon-cyan" />
            <span className="text-neon-cyan text-sm">Edit</span>
          </button>
          <button 
            className="flex-1 p-2 bg-red-500/20 active:bg-red-500/30 sm:hover:bg-red-500/30 rounded-lg transition-colors flex items-center justify-center gap-2"
            onClick={() => onDelete(bet.id)}
            title="Delete"
          >
            <FiTrash2 className="text-red-400" />
            <span className="text-red-400 text-sm">Delete</span>
          </button>
        </div>
      </div>
    </Card>
  );
});

export default function AdminBetsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [bets, setBets] = useState<Bet[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [resultFilter, setResultFilter] = useState<ResultFilter>('ALL');
  const [showFinishedDropdown, setShowFinishedDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingBet, setEditingBet] = useState<Bet | null>(null);
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    categoryId: '',
    odds: '',
    result: 'IN_PROGRESS' as 'IN_PROGRESS' | 'WIN' | 'LOST' | 'CASH_OUT',
  });
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Performance hooks
  const shouldReduceMotion = useShouldReduceMotion();
  const isMobile = useIsMobile();

  // Translations
  const t = useTranslations('admin.bets');
  const tCommon = useTranslations('common');
  const tBets = useTranslations('bets');

  // Initial load - fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const categoriesData = await api.getCategories(true);
        setCategories(categoriesData);
      } catch (err: any) {
        console.error('Failed to fetch categories:', err);
      }
    };
    fetchCategories();
  }, []);

  // Fetch bets whenever filters change (including initial load)
  useEffect(() => {
    fetchBets();
  }, [selectedCategory, resultFilter]);

  const fetchBets = async () => {
    try {
      setLoading(true);
      setPage(1);
      const betsResponse = await api.getAdminBets(
        1, 50,
        selectedCategory || undefined,
        resultFilter !== 'ALL' ? resultFilter : undefined
      );
      setBets(betsResponse.data || []);
      setHasMore((betsResponse.pagination?.page || 1) < (betsResponse.pagination?.totalPages || 1));
    } catch (err: any) {
      console.error('Failed to fetch bets:', err);
      setError(err.response?.data?.message || 'Failed to load bets');
    } finally {
      setLoading(false);
    }
  };

  const fetchData = fetchBets;

  const loadMoreBets = async () => {
    if (loadingMore || !hasMore) return;
    
    try {
      setLoadingMore(true);
      const nextPage = page + 1;
      const betsResponse = await api.getAdminBets(
        nextPage, 50,
        selectedCategory || undefined,
        resultFilter !== 'ALL' ? resultFilter : undefined
      );
      setBets(prev => [...prev, ...(betsResponse.data || [])]);
      setPage(nextPage);
      setHasMore(nextPage < (betsResponse.pagination?.totalPages || 1));
    } catch (err) {
      console.error('Failed to load more bets:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Log file info for debugging mobile issues
      console.log('Selected file:', {
        name: file.name,
        type: file.type,
        size: file.size,
      });
      
      // Validate file type - only PNG and JPG allowed
      // Note: Some mobile browsers report empty type or different MIME types
      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', ''];
      const fileExtension = file.name.toLowerCase().split('.').pop();
      const allowedExtensions = ['png', 'jpg', 'jpeg'];
      
      // Check by MIME type OR by extension (mobile browsers sometimes don't set type correctly)
      const isValidType = allowedTypes.includes(file.type) || allowedExtensions.includes(fileExtension || '');
      
      if (!isValidType) {
        alert(`Only PNG and JPG images are allowed. Your file type: ${file.type || 'unknown'}`);
        return;
      }
      
      // Validate file size - max 5MB
      if (file.size > 5 * 1024 * 1024) {
        alert(`Image must be less than 5MB. Your file size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
        return;
      }
      
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateBet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.categoryId || !formData.odds) {
      alert('Please fill in all required fields');
      return;
    }
    
    // Image is required for new bets
    if (!editingBet && !selectedImage) {
      alert('Please upload an image for the bet');
      return;
    }

    try {
      setSubmitting(true);
      const form = new FormData();
      form.append('categoryId', formData.categoryId);
      form.append('odds', formData.odds);
      form.append('result', formData.result);
      if (selectedImage) {
        // Log file info for debugging
        console.log('Uploading image:', {
          name: selectedImage.name,
          type: selectedImage.type,
          size: selectedImage.size,
        });
        form.append('image', selectedImage);
      }

      if (editingBet) {
        await api.updateBet(editingBet.id, form);
      } else {
        await api.createBet(form);
      }

      await fetchData();
      resetForm(); // Close modal after creating or editing
    } catch (err: any) {
      // Enhanced error logging for debugging
      console.error('Bet save error:', {
        message: err.message,
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
        code: err.code,
      });
      
      // Show more detailed error to user
      const errorMessage = err.response?.data?.message 
        || err.response?.data?.error 
        || err.message 
        || 'Failed to save bet';
      alert(`Error: ${errorMessage}${err.response?.status ? ` (${err.response.status})` : ''}`);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setShowCreateModal(false);
    setEditingBet(null);
    setFormData({
      categoryId: selectedCategory || '',
      odds: '',
      result: 'IN_PROGRESS',
    });
    setSelectedImage(null);
    setImagePreview(null);
  };

  const handleEdit = (bet: Bet) => {
    setEditingBet(bet);
    setFormData({
      categoryId: bet.categoryId,
      odds: bet.odds,
      result: bet.result,
    });
    if (bet.imageUrl) {
      setImagePreview(`${API_BASE_URL}${bet.imageUrl}`);
    }
    setShowCreateModal(true);
  };

  const handlePublish = async (id: string) => {
    try {
      await api.publishBet(id);
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to publish bet');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this bet?')) return;
    
    try {
      await api.deleteBet(id);
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete bet');
    }
  };

  // Bets are now filtered server-side, no client-side filtering needed

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

  if (error) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 sm:pt-32 pb-20">
          <Panel>
            <div className="text-center py-8">
              <p className="text-red-400 mb-4">{error}</p>
              <Button onClick={() => window.location.reload()}>{tCommon('retry')}</Button>
            </div>
          </Panel>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />

      <div className="container mx-auto px-4 pt-24 sm:pt-32 pb-20">
        {/* Header */}
        <div className={`mb-6 sm:mb-8 ${shouldReduceMotion ? '' : 'animate-fade-in'}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="font-orbitron text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-neon-cyan mb-2 sm:mb-4 text-shadow-glow-light sm:text-shadow-glow">
                {t('title')}
              </h1>
              <p className="text-base sm:text-xl text-gray-300">
                {t('subtitle')}
              </p>
            </div>
            
            {/* Show Create button when category is selected */}
            {selectedCategory && (
              <Button 
                variant="primary" 
                size="lg" 
                icon={<FiPlus />}
                onClick={() => {
                  // Set the result based on current filter
                  let defaultResult: 'IN_PROGRESS' | 'WIN' | 'LOST' | 'CASH_OUT' = 'IN_PROGRESS';
                  if (resultFilter === 'WIN') defaultResult = 'WIN';
                  else if (resultFilter === 'LOST') defaultResult = 'LOST';
                  else if (resultFilter === 'CASH_OUT') defaultResult = 'CASH_OUT';
                  
                  setFormData(prev => ({ ...prev, categoryId: selectedCategory, result: defaultResult }));
                  setShowCreateModal(true);
                }}
              >
                {t('createBet')}
              </Button>
            )}
          </div>
        </div>

        {/* Result Filters - Above categories */}
        <div className="glass-panel-mobile p-3 sm:p-4 rounded-xl mb-6 overflow-visible relative z-20">
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
            <span className="text-gray-400 font-bold text-sm sm:text-base">{tBets('filterByResult')}</span>
            
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => { setResultFilter('ALL'); setSelectedCategory(null); }}>
                <Badge
                  variant="purple"
                  className={`cursor-pointer ${resultFilter === 'ALL' ? 'ring-2 ring-neon-cyan' : 'opacity-50 active:opacity-75 sm:hover:opacity-75'}`}
                >
                  {tBets('results.all')}
                </Badge>
              </button>
              
              <button onClick={() => setResultFilter('IN_PROGRESS')}>
                <Badge
                  variant="blue"
                  className={`cursor-pointer ${resultFilter === 'IN_PROGRESS' ? 'ring-2 ring-neon-cyan' : 'opacity-50 active:opacity-75 sm:hover:opacity-75'}`}
                >
                  {tBets('results.inProgress')}
                </Badge>
              </button>
              
                <div className="relative z-50">
                <button onClick={() => setShowFinishedDropdown(!showFinishedDropdown)}>
                  <Badge
                    variant={resultFilter === 'WIN' ? 'green' : resultFilter === 'LOST' ? 'red' : resultFilter === 'CASH_OUT' ? 'orange' : 'orange'}
                    className={`cursor-pointer flex items-center gap-1 ${
                      ['FINISHED', 'WIN', 'LOST', 'CASH_OUT'].includes(resultFilter) ? 'ring-2 ring-neon-cyan' : 'opacity-50 active:opacity-75 sm:hover:opacity-75'
                    }`}
                  >
                    {resultFilter === 'WIN' ? 'Win' : resultFilter === 'LOST' ? 'Lost' : resultFilter === 'CASH_OUT' ? 'Cash Out 95% Profit' : 'Finished'}
                    <FiChevronDown className={`transition-transform ${showFinishedDropdown ? 'rotate-180' : ''}`} />
                  </Badge>
                </button>
                
                <AnimatePresence>
                  {showFinishedDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute top-full left-0 mt-2 z-[100] glass-panel-mobile rounded-lg min-w-[120px] shadow-lg border border-white/10"
                      style={{ background: 'rgba(15, 23, 42, 0.95)' }}
                    >
                      <button
                        onClick={() => { setResultFilter('FINISHED'); setShowFinishedDropdown(false); }}
                        className="w-full px-4 py-2 text-left text-gray-300 active:bg-neon-cyan/10 sm:hover:bg-neon-cyan/10 transition-colors"
                      >
                        All Finished
                      </button>
                      <button
                        onClick={() => { setResultFilter('WIN'); setShowFinishedDropdown(false); }}
                        className="w-full px-4 py-2 text-left text-green-400 active:bg-green-500/10 sm:hover:bg-green-500/10 transition-colors"
                      >
                        Win
                      </button>
                      <button
                        onClick={() => { setResultFilter('LOST'); setShowFinishedDropdown(false); }}
                        className="w-full px-4 py-2 text-left text-red-400 active:bg-red-500/10 sm:hover:bg-red-500/10 transition-colors"
                      >
                        Lost
                      </button>
                      <button
                        onClick={() => { setResultFilter('CASH_OUT'); setShowFinishedDropdown(false); }}
                        className="w-full px-4 py-2 text-left text-orange-400 active:bg-orange-500/10 sm:hover:bg-orange-500/10 transition-colors"
                      >
                        Cash Out 95% Profit
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        {/* Categories - Below result filter */}
        <div className="mb-8">
          <h2 className="font-orbitron text-lg font-bold text-white mb-3 flex items-center gap-2">
            <FiFilter className="text-neon-cyan" />
            Select Category {resultFilter !== 'ALL' && !selectedCategory && <span className="text-neon-orange text-sm">(required to create bets)</span>}
          </h2>
          
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedCategory(null)}
              className="transition-all"
            >
              <Badge
                variant="purple"
                className={`cursor-pointer ${selectedCategory === null ? 'opacity-100 ring-2 ring-neon-cyan' : 'opacity-50 active:opacity-75 sm:hover:opacity-75'}`}
              >
                All Categories
              </Badge>
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id === selectedCategory ? null : category.id)}
                className="transition-all"
              >
                <Badge
                  variant="blue"
                  className={`cursor-pointer ${selectedCategory === category.id ? 'opacity-100 ring-2 ring-neon-cyan' : 'opacity-50 active:opacity-75 sm:hover:opacity-75'}`}
                >
                  {category.name}
                </Badge>
              </button>
            ))}
          </div>
        </div>

        {/* Bets Grid */}
        <div className="relative z-10">
          <Panel>
            {bets.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400 mb-4">
                  No bets found for this selection
                </p>
                {selectedCategory && (
                  <Button 
                    variant="primary" 
                    icon={<FiPlus />}
                    onClick={() => {
                      let defaultResult: 'IN_PROGRESS' | 'WIN' | 'LOST' | 'CASH_OUT' = 'IN_PROGRESS';
                      if (resultFilter === 'WIN') defaultResult = 'WIN';
                      else if (resultFilter === 'LOST') defaultResult = 'LOST';
                      else if (resultFilter === 'CASH_OUT') defaultResult = 'CASH_OUT';
                      
                      setFormData(prev => ({ ...prev, categoryId: selectedCategory, result: defaultResult }));
                      setShowCreateModal(true);
                    }}
                  >
                    Create First Bet
                  </Button>
                )}
              </div>
            ) : (
              <>
                {/* Card Grid - Optimized for mobile */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {bets.map((bet) => (
                    <div key={bet.id}>
                      <AdminBetCard
                        bet={bet}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onPublish={handlePublish}
                        onImageClick={setZoomImageUrl}
                        shouldReduceMotion={shouldReduceMotion}
                        isMobile={isMobile}
                      />
                    </div>
                  ))}
                </div>
                
                {/* Load More Button */}
                {hasMore && (
                  <div className="flex justify-center mt-8">
                    <Button
                      onClick={loadMoreBets}
                      disabled={loadingMore}
                    >
                      {loadingMore ? tCommon('loading') : 'Load More'}
                    </Button>
                  </div>
                )}
              </>
            )}
          </Panel>
        </div>
      </div>

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div
            className={`fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-2 sm:p-4 ${
              shouldReduceMotion ? '' : 'animate-fade-in'
            }`}
            onClick={() => resetForm()}
          >
            <div
              className="glass-panel-mobile p-4 sm:p-6 rounded-xl sm:rounded-2xl max-w-lg w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h2 className="font-orbitron text-lg sm:text-2xl font-bold text-neon-cyan">
                  {editingBet ? 'Edit Bet' : 'Create New Bet'}
                </h2>
                <button
                  onClick={() => resetForm()}
                  className="p-2 active:bg-white/10 sm:hover:bg-white/10 rounded-lg transition-colors"
                >
                  <FiX className="text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleCreateBet} className="space-y-3 sm:space-y-4">
                {/* Image Upload - Required */}
                <div>
                  <label className="block text-xs sm:text-sm text-gray-400 mb-2">Image * <span className="text-xs text-gray-500">(PNG or JPG only)</span></label>
                  <div
                    className={`border-2 border-dashed rounded-xl p-4 sm:p-6 text-center cursor-pointer transition-colors ${
                      !imagePreview && !editingBet ? 'border-neon-orange/50 active:border-neon-orange sm:hover:border-neon-orange' : 'border-white/20 active:border-neon-cyan/50 sm:hover:border-neon-cyan/50'
                    }`}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {imagePreview ? (
                      <div className="relative">
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="max-h-32 sm:max-h-48 mx-auto rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedImage(null);
                            setImagePreview(null);
                          }}
                          className="absolute top-2 right-2 p-1 bg-red-500 rounded-full"
                        >
                          <FiX className="text-white text-sm" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <FiUpload className="text-2xl sm:text-4xl text-neon-orange mx-auto mb-2" />
                        <p className="text-neon-orange font-semibold text-sm sm:text-base">Click to upload image (required)</p>
                        <p className="text-xs text-gray-500">PNG or JPG only (max 5MB)</p>
                      </>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                </div>

                {/* Category - Auto-filled from filter selection */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Category</label>
                  <div className="w-full bg-white/5 border border-neon-cyan/50 rounded-lg px-4 py-3 text-neon-cyan font-semibold">
                    {categories.find(c => c.id === formData.categoryId)?.name || 'Select a category from the filters above'}
                  </div>
                  <input type="hidden" value={formData.categoryId} />
                </div>

                {/* Odds */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Odds *</label>
                  <input
                    type="text"
                    value={formData.odds}
                    onChange={(e) => setFormData({ ...formData, odds: e.target.value })}
                    className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-neon-cyan"
                    placeholder="e.g., 2.50"
                    required
                  />
                </div>

                {/* Result Status */}
                <div>
                  <label className="block text-xs sm:text-sm text-gray-400 mb-2">Result Status *</label>
                  <div className="grid grid-cols-2 xs:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, result: 'IN_PROGRESS' })}
                      className={`py-2 sm:py-3 px-3 sm:px-4 rounded-lg border-2 transition-all font-semibold text-sm ${
                        formData.result === 'IN_PROGRESS'
                          ? 'border-neon-blue bg-neon-blue/20 text-neon-blue'
                          : 'border-white/20 bg-white/5 text-gray-400 active:border-neon-blue/50 sm:hover:border-neon-blue/50'
                      }`}
                    >
                      In Progress
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, result: 'WIN' })}
                      className={`py-2 sm:py-3 px-3 sm:px-4 rounded-lg border-2 transition-all font-semibold text-sm ${
                        formData.result === 'WIN'
                          ? 'border-green-500 bg-green-500/20 text-green-400'
                          : 'border-white/20 bg-white/5 text-gray-400 active:border-green-500/50 sm:hover:border-green-500/50'
                      }`}
                    >
                      Win
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, result: 'LOST' })}
                      className={`py-2 sm:py-3 px-3 sm:px-4 rounded-lg border-2 transition-all font-semibold text-sm ${
                        formData.result === 'LOST'
                          ? 'border-red-500 bg-red-500/20 text-red-400'
                          : 'border-white/20 bg-white/5 text-gray-400 active:border-red-500/50 sm:hover:border-red-500/50'
                      }`}
                    >
                      Lost
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, result: 'CASH_OUT' })}
                      className={`py-2 sm:py-3 px-3 sm:px-4 rounded-lg border-2 transition-all font-semibold text-sm ${
                        formData.result === 'CASH_OUT'
                          ? 'border-orange-500 bg-orange-500/20 text-orange-400'
                          : 'border-white/20 bg-white/5 text-gray-400 active:border-orange-500/50 sm:hover:border-orange-500/50'
                      }`}
                    >
                      Cash Out 95% Profit
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-3 sm:pt-4">
                  <button
                    type="button"
                    onClick={() => resetForm()}
                    className="flex-1 font-orbitron font-bold uppercase tracking-wider transition-all duration-300 rounded-xl bg-glass-white text-neon-cyan border-2 border-neon-cyan/30 active:border-neon-cyan sm:hover:border-neon-cyan px-4 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 font-orbitron font-bold uppercase tracking-wider transition-all duration-300 rounded-xl bg-gradient-to-r from-neon-blue to-neon-cyan text-cyber-dark sm:hover:scale-105 border-2 border-neon-blue px-4 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Saving...' : editingBet ? 'Update Bet' : 'Create Bet'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Image Zoom Modal */}
      <AnimatePresence>
        {zoomImageUrl && (
          <div
            className={`fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4 ${
              shouldReduceMotion ? '' : 'animate-fade-in'
            }`}
            onClick={() => setZoomImageUrl(null)}
          >
            <div
              className="relative max-w-4xl max-h-[90vh] w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setZoomImageUrl(null)}
                className="absolute -top-10 right-0 text-white active:text-neon-cyan sm:hover:text-neon-cyan transition-colors"
              >
                <FiX className="w-8 h-8" />
              </button>
              <img
                src={zoomImageUrl}
                alt="Zoomed bet image"
                className="w-full h-auto max-h-[85vh] object-contain rounded-lg"
              />
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
