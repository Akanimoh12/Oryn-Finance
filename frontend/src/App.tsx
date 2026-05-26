import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WalletProvider } from "@/contexts/WalletContext";
import { WebSocketProvider } from "@/contexts/WebSocketContext";
import LandingPage from "./pages/LandingPage";
import Markets from "./pages/Markets";
import MarketDetail from "./pages/MarketDetail";
import CreateMarket from "./pages/CreateMarket";
import Leaderboard from "./pages/Leaderboard";
import Portfolio from "./pages/Portfolio";
import Analytics from "./pages/Analytics";
import Governance from "./pages/Governance";
import HowItWorks from "./pages/HowItWorks";
import About from "./pages/About";
import NotFound from "./pages/NotFound";
import { Toaster as HotToaster } from "react-hot-toast";
import SmoothScroll from "@/components/SmoothScroll";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import TradeDetail from "./pages/TradeDetail";
import LiquidityPools from "./pages/LiquidityPools";
import AdminDashboard from "./pages/AdminDashboard";
import IntegrationTest from "./components/IntegrationTest";
import { RabetWalletTest } from "./components/RabetWalletTest";
import { OfflineBanner } from "@/components/OfflineBanner";
import { useOffline } from "@/hooks/useOffline";

const queryClient = new QueryClient();

function AppShell() {
  const isOffline = useOffline();
  return (
    <>
      {isOffline && <OfflineBanner />}
      <Toaster />
      <Sonner />
      <HotToaster />
      <SmoothScroll />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/landingpage" element={<LandingPage />} />
          <Route path="/markets" element={<Markets />} />
          <Route path="/market/:id" element={<MarketDetail />} />
          <Route path="/create" element={<CreateMarket />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/governance" element={<Governance />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/about" element={<About />} />
          <Route path="/integration-test" element={<IntegrationTest />} />
          <Route path="/rabet-test" element={<RabetWalletTest />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <WalletProvider>
      <WebSocketProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <HotToaster />
          <SmoothScroll />
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/landingpage" element={<LandingPage />} />
              <Route path="/markets" element={<Markets />} />
              <Route path="/market/:id" element={<MarketDetail />} />
              <Route path="/create" element={<CreateMarket />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/portfolio" element={<Portfolio />} />
              <Route path="/trade/:tradeId" element={<TradeDetail />} />
              <Route path="/liquidity" element={<LiquidityPools />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/governance" element={<Governance />} />
              <Route path="/how-it-works" element={<HowItWorks />} />
              <Route path="/about" element={<About />} />
              <Route path="/integration-test" element={<IntegrationTest />} />
              <Route path="/rabet-test" element={<RabetWalletTest />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </WebSocketProvider>
    </WalletProvider>
  </QueryClientProvider>
);

export default App;
