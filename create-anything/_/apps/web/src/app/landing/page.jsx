"use client";

import { useEffect, useState } from "react";

export default function LandingPage() {
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("taskdash_access_token");
    if (token) {
      window.location.replace("/balance");
      return;
    }
    setCheckingAuth(false);
  }, []);

  if (checkingAuth) return null;

  return (
    <div className="min-h-screen bg-white font-inter">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-[#2563FF] to-[#1E40AF] text-white">
        <div className="max-w-[1200px] mx-auto px-6 py-20">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-white rounded-full mx-auto mb-6"></div>
            <h1 className="text-[48px] font-bold mb-4">Task Dash</h1>
            <p className="text-[20px] text-blue-100 mb-8 max-w-[600px] mx-auto">
              スキル不要、すぐ始められる
              <br />
              公平な条件で稼げる新しいタスク完遂プラットフォーム
            </p>
            <a
              href="/login"
              className="inline-block bg-white text-[#2563FF] px-8 py-4 rounded-lg text-[18px] font-semibold hover:bg-blue-50 transition-colors"
            >
              今すぐメールで始める
            </a>
          </div>
        </div>
      </div>

      {/* 特徴セクション */}
      <div className="max-w-[1200px] mx-auto px-6 py-20">
        <h2 className="text-[36px] font-bold text-center mb-16 text-[#2B2B2B]">
          Task Dashの特徴
        </h2>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-white border-2 border-[#F1F1F1] rounded-xl p-8 hover:border-[#2563FF] transition-colors">
            <div className="w-12 h-12 bg-[#EFF6FF] rounded-lg flex items-center justify-center mb-4">
              <span className="text-[24px]">⚡</span>
            </div>
            <h3 className="text-[20px] font-semibold mb-3 text-[#2B2B2B]">
              スキル不要で今すぐ開始
            </h3>
            <p className="text-[14px] text-[#7A7A7A] leading-relaxed">
              特別なスキルは一切不要。メールアドレスだけで登録完了。シンプルなタスクを並べ替えるだけで報酬を獲得できます。
            </p>
          </div>

          <div className="bg-white border-2 border-[#F1F1F1] rounded-xl p-8 hover:border-[#2563FF] transition-colors">
            <div className="w-12 h-12 bg-[#EFF6FF] rounded-lg flex items-center justify-center mb-4">
              <span className="text-[24px]">🎯</span>
            </div>
            <h3 className="text-[20px] font-semibold mb-3 text-[#2B2B2B]">
              案件探し不要
            </h3>
            <p className="text-[14px] text-[#7A7A7A] leading-relaxed">
              仕事の発注元はTask Dashのみ。複雑な提案や営業は一切不要。ログインすればすぐにタスクを開始できます。
            </p>
          </div>

          <div className="bg-white border-2 border-[#F1F1F1] rounded-xl p-8 hover:border-[#2563FF] transition-colors">
            <div className="w-12 h-12 bg-[#EFF6FF] rounded-lg flex items-center justify-center mb-4">
              <span className="text-[24px]">⚖️</span>
            </div>
            <h3 className="text-[20px] font-semibold mb-3 text-[#2B2B2B]">
              公平な条件で競争
            </h3>
            <p className="text-[14px] text-[#7A7A7A] leading-relaxed">
              全員が同じタスクに挑戦。正確さとスピードで評価されるシンプルな仕組み。努力がそのまま報酬につながります。
            </p>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-[#2563FF] text-white py-20">
        <div className="max-w-[800px] mx-auto px-6 text-center">
          <h2 className="text-[36px] font-bold mb-4">今すぐTask Dashを始めましょう</h2>
          <p className="text-[18px] text-blue-100 mb-8">
            登録は無料、初期費用も不要。メールアドレスだけで今すぐ開始できます
          </p>
          <a
            href="/login"
            className="inline-block bg-white text-[#2563FF] px-10 py-4 rounded-lg text-[18px] font-semibold hover:bg-blue-50 transition-colors"
          >
            メールで無料登録
          </a>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-[#2B2B2B] text-white py-8">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <p className="text-[14px] text-gray-400">© 2024 Task Dash. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
