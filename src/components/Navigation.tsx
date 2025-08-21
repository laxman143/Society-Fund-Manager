"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="bg-white shadow mb-4">
      <div className="max-w-3xl mx-auto px-4">
        <div className="flex space-x-4 h-14 items-center">
          <Link 
            href="/" 
            className={`px-3 py-2 rounded-md text-sm font-medium ${
              pathname === '/' 
                ? 'bg-gray-900 text-white' 
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            Fund Collection
          </Link>
          <Link 
            href="/expense" 
            className={`px-3 py-2 rounded-md text-sm font-medium ${
              pathname === '/expense' 
                ? 'bg-gray-900 text-white' 
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            Expenses
          </Link>
        </div>
      </div>
    </nav>
  );
}
