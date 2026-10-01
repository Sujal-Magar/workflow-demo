import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

import { BACK_TO_SIGN_IN_BUTTON, RESET_LINK_INVALID } from "../lib/auth-copy";

export function InvalidResetLink() {
  return (
    <div className="flex flex-col items-center text-center">
      <p role="alert" className="text-[15px] leading-6 text-slate-600">
        {RESET_LINK_INVALID}
      </p>
      <Link href="/auth" className={buttonVariants({ variant: "primary", className: "mt-6" })}>
        {BACK_TO_SIGN_IN_BUTTON}
      </Link>
    </div>
  );
}
