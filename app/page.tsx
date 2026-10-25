import { getChatGPTUser } from "./chatgpt-auth";
import GuardianApp from "./guardian-app";

export default async function Home() {
  const user = await getChatGPTUser();
  return <GuardianApp displayName={user?.displayName ?? "Antoni"} />;
}
