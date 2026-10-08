import { cookies } from "next/headers";
import Onboarding from "./onboarding";

export default async function Home() {
  const restoreSession = Boolean((await cookies()).get("scaler_session")?.value);
  return <Onboarding restoreSession={restoreSession} />;
}
