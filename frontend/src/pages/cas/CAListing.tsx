import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { caService, CAFilters, advancedSearchService, AdvancedSearchFilters, SearchResultItem } from '../../services';
import api from '../../services/api';
import { useAppSelector } from '../../store/hooks';
import { Card, Button, Loading, Input, Modal, Alert, FileUpload } from '../../components/common';

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

interface Firm {
  id: string;
  firmName: string;
  firmType: string;
  status: string;
  verificationLevel: string;
  description?: string;
  logoUrl?: string;
  city: string;
  state: string;
  establishedYear: number;
  _count?: {
    members: number;
    currentCAs: number;
    serviceRequests: number;
    firmReviews: number;
  };
}

type Provider = (CA & { type: 'individual' }) | (Firm & { type: 'firm' });

const CAListing: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);
  const [cas, setCAs] = useState<CA[]>([]);
  const [firms, setFirms] = useState<Firm[]>([]);
  const [filteredProviders, setFilteredProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'experience' | 'hourlyRate' | 'rating'>('name');
  const [showType, setShowType] = useState<'all' | 'individual' | 'firm'>('all');
  const [filters, setFilters] = useState<CAFilters>({
    verificationStatus: 'VERIFIED',
  });

  // Advanced search state
  const [useAdvancedSearch, setUseAdvancedSearch] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedSearchFilters>({});
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [quickFilter, setQuickFilter] = useState<'none' | 'topRated' | 'mostExperienced'>('none');

  // Hire modal state
  const [showHireModal, setShowHireModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [hireForm, setHireForm] = useState({
    serviceType: '',
    description: '',
    deadline: '',
    estimatedHours: '',
  });
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  // Fetch search suggestions
  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchSuggestions([]);
      return;
    }

    try {
      const suggestions = await advancedSearchService.getSuggestions(query, 5);
      setSearchSuggestions(suggestions);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      setSearchSuggestions([]);
    }
  }, []);

  // Perform advanced search
  const performAdvancedSearch = useCallback(async () => {
    try {
      setLoading(true);
      setUseAdvancedSearch(true);

      const response = await advancedSearchService.search(advancedFilters, 1, 50);
      setSearchResults(response.results);
    } catch (error) {
      console.error('Error performing advanced search:', error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  }, [advancedFilters]);

  // Quick filter handlers
  const handleTopRated = useCallback(async () => {
    try {
      setLoading(true);
      setUseAdvancedSearch(true);
      setQuickFilter('topRated');

      const response = await advancedSearchService.getTopRated(1, 50);
      setSearchResults(response.results);
    } catch (error) {
      console.error('Error fetching top rated:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleMostExperienced = useCallback(async () => {
    try {
      setLoading(true);
      setUseAdvancedSearch(true);
      setQuickFilter('mostExperienced');

      const response = await advancedSearchService.getMostExperienced(1, 50);
      setSearchResults(response.results);
    } catch (error) {
      console.error('Error fetching most experienced:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProviders = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch both CAs and firms in parallel
      const [caResponse, firmResponse] = await Promise.all([
        caService.getCAs(filters),
        api.get('/firms', {
          params: {
            status: 'ACTIVE',
            verificationLevel: 'VERIFIED'
          }
        })
      ]);

      if (caResponse.success) {
        setCAs(caResponse.data.data || caResponse.data);
      }

      if (firmResponse.data.success) {
        setFirms(firmResponse.data.data.firms || []);
      }
    } catch (error) {
      console.error('Error fetching providers:', error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  // Filter and sort providers (CAs and firms)
  useEffect(() => {
    if (useAdvancedSearch && searchResults.length >= 0) {
      // Use advanced search results
      const mappedResults: Provider[] = searchResults.map((result) => {
        if (result.type === 'INDIVIDUAL') {
          return {
            id: result.id,
            type: 'individual' as const,
            caLicenseNumber: '',
            specialization: result.specializations,
            experienceYears: result.experienceYears || 0,
            hourlyRate: result.hourlyRate || 0,
            description: result.description,
            verificationStatus: result.verificationStatus,
            user: {
              id: result.id,
              name: result.name,
              email: '',
              profileImage: result.profileImage,
            },
            averageRating: result.rating,
            reviewCount: result.reviewCount,
          } as CA & { type: 'individual' };
        } else {
          return {
            id: result.id,
            type: 'firm' as const,
            firmName: result.name,
            firmType: 'PARTNERSHIP',
            status: 'ACTIVE',
            verificationLevel: result.verificationStatus,
            description: result.description,
            logoUrl: result.profileImage,
            city: result.city || '',
            state: result.state || '',
            establishedYear: new Date().getFullYear() - (result.experienceYears || 0),
            _count: {
              members: 0,
              currentCAs: 0,
              serviceRequests: 0,
              firmReviews: result.reviewCount,
            },
          } as Firm & { type: 'firm' };
        }
      });

      // Apply client-side filters
      let result = mappedResults;

      // Filter by type
      if (showType === 'individual') {
        result = result.filter(p => p.type === 'individual');
      } else if (showType === 'firm') {
        result = result.filter(p => p.type === 'firm');
      }

      setFilteredProviders(result);
    } else {
      // Use basic search
      let result: Provider[] = [];

      // Combine CAs and firms
      const casWithType: Provider[] = cas.map(ca => ({ ...ca, type: 'individual' as const }));
      const firmsWithType: Provider[] = firms.map(firm => ({ ...firm, type: 'firm' as const }));

      // Filter by type
      if (showType === 'individual') {
        result = casWithType;
      } else if (showType === 'firm') {
        result = firmsWithType;
      } else {
        result = [...casWithType, ...firmsWithType];
      }

      // Search filter
      if (searchQuery && !useAdvancedSearch) {
        result = result.filter((provider) => {
          const searchLower = searchQuery.toLowerCase();
          if (provider.type === 'individual') {
            return provider.user.name.toLowerCase().includes(searchLower);
          } else {
            return provider.firmName.toLowerCase().includes(searchLower);
          }
        });
      }

      // Sort
      result.sort((a, b) => {
        switch (sortBy) {
          case 'name':
            const nameA = a.type === 'individual' ? a.user.name : a.firmName;
            const nameB = b.type === 'individual' ? b.user.name : b.firmName;
            return nameA.localeCompare(nameB);
          case 'experience':
            // For firms, use established years as a proxy
            const expA = a.type === 'individual' ? a.experienceYears : (new Date().getFullYear() - a.establishedYear);
            const expB = b.type === 'individual' ? b.experienceYears : (new Date().getFullYear() - b.establishedYear);
            return expB - expA;
          case 'hourlyRate':
            // Firms don't have hourly rate, so put them at the end
            if (a.type === 'firm' && b.type === 'individual') return 1;
            if (a.type === 'individual' && b.type === 'firm') return -1;
            if (a.type === 'individual' && b.type === 'individual') {
              return a.hourlyRate - b.hourlyRate;
            }
            return 0;
          case 'rating':
            const ratingA = a.type === 'individual' ? (a.averageRating || 0) : 0;
            const ratingB = b.type === 'individual' ? (b.averageRating || 0) : 0;
            return ratingB - ratingA;
          default:
            return 0;
        }
      });

      setFilteredProviders(result);
    }
  }, [cas, firms, searchQuery, sortBy, showType, useAdvancedSearch, searchResults]);

  const handleFilterChange = (key: keyof CAFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value || undefined,
    }));
  };

  const handleHireClick = (provider: Provider, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click navigation

    // Check if user is authenticated
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    // Check if user object exists
    if (!user) {
      setError('User session not loaded. Please refresh the page or log in again.');
      setTimeout(() => setError(''), 5000);
      return;
    }

    // Check if user is a CLIENT
    if (user.role !== 'CLIENT') {
      setError('Only clients can hire CAs or firms. Please register as a client.');
      setTimeout(() => setError(''), 5000);
      return;
    }

    setSelectedProvider(provider);
    setShowHireModal(true);
    setHireForm({
      serviceType: '',
      description: '',
      deadline: '',
      estimatedHours: '',
    });
    setUploadedFiles([]);
  };

  const handleSubmitHire = async () => {
    if (!selectedProvider) return;

    // Validation
    if (!hireForm.serviceType || !hireForm.description) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const requestData: any = {
        providerType: selectedProvider.type === 'individual' ? 'INDIVIDUAL' : 'FIRM',
        serviceType: hireForm.serviceType,
        description: hireForm.description,
      };

      // Add provider ID based on type
      if (selectedProvider.type === 'individual') {
        requestData.caId = selectedProvider.id;
      } else {
        requestData.firmId = selectedProvider.id;
      }

      // Add optional fields
      if (hireForm.deadline) {
        requestData.deadline = hireForm.deadline;
      }
      if (hireForm.estimatedHours) {
        requestData.estimatedHours = parseInt(hireForm.estimatedHours);
      }

      // Add document metadata (files will be uploaded via messages after request creation)
      if (uploadedFiles.length > 0) {
        requestData.documents = uploadedFiles.map(file => ({
          name: file.name,
          size: file.size,
          type: file.type,
          uploadedAt: new Date().toISOString(),
          note: 'Pending upload via messages'
        }));
      }

      console.log('Sending service request with data:', requestData);

      const response = await api.post('/service-requests', requestData);

      if (response.data.success) {
        setSuccess('Service request sent successfully!');
        setShowHireModal(false);
        setTimeout(() => {
          setSuccess('');
          navigate('/client/dashboard');
        }, 2000);
      }
    } catch (err: any) {
      // Extract user-friendly error message
      let errorMessage = 'Failed to create service request';

      if (err.response?.data) {
        const data = err.response.data;

        // Backend returns error in data.error (string) or data.message
        if (typeof data.error === 'string') {
          errorMessage = data.error;
        } else if (typeof data.message === 'string') {
          errorMessage = data.message;
        } else if (data.error?.message) {
          errorMessage = data.error.message;
        }
      } else if (err.message) {
        errorMessage = err.message;
      }

      // Add helpful context for network errors
      if (err.code === 'ERR_NETWORK' || err.code === 'ECONNREFUSED') {
        errorMessage = 'Unable to connect to server. Please check your connection and try again.';
      }

      setError(errorMessage);
      console.error('Service request error:', err.response?.data || err); // Log full error for debugging
    } finally {
      setSubmitting(false);
    }
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

        {/* Quick Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <Button
            variant={quickFilter === 'topRated' ? 'primary' : 'outline'}
            size="sm"
            onClick={handleTopRated}
          >
            ⭐ Top Rated
          </Button>
          <Button
            variant={quickFilter === 'mostExperienced' ? 'primary' : 'outline'}
            size="sm"
            onClick={handleMostExperienced}
          >
            👨‍💼 Most Experienced
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setQuickFilter('none');
              setUseAdvancedSearch(false);
              setAdvancedFilters({});
              setSearchResults([]);
              fetchProviders();
            }}
          >
            🔄 Clear All Filters
          </Button>
        </div>

        {/* Search and Sort */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="relative">
            <Input
              placeholder="Search by name, specialization, or qualifications..."
              value={searchQuery}
              onChange={(e) => {
                const value = e.target.value;
                setSearchQuery(value);
                if (useAdvancedSearch && value) {
                  fetchSuggestions(value);
                  setShowSuggestions(true);
                }
              }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            />
            {showSuggestions && searchSuggestions.length > 0 && (
              <div className="absolute z-10 w-full bg-white border border-gray-300 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                {searchSuggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                    onClick={() => {
                      setSearchQuery(suggestion);
                      setAdvancedFilters({ ...advancedFilters, fullText: suggestion });
                      setShowSuggestions(false);
                      performAdvancedSearch();
                    }}
                  >
                    {suggestion}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={showType}
              onChange={(e) => setShowType(e.target.value as any)}
            >
              <option value="all">All Providers</option>
              <option value="individual">Individual CAs Only</option>
              <option value="firm">Firms Only</option>
            </select>
          </div>
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

        {/* Advanced Filters Toggle */}
        <div className="mb-6">
          <Button
            variant="outline"
            fullWidth
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="flex items-center justify-center gap-2"
          >
            <span>🔍 {showAdvancedFilters ? 'Hide' : 'Show'} Advanced Filters</span>
            <span className={`transform transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`}>▼</span>
          </Button>
        </div>

        {/* Advanced Filters Panel */}
        {showAdvancedFilters && (
          <Card className="mb-8 bg-blue-50">
            <h2 className="text-lg font-semibold mb-4">Advanced Search Filters</h2>

            {/* Location Filters */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">📍 Location</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="City"
                  placeholder="e.g., Mumbai, Delhi"
                  value={advancedFilters.city || ''}
                  onChange={(e) => setAdvancedFilters({ ...advancedFilters, city: e.target.value })}
                />
                <Input
                  label="State"
                  placeholder="e.g., Maharashtra, Delhi"
                  value={advancedFilters.state || ''}
                  onChange={(e) => setAdvancedFilters({ ...advancedFilters, state: e.target.value })}
                />
              </div>
            </div>

            {/* Language Filters */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">🗣️ Languages</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {['English', 'Hindi', 'Gujarati', 'Marathi', 'Tamil', 'Telugu', 'Bengali', 'Kannada'].map((lang) => (
                  <label key={lang} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedLanguages.includes(lang)}
                      onChange={(e) => {
                        const newLangs = e.target.checked
                          ? [...selectedLanguages, lang]
                          : selectedLanguages.filter(l => l !== lang);
                        setSelectedLanguages(newLangs);
                        setAdvancedFilters({ ...advancedFilters, languages: newLangs });
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm">{lang}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Availability Filters */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">📅 Availability</h3>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={advancedFilters.availableOnline || false}
                    onChange={(e) => setAdvancedFilters({ ...advancedFilters, availableOnline: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm">Available Online</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={advancedFilters.availableOffline || false}
                    onChange={(e) => setAdvancedFilters({ ...advancedFilters, availableOffline: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm">Available Offline (In-person)</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={advancedFilters.availableNow || false}
                    onChange={(e) => setAdvancedFilters({ ...advancedFilters, availableNow: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm">Available Now</span>
                </label>
              </div>
            </div>

            {/* Apply Advanced Search Button */}
            <div className="flex gap-3">
              <Button
                fullWidth
                onClick={performAdvancedSearch}
              >
                🔍 Apply Advanced Search
              </Button>
              <Button
                fullWidth
                variant="outline"
                onClick={() => {
                  setAdvancedFilters({});
                  setSelectedLanguages([]);
                  setUseAdvancedSearch(false);
                  setSearchResults([]);
                }}
              >
                Clear
              </Button>
            </div>
          </Card>
        )}

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

        {/* Active Filters Indicator */}
        {useAdvancedSearch && (
          <div className="mb-6 p-4 bg-blue-100 border border-blue-300 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-blue-800 font-medium">🔍 Advanced Search Active</span>
                {quickFilter !== 'none' && (
                  <span className="text-sm text-blue-700">
                    ({quickFilter === 'topRated' ? 'Top Rated' : 'Most Experienced'})
                  </span>
                )}
              </div>
              <span className="text-sm text-blue-700">
                {searchResults.length} {searchResults.length === 1 ? 'result' : 'results'} found
              </span>
            </div>
          </div>
        )}

        {/* Provider List (CAs and Firms) */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loading size="lg" text="Loading providers..." />
          </div>
        ) : filteredProviders.length === 0 ? (
          <Card>
            <p className="text-gray-500 text-center py-8">
              {searchQuery || useAdvancedSearch
                ? 'No providers found matching your search criteria. Try adjusting your filters.'
                : 'No providers found matching your criteria'}
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProviders.map((provider) => (
              <Card
                key={provider.id}
                hoverable
                onClick={() => navigate(provider.type === 'individual' ? `/cas/${provider.id}` : `/firms/${provider.id}`)}
              >
                {provider.type === 'individual' ? (
                  // Individual CA Card
                  <>
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0">
                        {provider.user.profileImage ? (
                          <img
                            src={provider.user.profileImage}
                            alt={provider.user.name}
                            className="h-16 w-16 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-16 w-16 rounded-full bg-blue-500 flex items-center justify-center text-white text-xl font-semibold">
                            {provider.user.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-gray-900 truncate">
                          {provider.user.name}
                        </h3>
                        <div className="flex flex-wrap gap-1 items-center mt-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            Individual CA
                          </span>
                          {provider.verificationStatus === 'VERIFIED' && (
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
                    </div>

                    <div className="mt-4">
                      <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                        <span>{provider.experienceYears} years exp.</span>
                        <span className="font-semibold text-blue-600">₹{provider.hourlyRate}/hr</span>
                      </div>

                      {provider.averageRating && provider.reviewCount ? (
                        <div className="mb-3">
                          {renderStars(provider.averageRating)}
                          <span className="text-xs text-gray-500 ml-1">
                            ({provider.reviewCount} reviews)
                          </span>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500 mb-3">No reviews yet</p>
                      )}

                      <div className="flex flex-wrap gap-2 mb-3">
                        {provider.specialization.slice(0, 3).map((spec) => (
                          <span
                            key={spec}
                            className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                          >
                            {spec.replace(/_/g, ' ')}
                          </span>
                        ))}
                        {provider.specialization.length > 3 && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                            +{provider.specialization.length - 3} more
                          </span>
                        )}
                      </div>

                      {provider.description && (
                        <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                          {provider.description}
                        </p>
                      )}

                      <Button
                        fullWidth
                        size="sm"
                        onClick={(e) => handleHireClick(provider, e)}
                      >
                        Hire
                      </Button>
                    </div>
                  </>
                ) : (
                  // Firm Card
                  <>
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0">
                        {provider.logoUrl ? (
                          <img
                            src={provider.logoUrl}
                            alt={provider.firmName}
                            className="h-16 w-16 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="h-16 w-16 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-xl font-semibold">
                            {provider.firmName.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-gray-900 truncate">
                          {provider.firmName}
                        </h3>
                        <div className="flex flex-wrap gap-1 items-center mt-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                            {provider.firmType === 'PARTNERSHIP' ? 'Partnership Firm' :
                             provider.firmType === 'LLP' ? 'LLP' :
                             provider.firmType === 'COMPANY' ? 'Company' : 'Firm'}
                          </span>
                          {provider.verificationLevel === 'VERIFIED' && (
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
                    </div>

                    <div className="mt-4">
                      <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                        <span className="flex items-center">
                          <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          {provider._count?.currentCAs || 0} CAs
                        </span>
                        <span className="text-xs text-gray-500">{provider.city}, {provider.state}</span>
                      </div>

                      <div className="text-xs text-gray-600 mb-3">
                        Est. {provider.establishedYear} • {new Date().getFullYear() - provider.establishedYear} years in business
                      </div>

                      {provider._count && provider._count.firmReviews > 0 ? (
                        <p className="text-xs text-gray-500 mb-3">
                          {provider._count.firmReviews} reviews • {provider._count.serviceRequests} completed requests
                        </p>
                      ) : (
                        <p className="text-xs text-gray-500 mb-3">No reviews yet</p>
                      )}

                      {provider.description && (
                        <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                          {provider.description}
                        </p>
                      )}

                      <Button
                        fullWidth
                        size="sm"
                        onClick={(e) => handleHireClick(provider, e)}
                      >
                        Hire Firm
                      </Button>
                    </div>
                  </>
                )}
              </Card>
            ))}
          </div>
        )}

        {/* Success/Error Messages */}
        {success && (
          <div className="fixed top-4 right-4 z-50">
            <Alert type="success" onClose={() => setSuccess('')}>
              {success}
            </Alert>
          </div>
        )}
        {error && !showHireModal && (
          <div className="fixed top-4 right-4 z-50">
            <Alert type="error" onClose={() => setError('')}>
              {error}
            </Alert>
          </div>
        )}

        {/* Hire Modal */}
        <Modal
          isOpen={showHireModal}
          onClose={() => {
            setShowHireModal(false);
            setSelectedProvider(null);
            setError('');
          }}
          title={selectedProvider
            ? `Hire ${selectedProvider.type === 'individual'
                ? (selectedProvider as CA & { type: 'individual' }).user.name
                : (selectedProvider as Firm & { type: 'firm' }).firmName}`
            : 'Hire Provider'}
          size="lg"
        >
          <div className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <h4 className="text-sm font-semibold text-red-800 mb-2">Error Details:</h4>
                <pre className="text-xs text-red-700 whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                  {error}
                </pre>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Service Type <span className="text-red-500">*</span>
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={hireForm.serviceType}
                onChange={(e) => setHireForm({ ...hireForm, serviceType: e.target.value })}
              >
                <option value="">Select service type</option>
                <option value="GST_FILING">GST Compliance & Filing</option>
                <option value="INCOME_TAX_RETURN">Income Tax Return Filing</option>
                <option value="AUDIT">Audit Services</option>
                <option value="ACCOUNTING">Accounting & Bookkeeping</option>
                <option value="FINANCIAL_CONSULTING">Financial Consulting</option>
                <option value="TAX_PLANNING">Tax Planning</option>
                <option value="COMPANY_REGISTRATION">Company Registration</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={4}
                placeholder="Describe your requirements in detail..."
                value={hireForm.description}
                onChange={(e) => setHireForm({ ...hireForm, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Deadline (Optional)
                </label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={hireForm.deadline}
                  onChange={(e) => setHireForm({ ...hireForm, deadline: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estimated Hours (Optional)
                </label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 10"
                  value={hireForm.estimatedHours}
                  onChange={(e) => setHireForm({ ...hireForm, estimatedHours: e.target.value })}
                  min="1"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Documents (Optional)
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Upload relevant documents for your service request (invoices, statements, forms, etc.)
              </p>
              <FileUpload
                onFilesSelected={(files) => {
                  setUploadedFiles(prev => [...prev, ...files]);
                  setError(''); // Clear any previous errors
                }}
                existingFiles={uploadedFiles}
                maxFiles={5}
                maxSizeMB={10}
                disabled={submitting}
              />
              {uploadedFiles.length > 0 && (
                <p className="text-xs text-blue-600 mt-2">
                  💡 Documents will be attached to your first message after the CA accepts your request
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowHireModal(false);
                  setSelectedProvider(null);
                  setError('');
                }}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSubmitHire}
                isLoading={submitting}
                disabled={!hireForm.serviceType || !hireForm.description}
              >
                Send Request
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
};

export default CAListing;
