import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <SignUp
        path="/sign-up"
        routing="path"
        fallbackRedirectUrl="/dashboard"
        signInUrl="/login"
      />
    </div>
  );
}
