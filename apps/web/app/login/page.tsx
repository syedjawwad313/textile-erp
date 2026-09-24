"use client";

import React, { useState } from "react";
import { useAuth } from "../../lib/auth/auth-context";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Alert } from "../../components/ui/alert";
import { Boxes, ShieldCheck, ArrowRight, KeyRound, Building2 } from "lucide-react";

export default function LoginPage() {
  const { login, register, isLoading } = useAuth();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [tenantId, setTenantId] = useState("demo-tenant-1");
  const [email, setEmail] = useState("admin@acmetextiles.com");
  const [password, setPassword] = useState("AdminPassword123!");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleDemoFill = () => {
    setTenantId("demo-tenant-1");
    setEmail("admin@acmetextiles.com");
    setPassword("AdminPassword123!");
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!tenantId.trim()) {
      setErrorMessage("Tenant identifier is required.");
      return;
    }
    if (!email.trim()) {
      setErrorMessage("Email address is required.");
      return;
    }
    if (!password) {
      setErrorMessage("Password is required.");
      return;
    }

    try {
      if (mode === "login") {
        await login(tenantId.trim(), email.trim(), password);
      } else {
        if (!firstName.trim() || !lastName.trim()) {
          setErrorMessage("First and last name are required for registration.");
          return;
        }
        await register(
          tenantId.trim(),
          email.trim(),
          password,
          firstName.trim(),
          lastName.trim()
        );
      }
    } catch (err: any) {
      setErrorMessage(
        err?.message || "Authentication failed. Please verify your credentials."
      );
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-900 text-slate-100 items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 text-white font-bold shadow-lg shadow-blue-900/50 mb-3">
            <Boxes className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white uppercase">
            Textile & Apparel ERP / MES
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Enterprise Commercial & Manufacturing Operations Platform
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xl p-6 sm:p-8 text-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {mode === "login" ? "Account Sign In" : "Register Personnel"}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {mode === "login"
                  ? "Access your assigned factory and ERP modules"
                  : "Create an authorized user within a tenant"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setErrorMessage(null);
              }}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
            >
              {mode === "login" ? "Register" : "Sign In"}
            </button>
          </div>

          {errorMessage && (
            <div className="mb-4">
              <Alert variant="danger" title="Authentication Error">
                {errorMessage}
              </Alert>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Tenant ID"
              placeholder="e.g. demo-tenant-1"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              required
              helperText="Multi-tenant workspace partition"
            />

            {mode === "register" && (
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="First Name"
                  placeholder="e.g. Admin"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
                <Input
                  label="Last Name"
                  placeholder="e.g. User"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
            )}

            <Input
              label="Work Email"
              type="email"
              placeholder="e.g. admin@acmetextiles.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <Button
              type="submit"
              variant="secondary"
              size="lg"
              className="w-full mt-2"
              isLoading={isLoading}
            >
              {mode === "login" ? (
                <>
                  <span>Sign In to System</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              ) : (
                <>
                  <span>Complete Registration</span>
                  <ShieldCheck className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          </form>

          {/* Quick Demo Autofill */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                Quick Access (Demo Seed):
              </span>
              <button
                type="button"
                onClick={handleDemoFill}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <KeyRound className="w-3 h-3" />
                Auto-fill Admin
              </button>
            </div>
            <div className="bg-slate-50 p-2.5 rounded border border-slate-200 text-[11px] text-slate-600 font-mono">
              Tenant: <span className="text-slate-900 font-semibold">demo-tenant-1</span> | User:{" "}
              <span className="text-slate-900 font-semibold">admin@acmetextiles.com</span>
            </div>
          </div>
        </div>

        {/* Secure Banner */}
        <div className="flex items-center justify-center gap-2 text-center text-xs text-slate-400 mt-6">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Strict Tenant Isolation & Role-Based Access Control Enforced</span>
        </div>
      </div>
    </div>
  );
}
