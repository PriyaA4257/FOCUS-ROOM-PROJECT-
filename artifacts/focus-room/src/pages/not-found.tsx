import { Link } from "wouter";
import { Button } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground">
      <h1 className="text-6xl font-display font-bold mb-4 text-white">404</h1>
      <p className="text-xl text-muted-foreground mb-8">This page got lost in deep work.</p>
      <Link href="/">
        <Button>Return Home</Button>
      </Link>
    </div>
  );
}
