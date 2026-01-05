import React from 'react';
import { Link } from 'react-router-dom';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-800 text-white mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* About Section */}
          <div>
            <h3 className="text-lg font-semibold mb-4">CA Marketplace</h3>
            <p className="text-gray-300 text-sm">
              Connect with verified Chartered Accountants for all your financial and taxation needs.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/cas" className="text-gray-300 hover:text-white text-sm">
                  Find CAs
                </Link>
              </li>
              <li>
                <Link to="/register/ca" className="text-gray-300 hover:text-white text-sm">
                  Become a CA
                </Link>
              </li>
              <li>
                <Link to="/register/client" className="text-gray-300 hover:text-white text-sm">
                  Register as Client
                </Link>
              </li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Services</h3>
            <ul className="space-y-2 text-sm text-gray-300">
              <li>GST Filing</li>
              <li>Income Tax Return</li>
              <li>Audit Services</li>
              <li>Financial Consulting</li>
              <li>Company Registration</li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Contact</h3>
            <ul className="space-y-2 text-sm text-gray-300">
              <li>Email: support@camarketplace.com</li>
              <li>Phone: +91 1234567890</li>
              <li>Hours: Mon-Fri, 9AM-6PM IST</li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-700 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-sm text-gray-400">
            {currentYear} CA Marketplace. All rights reserved.
          </p>
          <div className="flex space-x-6 mt-4 md:mt-0">
            <Link to="#" className="text-sm text-gray-400 hover:text-white">
              Privacy Policy
            </Link>
            <Link to="#" className="text-sm text-gray-400 hover:text-white">
              Terms of Service
            </Link>
            <Link to="#" className="text-sm text-gray-400 hover:text-white">
              Help Center
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
