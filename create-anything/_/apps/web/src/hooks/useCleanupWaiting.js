import { useState } from "react";

export function useCleanupWaiting() {
  const [cleanupResult, setCleanupResult] = useState(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);

  const handleCleanupWaiting = async () => {
    const token = localStorage.getItem("taskdash_token");
    setCleanupLoading(true);
    setCleanupResult(null);

    try {
      const API_BASE =
        import.meta.env.VITE_API_BASE_URL || "https://taskdash-api.onrender.com";
      const response = await fetch(`${API_BASE}/api/tasks/cleanup-waiting`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to cleanup");
      }

      setCleanupResult(data);
    } catch (error) {
      setCleanupResult({ error: error.message });
    } finally {
      setCleanupLoading(false);
    }
  };

  return {
    cleanupResult,
    cleanupLoading,
    handleCleanupWaiting,
  };
}
