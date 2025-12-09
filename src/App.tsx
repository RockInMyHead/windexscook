import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { UserProvider } from "@/contexts/UserContext";
import Index from "./pages/Index";
import MyRecipes from "./pages/MyRecipes";
import MyChef from "./pages/MyChef";
import Recipes from "./pages/Recipes";
import NotFound from "./pages/NotFound";
import Collaborations from "./pages/Collaborations";
import RecipeDetails from './pages/RecipeDetails';
import UserProfile from './pages/UserProfile';
import Settings from './pages/Settings';
import AdminPanel from './pages/AdminPanel';
import PaymentSuccess from './pages/PaymentSuccess';
import TermsOfService from './pages/TermsOfService';
import PrivacyPolicy from './pages/PrivacyPolicy';
import ResetPassword from './pages/ResetPassword';
import Premium from './pages/Premium';

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <UserProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/my-recipes" element={<MyRecipes />} />
            <Route path="/my-chef" element={<MyChef />} />
            <Route path="/recipes" element={<Recipes />} />
            <Route path="/recipes/:id" element={<RecipeDetails />} />
            <Route path="/collaborations" element={<Collaborations />} />
            <Route path="/profile" element={<UserProfile />} />
            <Route path="/settings/*" element={<Settings />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/payment-success" element={<PaymentSuccess />} />
            <Route path="/premium" element={<Premium />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </UserProvider>
  </QueryClientProvider>
);

export default App;
