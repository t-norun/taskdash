import { useState } from "react";

export function useWalletWithdrawal(wallet, onSuccess) {
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawNotes, setWithdrawNotes] = useState("");

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) {
      alert("Invalid amount");
      return;
    }

    if (amount > wallet?.balance) {
      alert("Insufficient balance");
      return;
    }

    const token = localStorage.getItem("taskdash_token");

    try {
      const response = await fetch("/api/admin/wallet", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount,
          notes: withdrawNotes,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create withdrawal");
      }

      alert("Withdrawal request created");
      setWithdrawAmount("");
      setWithdrawNotes("");
      if (onSuccess) onSuccess();
    } catch (error) {
      alert(error.message);
    }
  };

  return {
    withdrawAmount,
    setWithdrawAmount,
    withdrawNotes,
    setWithdrawNotes,
    handleWithdraw,
  };
}
