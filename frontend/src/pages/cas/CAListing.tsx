import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { caService, CAFilters } from '../../services';
import { Card, Button, Loading, Input } from '../../components/common';

interface CA {
  id: string;
  caLicenseNumber: string;
  specialization: string[];
  experienceYears: number;
  hourlyRate: number;
  description?: string;
  verificationStatus: string;
  user: {
    id: string;
    name: string;
    email: string;
    profileImage?: string;
  };
  averageRating?: number;
  reviewCount?: number;
}

const CAListing: React.FC = () => {
  const navigate = useNavigate();
  const [cas, setCAs] = useState<CA[]>([]);
  const [filteredCAs, setFilteredCAs] = useState<CA[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'experience' | 'hourlyRate' | 'rating'>('name');
  const [filters, setFilters] = useState<CAFilters>({
    verificationStatus: 'VERIFIED',
  });

  const fetchCAs = useCallback(async () => {
    try {
      setLoading(true);
      const response = await caService.getCAs(filters);

      if (response.success) {
        setCAs(response.data.data || response.data);
      }
    } catch (error) {
      console.error('Error fetching CAs:', error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchCAs();
  }, [fetchCAs]);

  // Filter and sort CAs
  useEffect(() => {
    let result = [...cas];

    // Search filter
    if (searchQuery) {
      result = result.filter((ca) =>
        ca.user.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.user.name.localeCompare(b.user.name);
        case 'experience':
          return b.experienceYears - a.experienceYears;
        case 'hourlyRate':
          return a.hourlyRate - b.hourlyRate;
        case 'rating':
          return (b.averageRating || 0) - (a.averageRating || 0);
        default:
          return 0;
      }
    });

    setFilteredCAs(result);
  }, [cas, searchQuery, sortBy]);

  const handleFilterChange = (key: keyof CAFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value || undefined,
    }));
  };

  const renderStars = (rating: number = 0) => {
    return (
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <svg
            key={star}
            className={`h-4 w-4 ${star <= rating ? 'text-yellow-400' : 'text-gray-300'}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
        <span className="ml-2 text-sm text-gray-600">({rating.toFixed(1)})</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Find Chartered Accountants</h1>
          <p className="mt-2 text-gray-600">Browse verified CAs and connect with the right professional</p>
        </div>

        {/* Search and Sort */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Input
            placeholder="Search by CA name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <option value="name">Sort by Name</option>
              <option value="experience">Sort by Experience (High to Low)</option>
              <option value="hourlyRate">Sort by Hourly Rate (Low to High)</option>
              <option value="rating">Sort by Rating (High to Low)</option>
            </select>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Specialization
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filters.specialization || ''}
                onChange={(e) => handleFilterChange('specialization', e.target.value)}
              >
                <option value="">All Specializations</option>
                <option value="GST">GST</option>
                <option value="INCOME_TAX">Income Tax</option>
                <option value="AUDIT">Audit</option>
                <option value="ACCOUNTING">Accounting</option>
                <option value="FINANCIAL_PLANNING">Financial Planning</option>
                <option value="TAX_PLANNING">Tax Planning</option>
                <option value="COMPANY_LAW">Company Law</option>
              </select>
            </div>

            <Input
              label="Min Experience (Years)"
              type="number"
              min="0"
              value={filters.minExperience || ''}
              onChange={(e) => handleFilterChange('minExperience', e.target.value ? parseInt(e.target.value) : undefined)}
            />

            <Input
              label="Max Hourly Rate (₹)"
              type="number"
              min="0"
              value={filters.maxHourlyRate || ''}
              onChange={(e) => handleFilterChange('maxHourlyRate', e.target.value ? parseInt(e.target.value) : undefined)}
            />

            <div className="flex items-end">
              <Button
                fullWidth
                variant="outline"
                onClick={() => setFilters({ verificationStatus: 'VERIFIED' })}
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </Card>

        {/* CA List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loading size="lg" text="Loading CAs..." />
          </div>
        ) : filteredCAs.length === 0 ? (
          <Card>
            <p className="text-gray-500 text-center py-8">
              {searchQuery
                ? 'No CAs found matching your search'
                : 'No CAs found matching your criteria'}
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCAs.map((ca) => (
              <Card
                key={ca.id}
                hoverable
                onClick={() => navigate(`/cas/${ca.id}`)}
              >
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    {ca.user.profileImage ? (
                      <img
                        src={ca.user.profileImage}
                        alt={ca.user.name}
                        className="h-16 w-16 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-full bg-blue-500 flex items-center justify-center text-white text-xl font-semibold">
                        {ca.user.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 truncate">
                      {ca.user.name}
                    </h3>
                    {ca.verificationStatus === 'VERIFIED' && (
                      <span className="inline-flex items-center text-xs text-green-600">
                        <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Verified
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                    <span>{ca.experienceYears} years exp.</span>
                    <span className="font-semibold text-blue-600">₹{ca.hourlyRate}/hr</span>
                  </div>

                  {ca.averageRating && ca.reviewCount ? (
                    <div className="mb-3">
                      {renderStars(ca.averageRating)}
                      <span className="text-xs text-gray-500 ml-1">
                        ({ca.reviewCount} reviews)
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 mb-3">No reviews yet</p>
                  )}

                  <div className="flex flex-wrap gap-2 mb-3">
                    {ca.specialization.slice(0, 3).map((spec) => (
                      <span
                        key={spec}
                        className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                      >
                        {spec.replace(/_/g, ' ')}
                      </span>
                    ))}
                    {ca.specialization.length > 3 && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                        +{ca.specialization.length - 3} more
                      </span>
                    )}
                  </div>

                  {ca.description && (
                    <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                      {ca.description}
                    </p>
                  )}

                  <Button fullWidth size="sm">
                    Hire
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CAListing;
