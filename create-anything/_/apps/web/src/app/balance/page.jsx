"use client";

import React from "react";
import AdminPlatformBalance from "../home/ui/AdminPlatformBalance";
import { getPlatformBalance } from "@/utils/runtimeData";

export default function BalancePage() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Balance</h1>
      <AdminPlatformBalance getPlatformBalance={getPlatformBalance} />
    </main>
  );
}
