import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Mail,
  ArrowRight,
  CheckCircle,
  ArrowLeft,
  KeyRound,
  Lock,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/api";

export const ForgotPassword = () => {
  const [step, setStep] = useState(1); // 1: email, 2: otp, 3: new password
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpToken, setOtpToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorState, setErrorState] = useState("");
  const [timer, setTimer] = useState(0);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Timer effect for OTP resend
  useEffect(() => {
    if (timer === 0) return;
    const interval = setInterval(() => {
      setTimer((t) => t - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorState("");

    try {
      const data = await api.auth.forgotPassword(email);
      setOtpToken(data.otpToken);
      setStep(2);
      setTimer(60);
      toast("OTP sent to your email successfully", { type: "success" });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to send OTP";
      setErrorState(msg);
      toast(msg, { type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorState("");

    try {
      await api.auth.verifyResetOTP(otpToken, otp);
      setStep(3);
      toast("OTP verified successfully", { type: "success" });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Invalid OTP";
      setErrorState(msg);
      toast(msg, { type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      setErrorState("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      setErrorState("Password must be at least 6 characters");
      return;
    }

    setIsLoading(true);
    setErrorState("");

    try {
      await api.auth.resetPassword(otpToken, otp, newPassword, confirmPassword);
      toast("Password reset successfully!", { type: "success" });
      navigate("/login");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to reset password";
      setErrorState(msg);
      toast(msg, { type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setIsLoading(true);
    setErrorState("");

    try {
      const data = await api.auth.forgotPassword(email);
      setOtpToken(data.otpToken);
      setTimer(60);
      toast("OTP sent again to your email", { type: "success" });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to resend OTP";
      setErrorState(msg);
      toast(msg, { type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangeEmail = () => {
    setStep(1);
    setOtp("");
    setOtpToken("");
    setNewPassword("");
    setConfirmPassword("");
    setTimer(0);
    setErrorState("");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="bg-blue-100 p-3 rounded-full text-blue-600 mb-4">
            <KeyRound size={32} />
          </div>
        </div>
        <h2 className="text-center text-3xl font-extrabold text-gray-900 font-display">
          Forgot Password?
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600 max-w-xs mx-auto">
          {step === 1
            ? "Enter your email to reset your password"
            : step === 2
            ? "Enter the OTP sent to your email"
            : "Enter your new password"
          }
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl shadow-gray-200/50 sm:rounded-2xl sm:px-10 border border-gray-100">
          {/* Step 1: Enter Email */}
          {step === 1 && (
            <form className="space-y-6" onSubmit={handleSendOTP}>
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-bold text-gray-700 mb-1"
                >
                  Email address
                </label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-xl py-3 border outline-none transition-all"
                    placeholder="Enter your email"
                  />
                </div>
                {errorState && (
                  <p className="mt-2 text-sm text-red-600">{errorState}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-slate-900 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all disabled:opacity-70 hover:shadow-lg"
              >
                {isLoading ? "Sending OTP..." : "Send Reset OTP"}{" "}
                <ArrowRight className="ml-2 h-4 w-4" />
              </button>
            </form>
          )}

          {/* Step 2: Enter OTP Only */}
          {step === 2 && (
            <form className="space-y-6" onSubmit={handleVerifyOTP}>
              <div>
                <label
                  htmlFor="otp"
                  className="block text-sm font-bold text-gray-700 mb-1"
                >
                  OTP Code
                </label>
                <input
                  id="otp"
                  name="otp"
                  type="text"
                  required
                  value={otp}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  className="focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-xl py-3 border outline-none transition-all text-center tracking-widest"
                  placeholder="000000"
                />
              </div>

              {errorState && (
                <p className="mt-2 text-sm text-red-600">{errorState}</p>
              )}

              <button
                type="submit"
                disabled={isLoading || otp.length !== 6}
                className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all disabled:opacity-70 hover:shadow-lg"
              >
                {isLoading ? "Verifying..." : "Verify OTP"}{" "}
                <CheckCircle className="ml-2 h-4 w-4" />
              </button>

              <div className="flex justify-between items-center">
                <button
                  type="button"
                  onClick={handleChangeEmail}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Change Email
                </button>
                <button
                  type="button"
                  disabled={timer > 0}
                  onClick={handleResendOTP}
                  className="text-sm text-blue-600 hover:underline disabled:opacity-50"
                >
                  {timer > 0 ? `Resend in ${Math.floor(timer / 60)}:${(timer % 60).toString().padStart(2, '0')}` : "Resend OTP"}
                </button>
              </div>
            </form>
          )}

          {/* Step 3: Enter New Password */}
          {step === 3 && (
            <form className="space-y-6" onSubmit={handleResetPassword}>
              <div>
                <label
                  htmlFor="newPassword"
                  className="block text-sm font-bold text-gray-700 mb-1"
                >
                  New Password
                </label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-xl py-3 border outline-none transition-all"
                    placeholder="Enter new password"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-bold text-gray-700 mb-1"
                >
                  Confirm Password
                </label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-xl py-3 border outline-none transition-all"
                    placeholder="Confirm new password"
                  />
                </div>
              </div>

              {errorState && (
                <p className="mt-2 text-sm text-red-600">{errorState}</p>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all disabled:opacity-70 hover:shadow-lg"
              >
                {isLoading ? "Resetting..." : "Reset Password"}{" "}
                <CheckCircle className="ml-2 h-4 w-4" />
              </button>

              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Back to OTP
                </button>
              </div>
            </form>
          )}

          <div className="mt-6">
            <Link
              to="/login"
              className="flex items-center justify-center text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft size={16} className="mr-2" /> Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
