import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center">
      <div className="text-8xl mb-6">🎾</div>
      <h1 className="text-4xl font-bold text-gradient-primary mb-2">404</h1>
      <p className="text-xl text-muted-foreground mb-8">This court doesn't exist</p>
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => window.history.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Go Back
        </Button>
        <Link to="/">
          <Button className="bg-gradient-primary hover:opacity-90">
            <Home className="mr-2 h-4 w-4" />
            Home
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
