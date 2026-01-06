import { useState, useEffect } from "react";

export function useAdminAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = () => {
    const token = localStorage.getItem("taskdash_token");
    const userData = localStorage.getItem("taskdash_user");

    if (!token || !userData) {
      window.location.href = "/landing";
      return;
    }

    const parsedUser = JSON.parse(userData);
    if (parsedUser.email !== "taskdash.llc@gmail.com") {
      alert("Admin access required");
      window.location.href = "/";
      return;
    }

    setUser(parsedUser);
    setLoading(false);
  };

  return { user, loading };
}
