import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { PlayerProvider } from "@/contexts/PlayerContext";

// Pages
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Join from "./pages/Join";
import Home from "./pages/Home";
import Matches from "./pages/Matches";
import Leaderboard from "./pages/Leaderboard";

import AuctionHouse from "./pages/AuctionHouse";
import AuctionLive from "./pages/Auction";
import LotDetail from "./pages/LotDetail";
import PledgeDetail from "./pages/PledgeDetail";
import Pledges from "./pages/Pledges";
import CompleteEntry from "./pages/CompleteEntry";
import PlayerProfile from "./pages/PlayerProfile";
import NotFound from "./pages/NotFound";

// Admin Pages
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminTournamentCreate from "./pages/admin/AdminTournamentCreate";
import AdminTournamentDetail from "./pages/admin/AdminTournamentDetail";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <PlayerProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Lobby />} />
            <Route path="/lobby" element={<Lobby />} />
            <Route path="/landing" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/join" element={<Join />} />
            
            <Route path="/complete-entry" element={<CompleteEntry />} />
            
            {/* Player routes */}
            <Route path="/home" element={<Home />} />
            <Route path="/matches" element={<Matches />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            
            <Route path="/auction" element={<AuctionHouse />} />
            <Route path="/auction/live" element={<AuctionLive />} />
            <Route path="/auction/lot/:lotId" element={<LotDetail />} />
            <Route path="/auction/:pledgeId" element={<PledgeDetail />} />
            <Route path="/pledges" element={<Pledges />} />
            <Route path="/player/:playerId" element={<PlayerProfile />} />
            
            {/* Admin routes */}
            <Route path="/admin" element={<AdminLogin />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/tournaments/new" element={<AdminTournamentCreate />} />
            <Route path="/admin/tournaments/:tournamentId" element={<AdminTournamentDetail />} />
            
            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </PlayerProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
