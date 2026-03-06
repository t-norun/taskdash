"use client";

import { useEffect } from "react";

export default function BalancePage() {
  useEffect(() => {
    window.location.replace("/task");
  }, []);

  return null;
}

