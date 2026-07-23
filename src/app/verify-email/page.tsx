import Link from "next/link";
import { verifyEmailToken, InvalidTokenError } from "@/lib/account-verification";

// Known minor quirk: refreshing this page after a successful verification
// re-submits the same (now-cleared) token and shows "invalid," even though
// the account is actually verified. Distinguishing "already used
// successfully" from "genuinely invalid" would need tracking used tokens
// separately rather than clearing them on use — not worth the extra schema
// field for something this low-stakes (worst case, a confusing refresh; the
// account is still verified either way).
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  let result: "success" | "invalid" | "missing" = "missing";
  if (token) {
    try {
      await verifyEmailToken(token);
      result = "success";
    } catch (err) {
      if (err instanceof InvalidTokenError) {
        result = "invalid";
      } else {
        throw err;
      }
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16 w-full text-center">
      {result === "success" && (
        <>
          <p className="text-4xl mb-3">✅</p>
          <h1 className="text-xl font-semibold mb-1">Email verified</h1>
          <p className="text-sm text-gray-500 mb-6">You&apos;re all set.</p>
        </>
      )}
      {result === "invalid" && (
        <>
          <p className="text-4xl mb-3">⚠️</p>
          <h1 className="text-xl font-semibold mb-1">This link isn&apos;t valid</h1>
          <p className="text-sm text-gray-500 mb-6">
            It may have expired, or already been used. Log in and request a new one from your account.
          </p>
        </>
      )}
      {result === "missing" && (
        <>
          <p className="text-4xl mb-3">⚠️</p>
          <h1 className="text-xl font-semibold mb-1">Missing verification link</h1>
          <p className="text-sm text-gray-500 mb-6">Use the link from your verification email.</p>
        </>
      )}
      <Link href="/" className="text-sm text-orange-600">
        Back home
      </Link>
    </main>
  );
}
