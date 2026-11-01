import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { handleProjectsRequest } from "../../../lib/projects-api.mjs";

export const dynamic = "force-dynamic";

async function handle(request: Request) {
  const user = await getChatGPTUser();
  return handleProjectsRequest(request, env, user);
}

export { handle as GET, handle as POST, handle as PUT, handle as DELETE };
