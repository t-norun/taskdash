import { useWalletWithdrawal } from "@/hooks/useWalletWithdrawal";

export function WalletTab({ wallet, onWithdrawSuccess }) {
  const {
    withdrawAmount,
    setWithdrawAmount,
    withdrawNotes,
    setWithdrawNotes,
    handleWithdraw,
  } = useWalletWithdrawal(wallet, onWithdrawSuccess);

  if (!wallet) return null;

  return (
    <div className="space-y-6">
      {/* Wallet Balance */}
      <div className="bg-white border border-[#E5E5E5] rounded-xl p-6">
        <h3 className="text-[16px] font-semibold text-[#2B2B2B] mb-4">
          Wallet Balance
        </h3>
        <div className="text-[28px] font-semibold text-[#2B2B2B]">
          ${wallet.balance}
        </div>
      </div>

      {/* Withdrawal Request */}
      <div className="bg-white border border-[#E5E5E5] rounded-xl p-6">
        <h3 className="text-[16px] font-semibold text-[#2B2B2B] mb-4">
          Withdrawal Request
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-[13px] text-[#7A7A7A] mb-1">Amount</div>
            <input
              type="number"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              className="w-full px-3 py-2 border border-[#E5E5E5] rounded-md text-[13px] text-[#2B2B2B] bg-[#F8F9FA] focus:outline-none focus:border-[#2563FF]"
            />
          </div>
          <div>
            <div className="text-[13px] text-[#7A7A7A] mb-1">
              Notes (Optional)
            </div>
            <textarea
              value={withdrawNotes}
              onChange={(e) => setWithdrawNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-[#E5E5E5] rounded-md text-[13px] text-[#2B2B2B] bg-[#F8F9FA] focus:outline-none focus:border-[#2563FF]"
            />
          </div>
        </div>
        <div className="mt-4">
          <button
            onClick={handleWithdraw}
            className="w-full flex items-center justify-center px-4 py-2 border border-[#2563FF] rounded-md text-[14px] font-medium text-[#2563FF] bg-[#F8F9FA] hover:bg-[#F1F1F1] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2563FF]"
          >
            Request Withdrawal
          </button>
        </div>
      </div>
    </div>
  );
}

