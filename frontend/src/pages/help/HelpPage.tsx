import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpenIcon,
  UserCircleIcon,
  BriefcaseIcon,
  BuildingOfficeIcon,
  CreditCardIcon,
  QuestionMarkCircleIcon,
  LifebuoyIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { useAppSelector } from '../../store/hooks';

interface Section {
  id: string;
  title: string;
  icon: any;
  content: string;
  roles: string[]; // Roles that can see this section
}

const HelpPage: React.FC = () => {
  const { user } = useAppSelector((state) => state.auth);
  const userRole = user?.role || 'GUEST';

  const [activeSection, setActiveSection] = useState<string>('');
  const [expandedFAQs, setExpandedFAQs] = useState<Set<number>>(new Set());

  const toggleFAQ = (index: number) => {
    const newExpanded = new Set(expandedFAQs);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedFAQs(newExpanded);
  };

  const allSections: Section[] = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      icon: BookOpenIcon,
      content: 'getting-started',
      roles: ['GUEST', 'CLIENT', 'CA', 'ADMIN', 'SUPER_ADMIN'],
    },
    {
      id: 'for-clients',
      title: 'Client Guide',
      icon: UserCircleIcon,
      content: 'for-clients',
      roles: ['CLIENT'],
    },
    {
      id: 'for-cas',
      title: 'CA Guide',
      icon: BriefcaseIcon,
      content: 'for-cas',
      roles: ['CA'],
    },
    {
      id: 'for-firms',
      title: 'CA Firm Guide',
      icon: BuildingOfficeIcon,
      content: 'for-firms',
      roles: ['CA'],
    },
    {
      id: 'payments',
      title: 'Payment & Billing',
      icon: CreditCardIcon,
      content: 'payments',
      roles: ['CLIENT', 'CA'],
    },
    {
      id: 'faqs',
      title: 'FAQs',
      icon: QuestionMarkCircleIcon,
      content: 'faqs',
      roles: ['GUEST', 'CLIENT', 'CA', 'ADMIN', 'SUPER_ADMIN'],
    },
    {
      id: 'support',
      title: 'Support',
      icon: LifebuoyIcon,
      content: 'support',
      roles: ['GUEST', 'CLIENT', 'CA', 'ADMIN', 'SUPER_ADMIN'],
    },
  ];

  // Filter sections based on user role
  const sections = useMemo(() => {
    return allSections.filter(section => section.roles.includes(userRole));
  }, [userRole]);

  // Set default active section when sections change
  useEffect(() => {
    if (sections.length > 0 && !sections.find(s => s.id === activeSection)) {
      // If client, default to client guide, if CA default to CA guide, otherwise getting started
      if (userRole === 'CLIENT' && sections.find(s => s.id === 'for-clients')) {
        setActiveSection('for-clients');
      } else if (userRole === 'CA' && sections.find(s => s.id === 'for-cas')) {
        setActiveSection('for-cas');
      } else {
        setActiveSection(sections[0].id);
      }
    }
  }, [sections, userRole]);

  const allFaqs = [
    {
      category: 'General',
      roles: ['GUEST', 'CLIENT', 'CA', 'ADMIN', 'SUPER_ADMIN'],
      questions: [
        {
          q: 'Is registration free?',
          a: 'Yes, creating an account is completely free for both clients and CAs.',
        },
        {
          q: 'How long does verification take?',
          a: 'CA verification typically takes 24-48 hours after document submission.',
        },
        {
          q: 'Can I change my profile information?',
          a: 'Yes, you can edit your profile anytime from your dashboard.',
        },
      ],
    },
    {
      category: 'For Clients',
      roles: ['CLIENT'],
      questions: [
        {
          q: 'How do I choose the right CA?',
          a: 'Consider their specializations, experience, ratings, and reviews. Use our comparison tool to compare multiple CAs.',
        },
        {
          q: 'What if I\'m not satisfied with the service?',
          a: 'Contact support within 7 days of service completion. We\'ll review and may issue a refund.',
        },
        {
          q: 'Can I cancel a service request?',
          a: 'Yes, you can cancel before the CA accepts it. After acceptance, contact the CA or support.',
        },
        {
          q: 'Is my payment secure?',
          a: 'Yes, we use Razorpay, a PCI-DSS compliant payment gateway. Payments are held in escrow until service completion.',
        },
      ],
    },
    {
      category: 'For CAs',
      roles: ['CA'],
      questions: [
        {
          q: 'How do I get more clients?',
          a: 'Complete your profile, get verified, maintain high ratings, and respond quickly to requests.',
        },
        {
          q: 'When will I receive payment?',
          a: 'After service completion and admin approval, funds are credited to your wallet. You can withdraw anytime.',
        },
        {
          q: 'Can I work independently if I\'m in a firm?',
          a: 'Depends on your firm\'s policy. Request approval from your firm admin for independent work.',
        },
        {
          q: 'What if a client disputes my service?',
          a: 'Contact support immediately. We\'ll mediate and review the case objectively.',
        },
      ],
    },
    {
      category: 'For Firms',
      roles: ['CA'],
      questions: [
        {
          q: 'How many members can I have?',
          a: 'No limit! Invite as many CAs as your firm has.',
        },
        {
          q: 'Can members leave the firm?',
          a: 'Yes, members can resign anytime. Pending work must be completed or reassigned.',
        },
        {
          q: 'What happens to ongoing requests if a member leaves?',
          a: 'Requests can be reassigned to another team member or completed by the leaving member.',
        },
      ],
    },
  ];

  // Filter FAQs based on user role
  const faqs = useMemo(() => {
    return allFaqs.filter(faqCategory => faqCategory.roles.includes(userRole));
  }, [userRole]);

  // Get personalized header text based on role
  const getHeaderText = () => {
    switch (userRole) {
      case 'CLIENT':
        return {
          title: 'Client Help Center',
          subtitle: 'Everything you need to know about finding CAs and managing your service requests',
        };
      case 'CA':
        return {
          title: 'CA Help Center',
          subtitle: 'Guide to managing your profile, requests, earnings, and firm operations',
        };
      case 'ADMIN':
      case 'SUPER_ADMIN':
        return {
          title: 'Admin Help Center',
          subtitle: 'Platform administration and management guide',
        };
      default:
        return {
          title: 'Help & Support',
          subtitle: 'Everything you need to know about using CA Marketplace',
        };
    }
  };

  const headerText = getHeaderText();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-blue-600 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold mb-4">{headerText.title}</h1>
          <p className="text-xl text-blue-100">
            {headerText.subtitle}
          </p>
          {user && (
            <p className="text-sm text-blue-200 mt-2">
              Welcome, {user.name}!
            </p>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <nav className="space-y-1 sticky top-4">
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                      activeSection === section.id
                        ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-700'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="mr-3 h-5 w-5" />
                    {section.title}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <div className="bg-white shadow rounded-lg p-8">
              {/* Getting Started */}
              {activeSection === 'getting-started' && (
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-6">Getting Started</h2>

                  <div className="space-y-8">
                    <div>
                      <h3 className="text-xl font-semibold mb-3">Creating an Account</h3>
                      <ol className="list-decimal list-inside space-y-2 text-gray-700">
                        <li>Visit the CA Marketplace homepage</li>
                        <li>Click "Register" and choose your account type:
                          <ul className="list-disc list-inside ml-6 mt-2">
                            <li><strong>Client:</strong> If you need accounting services</li>
                            <li><strong>Chartered Accountant:</strong> If you're a CA offering services</li>
                          </ul>
                        </li>
                        <li>Fill in your details (Email, Password, Name, Phone)</li>
                        <li>Verify your email (check inbox for verification link)</li>
                        <li>Complete your profile with additional details</li>
                      </ol>
                    </div>

                    <div>
                      <h3 className="text-xl font-semibold mb-3">Logging In</h3>
                      <ol className="list-decimal list-inside space-y-2 text-gray-700">
                        <li>Click "Login" on the homepage</li>
                        <li>Enter your registered email and password</li>
                        <li>Click "Sign In"</li>
                      </ol>
                    </div>

                    <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <QuestionMarkCircleIcon className="h-5 w-5 text-blue-400" />
                        </div>
                        <div className="ml-3">
                          <p className="text-sm text-blue-700">
                            <strong>Quick Tip:</strong> Make sure to complete your profile to get better visibility and trust from other users.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* For Clients */}
              {activeSection === 'for-clients' && (
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-6">For Clients</h2>

                  <div className="space-y-8">
                    <div>
                      <h3 className="text-xl font-semibold mb-3">Finding the Right CA</h3>
                      <p className="text-gray-700 mb-3">Navigate to "Find CAs" and use our search and filter tools:</p>
                      <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                        <li>Search by CA name</li>
                        <li>Filter by specialization (GST, Income Tax, Audit, etc.)</li>
                        <li>Filter by experience level</li>
                        <li>Sort by hourly rate or rating</li>
                        <li>View detailed CA profiles with licenses, ratings, and reviews</li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="text-xl font-semibold mb-3">Creating a Service Request</h3>
                      <ol className="list-decimal list-inside space-y-2 text-gray-700">
                        <li>From your dashboard, click "Create New Request"</li>
                        <li>Select service type (GST Filing, Income Tax Return, Audit, etc.)</li>
                        <li>Provide detailed description of your requirements</li>
                        <li>Set deadline and estimated hours (optional)</li>
                        <li>Select a CA or let the system auto-assign</li>
                        <li>Upload relevant documents</li>
                        <li>Submit request</li>
                      </ol>
                    </div>

                    <div>
                      <h3 className="text-xl font-semibold mb-3">Request Status</h3>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="space-y-2">
                          <div className="flex items-center">
                            <span className="inline-block w-24 px-2 py-1 text-xs font-semibold text-yellow-800 bg-yellow-100 rounded-full">PENDING</span>
                            <span className="ml-4 text-sm text-gray-600">Waiting for CA to accept</span>
                          </div>
                          <div className="flex items-center">
                            <span className="inline-block w-24 px-2 py-1 text-xs font-semibold text-blue-800 bg-blue-100 rounded-full">ACCEPTED</span>
                            <span className="ml-4 text-sm text-gray-600">CA has accepted your request</span>
                          </div>
                          <div className="flex items-center">
                            <span className="inline-block w-24 px-2 py-1 text-xs font-semibold text-purple-800 bg-purple-100 rounded-full">IN_PROGRESS</span>
                            <span className="ml-4 text-sm text-gray-600">Work has started</span>
                          </div>
                          <div className="flex items-center">
                            <span className="inline-block w-24 px-2 py-1 text-xs font-semibold text-green-800 bg-green-100 rounded-full">COMPLETED</span>
                            <span className="ml-4 text-sm text-gray-600">Service delivered</span>
                          </div>
                          <div className="flex items-center">
                            <span className="inline-block w-24 px-2 py-1 text-xs font-semibold text-red-800 bg-red-100 rounded-full">CANCELLED</span>
                            <span className="ml-4 text-sm text-gray-600">Request was cancelled</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xl font-semibold mb-3">Making Payments</h3>
                      <ol className="list-decimal list-inside space-y-2 text-gray-700">
                        <li>Receive payment request when service is complete</li>
                        <li>Review amount breakdown (service cost + 10% platform fee)</li>
                        <li>Choose payment method (Card, Net Banking, UPI, Wallet)</li>
                        <li>Complete payment via secure gateway</li>
                        <li>Payment held in escrow until admin approval</li>
                      </ol>
                    </div>

                    <div>
                      <h3 className="text-xl font-semibold mb-3">Leaving Reviews</h3>
                      <p className="text-gray-700 mb-2">After service completion:</p>
                      <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                        <li>Rate your experience (1-5 stars)</li>
                        <li>Write detailed feedback</li>
                        <li>Submit review to help other clients</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* For CAs */}
              {activeSection === 'for-cas' && (
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-6">For Chartered Accountants</h2>

                  <div className="space-y-8">
                    <div>
                      <h3 className="text-xl font-semibold mb-3">Setting Up Your Profile</h3>
                      <p className="text-gray-700 mb-3">Complete your professional profile with:</p>
                      <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                        <li>CA License Number (unique identifier)</li>
                        <li>Specializations (GST, Income Tax, Audit, etc.)</li>
                        <li>Years of experience</li>
                        <li>Qualifications and certifications</li>
                        <li>Languages you speak</li>
                        <li>Your hourly rate</li>
                        <li>Professional bio and description</li>
                        <li>Upload license certificate and credentials</li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="text-xl font-semibold mb-3">Managing Service Requests</h3>
                      <p className="text-gray-700 mb-3">When you receive a request:</p>
                      <ol className="list-decimal list-inside space-y-2 text-gray-700">
                        <li>Review request details and client requirements</li>
                        <li>Check your availability</li>
                        <li><strong>Accept</strong> to start working or <strong>Reject</strong> if unavailable</li>
                        <li>Update status as you progress (In Progress → Completed)</li>
                        <li>Use chat feature to communicate with client</li>
                        <li>Upload deliverables when complete</li>
                      </ol>
                    </div>

                    <div>
                      <h3 className="text-xl font-semibold mb-3">Earnings & Payments</h3>
                      <div className="bg-gray-50 rounded-lg p-4 mb-4">
                        <h4 className="font-semibold mb-2">Payment Flow:</h4>
                        <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
                          <li>Client pays after service completion</li>
                          <li>Platform deducts 10% commission</li>
                          <li>Your 90% credited to wallet after admin approval</li>
                          <li>Request payout to your bank account anytime</li>
                          <li>Funds transferred within 2-3 business days</li>
                        </ol>
                      </div>
                      <p className="text-gray-700 mb-2"><strong>Withdrawing Funds:</strong></p>
                      <ol className="list-decimal list-inside space-y-2 text-gray-700">
                        <li>Go to "Wallet" or "Earnings" section</li>
                        <li>Click "Request Payout"</li>
                        <li>Enter withdrawal amount</li>
                        <li>Select payout method (Bank Transfer, UPI, RTGS/NEFT)</li>
                        <li>Enter bank details</li>
                        <li>Submit and wait for admin approval</li>
                      </ol>
                    </div>

                    <div>
                      <h3 className="text-xl font-semibold mb-3">Getting Verified</h3>
                      <div className="bg-green-50 border-l-4 border-green-400 p-4">
                        <h4 className="font-semibold text-green-800 mb-2">Why Verification Matters:</h4>
                        <ul className="list-disc list-inside space-y-1 text-sm text-green-700 ml-4">
                          <li>Builds client trust and credibility</li>
                          <li>Better visibility in search results</li>
                          <li>Access to premium features</li>
                          <li>Higher conversion rate</li>
                        </ul>
                      </div>
                      <p className="text-gray-700 mt-4 mb-2"><strong>Verification Process:</strong></p>
                      <ol className="list-decimal list-inside space-y-1 text-gray-700">
                        <li>Submit complete profile with all documents</li>
                        <li>Admin reviews your credentials (24-48 hours)</li>
                        <li>Status: Pending → Verified/Rejected</li>
                        <li>Get verified badge on your profile</li>
                      </ol>
                    </div>
                  </div>
                </div>
              )}

              {/* For Firms */}
              {activeSection === 'for-firms' && (
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-6">For CA Firms</h2>

                  <div className="space-y-8">
                    <div>
                      <h3 className="text-xl font-semibold mb-3">Registering Your Firm</h3>
                      <p className="text-gray-700 mb-4">Complete 3-step registration wizard:</p>

                      <div className="space-y-4">
                        <div className="border-l-4 border-blue-500 pl-4">
                          <h4 className="font-semibold text-blue-900 mb-2">Step 1: Basic Information</h4>
                          <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 ml-4">
                            <li>Firm Name (unique)</li>
                            <li>Firm Type (Sole Proprietorship, Partnership, LLP, Pvt Ltd)</li>
                            <li>Registration Number and GSTIN</li>
                            <li>PAN Number</li>
                            <li>Contact details and address</li>
                            <li>Established year and website</li>
                            <li>Firm description</li>
                          </ul>
                        </div>

                        <div className="border-l-4 border-green-500 pl-4">
                          <h4 className="font-semibold text-green-900 mb-2">Step 2: Invite Team Members</h4>
                          <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 ml-4">
                            <li>Add CA email addresses</li>
                            <li>Assign roles: FIRM_ADMIN, SENIOR_CA, JUNIOR_CA, SUPPORT_STAFF, CONSULTANT</li>
                            <li>Choose membership type: Full-time, Part-time, Contractor</li>
                            <li>Add personal welcome message (optional)</li>
                            <li>Send invitations</li>
                          </ul>
                        </div>

                        <div className="border-l-4 border-purple-500 pl-4">
                          <h4 className="font-semibold text-purple-900 mb-2">Step 3: Review & Submit</h4>
                          <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 ml-4">
                            <li>Review all firm details</li>
                            <li>Verify team member invitations</li>
                            <li>Submit for admin verification</li>
                            <li>Track status: DRAFT → PENDING_VERIFICATION → ACTIVE</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xl font-semibold mb-3">Managing Your Firm</h3>
                      <p className="text-gray-700 mb-3">Access "My Firm" dashboard to:</p>
                      <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                        <li>View firm details and verification status</li>
                        <li>See all team members with their roles</li>
                        <li>Track statistics (requests, revenue, team size)</li>
                        <li>Invite additional members</li>
                        <li>Manage invitations and membership</li>
                        <li>View firm analytics and performance</li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="text-xl font-semibold mb-3">Invitation Management</h3>
                      <p className="text-gray-700 mb-3">If you receive a firm invitation:</p>
                      <ol className="list-decimal list-inside space-y-2 text-gray-700">
                        <li>Go to "Invitations" in CA dashboard</li>
                        <li>View pending invitations with:
                          <ul className="list-disc list-inside ml-6 mt-1 space-y-1">
                            <li>Firm details and location</li>
                            <li>Your proposed role and membership type</li>
                            <li>Personal message from admin</li>
                            <li>Expiry date (7 days from sent)</li>
                          </ul>
                        </li>
                        <li>Accept or Reject with confirmation</li>
                        <li>View past invitations in History tab</li>
                      </ol>
                    </div>

                    <div>
                      <h3 className="text-xl font-semibold mb-3">Independent Work Management</h3>
                      <div className="bg-yellow-50 rounded-lg p-4">
                        <p className="text-sm text-gray-700 mb-2">
                          As a firm member, you may request permission for independent work outside the firm.
                        </p>
                        <p className="text-sm text-gray-700 mb-2"><strong>Firm Policies:</strong></p>
                        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 ml-4">
                          <li><strong>NO_INDEPENDENT_WORK:</strong> Not allowed</li>
                          <li><strong>LIMITED_WITH_APPROVAL:</strong> Requires approval per request</li>
                          <li><strong>FULL_INDEPENDENT_WORK:</strong> Freely allowed</li>
                          <li><strong>CLIENT_RESTRICTIONS:</strong> Allowed except specific clients</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Payments */}
              {activeSection === 'payments' && (
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-6">Payment & Billing</h2>

                  <div className="space-y-8">
                    <div>
                      <h3 className="text-xl font-semibold mb-3">How Payments Work</h3>
                      <div className="bg-gray-50 rounded-lg p-6">
                        <ol className="space-y-3 text-gray-700">
                          <li className="flex items-start">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-semibold mr-3 flex-shrink-0">1</span>
                            <span>Service request created and assigned to CA</span>
                          </li>
                          <li className="flex items-start">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-semibold mr-3 flex-shrink-0">2</span>
                            <span>CA completes the service</span>
                          </li>
                          <li className="flex items-start">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-semibold mr-3 flex-shrink-0">3</span>
                            <span>Client pays via secure payment gateway</span>
                          </li>
                          <li className="flex items-start">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-semibold mr-3 flex-shrink-0">4</span>
                            <span>Payment held in escrow by platform</span>
                          </li>
                          <li className="flex items-start">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-semibold mr-3 flex-shrink-0">5</span>
                            <span>Admin verifies service completion and approves release</span>
                          </li>
                          <li className="flex items-start">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-semibold mr-3 flex-shrink-0">6</span>
                            <span>90% credited to CA wallet, 10% platform fee</span>
                          </li>
                          <li className="flex items-start">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-semibold mr-3 flex-shrink-0">7</span>
                            <span>CA requests withdrawal to bank account</span>
                          </li>
                        </ol>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xl font-semibold mb-3">Payment Methods</h3>
                      <div className="grid md:grid-cols-2 gap-6">
                        <div>
                          <h4 className="font-semibold mb-3">For Clients (Making Payments):</h4>
                          <ul className="list-disc list-inside space-y-1 text-gray-700 ml-4">
                            <li>Credit Cards (Visa, Mastercard, Amex)</li>
                            <li>Debit Cards</li>
                            <li>Net Banking</li>
                            <li>UPI (Google Pay, PhonePe, Paytm)</li>
                            <li>Wallets (Paytm, Amazon Pay, etc.)</li>
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-semibold mb-3">For CAs (Receiving Payouts):</h4>
                          <ul className="list-disc list-inside space-y-1 text-gray-700 ml-4">
                            <li>Bank Transfer</li>
                            <li>UPI</li>
                            <li>RTGS</li>
                            <li>NEFT</li>
                            <li>IMPS</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xl font-semibold mb-3">Platform Fees</h3>
                      <div className="bg-blue-50 rounded-lg p-6">
                        <div className="grid md:grid-cols-3 gap-4 text-center">
                          <div>
                            <div className="text-3xl font-bold text-blue-600 mb-2">100%</div>
                            <div className="text-sm text-gray-600">Client Pays</div>
                            <div className="text-xs text-gray-500 mt-1">Full service amount</div>
                          </div>
                          <div>
                            <div className="text-3xl font-bold text-red-600 mb-2">10%</div>
                            <div className="text-sm text-gray-600">Platform Fee</div>
                            <div className="text-xs text-gray-500 mt-1">Commission deducted</div>
                          </div>
                          <div>
                            <div className="text-3xl font-bold text-green-600 mb-2">90%</div>
                            <div className="text-sm text-gray-600">CA Receives</div>
                            <div className="text-xs text-gray-500 mt-1">Net earnings</div>
                          </div>
                        </div>
                        <p className="text-center text-sm text-gray-600 mt-4">No hidden charges - transparent pricing</p>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xl font-semibold mb-3">Payment Security</h3>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="flex items-start">
                          <svg className="h-6 w-6 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                          </svg>
                          <div>
                            <h4 className="font-semibold">SSL Encrypted</h4>
                            <p className="text-sm text-gray-600">All transactions are secure</p>
                          </div>
                        </div>
                        <div className="flex items-start">
                          <svg className="h-6 w-6 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                          </svg>
                          <div>
                            <h4 className="font-semibold">Razorpay Integration</h4>
                            <p className="text-sm text-gray-600">PCI-DSS compliant gateway</p>
                          </div>
                        </div>
                        <div className="flex items-start">
                          <svg className="h-6 w-6 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                          </svg>
                          <div>
                            <h4 className="font-semibold">Escrow Protection</h4>
                            <p className="text-sm text-gray-600">Funds held until service verified</p>
                          </div>
                        </div>
                        <div className="flex items-start">
                          <svg className="h-6 w-6 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                          </svg>
                          <div>
                            <h4 className="font-semibold">Refund Policy</h4>
                            <p className="text-sm text-gray-600">Available for disputes</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* FAQs */}
              {activeSection === 'faqs' && (
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-6">Frequently Asked Questions</h2>

                  <div className="space-y-6">
                    {faqs.map((category, catIndex) => (
                      <div key={catIndex}>
                        <h3 className="text-xl font-semibold mb-4 text-blue-600">{category.category}</h3>
                        <div className="space-y-3">
                          {category.questions.map((faq, faqIndex) => {
                            const globalIndex = catIndex * 100 + faqIndex;
                            const isExpanded = expandedFAQs.has(globalIndex);
                            return (
                              <div key={faqIndex} className="border border-gray-200 rounded-lg">
                                <button
                                  onClick={() => toggleFAQ(globalIndex)}
                                  className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
                                >
                                  <span className="font-medium text-gray-900">{faq.q}</span>
                                  {isExpanded ? (
                                    <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                                  ) : (
                                    <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                                  )}
                                </button>
                                {isExpanded && (
                                  <div className="px-4 pb-4 text-gray-700">
                                    {faq.a}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Support */}
              {activeSection === 'support' && (
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-6">Support</h2>

                  <div className="space-y-8">
                    <div>
                      <h3 className="text-xl font-semibold mb-4">Getting Help</h3>
                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="bg-blue-50 rounded-lg p-6">
                          <h4 className="font-semibold text-blue-900 mb-2">Email Support</h4>
                          <p className="text-blue-700 mb-1">support@camarketplace.com</p>
                          <p className="text-sm text-blue-600">Response Time: Within 24 hours</p>
                        </div>
                        <div className="bg-green-50 rounded-lg p-6">
                          <h4 className="font-semibold text-green-900 mb-2">Phone Support</h4>
                          <p className="text-green-700 mb-1">+91-XXXX-XXXXXX</p>
                          <p className="text-sm text-green-600">Mon-Fri, 9 AM - 6 PM IST</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xl font-semibold mb-4">Report an Issue</h3>
                      <ol className="list-decimal list-inside space-y-2 text-gray-700">
                        <li>Click "Help" in your dashboard</li>
                        <li>Select issue category:
                          <ul className="list-disc list-inside ml-6 mt-1 space-y-1">
                            <li>Account & Login</li>
                            <li>Payments & Billing</li>
                            <li>Service Requests</li>
                            <li>Technical Issues</li>
                            <li>Other</li>
                          </ul>
                        </li>
                        <li>Describe your issue in detail</li>
                        <li>Attach screenshots if helpful</li>
                        <li>Submit ticket and track status</li>
                      </ol>
                    </div>

                    <div>
                      <h3 className="text-xl font-semibold mb-4">Feedback & Suggestions</h3>
                      <div className="bg-purple-50 border-l-4 border-purple-400 p-4">
                        <p className="text-purple-900 mb-2">
                          We love hearing from you! Share your ideas to help us improve the platform.
                        </p>
                        <p className="text-sm text-purple-700">
                          Email: <strong>feedback@camarketplace.com</strong>
                        </p>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xl font-semibold mb-4">Best Practices & Security Tips</h3>
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-semibold mb-2 text-green-700">✅ Do:</h4>
                          <ul className="list-disc list-inside space-y-1 text-gray-700 ml-4">
                            <li>Use strong, unique passwords</li>
                            <li>Keep your profile updated and complete</li>
                            <li>Communicate through platform messaging</li>
                            <li>Report suspicious activity immediately</li>
                            <li>Log out on shared devices</li>
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-semibold mb-2 text-red-700">❌ Don't:</h4>
                          <ul className="list-disc list-inside space-y-1 text-gray-700 ml-4">
                            <li>Share your password with anyone</li>
                            <li>Make payments outside the platform</li>
                            <li>Share sensitive client information</li>
                            <li>Click suspicious links in messages</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpPage;
