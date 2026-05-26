import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Shield } from 'lucide-react';
import { WalletSelector } from '@/components/WalletSelector';
import { WalletBalance } from '@/components/wallet/WalletBalance';
import { CompactWalletBalance } from '@/components/wallet/CompactWalletBalance';
import { useWallet } from '@/contexts/WalletContext';

const navItems = [
  { name: 'Home', path: '/' },
  { name: 'Markets', path: '/markets' },
  { name: 'Liquidity', path: '/liquidity' },
  { name: 'Create', path: '/create' },
  { name: 'About', path: '/about' },
  { name: 'Leaderboard', path: '/leaderboard' },
  { name: 'Analytics', path: '/analytics' },
  { name: 'Governance', path: '/governance' },
];

export function Navbar() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isConnected, publicKey } = useWallet();

  const adminAddresses = (import.meta.env.VITE_ADMIN_ADDRESSES || '').split(',').map((a: string) => a.trim().toLowerCase());
  const isAdmin = isConnected && publicKey && (
    adminAddresses.includes(publicKey.toLowerCase()) || import.meta.env.DEV
  );

  return (
    <>
      <nav className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-7xl rounded-full border border-white/10 bg-black/20 backdrop-blur-xl shadow-lg overflow-hidden transition-all duration-300">
        <div className="flex items-center justify-between px-4 lg:px-8 py-3 w-full relative z-10">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group flex-shrink-0">
            <h1 className="text-lg lg:text-xl font-bold bg-gradient-to-r from-[#FF8C00] via-[#5F9EA0] to-[#7a57db] bg-clip-text text-transparent">
              Oryn Finance
            </h1>
          </Link>

          {/* Desktop Navigation - Hide when wallet is connected to save space */}
          <div className={`hidden lg:flex items-center gap-6 ${isConnected ? 'xl:gap-8' : 'gap-8'}`}>
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`text-sm font-medium transition-colors hover:text-primary whitespace-nowrap ${
                  location.pathname === item.path ? 'text-primary' : 'text-neutral-400'
                }`}
              >
                {item.name}
              </Link>
            ))}
          </div>

          {/* Wallet Section */}
          <div className="flex gap-2 items-center flex-shrink-0">
            {isAdmin && (
              <Link
                to="/admin"
                className={`hidden lg:flex items-center gap-1 text-sm font-medium transition-colors hover:text-orange-400 ${location.pathname === '/admin' ? 'text-orange-400' : 'text-neutral-400'}`}
              >
                <Shield className="w-4 h-4" />
                Admin
              </Link>
            )}
            {isConnected && (
              <>
                <div className="hidden lg:block">
                  <WalletBalance />
                </div>
                <CompactWalletBalance />
              </>
            )}
            <WalletSelector />
          </div>

          {/* Mobile Menu Button */}
          <button
            className="lg:hidden p-2 text-muted-foreground hover:text-foreground ml-2"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-xl animate-fade-in">
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-6 py-6 border-b border-white/10">
              <span className="text-xl font-bold">Menu</span>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex flex-col gap-6 p-8 items-center justify-center flex-1">
              {/* Mobile Wallet Balance */}
              {isConnected && (
                <div className="mb-4">
                  <WalletBalance />
                </div>
              )}
              
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`text-2xl font-bold ${location.pathname === item.path ? 'text-primary' : 'text-neutral-400'
                    }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.name}
                </Link>
              ))}
              {isAdmin && (
                <Link
                  to="/admin"
                  className={`text-2xl font-bold flex items-center gap-2 ${location.pathname === '/admin' ? 'text-orange-400' : 'text-neutral-400'}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Shield className="w-6 h-6" /> Admin
                </Link>
              )}
              
              <div className="mt-8">
                <WalletSelector />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
