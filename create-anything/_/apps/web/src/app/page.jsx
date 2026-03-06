"use client";

import { useEffect, useState } from "react";
import Landing from "./landing/page";

export default function Page() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("taskdash_access_token");
    if (token) {
      window.location.replace("/balance");
      return;
    }
    setReady(true);
  }, []);

  if (!ready) return null;
  return <Landing />;
}
