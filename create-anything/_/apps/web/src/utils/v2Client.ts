// src/utils/v2Client.ts

const API_BASE = "http://localhost:3000";

function getToken() {
  return localStorage.getItem("taskdash_access_token") || "";
}
function getV2UserId() {
  return localStorage.getItem("taskdash_v2_userId") || "";
}

export async function v2GetBalance() {
  const token = getToken();
  const userId = getV2UserId();
  if (!token) throw new Error("missing token: localStorage.taskdash_access_token");
  if (!userId) throw new Error("missing userId: localStorage.taskdash_v2_userId");

  const r = await fetch(
    `${API_BASE}/api/user/balance?userId=${encodeURIComponent(userId)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const text = await r.text();
  if (!r.ok) throw new Error(`balance failed ${r.status}: ${text}`);
  return JSON.parse(text);
}
