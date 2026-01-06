"use client";

import { useEffect, useState } from "react";

export default function LandingPage() {
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    // ログイン済みならダッシュボードへ
    const token = localStorage.getItem("taskdash_access_token");
    if (token) {
      window.location.href = "/";
    } else {
      setCheckingAuth(false);
    }
  }, []);

  if (checkingAuth) {
    return null;
  }

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
          {/* 特徴1 */}
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

          {/* 特徴2 */}
          <div className="bg-white border-2 border-[#F1F1F1] rounded-xl p-8 hover:border-[#2563FF] transition-colors">
            <div className="w-12 h-12 bg-[#EFF6FF] rounded-lg flex items-center justify-center mb-4">
              <span className="text-[24px]">🎯</span>
            </div>
            <h3 className="text-[20px] font-semibold mb-3 text-[#2B2B2B]">
              案件探し不要
            </h3>
            <p className="text-[14px] text-[#7A7A7A] leading-relaxed">
              仕事の発注元はTask
              Dashのみ。複雑な提案や営業は一切不要。ログインすればすぐにタスクを開始できます。
            </p>
          </div>

          {/* 特徴3 */}
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

      {/* 仕組みセクション */}
      <div className="bg-[#F8F9FA] py-20">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-[36px] font-bold text-center mb-16 text-[#2B2B2B]">
            仕組みはシンプル
          </h2>

          <div className="grid md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-[#2563FF] text-white rounded-full flex items-center justify-center text-[24px] font-bold mx-auto mb-4">
                1
              </div>
              <h4 className="text-[16px] font-semibold mb-2 text-[#2B2B2B]">
                メール登録
              </h4>
              <p className="text-[13px] text-[#7A7A7A]">
                メールアドレスで
                <br />
                無料登録
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-[#2563FF] text-white rounded-full flex items-center justify-center text-[24px] font-bold mx-auto mb-4">
                2
              </div>
              <h4 className="text-[16px] font-semibold mb-2 text-[#2B2B2B]">
                タスク受注
              </h4>
              <p className="text-[13px] text-[#7A7A7A]">
                レベルに応じた
                <br />
                タスクを選択
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-[#2563FF] text-white rounded-full flex items-center justify-center text-[24px] font-bold mx-auto mb-4">
                3
              </div>
              <h4 className="text-[16px] font-semibold mb-2 text-[#2B2B2B]">
                数字を並べ替え
              </h4>
              <p className="text-[13px] text-[#7A7A7A]">
                表示された数字を
                <br />
                正確に並べる
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-[#2563FF] text-white rounded-full flex items-center justify-center text-[24px] font-bold mx-auto mb-4">
                4
              </div>
              <h4 className="text-[16px] font-semibold mb-2 text-[#2B2B2B]">
                報酬獲得
              </h4>
              <p className="text-[13px] text-[#7A7A7A]">
                正確さとスピードで
                <br />
                評価・報酬
              </p>
            </div>
          </div>

          {/* 数字生成の説明 */}
          <div className="mt-12 bg-white border border-[#E5E5E5] rounded-xl p-6">
            <h3 className="text-[16px] font-semibold text-[#2B2B2B] mb-3">
              📊 公平な難易度設計
            </h3>
            <p className="text-[14px] text-[#7A7A7A] leading-relaxed">
              本タスクでは、毎回ランダムに生成された10個の数値（0〜99）を入力します。
              数値の構成は、すべての利用者で難易度が均一になるよう調整されています。
              連番の排除、ゾロ目の上限設定、1桁・2桁の比率制御により、
              認知負荷を一定に保ち、純粋なスキルで競い合える環境を提供します。
            </p>
          </div>
        </div>
      </div>

      {/* レベルシステム */}
      <div className="max-w-[1200px] mx-auto px-6 py-20">
        <h2 className="text-[36px] font-bold text-center mb-8 text-[#2B2B2B]">
          レベルアップで報酬もアップ
        </h2>
        <p className="text-center text-[#7A7A7A] mb-12">
          3回タスクをこなすごとにレベルが上がり、高額タスクに挑戦できます
        </p>

        <div className="grid md:grid-cols-5 gap-4">
          <div className="bg-white border-2 border-[#E5E5E5] rounded-lg p-4 text-center">
            <div className="text-[#10B981] text-[20px] font-bold mb-1">Lv1</div>
            <div className="text-[24px] font-bold text-[#2B2B2B] mb-2">$1</div>
            <div className="text-[12px] text-[#7A7A7A]">スタート</div>
            <div className="text-[11px] text-[#A0A0A0] mt-1">正答率70%</div>
          </div>

          <div className="bg-white border-2 border-[#E5E5E5] rounded-lg p-4 text-center">
            <div className="text-[#10B981] text-[20px] font-bold mb-1">
              Lv10
            </div>
            <div className="text-[24px] font-bold text-[#2B2B2B] mb-2">$10</div>
            <div className="text-[12px] text-[#7A7A7A]">27回完了</div>
            <div className="text-[11px] text-[#A0A0A0] mt-1">正答率77%</div>
          </div>

          <div className="bg-white border-2 border-[#2563FF] rounded-lg p-4 text-center shadow-lg">
            <div className="text-[#2563FF] text-[20px] font-bold mb-1">
              Lv30
            </div>
            <div className="text-[24px] font-bold text-[#2B2B2B] mb-2">$30</div>
            <div className="text-[12px] text-[#2563FF] font-semibold">
              選別ライン
            </div>
            <div className="text-[11px] text-[#2563FF] mt-1">正答率88%</div>
          </div>

          <div className="bg-white border-2 border-[#E5E5E5] rounded-lg p-4 text-center">
            <div className="text-[#F59E0B] text-[20px] font-bold mb-1">
              Lv60
            </div>
            <div className="text-[24px] font-bold text-[#2B2B2B] mb-2">$60</div>
            <div className="text-[12px] text-[#7A7A7A]">177回完了</div>
            <div className="text-[11px] text-[#A0A0A0] mt-1">正答率94%</div>
          </div>

          <div className="bg-gradient-to-br from-[#EF4444] to-[#DC2626] border-2 border-[#DC2626] rounded-lg p-4 text-center text-white">
            <div className="text-[20px] font-bold mb-1">Lv100</div>
            <div className="text-[24px] font-bold mb-2">$100</div>
            <div className="text-[12px]">Master</div>
            <div className="text-[11px] mt-1">正答率97.5%</div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-[#2563FF] text-white py-20">
        <div className="max-w-[800px] mx-auto px-6 text-center">
          <h2 className="text-[36px] font-bold mb-4">
            今すぐTask Dashを始めましょう
          </h2>
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
          <p className="text-[14px] text-gray-400">
            © 2024 Task Dash. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
