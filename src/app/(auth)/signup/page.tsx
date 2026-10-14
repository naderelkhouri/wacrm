"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  MessageSquare,
  CheckCircle,
  UsersRound,
  Lock,
  MailCheck,
  Loader2,
  KeyRound,
} from "lucide-react";

// `useSearchParams` opts the component out of static prerendering
// unless wrapped in Suspense — same pattern as /login.
export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupPageInner />
    </Suspense>
  );
}

function SignupPageInner() {
  const searchParams = useSearchParams();
  // When the user lands here from `/join/<token>` we carry the
  // invite token in the query so it survives the signup → email
  // verification → redirect round-trip. `emailRedirectTo` below
  // points back at /join/<token> so the user lands on the redeem
  // step after verifying instead of being dropped on /dashboard.
  const inviteToken = searchParams.get("invite");

  const [checkingMode, setCheckingMode] = useState(true);
  const [signupMode, setSignupMode] = useState<"open" | "invite_only" | "closed">("open");
  const [isInviteValid, setIsInviteValid] = useState<boolean>(false);
  const [manualInviteInput, setManualInviteInput] = useState("");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    let active = true;
    async function checkSignupStatus() {
      setCheckingMode(true);
      try {
        const query = inviteToken
          ? `?invite=${encodeURIComponent(inviteToken)}`
          : "";
        const res = await fetch(`/api/auth/signup-mode${query}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Could not check signup mode");
        const data = await res.json();
        if (active) {
          setSignupMode(data.mode ?? "open");
          setIsInviteValid(Boolean(data.invite?.valid));
        }
      } catch {
        if (active) {
          setSignupMode("open");
        }
      } finally {
        if (active) {
          setCheckingMode(false);
        }
      }
    }

    checkSignupStatus();
    return () => {
      active = false;
    };
  }, [inviteToken]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    // If we have an invite token, point Supabase's verification
    // email back at the join page so the user can accept after
    // verifying. Without a token, Supabase uses its default
    // redirect (the app root).
    const emailRedirectTo = inviteToken
      ? `${window.location.origin}/join/${encodeURIComponent(inviteToken)}`
      : undefined;

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            invite_token: inviteToken || undefined,
          },
          ...(emailRedirectTo ? { emailRedirectTo } : {}),
        },
      });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      // If auto-confirmed (session issued immediately), redirect straight to app
      if (data?.session) {
        const destination = inviteToken
          ? `/join/${encodeURIComponent(inviteToken)}`
          : "/dashboard";
        window.location.href = destination;
        return;
      }

      setSuccess(true);
    } catch (err: unknown) {
      console.error("[Signup error]:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create account. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  if (checkingMode) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // State: Signups Closed
  if (signupMode === "closed") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md border-border bg-card">
          <CardHeader className="items-center text-center">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10">
              <Lock className="h-6 w-6 text-red-400" />
            </div>
            <CardTitle className="text-xl text-foreground">
              Cadastros Temporariamente Pausados
            </CardTitle>
            <CardDescription className="text-muted-foreground text-center">
              A criação de novas contas e perfis está temporariamente desativada no WACRM. Entre em contato com o suporte ou acesse sua conta existente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link href="/login">
              <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                Voltar para o Login
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // State: Invite Only and no valid invite token provided
  if (signupMode === "invite_only" && !isInviteValid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md border-border bg-card">
          <CardHeader className="items-center text-center">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <MailCheck className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-xl text-foreground">
              Acesso Exclusivo por Convite
            </CardTitle>
            <CardDescription className="text-muted-foreground text-center">
              A criação de novas contas está disponível apenas para usuários convidados por uma organização existente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="manualToken" className="text-xs text-muted-foreground">
                Possui um código ou link de convite?
              </Label>
              <div className="flex gap-2">
                <Input
                  id="manualToken"
                  placeholder="Cole o código do convite aqui..."
                  value={manualInviteInput}
                  onChange={(e) => setManualInviteInput(e.target.value)}
                  className="border-border bg-muted text-foreground placeholder:text-muted-foreground"
                />
                <Button
                  onClick={() => {
                    const token = manualInviteInput.trim();
                    if (token) {
                      window.location.href = `/signup?invite=${encodeURIComponent(token)}`;
                    }
                  }}
                  disabled={!manualInviteInput.trim()}
                  className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <KeyRound className="size-4 mr-1" />
                  Validar
                </Button>
              </div>
            </div>

            <div className="pt-2 text-center text-sm text-muted-foreground">
              Já possui uma conta?{" "}
              <Link href="/login" className="text-primary hover:text-primary/80 font-medium">
                Entrar
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // State: Success screen after registration
  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md border-border bg-card">
          <CardHeader className="items-center text-center">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <CheckCircle className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-xl text-foreground">
              Check your email
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              We&apos;ve sent a confirmation link to{" "}
              <span className="text-foreground">{email}</span>. Please check your
              inbox and click the link to verify your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href={
                inviteToken
                  ? `/login?invite=${encodeURIComponent(inviteToken)}`
                  : "/login"
              }
            >
              <Button
                variant="outline"
                className="w-full border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Back to sign in
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Standard registration form (either open mode, or valid invite)
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-border bg-card">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            {inviteToken ? (
              <UsersRound className="h-6 w-6 text-primary" />
            ) : (
              <MessageSquare className="h-6 w-6 text-primary" />
            )}
          </div>
          <CardTitle className="text-xl text-foreground">
            {inviteToken ? "Create account & join" : "Create account"}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {inviteToken
              ? "Verify your email, then accept the invitation to join your team."
              : "Get started with CRM Template for WhatsApp"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="flex flex-col gap-4">
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="fullName" className="text-muted-foreground">
                Full name
              </Label>
              <Input
                id="fullName"
                type="text"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="border-border bg-muted text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/20"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="email" className="text-muted-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="border-border bg-muted text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/20"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="password" className="text-muted-foreground">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="border-border bg-muted text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/20"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="confirmPassword" className="text-muted-foreground">
                Confirm password
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Repeat your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="border-border bg-muted text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/20"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="mt-2 h-10 w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? "Creating account..." : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href={
                inviteToken
                  ? `/login?invite=${encodeURIComponent(inviteToken)}`
                  : "/login"
              }
              className="text-primary hover:text-primary/80"
            >
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
