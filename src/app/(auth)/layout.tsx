import { PwaInstallBanner } from "@/components/pwa-install-banner";
import { MobileAppBanner } from "@/components/mobile-app-banner";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <PwaInstallBanner />
      <MobileAppBanner />
    </>
  );
}
