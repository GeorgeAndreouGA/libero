'use client';

import { motion } from 'framer-motion';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Navbar from '@/components/layout/Navbar';
import Panel from '@/components/ui/Panel';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { FiSearch, FiFilter, FiUser, FiDollarSign, FiClock, FiEye, FiRefreshCw } from 'react-icons/fi';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function AdminUsersPage() {
  const t = useTranslations('admin.users');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalUsers, setTotalUsers] = useState(0);

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 500); // 500ms debounce
  const [timeFilter, setTimeFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [transactionLoading, setTransactionLoading] = useState(false);
  const [transactionFilter, setTransactionFilter] = useState('all');
  const [userSubscriptions, setUserSubscriptions] = useState<any[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || user?.role !== 'admin')) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, user, router]);

  useEffect(() => {
    if (isAuthenticated && user?.role === 'admin') {
      fetchUsers();
    }
  }, [isAuthenticated, user, debouncedSearch, timeFilter]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setPage(1);
    try {
      const response = await api.getAllUsers(
        debouncedSearch || undefined,
        timeFilter !== 'all' ? timeFilter : undefined,
        1,
        50
      );
      setUsers(response.data || []);
      setTotalUsers(response.pagination?.total || 0);
      setHasMore((response.pagination?.page || 1) < (response.pagination?.totalPages || 1));
    } catch (err: any) {
      console.error('Failed to fetch users:', err);
      setError(err.response?.data?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, timeFilter]);

  const loadMoreUsers = async () => {
    if (loadingMore || !hasMore) return;
    
    try {
      setLoadingMore(true);
      const nextPage = page + 1;
      const response = await api.getAllUsers(
        debouncedSearch || undefined,
        timeFilter !== 'all' ? timeFilter : undefined,
        nextPage,
        50
      );
      setUsers(prev => [...prev, ...(response.data || [])]);
      setPage(nextPage);
      setHasMore(nextPage < (response.pagination?.totalPages || 1));
    } catch (err) {
      console.error('Failed to load more users:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const fetchUserTransactions = async (userId: string) => {
    setTransactionLoading(true);
    try {
      const data = await api.getUserTransactions(
        userId,
        transactionFilter !== 'all' ? transactionFilter : undefined
      );
      setTransactions(data);
    } catch (err: any) {
      console.error('Failed to fetch transactions:', err);
      setError(err.response?.data?.message || 'Failed to load transactions');
    } finally {
      setTransactionLoading(false);
    }
  };

  const fetchUserSubscriptions = async (userId: string) => {
    try {
      const allSubs = await api.getAdminSubscriptions();
      const userSubs = allSubs.filter((s: any) => s.user_id === userId);
      setUserSubscriptions(userSubs);
    } catch (err: any) {
      console.error('Failed to fetch subscriptions:', err);
    }
  };

  const handleRefund = async (subscriptionId: string) => {
    if (!confirm('Are you sure you want to refund this subscription? This will return the money to the customer and cancel the subscription immediately.')) {
      return;
    }
    setActionLoading(subscriptionId);
    setSuccessMessage('');
    setError('');
    try {
      await api.refundSubscription(subscriptionId);
      setSuccessMessage('Refund processed successfully. Customer will receive funds in 5-10 business days.');
      // Refresh data
      await Promise.all([
        fetchUserTransactions(selectedUser.id),
        fetchUserSubscriptions(selectedUser.id)
      ]);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to process refund');
    } finally {
      setActionLoading(null);
    }
  };

  const handleViewUser = async (user: any) => {
    setSelectedUser(user);
    setTransactionFilter('all');
    setSuccessMessage('');
    await Promise.all([
      fetchUserTransactions(user.id),
      fetchUserSubscriptions(user.id)
    ]);
  };

  useEffect(() => {
    if (selectedUser) {
      fetchUserTransactions(selectedUser.id);
    }
  }, [transactionFilter]);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading && !selectedUser) {
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
          className="mb-8 sm:mb-12"
        >
          <h1 className="font-orbitron text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-neon-cyan mb-4 text-shadow-glow">
            {t('title')}
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-gray-300">
            {t('subtitle')}
          </p>
        </motion.div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Card variant="glass" className="bg-red-500/10 border-red-500/50">
              <p className="text-red-400">{error}</p>
            </Card>
          </motion.div>
        )}

        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Card variant="glass" className="bg-green-500/10 border-green-500/50">
              <p className="text-green-400">{successMessage}</p>
            </Card>
          </motion.div>
        )}

        {!selectedUser ? (
          <>
            {/* Search and Filters */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mb-8"
            >
              <Card variant="glass">
                <div className="flex flex-col md:flex-row gap-4">
                  {/* Search Bar */}
                  <div className="flex-1 relative">
                    <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={t('searchPlaceholder')}
                      className="w-full pl-12 pr-4 py-3 bg-cyber-navy/50 border border-neon-cyan/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-neon-cyan transition-colors text-sm sm:text-base"
                    />
                  </div>

                  {/* Time Filter */}
                  <div className="flex items-center gap-2">
                    <FiFilter className="text-neon-cyan text-xl hidden sm:block" />
                    <select
                      value={timeFilter}
                      onChange={(e) => setTimeFilter(e.target.value)}
                      className="px-3 sm:px-4 py-3 bg-cyber-navy/50 border border-neon-cyan/30 rounded-lg text-white focus:outline-none focus:border-neon-cyan transition-colors text-sm"
                    >
                      <option value="all">{t('timeFilters.all')}</option>
                      <option value="24h">{t('timeFilters.24h')}</option>
                      <option value="month">{t('timeFilters.month')}</option>
                    </select>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Users List */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Panel title={t('title')} subtitle={`${users.length} ${t('usersFound').replace('{count}', users.length.toString()).split(' ').slice(1).join(' ')}`}>
                <div className="space-y-3 sm:space-y-4">
                  {users.length === 0 ? (
                    <div className="text-center py-8 sm:py-12 text-gray-400">
                      {t('noUsers')}
                    </div>
                  ) : (
                    users.map((user, index) => (
                      <motion.div
                        key={user.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + index * 0.05 }}
                      >
                        <Card variant="glass" hover className="cursor-pointer">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neon-cyan to-neon-blue flex items-center justify-center">
                                  <FiUser className="text-white" />
                                </div>
                                <div>
                                  <p className="text-white font-semibold text-lg">{user.username}</p>
                                  <p className="text-sm text-gray-400">{user.email}</p>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2 ml-13">
                                <Badge variant="blue" size="sm">
                                  {user.activeSubscriptions || 0} {t('activeSubs')}
                                </Badge>
                                <Badge variant="green" size="sm">
                                  €{user.totalSpent || 0} {t('total')}
                                </Badge>
                                <Badge variant={user.status === 'active' ? 'green' : 'orange'} size="sm">
                                  {user.status}
                                </Badge>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 sm:gap-4">
                              <div className="text-right hidden sm:block">
                                <p className="text-xs text-gray-400">{t('joined')}</p>
                                <p className="text-sm text-white">
                                  {new Date(user.created_at).toLocaleDateString()}
                                </p>
                              </div>
                              <Button
                                variant="primary"
                                size="sm"
                                icon={<FiEye />}
                                onClick={() => handleViewUser(user)}
                              >
                                {tCommon('view')}
                              </Button>
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    ))
                  )}
                  
                  {/* Load More Button */}
                  {hasMore && users.length > 0 && (
                    <div className="flex justify-center mt-6">
                      <Button
                        onClick={loadMoreUsers}
                        disabled={loadingMore}
                      >
                        {loadingMore ? tCommon('loading') : `Load More (${users.length} of ${totalUsers})`}
                      </Button>
                    </div>
                  )}
                </div>
              </Panel>
            </motion.div>
          </>
        ) : (
          <>
            {/* User Details */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 sm:mb-8"
            >
              <Button
                variant="ghost"
                onClick={() => {
                  setSelectedUser(null);
                  setTransactions([]);
                }}
                className="mb-4"
              >
                {t('backToUsers')}
              </Button>

              <Card variant="glass">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-neon-cyan to-neon-blue flex items-center justify-center flex-shrink-0">
                      <FiUser className="text-white text-lg sm:text-2xl" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-xl sm:text-2xl font-orbitron font-bold text-white truncate">{selectedUser.username}</h2>
                      <p className="text-gray-400 text-sm truncate">{selectedUser.email}</p>
                      <p className="text-xs sm:text-sm text-gray-500 mt-1 truncate">{selectedUser.full_name}</p>
                    </div>
                  </div>
                  <div className="text-left sm:text-right space-y-2 mt-2 sm:mt-0">
                    <Badge variant="blue" size="lg">
                      {selectedUser.activeSubscriptions || 0} Active Subscriptions
                    </Badge>
                    <p className="text-neon-green text-xl sm:text-2xl font-bold">
                      €{selectedUser.totalSpent || 0}
                    </p>
                    <p className="text-xs text-gray-400">Total Spent</p>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Transactions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Panel
                title="Transactions"
                subtitle={`${transactions.length} transactions`}
              >
                {/* Filter */}
                <div className="flex flex-col sm:flex-row justify-between gap-4 mb-4 sm:mb-6">
                  <div className="flex items-center gap-2">
                    <FiFilter className="text-neon-cyan text-xl" />
                    <select
                      value={transactionFilter}
                      onChange={(e) => setTransactionFilter(e.target.value)}
                      className="px-3 sm:px-4 py-2 bg-cyber-navy/50 border border-neon-cyan/30 rounded-lg text-white text-sm focus:outline-none focus:border-neon-cyan transition-colors"
                    >
                      <option value="all">All Time</option>
                      <option value="24h">Last 24 Hours</option>
                      <option value="month">Last Month</option>
                    </select>
                  </div>
                </div>

                {/* Transaction List */}
                {transactionLoading ? (
                  <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-neon-cyan"></div>
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    No transactions found
                  </div>
                ) : (
                  <div className="space-y-4 mt-0">
                    {transactions.map((transaction, index) => {
                      // Find the subscription associated with this transaction
                      const subscription = userSubscriptions.find(
                        (s: any) => s.id === transaction.subscriptionId
                      );
                      const canRefund = transaction.status === 'COMPLETED' && subscription?.status === 'active';

                      return (
                        <motion.div
                          key={transaction.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                        >
                          <Card variant="glass" hover={false}>
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neon-orange to-neon-pink flex items-center justify-center">
                                    <FiDollarSign className="text-white" />
                                  </div>
                                  <div>
                                    <p className="text-white font-semibold">
                                      {transaction.packName || 'N/A'}
                                    </p>
                                    <p className="text-sm text-gray-400">{transaction.description || 'No description'}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 ml-13">
                                  <FiClock className="text-gray-400 text-sm" />
                                  <p className="text-xs text-gray-400">
                                    {formatDate(transaction.created_at)}
                                  </p>
                                </div>
                              </div>

                              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                                <Badge
                                  variant={
                                    transaction.status === 'COMPLETED'
                                      ? 'green'
                                      : transaction.status === 'PENDING'
                                      ? 'orange'
                                      : transaction.status === 'REFUNDED'
                                      ? 'blue'
                                      : 'red'
                                  }
                                  size="sm"
                                >
                                  {transaction.status}
                                </Badge>
                                <div className="text-right">
                                  <p className="text-xl sm:text-2xl font-orbitron font-bold text-neon-green">
                                    €{transaction.amount}
                                  </p>
                                </div>
                                
                                {/* Action Buttons */}
                                {transaction.subscriptionId && canRefund && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    icon={<FiRefreshCw />}
                                    onClick={() => handleRefund(transaction.subscriptionId)}
                                    disabled={actionLoading === transaction.subscriptionId}
                                    className="text-orange-400 border-orange-400/50 hover:bg-orange-400/20"
                                  >
                                    {actionLoading === transaction.subscriptionId ? 'Processing...' : 'Refund'}
                                  </Button>
                                )}
                              </div>
                            </div>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </Panel>
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}

