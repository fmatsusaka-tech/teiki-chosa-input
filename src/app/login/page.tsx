"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch("/api/pilot-login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = await response.json() as { message?: string };
      if (!response.ok) {
        setMessage(result.message ?? "ログインできませんでした。");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setMessage("通信できませんでした。少し待ってから再度お試しください。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <form className="login-card" onSubmit={handleSubmit}>
        <p className="eyebrow">LIMITED PILOT</p>
        <h1>ログイン</h1>
        <p className="lead">共有されたパスワードを入力してください。</p>
        <label className="login-field">
          <span>パスワード</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            autoFocus
            required
          />
        </label>
        {message && <p className="login-error" role="alert">{message}</p>}
        <button className="primary-action" type="submit" disabled={submitting}>
          {submitting ? "確認中…" : "ログイン"}
        </button>
      </form>
    </main>
  );
}
