import { cn } from "@/lib/cn";

interface FormAlertProps {
  message: string;
  className?: string;
}

export function FormAlert({ message, className }: FormAlertProps) {
  return (
    <div
      role="alert"
      className={cn("w-full rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700", className)}
    >
      {message}
    </div>
  );
}
