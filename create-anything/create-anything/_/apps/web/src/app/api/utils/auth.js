import { extractBearerToken, verifyAccessToken } from "../../utils/jwt";

/**
 * Bearer隱崎ｨｼ繝溘ラ繝ｫ繧ｦ繧ｧ繧｢
 * 縺吶∋縺ｦ縺ｮ隱崎ｨｼ縺悟ｿ・ｦ√↑API縺ｧ菴ｿ逕ｨ
 */
export async function authenticateUser(request) {
  console.log("白 Server: authenticateUser called");

  const token = extractBearerToken(request);
  console.log("白 Server: Token extracted:", !!token);
  console.log("白 Server: Token preview:", token?.substring(0, 30) + "...");

  if (!token) {
    console.log("笶・Server: No token provided");
    throw new Error("Unauthorized - No token provided");
  }

  const payload = verifyAccessToken(token);
  console.log("白 Server: Token verification result:", !!payload);
  console.log("白 Server: Payload:", payload);

  if (!payload) {
    console.log("笶・Server: Invalid or expired token");
    throw new Error("Unauthorized - Invalid or expired token");
  }

  // legacy web 縺ｧ縺ｯDB縺檎┌縺・・縺ｧ縲｝ayload 縺九ｉ謫ｬ莨ｼ繝ｦ繝ｼ繧ｶ繝ｼ繧堤ｵ・∩遶九※繧・
  // 譛溷ｾ・ payload.userId・医↑縺代ｌ縺ｰ payload.sub 遲峨↓繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ・・
  const id = payload.userId ?? payload.sub ?? payload.uid ?? "dev";
  const email = payload.email ?? `${id}@local.dev`;

  const user = {
    id,
    email,
    // 蠢・ｦ√↑繧蛾←螳懆ｶｳ縺・
    // name: payload.name,
    // roles: payload.roles,
  };

  console.log("笨・Server: User authenticated (no DB):", user.email);
  return user;
}

