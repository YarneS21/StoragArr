import { Navigate, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import ViewDirectory from "./pages/ViewDirectory";
import Admin from "./pages/Admin";
import Header from "./components/Header";
import { useEffect, useState } from "react";
import LoginModal from "./components/LoginModal";
import CreateAdminModal from "./components/CreateAdminModal";
import api from "./api";

export default function App() {
  const [loginOpen, setLoginOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [adminExists, setAdminExists] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(Boolean(localStorage.getItem("token")));

  useEffect(() => {
    initAuth();
  }, []);

  async function initAuth() {
    try {
      const res = await api.get("/auth/status");
      const exists = Boolean(res.data?.adminExists);
      setAdminExists(exists);

      const token = localStorage.getItem("token");
      if (token && exists) {
        try {
          await api.get("/auth/verify", {
            headers: { Authorization: `Bearer ${token}` }
          });
          setIsLoggedIn(true);
        } catch {
          localStorage.removeItem("token");
          setIsLoggedIn(false);
        }
      } else {
        setIsLoggedIn(false);
      }

      if (!exists) {
        setSetupOpen(true);
        setLoginOpen(false);
      }
    } catch {
      setAdminExists(false);
      setSetupOpen(true);
      setLoginOpen(false);
    } finally {
      setAuthChecked(true);
    }
  }

  function onAdminCreated() {
    setAdminExists(true);
    setSetupOpen(false);
    setLoginOpen(true);
  }

  function onLoginSuccess() {
    setIsLoggedIn(true);
    setLoginOpen(false);
  }

  function onLogout() {
    localStorage.removeItem("token");
    setIsLoggedIn(false);
  }

  if (!authChecked) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <>
      <Header
        adminExists={adminExists}
        isLoggedIn={isLoggedIn}
        onLogin={() => setLoginOpen(true)}
        onLogout={onLogout}
      />
      <div className="p-6 max-w-[1600px] mx-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/dir/:id" element={<ViewDirectory />} />
          <Route path="/admin" element={isLoggedIn ? <Admin /> : <Navigate to="/" replace />} />
        </Routes>
      </div>

      {setupOpen && <CreateAdminModal onCreated={onAdminCreated} />}
      {loginOpen && !setupOpen && adminExists && (
        <LoginModal close={() => setLoginOpen(false)} onSuccess={onLoginSuccess} />
      )}
    </>
  );
}