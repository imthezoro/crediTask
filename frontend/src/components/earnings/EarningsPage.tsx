import React, { useState } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  Calendar, 
  Download,
  CreditCard,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Filter
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

const earningsData = [
  { month: 'Jan', earnings: 1200, tasks: 8 },
  { month: 'Feb', earnings: 1800, tasks: 12 },
  { month: 'Mar', earnings: 2400, tasks: 16 },
  { month: 'Apr', earnings: 1900, tasks: 13 },
  { month: 'May', earnings: 2800, tasks: 18 },
  { month: 'Jun', earnings: 3200, tasks: 22 }
];

const transactions = [
  { id: 1, type: 'earning', amount: 450, description: 'E-commerce Website Development', date: '2024-01-15', status: 'completed' },
  { id: 2, type: 'earning', amount: 280, description: 'Mobile App UI Design', date: '2024-01-12', status: 'completed' },
  { id: 3, type: 'withdrawal', amount: -500, description: 'Bank Transfer', date: '2024-01-10', status: 'completed' },
  { id: 4, type: 'earning', amount: 320, description: 'Logo Design Project', date: '2024-01-08', status: 'pending' },
  { id: 5, type: 'earning', amount: 180, description: 'Content Writing', date: '2024-01-05', status: 'completed' }
];

export function EarningsPage() {
  const { user } = useAuth();
  const [timeRange, setTimeRange] = useState('6months');
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);

  const totalEarnings = transactions
    .filter(t => t.type === 'earning' && t.status === 'completed')
    .reduce((sum, t) => sum + t.amount, 0);

  const pendingEarnings = transactions
    .filter(t => t.type === 'earning' && t.status === 'pending')
    .reduce((sum, t) => sum + t.amount, 0);

  const thisMonthEarnings = earningsData[earningsData.length - 1]?.earnings || 0;
  const lastMonthEarnings = earningsData[earningsData.length - 2]?.earnings || 0;
  const growthRate = lastMonthEarnings > 0 ? ((thisMonthEarnings - lastMonthEarnings) / lastMonthEarnings * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Earnings</h1>
          <p className="text-gray-600 mt-1">Track your income and manage withdrawals</p>
        </div>
        
        <div className="flex space-x-3">
          <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center space-x-2">
            <Download className="h-4 w-4" />
            <span>Export</span>
          </button>
          <button
            onClick={() => setShowWithdrawModal(true)}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center space-x-2"
          >
            <CreditCard className="h-4 w-4" />
            <span>Withdraw</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Available Balance</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">${user?.walletBalance?.toLocaleString() || '0'}</p>
            </div>
            <div className="bg-green-50 text-green-600 p-3 rounded-lg">
              <Wallet className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Earned</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">${totalEarnings.toLocaleString()}</p>
            </div>
            <div className="bg-indigo-50 text-indigo-600 p-3 rounded-lg">
              <DollarSign className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">This Month</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">${thisMonthEarnings.toLocaleString()}</p>
              <div className="flex items-center mt-2">
                {growthRate >= 0 ? (
                  <ArrowUpRight className="h-4 w-4 text-green-600 mr-1" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 text-red-600 mr-1" />
                )}
                <span className={`text-sm font-medium ${growthRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {Math.abs(growthRate).toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="bg-amber-50 text-amber-600 p-3 rounded-lg">
              <TrendingUp className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">${pendingEarnings.toLocaleString()}</p>
            </div>
            <div className="bg-orange-50 text-orange-600 p-3 rounded-lg">
              <Calendar className="h-6 w-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Earnings Trend */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Earnings Trend</h3>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
            >
              <option value="3months">Last 3 months</option>
              <option value="6months">Last 6 months</option>
              <option value="1year">Last year</option>
            </select>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={earningsData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => [`$${value}`, 'Earnings']} />
              <Line type="monotone" dataKey="earnings" stroke="#4F46E5" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Tasks Completed */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Tasks Completed</h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={earningsData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => [`${value}`, 'Tasks']} />
              <Bar dataKey="tasks" fill="#10B981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">Transaction History</h3>
            <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center space-x-2">
              <Filter className="h-4 w-4" />
              <span>Filter</span>
            </button>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {transactions.map((transaction) => (
            <div key={transaction.id} className="p-6 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className={`p-2 rounded-lg ${
                    transaction.type === 'earning' 
                      ? 'bg-green-50 text-green-600' 
                      : 'bg-red-50 text-red-600'
                  }`}>
                    {transaction.type === 'earning' ? (
                      <ArrowUpRight className="h-5 w-5" />
                    ) : (
                      <ArrowDownRight className="h-5 w-5" />
                    )}
                  </div>
                  
                  <div>
                    <p className="font-medium text-gray-900">{transaction.description}</p>
                    <p className="text-sm text-gray-600">{transaction.date}</p>
                  </div>
                </div>
                
                <div className="text-right">
                  <p className={`font-semibold ${
                    transaction.amount > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {transaction.amount > 0 ? '+' : ''}${Math.abs(transaction.amount)}
                  </p>
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    transaction.status === 'completed'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {transaction.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Withdrawal Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Withdraw Funds</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="number"
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="0.00"
                      max={user?.walletBalance || 0}
                    />
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Available: ${user?.walletBalance?.toLocaleString() || '0'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Withdrawal Method
                  </label>
                  <select className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
                    <option>Bank Transfer</option>
                    <option>PayPal</option>
                    <option>Stripe</option>
                  </select>
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => setShowWithdrawModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                  Withdraw
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}