import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Feather, Settings, LayoutDashboard, ExternalLink, LogOut, User as UserIcon } from 'lucide-react';

export function Header() {
  const { user, logout, isLoggingOut } = useAuth();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <header className="bg-purple-950 border-b border-purple-900 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-8">
            <Link to="/dashboard" className="flex items-center space-x-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-300 to-yellow-600 flex items-center justify-center text-purple-950 shadow-lg shadow-amber-500/20 group-hover:shadow-amber-500/40 transition-all duration-300">
                <Feather className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-xl text-white tracking-tight">ReachInbox</span>
              </div>
            </Link>

            {/* Navigation links */}
            <nav className="hidden md:flex space-x-1 font-sans">
              <Link
                to="/dashboard"
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
                  location.pathname === '/dashboard'
                    ? 'bg-purple-900 text-amber-400'
                    : 'text-purple-200 hover:bg-purple-900/50 hover:text-white'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Dashboard</span>
              </Link>
              <Link
                to="/settings"
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
                  location.pathname === '/settings'
                    ? 'bg-purple-900 text-amber-400'
                    : 'text-purple-200 hover:bg-purple-900/50 hover:text-white'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>Settings & Integrations</span>
              </Link>
              <a
                href="/admin/queues"
                target="_blank"
                rel="noreferrer"
                className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium text-purple-200 hover:bg-purple-900/50 hover:text-white transition"
              >
                <span>Bull Board</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-70" />
              </a>
            </nav>
          </div>

          {/* User Profile & Actions */}
          <div className="flex items-center space-x-4">
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center space-x-3 p-1.5 rounded-full hover:bg-purple-900/50 transition focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.name}
                      className="w-8 h-8 rounded-full object-cover border-2 border-amber-500/30"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-purple-800 text-amber-400 flex items-center justify-center text-sm font-semibold border border-purple-700">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="hidden sm:block text-left pr-2">
                    <p className="text-sm font-medium text-white leading-none">{user.name}</p>
                    <p className="text-xs text-purple-200 mt-0.5 leading-none">{user.email}</p>
                  </div>
                </button>

                {/* Dropdown Menu */}
                {dropdownOpen && (
                  <div
                    className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-50 animate-in fade-in slide-in-from-top-1"
                    onMouseLeave={() => setDropdownOpen(false)}
                  >
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Signed in as</p>
                      <p className="text-sm font-medium text-gray-900 truncate">{user.email}</p>
                    </div>
                    <Link
                      to="/settings"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
                    >
                      <Settings className="w-4 h-4 text-gray-400" />
                      <span>Settings & Slack</span>
                    </Link>
                    <button
                      onClick={() => logout()}
                      disabled={isLoggingOut}
                      className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition text-left"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>{isLoggingOut ? 'Logging out...' : 'Log out'}</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/login"
                className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition"
              >
                <UserIcon className="w-4 h-4" />
                <span>Log in</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
