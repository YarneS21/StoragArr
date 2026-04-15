import { Link } from "react-router-dom";
import { LockClosedIcon, Cog6ToothIcon, ArrowRightEndOnRectangleIcon } from "@heroicons/react/24/outline";


export default function Header({ adminExists, isLoggedIn, onLogin, onLogout }) {
  return (
    <header className="w-full bg-[#121622] py-4 px-6 flex items-center justify-between shadow-lg border-b border-white/5">
      <Link to="/" className="text-xl font-bold tracking-wide">
        Storag<span className="text-purple-400">Arr</span>
      </Link>

      <nav className="flex gap-6 text-gray-300">
        {isLoggedIn && (
          <Link to="/admin" className="flex items-center gap-1 bg-red-700/40 hover:bg-red-700/60 px-4 py-2 rounded-xl">
              <Cog6ToothIcon className="w-5" />Admin
          </Link>
        )}

        {!isLoggedIn && adminExists && (
          <button
            onClick={onLogin}
            className="flex items-center gap-1 bg-purple-700/40 hover:bg-purple-700/60 px-4 py-2 rounded-xl"
          >
            <LockClosedIcon className="w-5" />
            Login
          </button>
        )}

        {isLoggedIn && (
          <button
            onClick={onLogout}
            className="flex items-center gap-1 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10"
          >
            <ArrowRightEndOnRectangleIcon className="w-5" />
            Logout
          </button>
        )}
      </nav>
    </header>
  );
}